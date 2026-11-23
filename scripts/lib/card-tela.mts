// O card de automação de UMA tela (comando `jira.mts card-tela`), montado a
// partir do tela-cenarios.json. Nada aqui fala com o Jira por conta própria — a busca chega injetada —,
// para dar para testar e pré-visualizar offline.
//
// O card carrega a triagem INTEIRA na descrição — âncora, nível, o que validar e a fonte de cada
// cenário, mais os descartados e as regras a validar. Antes só o nome do cenário chegava ao card, e
// quem pegava para automatizar refazia o mapeamento e as buscas no Zendesk.

// nota: lido na hora do uso, não no import — este módulo carrega antes do jira-api.mts, que é quem lê o .env
const zendesk = () => (process.env.ZENDESK_ARTICLES_URL || 'https://SEU-DOMINIO.zendesk.com/hc/pt-br/articles/').replace(/\/*$/, '/');
const NIVEIS = { smoke: '{status:SMOKE|purple}', regressao: '{status:REGRESSÃO|blue}' };
const PREFIXO_ORIGEM = { cypress: 'Migrar do Cypress' };
const LABEL_ORIGEM = { cypress: 'migracao-cypress' };

// nota: `|` dentro do texto partiria a célula da tabela; vira barra
const celula = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();

/** "zendesk:123" vira link para o artigo; qualquer outro texto passa como está; vazio é "observado na tela". */
export function fonteMarkdown(fonte) {
  const f = String(fonte ?? '').trim();
  const m = f.match(/^zendesk:(\d+)$/i);
  if (m) return `[Zendesk ${m[1]}](${zendesk()}${m[1]})`;
  return f || 'observado na tela, sem artigo';
}

/**
 * Normaliza a entrada e devolve os erros que impedem o card de nascer. Na `analise` de um card que
 * já existe, zero cenários é um veredito legítimo (nada passa) — desde que os descartados digam por quê.
 */
export function lerEntrada(data, { analise = false } = {}) {
  const erros = [];
  const cenarios = (Array.isArray(data.cenarios) ? data.cenarios : []).map((c) => (typeof c === 'string' ? { nome: c } : { ...c }));
  if (!data.modulo || !data.tela) erros.push('"modulo" e "tela" são obrigatórios.');
  const temDescartes = Array.isArray(data.descartados) && data.descartados.length > 0;
  if (cenarios.length === 0 && !(analise && temDescartes)) erros.push(analise ? 'nenhum cenário nem descarte — a análise tem de dizer o que acontece com cada cenário do card.' : 'nenhum cenário em "cenarios".');
  cenarios.forEach((c, i) => {
    const quem = `cenário ${i + 1} (${c.nome || 'sem nome'})`;
    if (!c.nome) erros.push(`${quem}: sem "nome".`);
    // nota: é a âncora que separa cenário visto na tela de cenário inventado — sem ela o cenário não entra, e o script recusa em vez de confiar na skill
    if (!String(c.ancora ?? '').trim()) erros.push(`${quem}: sem "ancora" — o controle da tela que o dispara. Sem âncora, o cenário não existe.`);
    if (!NIVEIS[c.nivel]) erros.push(`${quem}: "nivel" tem de ser "smoke" ou "regressao".`);
    if (!String(c.validar ?? '').trim()) erros.push(`${quem}: sem "validar".`);
  });
  const descartados = (Array.isArray(data.descartados) ? data.descartados : []).map((d) => (typeof d === 'string' ? { nome: d } : d));
  descartados.forEach((d, i) => { if (!d.motivo) erros.push(`descartado ${i + 1} (${d.nome || 'sem nome'}): sem "motivo" — o descarte é a parte mais útil da revisão.`); });
  const origem = String(data.origem || '').toLowerCase();
  return {
    erros,
    entrada: {
      modulo: data.modulo, tela: data.tela, rota: data.rota || '', origem, objetivo: data.objetivo || '',
      cenarios, descartados,
      regras: (Array.isArray(data.regrasAValidar) ? data.regrasAValidar : []).map(String),
      cobertura: (Array.isArray(data.coberturaExistente) ? data.coberturaExistente : []).map(String),
      observadoEm: data.observadoEm || '',
    },
  };
}

export const tituloDoCard = (e) => `${PREFIXO_ORIGEM[e.origem] || 'Automatizar'}: ${e.modulo} > ${e.tela}`;

// A rota vira etiqueta para o dedupe casar pela TELA, e não pelo texto do título — o título dava
// falso positivo entre telas de nome parecido ("Agenda de Aulas" x "Configurar Aulas").
const etiquetaDaTela = (rota) => (rota ? `tela:${rota.replace(/\s+/g, '')}` : null);

/**
 * Os cards que a tela já tem. Pela etiqueta da rota; os cards anteriores a ela não a têm, então
 * quando a etiqueta não acha nada ainda se confere o título (módulo E tela) — o falso positivo do
 * título só pesa nesse caminho velho. `buscar` é o da lib jira-api, injetado para testar sem Jira.
 */
export async function cardsDaTela(e, buscar, projeto = 'QA') {
  const etiqueta = etiquetaDaTela(e.rota);
  if (etiqueta) {
    const porEtiqueta = await buscar(`project = ${projeto} AND labels = "${etiqueta}"`, { max: 3, campos: ['summary'] });
    if (porEtiqueta.length) return porEtiqueta;
  }
  const aspas = (t) => `"${String(t).replace(/["\\]/g, ' ').trim()}"`;
  return buscar(`project = ${projeto} AND summary ~ ${aspas(e.modulo)} AND summary ~ ${aspas(e.tela)}`, { max: 3, campos: ['summary'] });
}

export const etiquetasDoCard = (e, tag = 'scan-cobertura') =>
  [tag, LABEL_ORIGEM[e.origem], etiquetaDaTela(e.rota)].filter(Boolean);

function objetivoDoCard(e) {
  return e.objetivo || `Automatizar, como regressão de liberação, os fluxos núcleo de ${e.modulo} > ${e.tela}${e.rota ? ` (${e.rota})` : ''}.`;
}

const ESCALA = (e) => {
  const smoke = e.cenarios.filter((c) => c.nivel === 'smoke').length;
  const regressao = e.cenarios.length - smoke;
  return [smoke && `${NIVEIS.smoke} ${smoke}`, regressao && `${NIVEIS.regressao} ${regressao}`].filter(Boolean).join(' · ');
};

const tabelaDeCenarios = (e) => [
  '| # | Cenário | Nível | Âncora na tela | O que validar | Fonte da regra |',
  '|---|---|---|---|---|---|',
  ...e.cenarios.map((c, i) => `| ${i + 1} | ${celula(c.nome)} | ${NIVEIS[c.nivel]} | \`${celula(c.ancora).replace(/`/g, '')}\` | ${celula(c.validar)} | ${celula(fonteMarkdown(c.fonte))} |`),
  '',
  '*Âncora é o controle da tela que dispara o cenário, visto no mapeamento. Nível é o provável: a etiqueta definitiva entra quando o teste é escrito.*',
];

const tabelaDeDescartes = (e) => ['| Cenário | Por que ficou de fora |', '|---|---|', ...e.descartados.map((d) => `| ${celula(d.nome)} | ${celula(d.motivo)} |`)];

// Descartados, regras e mapeamento. `descartesAbertos` quando o descarte É o veredito (nada passou):
// recolhido, a única coisa que importa no comentário ficaria escondida.
function rodape(e, { descartesAbertos = false } = {}) {
  const linhas = [];
  if (e.descartados.length) {
    linhas.push('', ...(descartesAbertos
      ? [`## Fora da automação (${e.descartados.length})`, '', ...tabelaDeDescartes(e)]
      : [`:::expand Descartados (${e.descartados.length})`, ...tabelaDeDescartes(e), ':::']));
  }
  if (e.regras.length) {
    linhas.push('', `:::expand Regras a validar com produto (${e.regras.length})`, ...e.regras.map((r) => `- ${r}`), '',
      '*Não viram teste afirmativo até produto confirmar.*', ':::');
  }
  const mapeamento = [
    e.observadoEm && `- **Mapeado em:** ${e.observadoEm}`,
    ...(e.cobertura.length ? ['- **Cobertura que já existia:**', ...e.cobertura.map((c) => `  - ${c}`)] : ['- **Cobertura que já existia:** nenhuma']),
  ].filter(Boolean);
  linhas.push('', ':::expand Mapeamento', ...mapeamento, ':::');
  return linhas;
}

/** A descrição do card que a skill CRIA, no markdown da skill escrever-no-ticket. */
export function descricaoMarkdown(e) {
  return [
    ':::painel info',
    `**${tituloDoCard(e)}**${e.rota ? ` — \`${e.rota}\`` : ''}`,
    '',
    [`{status:${e.cenarios.length} CENÁRIOS|neutral}`, ESCALA(e)].filter(Boolean).join(' · '),
    '',
    objetivoDoCard(e),
    ':::',
    '',
    '## Cenários',
    '',
    ...tabelaDeCenarios(e),
    ...rodape(e),
  ].join('\n') + '\n';
}

/**
 * O comentário da ANÁLISE de um card que já existe (veio de produto): o veredito por cenário, no
 * mesmo formato do card criado. Viável quando ao menos um cenário vai para automação — o card não é
 * descartado inteiro por um cenário inviável.
 */
export function analiseMarkdown(e) {
  const total = e.cenarios.length + e.descartados.length;
  const viavel = e.cenarios.length > 0;
  return [
    `:::painel ${viavel ? 'success' : 'warning'}`,
    '**AGENTE DE QA — SUÍTE AUTOMATIZADA**',
    '',
    `🤖 Análise de viabilidade — ${e.modulo} > ${e.tela}${e.rota ? ` (\`${e.rota}\`)` : ''}`,
    '',
    viavel
      ? [`{status:VIÁVEL|green} ${e.cenarios.length} de ${total} cenário(s) vão para automação`, ESCALA(e)].filter(Boolean).join(' · ')
      : `{status:NÃO AUTOMATIZAR|red} nenhum dos ${total} cenário(s) passa — o card fica em Analisar para um humano decidir`,
    ':::',
    ...(viavel ? ['', '## Cenários para automatizar', '', ...tabelaDeCenarios(e)] : []),
    ...rodape(e, { descartesAbertos: !viavel }),
  ].join('\n') + '\n';
}

/**
 * O campo de casos de teste do Jira (JIRA_CASOS_FIELD, opcional), útil se um painel de QA lê de lá:
 * Objetivo + os cenários em "Casos de teste implementados" SEM código. Quem automatiza acrescenta o
 * código do teste a cada linha (`jira.mts casos`, casando pelo título).
 */
export function templateDeCasos(e) {
  const para = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: String(t) }] });
  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Objetivo', marks: [{ type: 'strong' }] }, { type: 'hardBreak' }, { type: 'text', text: objetivoDoCard(e) }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Casos de teste implementados', marks: [{ type: 'strong' }] }] },
      { type: 'bulletList', content: e.cenarios.map((c) => ({ type: 'listItem', content: [para(c.nome)] })) },
    ],
  };
}
