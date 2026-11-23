// Conexão com o Jira compartilhada pelos scripts que escrevem nele — hoje, o jira.mts e os
// comandos dele.
//
// Antes cada script tinha a sua cópia de autenticação, troca de base e montagem do ADF, e corrigir uma
// era esquecer a outra. Aqui nada encerra o processo: o erro sobe como ErroJira, e quem é CLI decide
// como mostrá-lo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adf, dimensoesDaImagem, imagensCitadas } from './jira-adf.mts';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class ErroJira extends Error {}

// nota: o .env do diretório atual vence o da raiz — é o que deixa uma floor ou uma vertical apontar para outro Jira sem tocar no da raiz
function carregarEnv() {
  const arquivo = [path.resolve(process.cwd(), '.env'), path.join(raiz, '.env')].find((a) => fs.existsSync(a));
  if (arquivo) process.loadEnvFile(arquivo);
}
carregarEnv();

const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
export const BASE_DIRETA = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '');
const BASE_GATEWAY = process.env.JIRA_CLOUD_ID ? `https://api.atlassian.com/ex/jira/${process.env.JIRA_CLOUD_ID}` : '';
export const SITE = BASE_DIRETA || 'https://SEU-SITE.atlassian.net';
export const credenciaisOk = Boolean(EMAIL && TOKEN && TOKEN !== 'COLE_SEU_TOKEN_AQUI');
export const authHeader = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
let baseResolvida = null;
/** A base que respondeu por último (direta ou gateway) — só para diagnóstico. */
export const baseEmUso = () => baseResolvida;

async function chamar(base, apiPath, { method = 'GET', body, form }: { method?: string; body?: unknown; form?: FormData } = {}) {
  const headers = { Authorization: authHeader, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  // nota: no multipart o Content-Type fica com o fetch, que é quem conhece o boundary; o X-Atlassian-Token desliga a checagem de XSRF que o Jira faz em upload
  if (form) headers['X-Atlassian-Token'] = 'no-check';
  const res = await fetch(`${base}${apiPath}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

/** Chama a API REST do Jira; tenta a base direta e cai para o gateway da Atlassian em 401/403. */
export async function request(apiPath, opts = {}) {
  if (!credenciaisOk) throw new ErroJira('Defina JIRA_EMAIL e JIRA_API_TOKEN em .env.');
  const bases = [baseResolvida, BASE_DIRETA, BASE_GATEWAY].filter((b, i, todas) => b && todas.indexOf(b) === i);
  if (bases.length === 0) throw new ErroJira('Nenhuma base definida (JIRA_BASE_URL ou JIRA_CLOUD_ID).');
  let ultima;
  for (const base of bases) {
    const r = await chamar(base, apiPath, opts);
    ultima = r;
    if ((r.status === 401 || r.status === 403) && base !== bases[bases.length - 1]) continue;
    baseResolvida = base;
    return r;
  }
  return ultima;
}

// ─── Tipos e busca ────────────────────────────────────────────────────────────────────────────

export async function tiposDoProjeto(projeto) {
  const r = await request(`/rest/api/3/issue/createmeta/${encodeURIComponent(projeto)}/issuetypes`);
  if (!r.ok) throw new ErroJira(`Não consegui listar os tipos de ${projeto} (HTTP ${r.status}). ${r.text?.slice(0, 200) || ''}`);
  return r.json.values || r.json.issueTypes || [];
}

/** Resolve o tipo pelo nome ou pelo id; recusa o que não existe em vez de inventar. */
export async function resolverTipo(tipo, projeto) {
  const tipos = await tiposDoProjeto(projeto);
  const achado = (/^\d+$/.test(String(tipo)) && tipos.find((t) => String(t.id) === String(tipo))) ||
    tipos.find((t) => (t.name || '').toLowerCase() === String(tipo).toLowerCase());
  if (!achado) throw new ErroJira(`Tipo "${tipo}" não existe no projeto ${projeto}. Rode "node scripts/jira.mts types --projeto ${projeto}" para ver os válidos.`);
  return { id: String(achado.id), nome: achado.name || '' };
}

// nota: /search/jql é a busca nova; o 404 dela significa site ainda na API antiga, e aí cai no /search
export async function buscar(jql, { max = 50, campos = ['summary', 'status', 'issuetype', 'labels'] } = {}) {
  const corpo = { jql, maxResults: max, fields: campos };
  let r = await request('/rest/api/3/search/jql', { method: 'POST', body: corpo });
  if (r.status === 404) r = await request('/rest/api/3/search', { method: 'POST', body: corpo });
  if (!r.ok) throw new ErroJira(`Busca falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  return r.json.issues || [];
}

// ─── Responsável ──────────────────────────────────────────────────────────────────────────────

// quirk: o board atribui o card a QUEM O CRIA durante a própria criação (o changelog não registra a atribuição, só quem a desfaz) — e o token do .env é de uma pessoa, então todo card aberto por agente nascia no nome dela e saía da fila. Mandar o assignee vazio no create não adianta, a regra roda por cima; só um PUT depois de criado vence
/** Deixa o card sem responsável. `accountId: null` é como a API desatribui; omitir o campo não faz nada. */
export async function soltarResponsavel(key) {
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/assignee`, { method: 'PUT', body: { accountId: null } });
  if (!r.ok && r.status !== 204) throw new ErroJira(`Não consegui deixar ${key} sem responsável (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
}

// ─── Anexos ───────────────────────────────────────────────────────────────────────────────────
// Portado de manual/tools/jira-anexos.py, para os dois agentes subirem evidência pelo mesmo canal.

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', pdf: 'application/pdf', json: 'application/json',
  har: 'application/json', txt: 'text/plain', log: 'text/plain', sql: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  zip: 'application/zip',
};
const mimeDe = (nome) => MIME[path.extname(nome).slice(1).toLowerCase()] || 'application/octet-stream';
const tipoDe = (mime = '') => (mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'imagem' : 'outro');
export const resumoAnexo = (a) => ({ id: a.id, arquivo: a.filename, tipo: tipoDe(a.mimeType || mimeDe(a.filename)), mime: a.mimeType, bytes: a.size, criado: a.created, autor: a.author?.displayName });

// Para o print aparecer DENTRO do texto (mediaSingle > media type=file) é preciso o id do arquivo na
// Media API. A API pública não devolve esse id, mas o conteúdo do anexo redireciona (303) para
// api.media.atlassian.com/file/<id>/binary — basta não seguir o redirect e ler o Location.
async function mediaIdDoAnexo(anexoId) {
  if (!baseResolvida) await request('/rest/api/3/myself');
  const res = await fetch(`${baseResolvida}/rest/api/3/attachment/content/${encodeURIComponent(anexoId)}`, { headers: { Authorization: authHeader }, redirect: 'manual' });
  const partes = new URL(res.headers.get('location') || 'http://x/').pathname.split('/').filter(Boolean);
  return partes[0] === 'file' && partes[1] ? partes[1] : null;
}

export async function anexar(key, arquivo) {
  if (!fs.existsSync(arquivo)) throw new ErroJira(`Arquivo não encontrado: ${arquivo}`);
  const nome = path.basename(arquivo);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(arquivo)], { type: mimeDe(nome) }), nome);
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, { method: 'POST', form });
  if (!r.ok) throw new ErroJira(`Upload de ${nome} falhou (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  const saida = [];
  for (const a of r.json || []) saida.push({ ...resumoAnexo(a), mediaId: await mediaIdDoAnexo(a.id), url: a.content });
  return saida;
}

export async function anexosDe(key) {
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=attachment`);
  if (!r.ok) throw new ErroJira(`Não li os anexos de ${key} (HTTP ${r.status}). ${r.text?.slice(0, 200) || ''}`);
  return r.json.fields?.attachment || [];
}

// ─── Texto rico ───────────────────────────────────────────────────────────────────────────────

/**
 * Prepara um markdown para publicar: confere as imagens citadas (relativas a `pasta`, que é como o
 * editor de markdown as mostra) e já converte uma vez sem os prints — erro de sintaxe aparece aqui,
 * antes de qualquer escrita no Jira.
 */
function prepararMarkdown(texto, pasta, origem = 'o texto') {
  const imagens = imagensCitadas(texto).map((ref) => ({ ref, caminho: path.resolve(pasta, ref) }));
  const faltando = imagens.filter((i) => !fs.existsSync(i.caminho));
  if (faltando.length) throw new ErroJira(`Imagem citada e não encontrada: ${faltando.map((i) => i.ref).join(', ')} (relativa a ${pasta})`);
  try { return { texto, imagens, doc: adf(texto, {}) }; } catch (e) { throw new ErroJira(`Markdown inválido em ${origem}: ${e.message}`); }
}

export function lerMarkdown(arquivo) {
  if (!fs.existsSync(arquivo)) throw new ErroJira(`Arquivo não encontrado: ${arquivo}`);
  return prepararMarkdown(fs.readFileSync(arquivo, 'utf8'), path.dirname(path.resolve(arquivo)), arquivo);
}

/**
 * Sobe as imagens (e vídeos) como anexo do ticket e devolve o mapa ref -> { id, largura, altura } que
 * o adf() usa. Arquivo que o ticket já tem — mesmo nome E mesmo tamanho — não sobe de novo: reeditar um
 * comentário, ou publicar depois de anexar, não duplica o vídeo. O tamanho entra porque a rodada 2
 * grava outro CA-01.webm com o mesmo nome.
 */
export async function subirImagens(key, imagens) {
  const midia = {};
  const jaTem = imagens.length ? await anexosDe(key) : [];
  for (const img of imagens) {
    const bytes = fs.statSync(img.caminho).size;
    const existente = jaTem.find((x) => x.filename === path.basename(img.caminho) && x.size === bytes);
    const [a] = existente ? [{ mediaId: await mediaIdDoAnexo(existente.id) }] : await anexar(key, img.caminho);
    if (a?.mediaId) midia[img.ref] = { id: a.mediaId, ...(dimensoesDaImagem(fs.readFileSync(img.caminho)) || {}) };
    else console.log(`⚠️  ${img.ref} subiu como anexo, mas sem mediaId — entra no texto como "📎 legenda".`);
  }
  return midia;
}

/** Regrava a descrição INTEIRA do ticket com o markdown preparado, com os prints dentro. */
export async function gravarDescricao(key, md) {
  const midia = await subirImagens(key, md.imagens);
  const r = await request(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: { description: adf(md.texto, midia) } } });
  if (!r.ok && r.status !== 204) throw new ErroJira(`Descrição de ${key} não foi gravada (HTTP ${r.status}). ${r.text?.slice(0, 300) || ''}`);
  console.log(`📝 Descrição de ${key} gravada${md.imagens.length ? ` com ${md.imagens.length} imagem(ns)` : ''}.`);
}
