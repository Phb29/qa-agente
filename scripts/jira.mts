#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { adf, adfSimples, adfPanel } from './lib/jira-adf.mts';
import { analiseMarkdown, cardsDaTela, descricaoMarkdown, etiquetasDoCard, lerEntrada, templateDeCasos, tituloDoCard } from './lib/card-tela.mts';
import { ErroJira, SITE, baseEmUso, buscar, resolverTipo, soltarResponsavel, tiposDoProjeto, anexar, anexosDe, authHeader, credenciaisOk, gravarDescricao, lerMarkdown, request, resumoAnexo, subirImagens } from './lib/jira-api.mts';

const PROJECT = process.env.JIRA_PROJECT_KEY || 'QA';
const DEFAULT_TYPE = process.env.JIRA_ISSUE_TYPE || 'Task';

function fail(msg) { console.error(`\n❌ ${msg}\n`); process.exit(1); }
if (!credenciaisOk) fail('Defina JIRA_EMAIL e JIRA_API_TOKEN em .env.');

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

// O tipo resolvido carrega o nome, porque é por ele que o create decide a etiqueta de defeito.
const resolveIssueType = (tipo, projeto = PROJECT) => resolverTipo(tipo, projeto);

async function cmdWhoami() {
  const r = await request('/rest/api/3/myself');
  if (!r.ok) fail(`Auth falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  console.log(`✅ Autenticado como: ${r.json.displayName} <${r.json.emailAddress ?? 'e-mail oculto'}>`);
  console.log(`   Base em uso: ${baseEmUso()}`);
}

async function cmdTypes(flags: Record<string, any> = {}) {
  const projeto = String(flags.projeto || PROJECT).toUpperCase();
  const types = await tiposDoProjeto(projeto);
  console.log(`\n🗂  Tipos de item validos no projeto ${projeto}:\n`);
  for (const t of types) console.log(`  id ${String(t.id).padEnd(8)} ${t.subtask ? '(subtarefa) ' : ''}${t.name}`);
  console.log('');
}

async function cmdSearch(flags) {
  const jql = flags._[0] || `project = ${PROJECT} ORDER BY created DESC`;
  const max = Number(flags.max || 50);
  const issues = await buscar(jql, { max });
  console.log(`\n🔎 ${issues.length} issue(s) para: ${jql}\n`);
  for (const it of issues) console.log(`  ${it.key.padEnd(10)} [${(it.fields?.status?.name || '?')}]  ${it.fields?.summary || ''}`);
  console.log('');
  return issues;
}

async function getMyAccountId() {
  const r = await request('/rest/api/3/myself');
  if (!r.ok) fail(`Não consegui identificar o usuário do token (HTTP ${r.status}).`);
  return r.json.accountId;
}

// Resolve accountId por nome/e-mail — pra --assign/--qas em create/comment sem caçar accountId na mão.
async function cmdWhois(flags) {
  const query = flags._[0];
  if (!query) fail('Uso: node scripts/jira.mts whois "<nome ou e-mail>"');
  const r = await request(`/rest/api/3/user/search?query=${encodeURIComponent(query)}`);
  if (!r.ok) fail(`Busca de usuário falhou (HTTP ${r.status}). ${r.text?.slice(0, 200) || ''}`);
  const users = r.json || [];
  if (!users.length) { console.log(`\n🔎 Nenhum usuário encontrado para "${query}".\n`); return []; }
  console.log(`\n🔎 ${users.length} usuário(s) para "${query}":\n`);
  for (const u of users) console.log(`  ${u.accountId}  ${u.displayName}  <${u.emailAddress || '?'}>`);
  console.log('');
  return users;
}

// Caminho "forward" do workflow QA, da entrada ao fechamento. As transições dependem do status atual,
// então caminhamos ETAPA POR ETAPA — nunca pulando um estágio do trilho, mesmo quando o board oferece
// o atalho (ex.: de Implementando direto a Finalizado, pulando a Versão). Status fora do trilho são
// desvios: só se chega neles pela UI. Comparado contra normStatus() ⇒ SEM acento ("VERSAO").
// A ordem abaixo é só um exemplo: defina a do SEU board no .env.
// Configurável no .env: JIRA_TRILHO=ANALISAR,ANALISANDO,... (a ordem dos status do SEU board).
const TRILHO = process.env.JIRA_TRILHO
  ? process.env.JIRA_TRILHO.split(',').map((s) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim())
  : ['ANALISAR', 'ANALISANDO', 'FILA DESENVOLVIMENTO', 'IMPLEMENTANDO', 'AGUARDANDO MERGE', 'VERSAO', 'FINALIZADO'];
// Campos customizados do Jira: cada empresa tem os seus IDs, então TODOS são opcionais e vêm do
// .env (ache o ID em Configurações do Jira → Campos, ou na URL do campo). Sem o ID, o recurso que
// depende do campo é simplesmente pulado.
// Categoria: alguns boards exigem um campo de categoria para o card andar no fluxo (validador
// escondido da transição, que devolve HTTP 400 sem dizer o porquê).
const CATEGORIA_FIELD = process.env.JIRA_CATEGORIA_FIELD || '';
const CATEGORIA_VALOR = process.env.JIRA_CATEGORIA_VALOR || '';
const comCategoria = () => (CATEGORIA_FIELD && CATEGORIA_VALOR ? { [CATEGORIA_FIELD]: { value: CATEGORIA_VALOR } } : {});
// Defeito aberto pela automação nasce SEMPRE com esta label — é por ela que o board filtra (§1.1).
// Label é campo nativo do Jira (não precisa de admin) e convive com a Categoria do Problema, que
// segue representando a ÁREA funcional do defeito.
const LABEL_BUG = process.env.JIRA_LABEL_BUG || 'bug-automacao';
// Tipo de ticket do defeito achado pela automação. Se o seu Jira tem um tipo de triagem, use-o: o
// defeito entra na fila de quem tria, e lá se decide se vira bug, ajuste ou nada. Sem triagem, "Bug".
const TIPO_DEFEITO = process.env.JIRA_TIPO_DEFEITO || 'triagem';
const QAS_FIELD = process.env.JIRA_QAS_FIELD || ''; // campo multiusuário "QAs" — quem está automatizando (opcional)
const normStatus = (s) => (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

async function transicionarPara(key, alvoNome) {
  const alvo = normStatus(alvoNome);
  const idxAlvo = TRILHO.indexOf(alvo);
  // Já está no status alvo? não faz nada (evita ⚠️ falso quando o card já está lá).
  const atual = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=status`);
  let corrente = atual.ok ? normStatus(atual.json.fields?.status?.name) : '';
  if (corrente === alvo) { console.log(`  = já em ${alvoNome}`); return true; }
  for (let hop = 0; hop < TRILHO.length + 1; hop++) {
    const t = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
    if (!t.ok) { console.error(`  ⚠️  não li as transições (HTTP ${t.status}) — status deixado como está.`); return false; }
    const trans = t.json.transitions || [];
    const idxCorrente = TRILHO.indexOf(corrente);
    // Alvo à frente no trilho: o próximo estágio manda, ainda que exista atalho direto — é o atalho
    // que pula a Versão e fecha o card sem ele passar pela release.
    const proximo = idxCorrente >= 0 && idxAlvo > idxCorrente
      ? trans.find((x) => normStatus(x.to?.name) === TRILHO[idxCorrente + 1])
      : null;
    const escolhido = proximo || trans.find((x) => normStatus(x.to?.name) === alvo);
    if (escolhido) {
      const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { method: 'POST', body: { transition: { id: escolhido.id } } });
      if (!r.ok && r.status !== 204) { console.error(`  ⚠️  passo p/ "${escolhido.to?.name}" falhou (HTTP ${r.status}).`); return false; }
      corrente = normStatus(escolhido.to?.name);
      if (corrente === alvo) { console.log(`  → ${alvoNome}`); return true; }
      console.log(`  ↪ ${escolhido.to?.name}`);
      continue;
    }
    // Alvo fora do trilho e sem transição direta: PARA. Caminhar o trilho às cegas hoje terminaria
    // em Finalizado — um alvo digitado errado fecharia o card.
    if (idxAlvo < 0) { console.error(`  ⚠️  "${alvoNome}" não está no trilho e não tem transição direta. Disponíveis: ${trans.map((x) => x.to?.name).join(', ')}`); return false; }
    const cands = trans
      .map((x) => ({ x, i: TRILHO.indexOf(normStatus(x.to?.name)) }))
      .filter((c) => c.i >= 0 && c.i <= idxAlvo && c.i > idxCorrente)
      .sort((a, b) => b.i - a.i);
    if (!cands.length) { console.error(`  ⚠️  sem transição do trilho p/ "${alvoNome}". Disponíveis: ${trans.map((x) => x.to?.name).join(', ')}`); return false; }
    const passo = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { method: 'POST', body: { transition: { id: cands[0].x.id } } });
    if (!passo.ok && passo.status !== 204) { console.error(`  ⚠️  passo p/ "${cands[0].x.to?.name}" falhou (HTTP ${passo.status}).`); return false; }
    corrente = normStatus(cands[0].x.to?.name);
    console.log(`  ↪ ${cands[0].x.to?.name}`);
  }
  console.error(`  ⚠️  não cheguei em "${alvoNome}" dentro do trilho.`);
  return false;
}

async function cmdCreate(flags) {
  const summary = flags._[0];
  if (!summary) fail('Informe o titulo: node scripts/jira.mts create "Titulo" --desc "..."');
  // Com --parent a issue nasce como SUBTAREFA do item pai (ramificações de um mesmo fluxo).
  // O tipo cai para "Subtarefa" por padrão porque "Teste Automatizado" não é um tipo de subtarefa.
  const type = flags.type || (flags.parent ? 'Subtarefa' : DEFAULT_TYPE);
  const labels = flags.labels ? String(flags.labels).split(',').map((s) => s.trim()).filter(Boolean) : [];
  // --projeto <CHAVE>: board de destino. Defeito NUNCA nasce no board QA — vai pro board do módulo.
  const projeto = String(flags.projeto || PROJECT).toUpperCase();
  const tipo = await resolveIssueType(type, projeto);
  // A regra olha o tipo RESOLVIDO, não o texto do --type: `--type 10021` é o mesmo Problema e escaparia.
  if ((tipo.nome || '').toLowerCase() === TIPO_DEFEITO && !labels.some((l) => l.toLowerCase() === LABEL_BUG)) labels.push(LABEL_BUG);
  const fields: Record<string, unknown> = { project: { key: projeto }, summary, issuetype: { id: tipo.id } };
  if (flags.parent) fields.parent = { key: String(flags.parent) };
  if (flags.desc || flags.description) fields.description = adf(flags.desc || flags.description);
  // --desc-arquivo: markdown completo, com prints. Imagem só sobe para ticket que já existe, então o
  // card nasce com a descrição sem as imagens (o print vira "📎 legenda") e ela é regravada com os
  // prints logo depois — se o upload falhar no meio, o card ao menos já tem o texto inteiro.
  const md = flags['desc-arquivo'] ? lerMarkdown(String(flags['desc-arquivo'])) : null;
  if (md) fields.description = md.doc;
  if (labels.length) fields.labels = labels;
  // --assign-me: responsável = dono do token (relator já é o criador por padrão = mesma pessoa).
  // Sem nenhum dos dois o card nasce SEM responsável (ver soltarResponsavel, mais abaixo).
  // --assign <accountId>: responsável = outra pessoa (achar o accountId com "whois").
  if (flags['assign-me']) fields.assignee = { accountId: await getMyAccountId() };
  else if (flags.assign) fields.assignee = { accountId: String(flags.assign) };
  // --qas <accountId[,accountId2,...]>: preenche o multiuserpicker "QAs" já na criação.
  if (flags.qas && QAS_FIELD) fields[QAS_FIELD] = String(flags.qas).split(',').map((id) => ({ accountId: id.trim() })).filter((u) => u.accountId);
  // Categoria já no nascimento (se o seu Jira usa): o --categoria troca o valor padrão do .env.
  if (CATEGORIA_FIELD && (flags.categoria || CATEGORIA_VALOR)) fields[CATEGORIA_FIELD] = { value: flags.categoria || CATEGORIA_VALOR };
  if (flags['dry-run']) {
    if (md) console.log(`\n🧪 ${md.imagens.length} imagem(ns) subiriam para a descrição: ${md.imagens.map((i) => i.ref).join(', ') || '—'}`);
    console.log('\n🧪 DRY-RUN:\n' + JSON.stringify({ fields, status: flags.status || null }, null, 2) + '\n');
    return;
  }
  const r = await request('/rest/api/3/issue', { method: 'POST', body: { fields } });
  // A recusa mais comum aqui é a Categoria: o valor tem que EXISTIR na lista do campo (só admin cria).
  if (!r.ok && r.status === 400 && CATEGORIA_FIELD && (/categoria/i.test(r.text || '') || (r.text || '').includes(CATEGORIA_FIELD))) {
    fail(`Criacao falhou (HTTP 400): a Categoria do Problema "${flags.categoria || CATEGORIA_VALOR}" nao existe na lista do projeto ${projeto}. Peca ao admin do Jira para incluir a opcao (escrita exata) antes de tentar de novo.`);
  }
  if (!r.ok) fail(`Criacao falhou (HTTP ${r.status}). ${r.text?.slice(0, 500) || ''}`);
    console.log(`\n✅ Tarefa criada: ${r.json.key}\n   ${SITE}/browse/${r.json.key}`);
  // Sem --assign-me/--assign o card é da FILA: o board o atribuiria a quem é dono do token.
  if (!flags['assign-me'] && !flags.assign) { await soltarResponsavel(r.json.key); console.log('   sem responsável — fica na fila.'); }
  if (md?.imagens.length) await gravarDescricao(r.json.key, md);
  // --status "Implementando": caminha o workflow até o status pedido (o card nasce já "em andamento").
  if (flags.status) await transicionarPara(r.json.key, String(flags.status));
  console.log('');
  return r.json;
}

// ADF → texto plano (pra ler a descrição do ticket: cenários em blocos, rota/tela).
function adfToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  const kids = (node.content || []).map(adfToText).join('');
  return node.type === 'paragraph' || node.type === 'listItem' ? kids + '\n' : kids;
}

async function cmdGet(flags) {
  const key = flags._[0];
  if (!key) fail('Informe a chave: node scripts/jira.mts get QA-123');
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,description,labels,status,issuetype${CASOS_FIELD ? ',' + CASOS_FIELD : ''}`);
  if (!r.ok) fail(`Get falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  const f = r.json.fields || {};
  console.log(`\n${key}  [${f.status?.name || '?'}]  (${f.issuetype?.name || ''})`);
  console.log(`Titulo: ${f.summary || ''}`);
  if (f.labels?.length) console.log(`Labels: ${f.labels.join(', ')}`);
  // Se o Jira tem um campo de casos de teste (JIRA_CASOS_FIELD), ele é a fonte principal dos cenários.
  if (CASOS_FIELD) {
    const template = adfToText(f[CASOS_FIELD]).trim();
    console.log(`\n📋 Casos de teste (FONTE PRINCIPAL — leia primeiro):\n${template || '(vazio)'}\n`);
  }
  const desc = adfToText(f.description).trim();
  console.log(`Descrição (o contexto de cada cenário — âncora, nível, o que validar, fonte — quando o card veio do mapeamento de tela):\n${desc || '(sem descrição)'}\n`);
  if (flags.comentarios) await imprimirConversa(key);
  return r.json;
}

// O ticket de teste manual se lê pelos comentários: é neles que o dev deixa o bloco [agente-teste]
// e que a rodada anterior do agente mora. Junto vão o responsável e PARA QUEM DEVOLVER — a regra
// mora aqui, e não num documento, porque é ela que decide em quem o ticket cai.
const DEV_RESPONSAVEL_FIELD = process.env.JIRA_DEV_RESPONSAVEL_FIELD || ''; // campo "Dev responsável pelo bug" (opcional)

/**
 * Para quem um ticket reprovado volta, na ordem:
 *  1. quem o implementou: o autor da última passagem por "Implementando" que durou 5 min ou mais;
 *     sem nenhuma assim, o da última passagem, de qualquer duração;
 *  2. o campo "Dev responsável pelo bug" (se configurado);
 *  3. quem o moveu por último para "Para Testar";
 *  4. o último responsável antes de ele ir para "Para Testar";
 *  5. o relator.
 * Em todos, não contam automação, a conta dona do token (é uma pessoa, que só dispara) nem a do
 * próprio agente — devolver para elas é devolver para ninguém. Um agente de IA que corrige bugs
 * com usuário comum conta: reprovado atribuído a ele cai na fila dele.
 */
// quirk: uma passagem instantânea por Implementando é triagem, não desenvolvimento — quem move dezenas
// de tickets em lote por Fila → Implementando → Para Testar no mesmo minuto não é quem os corrigiu.
// Por isso conta só a passagem de 5 min ou mais.
const IMPLEMENTOU_MIN_MS = 5 * 60_000;

async function quemRecebeDeVolta(issue) {
  const eu = await getMyAccountId();
  const valida = (u) => u && u.accountId !== eu && u.accountType !== 'app' &&
    !/automation for jira|agent tester/i.test(u.displayName || '');
  const historias = [...(issue.changelog?.histories || [])].sort((a, b) => b.created.localeCompare(a.created));
  const mudancasDeStatus = historias
    .flatMap((x) => (x.items || []).filter((i) => i.field === 'status').map((i) => ({ x, i })))
    .sort((a, b) => a.x.created.localeCompare(b.x.created));
  const passagens = [];
  mudancasDeStatus.forEach(({ x, i }, n) => {
    if (normStatus(i.toString) !== 'IMPLEMENTANDO') return;
    const saida = mudancasDeStatus.slice(n + 1).find(({ i: j }) => normStatus(j.fromString) === 'IMPLEMENTANDO');
    const ms = saida ? Date.parse(saida.x.created) - Date.parse(x.created) : Infinity;
    passagens.push({ autor: x.author, ms, quando: x.created });
  });
  const implementou = [...passagens].reverse().find((p) => p.ms >= IMPLEMENTOU_MIN_MS && valida(p.autor))
    ?? [...passagens].reverse().find((p) => valida(p.autor));
  if (implementou) {
    const min = Number.isFinite(implementou.ms) ? `${Math.round(implementou.ms / 60_000)} min` : 'ainda lá';
    return { pessoa: implementou.autor, regra: `implementou (Implementando em ${implementou.quando}, ${min})` };
  }
  const dev = DEV_RESPONSAVEL_FIELD ? issue.fields?.[DEV_RESPONSAVEL_FIELD] : null;
  if (valida(dev)) return { pessoa: dev, regra: 'campo "Dev responsável pelo BUG"' };
  const ida = historias.find((x) => (x.items || []).some((i) => i.field === 'status' && normStatus(i.toString) === 'PARA TESTAR') && valida(x.author));
  if (ida) return { pessoa: ida.author, regra: `moveu para "Para Testar" em ${ida.created}` };
  const quando = historias.find((x) => (x.items || []).some((i) => i.field === 'status' && normStatus(i.toString) === 'PARA TESTAR'))?.created;
  for (const x of historias.filter((h) => !quando || h.created <= quando)) {
    const troca = (x.items || []).find((i) => i.field === 'assignee' && i.to);
    if (!troca) continue;
    const r = await request(`/rest/api/3/user?accountId=${encodeURIComponent(troca.to)}`);
    if (r.ok && valida(r.json)) return { pessoa: r.json, regra: 'último responsável antes de "Para Testar"' };
  }
  if (valida(issue.fields?.reporter)) return { pessoa: issue.fields.reporter, regra: 'relator' };
  return null;
}

async function imprimirConversa(key) {
  const h = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=assignee,reporter${DEV_RESPONSAVEL_FIELD ? ',' + DEV_RESPONSAVEL_FIELD : ''}&expand=changelog`);
  if (h.ok) {
    const resp = h.json.fields?.assignee;
    console.log(`Responsável: ${resp ? `${resp.displayName} (${resp.accountId})` : '(ninguém)'}`);
    const volta = await quemRecebeDeVolta(h.json);
    console.log(volta
      ? `Devolver para: ${volta.pessoa.displayName} (${volta.pessoa.accountId}) — ${volta.regra}`
      : 'Devolver para: (ninguém achado — o ticket fica onde está e o comentário diz isso)');
  }
  const c = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/comment?orderBy=created&maxResults=100`);
  if (!c.ok) { console.error(`  ⚠️  não li os comentários (HTTP ${c.status}).`); return; }
  const comentarios = c.json.comments || [];
  console.log(`\n💬 ${comentarios.length} comentário(s), do mais antigo ao mais novo:`);
  for (const k of comentarios) {
    console.log(`\n── ${k.created} · ${k.author?.displayName} (${k.author?.accountId})`);
    console.log(adfToText(k.body).trim() || '(sem texto)');
  }
  console.log('');
}

// ─── Anexos ───────────────────────────────────────────────────────────────────────────────────
// Portado de manual/tools/jira-anexos.py, para os dois agentes subirem evidência pelo mesmo canal.

async function cmdAnexar(flags) {
  const [key, ...arquivos] = flags._;
  if (!key || !arquivos.length) fail('Uso: node scripts/jira.mts anexar QA-123 <arquivo> [<arquivo> ...]');
  if (flags['dry-run']) { console.log(`\n🧪 DRY-RUN anexar em ${key}: ${arquivos.join(', ')}\n`); return; }
  const saida = [];
  for (const a of arquivos) saida.push(...(await anexar(key, a)));
  console.log(JSON.stringify(saida, null, 2));
}

async function cmdAnexos(flags) {
  const key = flags._[0];
  if (!key) fail('Uso: node scripts/jira.mts anexos QA-123');
  console.log(JSON.stringify((await anexosDe(key)).map(resumoAnexo), null, 2));
}

async function cmdBaixar(flags) {
  const [key, destino] = flags._;
  const tipo = flags.tipo || 'todos';
  if (!key || !destino) fail('Uso: node scripts/jira.mts baixar QA-123 <pasta> [--tipo video|imagem|todos]');
  fs.mkdirSync(destino, { recursive: true });
  const saida = [];
  for (const a of await anexosDe(key)) {
    const item = resumoAnexo(a);
    if (tipo !== 'todos' && item.tipo !== tipo) continue;
    // nota: o fetch segue o 303 até a Media API e larga o Authorization na troca de origem — a URL de lá já vem assinada
    const res = await fetch(a.content, { headers: { Authorization: authHeader } });
    if (!res.ok) fail(`Download de ${a.filename} falhou (HTTP ${res.status}).`);
    const caminho = path.join(destino, `${a.id}-${path.basename(a.filename)}`);
    fs.writeFileSync(caminho, Buffer.from(await res.arrayBuffer()));
    saida.push({ ...item, salvoEm: caminho.split(path.sep).join('/') });
  }
  console.log(JSON.stringify(saida, null, 2));
}

// Duas formas, e a diferença é de propósito:
//   comment QA-1 "texto"           uma linha = um parágrafo, como sempre foi (worker e skills antigas)
//   comment QA-1 --arquivo c.md    markdown completo (ver scripts/lib/jira-adf.mts): painel, status,
//                                  expand, tabela e imagem; as imagens locais sobem como anexo antes
async function cmdComment(flags) {
  const key = flags._[0];
  if (flags.arquivo) return comentarDeArquivo(key, String(flags.arquivo), flags);
  const text = flags._[1];
  if (!key || !text) fail('Uso: node scripts/jira.mts comment QA-123 "texto do comentario" [--panel success|info|note|warning|error]  ·  comment QA-123 --arquivo comentario.md [--dry-run]');
  const body = flags.panel ? adfPanel(String(flags.panel), text) : adfSimples(text);
  if (flags['dry-run']) { console.log(`\n🧪 DRY-RUN comment em ${key}${flags.panel ? ` (panel:${flags.panel})` : ''}:\n${text}\n`); return; }
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { method: 'POST', body: { body } });
  if (!r.ok) fail(`Comentario falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  console.log(`\n✅ Comentario adicionado em ${key}.\n`);
  return r.json;
}

async function comentarDeArquivo(key, arquivo, flags) {
  if (!key) fail('Uso: node scripts/jira.mts comment QA-123 --arquivo comentario.md [--dry-run]');
  const md = lerMarkdown(arquivo);
  if (flags['dry-run']) {
    console.log(`\n🧪 DRY-RUN comment em ${key} — ${md.imagens.length} imagem(ns) subiriam: ${md.imagens.map((i) => i.ref).join(', ') || '—'}\n`);
    console.log(JSON.stringify(md.doc, null, 2));
    return;
  }
  const body = adf(md.texto, await subirImagens(key, md.imagens));
  // --editar <id>: regrava um comentário que já existe (ex.: trocar os prints pelos vídeos) em vez de somar outro
  const editar = flags.editar ? `/${encodeURIComponent(String(flags.editar))}` : '';
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/comment${editar}`, { method: editar ? 'PUT' : 'POST', body: { body } });
  if (!r.ok) fail(`Comentario falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  console.log(`\n✅ Comentario ${editar ? 'regravado' : 'adicionado'} em ${key}${md.imagens.length ? ` com ${md.imagens.length} imagem(ns)/vídeo(s)` : ''}.\n`);
  return r.json;
}

// Regrava a descrição INTEIRA de um ticket que já existe — não acrescenta, substitui.
async function cmdDescricao(flags) {
  const key = flags._[0];
  if (!key || !flags.arquivo) fail('Uso: node scripts/jira.mts descricao QA-123 --arquivo descricao.md [--dry-run]  (substitui a descrição inteira)');
  const md = lerMarkdown(String(flags.arquivo));
  if (flags['dry-run']) {
    console.log(`\n🧪 DRY-RUN descricao de ${key} (SUBSTITUI a atual) — ${md.imagens.length} imagem(ns) subiriam\n`);
    console.log(JSON.stringify(md.doc, null, 2));
    return;
  }
  await gravarDescricao(key, md);
}

// Card de automação de UMA tela (vindo de um mapeamento de tela), em dois modos:
//   card-tela x.json              CRIA o card da tela, já na Fila desenvolvimento com pronto-pro-agente
//   card-tela x.json --card QA-1  ANALISA um card que já existe (veio de produto): comenta o veredito
//                                 por cenário e move o card — viável para a Fila, inviável fica em Analisar
// A skill decide tudo — cenários, âncoras, níveis, o que fica de fora — e entrega no JSON; aqui só se
// garante o que não pode depender de o agente lembrar.
const ETIQUETA_PRONTO = 'pronto-pro-agente';
const ETIQUETA_ANALISADO = 'ia-analisou';

async function etiquetar(key, etiquetas) {
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { update: { labels: etiquetas.map((e) => ({ add: e })) } } });
  if (!r.ok && r.status !== 204) fail(`Etiquetar ${key} falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
}

// quirk: em alguns boards, sair de Analisando exige a categoria (validador escondido da transição) — card sem ela empaca a caminho da Fila com um 400 que não diz o porquê
async function mandarParaFila(key) {
  if (CATEGORIA_FIELD && CATEGORIA_VALOR) {
    const atual = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${CATEGORIA_FIELD}`);
    if (atual.ok && !atual.json.fields?.[CATEGORIA_FIELD]) {
      await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: comCategoria() } });
    }
  }
  if (!(await transicionarPara(key, 'Fila desenvolvimento'))) fail(`${key} não chegou à Fila desenvolvimento — mova à mão e confira a transição.`);
  await etiquetar(key, [ETIQUETA_PRONTO]);
}

async function cmdCardTela(flags) {
  const arquivo = flags._[0];
  if (!arquivo) fail('Uso: node scripts/jira.mts card-tela tela-cenarios.json [--card QA-123] [--preview | --markdown x.md | --dry-run | --force]');
  if (!fs.existsSync(arquivo)) fail(`JSON não encontrado: ${arquivo}`);
  const analise = flags.card ? String(flags.card) : null;
  const { erros, entrada } = lerEntrada(JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(String.fromCharCode(65279), '')), { analise: Boolean(analise) });
  if (erros.length) fail(`a triagem está incompleta:\n  - ${erros.join('\n  - ')}`);
  const markdown = analise ? analiseMarkdown(entrada) : descricaoMarkdown(entrada);
  const viavel = entrada.cenarios.length > 0;
  console.log(`\n🗺️  ${analise ? `Análise de ${analise}` : tituloDoCard(entrada)} · ${entrada.cenarios.length} cenário(s) para automatizar, ${entrada.descartados.length} fora, ${entrada.regras.length} regra(s) a validar`);
  if (flags.preview) { console.log(`\n${markdown}`); return; }
  if (flags.markdown) { fs.writeFileSync(String(flags.markdown), markdown); console.log(`📝 texto gravado em ${flags.markdown} (nada no Jira)`); return; }

  if (analise) {
    if (flags['dry-run']) { console.log(`🧪 DRY-RUN: comentaria a análise em ${analise} e ${viavel ? `o mandaria para a Fila com ${ETIQUETA_PRONTO}` : `o deixaria em Analisar com ${ETIQUETA_ANALISADO}`}.\n`); return; }
    const c = await request(`/rest/api/3/issue/${encodeURIComponent(analise)}/comment`, { method: 'POST', body: { body: adf(markdown) } });
    if (!c.ok) fail(`Comentário da análise falhou (HTTP ${c.status}). ${c.text?.slice(0, 300) || ''}`);
    if (viavel) await mandarParaFila(analise);
    // nota: inviável NÃO move e NÃO fecha — fechar é decisão humana; a etiqueta registra que a análise foi feita, e removê-la pede uma nova
    else await etiquetar(analise, [ETIQUETA_ANALISADO]);
    await soltarResponsavel(analise);
    console.log(`\n✅ ${analise}: análise comentada · ${viavel ? `Fila desenvolvimento + ${ETIQUETA_PRONTO}` : `fica em Analisar + ${ETIQUETA_ANALISADO}`} · sem responsável\n`);
    return;
  }

  // o card de automação nasce SEMPRE no board QA, nunca no board de um módulo
  const projeto = 'QA';
  const titulo = tituloDoCard(entrada);
  const existentes = flags.force ? [] : await cardsDaTela(entrada, buscar, projeto);
  if (existentes.length) {
    console.log(`~ a tela já tem card (${existentes.map((c) => c.key).join(', ')}) — leve a lista nova para ele num comentário. Para criar mesmo assim: --force`);
    return;
  }
  if (flags['dry-run']) { console.log(`🧪 DRY-RUN: criaria "${titulo}" no board ${projeto}, já na Fila desenvolvimento com ${ETIQUETA_PRONTO}.\n`); return; }
  const tipo = await resolverTipo('Teste Automatizado', projeto);
  const r = await request('/rest/api/3/issue', {
    method: 'POST',
    body: { fields: { project: { key: projeto }, summary: titulo, issuetype: { id: tipo.id }, labels: etiquetasDoCard(entrada), description: adf(markdown), ...comCategoria() } },
  });
  if (!r.ok) fail(`Criação falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  const key = r.json.key;
  // nota: o campo pode não estar na tela de criação do Jira, mas é editável no card — por isso um PUT à parte
  const up = CASOS_FIELD ? await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: { [CASOS_FIELD]: templateDeCasos(entrada) } } }) : { ok: true };
  if (!up.ok) console.log(`⚠️  não preenchi o campo de casos de teste (HTTP ${up.status}) — rode "jira.mts casos ${key} …".`);
  // o card sai triado, inclusive quanto à viabilidade — não passa por análise de novo, vai direto para a fila do agente
  await mandarParaFila(key);
  // card de backlog é da fila: quem pegar vira responsável pelo `andamento`
  await soltarResponsavel(key);
  console.log(`\n✅ Card criado: ${key} · Fila desenvolvimento + ${ETIQUETA_PRONTO} · sem responsável\n   ${SITE}/browse/${key}\n`);
}

// Solta o responsável do card — o inverso do `andamento`.
//
// Existe para o fim da TRIAGEM: o agente assume o card enquanto trabalha nele (o board precisa
// dizer quem está fazendo o quê), e o devolve à fila SEM dono quando termina de triar. Card parado
// na fila com responsável é card que parece estar sendo feito e não está.
//
// `accountId: null` é como a API do Jira desatribui; mandar o campo vazio ou omiti-lo não faz nada.
async function cmdSoltar(flags) {
  const key = flags._[0];
  if (!key) fail('Uso: node scripts/jira.mts soltar QA-123');
  if (flags['dry-run']) { console.log(`\n🧪 DRY-RUN soltar responsável de ${key}\n`); return; }
  await soltarResponsavel(key);
  console.log(`\n✅ ${key}: sem responsável — livre para a fila.\n`);
}

// Acrescenta etiqueta(s) ao card, sem tocar nas que já estão lá.
//
// Nasceu para a análise de viabilidade (hoje o `card-tela --card`): quando nenhum cenário passa, o
// card FICA onde está (fechar é decisão humana) e a etiqueta registra que a análise foi feita — quem
// varre o backlog a usa para não reanalisar. Tirar a etiqueta é como se pede uma segunda opinião.
//
// `update.labels.add` em vez de mandar a lista inteira: duas escritas concorrentes com a lista
// completa se sobrescrevem, e a etiqueta de quem escreveu primeiro some sem erro nenhum.
async function cmdEtiquetar(flags) {
  const key = flags._[0];
  const etiquetas = flags._.slice(1).filter(Boolean);
  if (!key || !etiquetas.length) fail('Uso: node scripts/jira.mts etiquetar QA-123 <etiqueta> [outra...] [--remover]');
  const acao = flags.remover ? 'remove' : 'add';
  if (flags['dry-run']) { console.log(`\n🧪 DRY-RUN etiquetar ${key}: ${acao} ${etiquetas.join(', ')}\n`); return; }
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: { update: { labels: etiquetas.map((e) => ({ [acao]: e })) } },
  });
  if (!r.ok) fail(`Etiquetar falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  console.log(`\n✅ ${key}: etiqueta(s) ${flags.remover ? 'removida(s)' : 'adicionada(s)'} — ${etiquetas.join(', ')}.\n`);
}

// Adiciona o código AUTE2E ao cenário na seção "Casos de teste implementados" do campo
// de casos de teste do Jira (JIRA_CASOS_FIELD) — útil se um painel de QA lê os testes feitos de lá.
// O card nasce com os cenários SEM código; aqui casamos pelo TÍTULO do cenário e enriquecemos a
// linha com "— AUTE2E-N". Cirúrgico (só a seção), preserva ordem, idempotente (re-rodar não duplica),
// e cenário ainda não automatizado permanece sem código.
const CASOS_FIELD = process.env.JIRA_CASOS_FIELD || '';
const HEADING_CASOS = 'Casos de teste implementados';
const nodeTitle = (n) => (n && (n.type === 'paragraph' || n.type === 'heading') ? (n.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim() : null);
// Título de seção do template = heading, ou parágrafo cujo 1º trecho é strong (ex.: **Objetivo**).
const isSectionTitle = (n) => !!n && (n.type === 'heading' || (n.type === 'paragraph' && (n.content || [])[0]?.marks?.some((m) => m.type === 'strong')));
// Tira o código (prefixo ou sufixo) pra sobrar só o título do cenário — a chave de casamento.
const stripCode = (s) => String(s).replace(/^\s*AUTE2E-\d+\s*[—–-]\s*/i, '').replace(/\s*[—–-]\s*AUTE2E-\d+\s*$/i, '').trim();
const bareKey = (s) => stripCode(s).toLowerCase();
const parseArg = (s) => { const m = String(s).match(/AUTE2E-(\d+)/i); return { code: m ? `AUTE2E-${m[1]}` : null, title: stripCode(s) }; };
const lineText = ({ code, title }) => (code ? `${title} — ${code}` : title);
// Linha que é SÓ um código, sem título. Uma seção inteira assim vira uma linha separada por
// vírgula (20 bullets de "ABC-1234" é um paredão); com título, bullet — senão vira texto corrido.
const SO_CODIGO = /^[A-Z][A-Z0-9]*-\d+$/i;
const soCodigos = (linhas) => linhas.length > 0 && linhas.every((t) => SO_CODIGO.test(t));

async function cmdCasos(flags) {
  const key = flags._[0];
  const args = flags._.slice(1).map((s) => String(s).trim()).filter(Boolean);
  if (!key || args.length === 0) fail('Uso: node scripts/jira.mts casos QA-123 "AUTE2E-34 — <titulo do cenario>" [...]');
  if (!CASOS_FIELD) fail('Defina JIRA_CASOS_FIELD no .env (o ID do campo de casos de teste do seu Jira).');
  const incoming = args.map(parseArg);
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${CASOS_FIELD}`);
  if (!r.ok) fail(`Get falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  let doc = r.json.fields?.[CASOS_FIELD];
  if (!doc || !Array.isArray(doc.content)) doc = { type: 'doc', version: 1, content: [] };

  // âncora: o título "Casos de teste implementados" (strong). Cria no fim se o campo não tiver.
  let idx = doc.content.findIndex((n) => (nodeTitle(n) || '').toLowerCase().startsWith(HEADING_CASOS.toLowerCase()));
  if (idx === -1) {
    doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: HEADING_CASOS, marks: [{ type: 'strong' }] }] });
    idx = doc.content.length - 1;
  }
  // fim da seção = próximo título de seção (ou fim do doc)
  let end = idx + 1;
  while (end < doc.content.length && !isSectionTitle(doc.content[end])) end++;

  // linhas já presentes (ignora o placeholder "(cole os SPs...)")
  const linhas = [];
  for (let i = idx + 1; i < end; i++) {
    const no = doc.content[i];
    if (no.type === 'bulletList') {
      for (const li of no.content || []) { const t = adfToText(li).trim(); if (t && !t.startsWith('(')) linhas.push(t); }
      continue;
    }
    // quirk: a seção pode já estar na forma compacta — reexpandir é o que mantém o casamento por
    // título e a idempotência; só quebra na vírgula se TODOS os pedaços forem código, senão o
    // parágrafo é texto de gente e vai inteiro.
    if (no.type !== 'paragraph') continue;
    const t = adfToText(no).trim();
    if (!t || t.startsWith('(')) continue;
    const pedacos = t.split(',').map((s) => s.trim()).filter(Boolean);
    if (soCodigos(pedacos)) linhas.push(...pedacos);
    else linhas.push(t);
  }

  // casa cada incoming pelo TÍTULO; enriquece a linha existente ou adiciona no fim se não achar.
  const usados = new Set();
  const resultado = linhas.map((linha) => {
    const j = incoming.findIndex((inc, i) => !usados.has(i) && bareKey(inc.title) === bareKey(linha));
    if (j === -1) return linha;
    usados.add(j);
    return lineText(incoming[j]);
  });
  incoming.forEach((inc, i) => { if (!usados.has(i)) resultado.push(lineText(inc)); });

  const bloco = soCodigos(resultado)
    ? { type: 'paragraph', content: [{ type: 'text', text: resultado.join(', ') }] }
    : { type: 'bulletList', content: resultado.map((t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) };
  doc.content.splice(idx + 1, end - (idx + 1), bloco);

  const novos = incoming.filter((_, i) => !usados.has(i)).length;
  if (flags['dry-run']) {
    const previa = soCodigos(resultado) ? `  ${resultado.join(', ')}` : resultado.map((m) => '  - ' + m).join('\n');
    console.log(`\n🧪 DRY-RUN casos em ${key} · ${CASOS_FIELD} (${soCodigos(resultado) ? 'linha compacta' : 'bullets'}):\n${previa}\n`);
    return;
  }
  const put = await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: { [CASOS_FIELD]: doc } } });
  if (!put.ok) fail(`Update do campo ${CASOS_FIELD} falhou (HTTP ${put.status}). ${put.text?.slice(0, 300) || ''}`);
  console.log(`\n✅ "Casos de teste implementados" atualizado em ${key} · ${CASOS_FIELD} (${resultado.length} linha(s)${novos ? `, ${novos} sem match adicionada(s) no fim` : ''}).\n`);
  return put.json;
}

async function cmdDelete(flags) {
  const jql = flags._[0];
  if (!jql) fail('Uso: delete "<JQL>" [--yes]  — dry-run por padrão; SÓ deleta com --yes (irreversível).');
  let r = await request('/rest/api/3/search/jql', { method: 'POST', body: { jql, maxResults: 400, fields: ['summary', 'status', 'labels'] } });
  if (r.status === 404) r = await request('/rest/api/3/search', { method: 'POST', body: { jql, maxResults: 400, fields: ['summary', 'status', 'labels'] } });
  if (!r.ok) fail(`Busca falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  const issues = r.json.issues || [];
  console.log(`\n🎯 ${issues.length} issue(s) alvo: ${jql}\n`);
  for (const it of issues) console.log(`  ${it.key.padEnd(10)} [${it.fields?.status?.name || '?'}]  ${it.fields?.summary || ''}`);
  if (!flags.yes) { console.log(`\n🧪 DRY-RUN — nada foi deletado. Rode com --yes para excluir de verdade (irreversível).\n`); return; }
  console.log('\n⚠️  Excluindo de verdade...\n');
  let ok = 0, erro = 0;
  for (const it of issues) {
    const d = await request(`/rest/api/3/issue/${encodeURIComponent(it.key)}`, { method: 'DELETE' });
    if (d.ok || d.status === 204) { ok++; console.log(`  🗑️  ${it.key} deletado`); }
    else { erro++; console.log(`  ❌ ${it.key} FALHOU (HTTP ${d.status}) ${d.text?.slice(0, 120) || ''}`); }
  }
  console.log(`\n✅ ${ok} deletado(s), ${erro} falha(s) de ${issues.length}.\n`);
}

// Põe um card EXISTENTE "em andamento": responsável = dono do token + status Implementando (caminha
// o trilho). Pra cards criados por outro caminho (ex.: o card-tela) entrarem no mesmo padrão.
async function cmdAndamento(flags) {
  const key = flags._[0];
  if (!key) fail('Uso: node scripts/jira.mts andamento QA-123');
  const accountId = await getMyAccountId();
  const a = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/assignee`, { method: 'PUT', body: { accountId } });
  console.log((a.ok || a.status === 204) ? `👤 ${key} responsável = você.` : `⚠️  não atribuí ${key} (HTTP ${a.status}).`);
  // QAs (multiuser): ACRESCENTA você sem apagar quem já estava — evita esquecer de preencher quem automatizou.
  const extras: Record<string, unknown> = { ...comCategoria() };
  if (QAS_FIELD) {
    const cur = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=${QAS_FIELD}`);
    const atuais = (cur.ok && Array.isArray(cur.json.fields?.[QAS_FIELD])) ? cur.json.fields[QAS_FIELD].map((u) => ({ accountId: u.accountId })) : [];
    extras[QAS_FIELD] = atuais.some((u) => u.accountId === accountId) ? atuais : [...atuais, { accountId }];
  }
  // Categoria (validador escondido da fila de DEV) + QAs no mesmo PUT, antes de caminhar o status.
  const put = Object.keys(extras).length
    ? await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: extras } })
    : { ok: true, status: 204, text: '' };
  if (!put.ok && put.status !== 204) console.log(`⚠️  não setei Categoria/QAs em ${key} (HTTP ${put.status}). ${put.text?.slice(0, 140) || ''}`);
  else console.log(`🧪 ${key} QAs += você.`);
  await transicionarPara(key, flags.status || 'Implementando');
}

// Só caminha o trilho de status — sem tocar responsável/QAs (ao contrário de "andamento"). Uso:
// fechar um card de outro autor (ex.: MR revisado e mergeado por você, mas o trabalho é de outro QA).
async function cmdStatus(flags) {
  const key = flags._[0];
  const alvo = flags._[1];
  if (!key || !alvo) fail('Uso: node scripts/jira.mts status QA-123 "FINALIZADO" · status ABC-1 "Em desenvolvimento|Reprovado" --via Testando');
  // O trilho é o fluxo do board QA. Fora dele (os boards de produto que o teste manual move) cada
  // tipo de ticket tem fluxo próprio, e caminhar o trilho às cegas poderia levar um aprovado para a
  // Fila desenvolvimento só por ela estar "no caminho". Lá, só transição direta — com destinos
  // alternativos em ordem (A|B) e intermediários explícitos (--via).
  const alvos = String(alvo).split('|').map((x) => x.trim()).filter(Boolean);
  const via = flags.via ? String(flags.via).split(',').map((x) => x.trim()).filter(Boolean) : [];
  if (key.split('-')[0].toUpperCase() === PROJECT && alvos.length === 1 && !via.length) {
    if (!(await transicionarPara(key, alvos[0]))) process.exit(1);
    return;
  }
  if (!(await transicionarDireto(key, alvos, via))) process.exit(1);
}

async function transicoesDe(key) {
  const t = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  if (!t.ok) throw new ErroJira(`não li as transições de ${key} (HTTP ${t.status}).`);
  return t.json.transitions || [];
}

async function transicionarDireto(key, alvos, via) {
  const atual = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=status`);
  const corrente = atual.ok ? atual.json.fields?.status?.name : '';
  if (alvos.some((a) => normStatus(a) === normStatus(corrente))) { console.log(`  = já em ${corrente}`); return true; }
  const passar = async (t) => {
    const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { method: 'POST', body: { transition: { id: t.id } } });
    if (!r.ok && r.status !== 204) throw new ErroJira(`a transição para "${t.to?.name}" falhou (HTTP ${r.status}): ${r.text?.slice(0, 200) || ''}`);
    console.log(`  → ${t.to?.name}`);
  };
  const direta = (trans) => alvos.map((a) => trans.find((x) => normStatus(x.to?.name) === normStatus(a))).find(Boolean);
  let trans = await transicoesDe(key);
  let achou = direta(trans);
  // Um intermediário por vez, e só os pedidos: andar por conta própria é como um status errado
  // acontece sem ninguém pedir.
  for (const v of via) {
    if (achou) break;
    const passo = trans.find((x) => normStatus(x.to?.name) === normStatus(v));
    if (!passo) continue;
    await passar(passo);
    trans = await transicoesDe(key);
    achou = direta(trans);
  }
  if (!achou) {
    console.error(`  ⚠️  nenhum de "${alvos.join('" | "')}" é alcançável a partir de "${corrente}"${via.length ? ` (via ${via.join(', ')})` : ''}. Disponíveis: ${trans.map((x) => x.to?.name).join(', ')}`);
    return false;
  }
  await passar(achou);
  return true;
}

// Atribui o ticket a uma pessoa — por accountId ou pelo nome/e-mail, que precisa achar UMA só.
async function cmdAtribuir(flags) {
  const [key, pessoa] = flags._;
  if (!key || !pessoa) fail('Uso: node scripts/jira.mts atribuir ABC-123 <accountId | "nome" | e-mail>');
  let accountId = pessoa;
  if (!/^[0-9a-f]{24}$|^\d+:[0-9a-f-]{20,}$/i.test(pessoa)) {
    const r = await request(`/rest/api/3/user/search?query=${encodeURIComponent(pessoa)}`);
    const achados = (r.ok ? r.json : []).filter((u) => u.accountType === 'atlassian');
    if (achados.length !== 1) fail(`"${pessoa}" achou ${achados.length} pessoa(s) — passe o accountId (whois "${pessoa}").`);
    accountId = achados[0].accountId;
  }
  const a = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/assignee`, { method: 'PUT', body: { accountId } });
  if (!a.ok && a.status !== 204) fail(`Atribuir falhou (HTTP ${a.status}). ${a.text?.slice(0, 200) || ''}`);
  console.log(`✅ ${key} atribuído a ${accountId}`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const flags = parseFlags(rest);
  switch (cmd) {
    case 'whoami': return cmdWhoami();
    case 'whois': return cmdWhois(flags);
    case 'types': return cmdTypes(flags);
    case 'search': return cmdSearch(flags);
    case 'get': return cmdGet(flags);
    case 'create': return cmdCreate(flags);
    case 'andamento': return cmdAndamento(flags);
    case 'status': return cmdStatus(flags);
    case 'atribuir': return cmdAtribuir(flags);
    case 'comment': return cmdComment(flags);
    case 'descricao': return cmdDescricao(flags);
    case 'card-tela': return cmdCardTela(flags);
    case 'anexar': return cmdAnexar(flags);
    case 'anexos': return cmdAnexos(flags);
    case 'baixar': return cmdBaixar(flags);
    case 'etiquetar': return cmdEtiquetar(flags);
    case 'soltar': return cmdSoltar(flags);
    case 'casos': return cmdCasos(flags);
    case 'delete': return cmdDelete(flags);
    default: console.log('Comandos: whoami | whois "<nome ou e-mail>" | types [--projeto ABC] | search "<JQL>" | get <CHAVE> [--comentarios] | create "<titulo>" --desc "...(aceita markdown)" [--projeto ABC] [--type "Teste Automatizado"] [--categoria "Sua categoria"] [--parent QA-123] [--labels a,b] [--assign-me | --assign <accountId>] [--qas <accountId[,accountId2]>] [--status "Implementando"] [--desc-arquivo descricao.md] [--dry-run] | descricao <CHAVE> --arquivo <descricao.md> [--dry-run] | card-tela <tela-cenarios.json> [--card <CHAVE>] [--preview | --markdown x.md | --dry-run | --force] | andamento <CHAVE> [--status "Implementando"] | status <CHAVE> "<Nome>[|<Outro>]" [--via <Intermediário>] | atribuir <CHAVE> <accountId | nome | e-mail> | comment <CHAVE> "<texto>" [--panel success|info|note|warning|error] [--dry-run] | comment <CHAVE> --arquivo <comentario.md> [--editar <idDoComentário>] [--dry-run] | anexar <CHAVE> <arquivo> [...] | anexos <CHAVE> | baixar <CHAVE> <pasta> [--tipo video|imagem|todos] | casos <CHAVE> "AUTE2E-34 — titulo" [...] [--dry-run] | delete "<JQL>" [--yes]');
  }
}
main().catch((e) => fail(e instanceof ErroJira ? e.message : e?.stack || String(e)));