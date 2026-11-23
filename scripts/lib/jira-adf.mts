// Markdown -> ADF (Atlassian Document Format), o formato que o Jira exige para texto rico.
//
// Mora fora do jira.mts para ser testável sem credencial: o jira.mts morre na carga quando falta
// JIRA_API_TOKEN, e a conversão é a parte que mais quebra calada (o Jira aceita o JSON e mostra
// markup cru, ou recusa o comentário inteiro por um nó mal formado).
//
// O que entende, além do markdown comum (título, lista, tabela, código, ---, **negrito**, `código`):
//   :::painel success|info|note|warning|error     bloco colorido; fecha com :::  (aceita aninhar)
//   :::expand Título                              bloco recolhível; fecha com :::
//   ![legenda](caminho/do/print.png){60%}         imagem dentro do texto (linha sozinha); largura opcional, padrão 100%
//   ![legenda](caminho/do/video.webm)              o mesmo para vídeo: o Jira mostra o player no lugar
//   *itálico*  ·  {status:APROVADO|green}  ·  {@accountId|Nome}  ·  [texto](https://…)
//
// Imagem precisa do id do arquivo na Media API do Jira, que só existe depois do upload. Por isso a
// conversão recebe `midia` (caminho -> { id, largura, altura }) pronta: quem sobe o arquivo é o jira.mts.

// Uma linha = um parágrafo. É o formato histórico do `comment` sem --arquivo e fica assim de
// propósito: linha em branco NÃO vira parágrafo vazio (o parágrafo ADF já tem margem, e a linha
// vazia dobrava o espaçamento no Jira).
export function adfSimples(t) {
  const paragrafos = String(t || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));
  return { type: 'doc', version: 1, content: paragrafos.length ? paragrafos : [{ type: 'paragraph', content: [] }] };
}

export const STATUS_CORES = ['neutral', 'purple', 'blue', 'red', 'yellow', 'green'];

// nota: a ordem das alternativas importa — `**` antes de `*`, senão o negrito vira dois itálicos vazios
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\{status:[^|}]+\|[a-z]+\}|\{@[^|}]+\|[^}]+\}|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

export function adfInline(texto) {
  const saida = [];
  let ultimo = 0;
  for (const m of texto.matchAll(INLINE)) {
    if (m.index > ultimo) saida.push({ type: 'text', text: texto.slice(ultimo, m.index) });
    const t = m[0];
    if (t.startsWith('**')) saida.push({ type: 'text', text: t.slice(2, -2), marks: [{ type: 'strong' }] });
    else if (t.startsWith('`')) saida.push({ type: 'text', text: t.slice(1, -1), marks: [{ type: 'code' }] });
    else if (t.startsWith('*')) saida.push({ type: 'text', text: t.slice(1, -1), marks: [{ type: 'em' }] });
    else if (t.startsWith('[')) {
      const [, rotulo, href] = t.match(/^\[([^\]]+)\]\((.+)\)$/);
      saida.push({ type: 'text', text: rotulo, marks: [{ type: 'link', attrs: { href } }] });
    }
    else if (t.startsWith('{status:')) {
      const [rotulo, cor] = t.slice(8, -1).split('|');
      // quirk: cor fora da lista o Jira não recusa — desenha cinza, e o "REPROVADO" vermelho sai neutro sem ninguém notar
      if (!STATUS_CORES.includes(cor)) throw new Error(`cor de status inválida "${cor}" (use: ${STATUS_CORES.join(', ')})`);
      saida.push({ type: 'status', attrs: { text: rotulo.trim(), color: cor, style: 'bold' } });
    } else {
      const [id, nome] = t.slice(2, -1).split('|');
      saida.push({ type: 'mention', attrs: { id: id.trim(), text: `@${nome.trim()}` } });
    }
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) saida.push({ type: 'text', text: texto.slice(ultimo) });
  return saida.length ? saida : [{ type: 'text', text: texto || ' ' }];
}

// quirk: o `|` de dentro de `{status:X|cor}` e `{@id|Nome}` não divide coluna — sem isso o status, que é o que mais vai em tabela de critério, partia a célula ao meio
function adfCelulas(linha) {
  const miolo = linha.trim().replace(/^\|/, '').replace(/\|$/, '');
  const celulas = [];
  let atual = '';
  let chaves = 0;
  for (const ch of miolo) {
    if (ch === '{') chaves += 1;
    else if (ch === '}' && chaves > 0) chaves -= 1;
    if (ch === '|' && chaves === 0) { celulas.push(atual.trim()); atual = ''; } else atual += ch;
  }
  celulas.push(atual.trim());
  return celulas;
}
const adfSeparador = (linha) => /^\s*\|[\s:|-]+\|\s*$/.test(linha || '');
const adfCelula = (tipo) => (c) => ({ type: tipo, attrs: {}, content: [{ type: 'paragraph', content: adfInline(c) }] });
const ADF_CERCA = '```';
const ADF_LISTAS = [
  { tipo: 'bulletList', re: /^\s*[-*]\s+/ },
  { tipo: 'orderedList', re: /^\s*\d+[.)]\s+/ },
];
const adfItem = (linha) => ADF_LISTAS.some((t) => t.re.test(linha));
const recuo = (linha) => linha.match(/^\s*/)[0].length;
const BLOCO = /^:::(painel|panel|expand)\b\s*(.*)$/;
const FIM_BLOCO = /^:::\s*$/;
const IMAGEM = /^!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(\d{1,3})%\})?\s*$/;
const PAINEIS = ['info', 'note', 'success', 'warning', 'error'];

/** Caminhos das imagens citadas no texto, na ordem — o jira.mts sobe estes antes de converter. */
export function imagensCitadas(t) {
  const saida = [];
  for (const linha of String(t || '').split(/\r?\n/)) {
    const m = linha.trim().match(IMAGEM);
    if (m && !saida.includes(m[2])) saida.push(m[2]);
  }
  return saida;
}

const terminaParagrafo = (l) => !l.trim() || l.startsWith(ADF_CERCA) || /^#{1,6}\s/.test(l) || l.trim().startsWith('|') ||
  adfItem(l) || /^---+$/.test(l.trim()) || BLOCO.test(l.trim()) || FIM_BLOCO.test(l.trim()) || IMAGEM.test(l.trim());

function blocos(linhas, midia) {
  const conteudo = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i += 1; continue; }

    const bloco = l.trim().match(BLOCO);
    if (bloco) {
      // Junta até o ::: que fecha ESTE bloco, contando os que abrem dentro dele.
      const corpo = [];
      let nivel = 1;
      i += 1;
      while (i < linhas.length) {
        const s = linhas[i].trim();
        if (BLOCO.test(s)) nivel += 1;
        else if (FIM_BLOCO.test(s) && --nivel === 0) break;
        corpo.push(linhas[i]);
        i += 1;
      }
      if (nivel !== 0) throw new Error(`bloco ":::${bloco[1]} ${bloco[2]}" sem o ::: que o fecha`);
      i += 1;
      const dentro = blocos(corpo, midia);
      if (bloco[1] === 'expand') {
        conteudo.push({ type: 'expand', attrs: { title: bloco[2].trim() }, content: dentro });
      } else {
        const tipo = bloco[2].trim() || 'info';
        if (!PAINEIS.includes(tipo)) throw new Error(`painel inválido "${tipo}" (use: ${PAINEIS.join(', ')})`);
        conteudo.push({ type: 'panel', attrs: { panelType: tipo }, content: dentro });
      }
      continue;
    }

    const imagem = l.trim().match(IMAGEM);
    if (imagem) {
      const m = midia?.[imagem[2]];
      const id = typeof m === 'string' ? m : m?.id;
      // quirk: sem mediaId (dry-run, ou o Jira não redirecionou para a Media API) a imagem vira texto — media com id falso faz o Jira recusar o comentário inteiro
      // quirk: sem largura o Jira desenha o print num tamanho padrão pequeno, e a tela só se lê clicando — por isso o padrão é a coluna inteira
      const largura = imagem[3] === undefined ? 100 : Number(imagem[3]);
      if (largura < 1 || largura > 100) throw new Error(`largura de imagem inválida "${imagem[3]}%" (use de 1% a 100%)`);
      if (id) {
        conteudo.push({ type: 'mediaSingle', attrs: { layout: 'center', width: largura, widthType: 'percentage' }, content: [{ type: 'media', attrs: { type: 'file', id, collection: '', ...(m?.largura ? { width: m.largura, height: m.altura } : {}) } }] });
        if (imagem[1]) conteudo.push({ type: 'paragraph', content: [{ type: 'text', text: imagem[1], marks: [{ type: 'em' }] }] });
      } else {
        conteudo.push({ type: 'paragraph', content: [{ type: 'text', text: `📎 ${imagem[1] || imagem[2]}` }] });
      }
      i += 1;
      continue;
    }

    if (l.startsWith(ADF_CERCA)) {
      const lang = l.slice(3).trim();
      const corpo = [];
      i += 1;
      while (i < linhas.length && !linhas[i].startsWith(ADF_CERCA)) { corpo.push(linhas[i]); i += 1; }
      i += 1;
      conteudo.push({ type: 'codeBlock', ...(lang ? { attrs: { language: lang } } : {}), content: [{ type: 'text', text: corpo.join('\n') || ' ' }] });
      continue;
    }

    const titulo = l.match(/^(#{1,6})\s+(.*)$/);
    if (titulo) { conteudo.push({ type: 'heading', attrs: { level: titulo[1].length }, content: adfInline(titulo[2]) }); i += 1; continue; }

    if (/^---+$/.test(l.trim())) { conteudo.push({ type: 'rule' }); i += 1; continue; }

    if (l.trim().startsWith('|') && adfSeparador(linhas[i + 1])) {
      const tabela = [{ type: 'tableRow', content: adfCelulas(l).map(adfCelula('tableHeader')) }];
      i += 2;
      while (i < linhas.length && linhas[i].trim().startsWith('|')) {
        tabela.push({ type: 'tableRow', content: adfCelulas(linhas[i]).map(adfCelula('tableCell')) });
        i += 1;
      }
      conteudo.push({ type: 'table', attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: tabela });
      continue;
    }

    // Sem o orderedList, "1." caía no parágrafo e o passo a passo do bug chegava no Jira numa linha só.
    const lista = ADF_LISTAS.find((t) => t.re.test(l));
    if (lista) {
      // quirk: sub-item indentado encerrava a lista, e o item seguinte abria OUTRA lista numerada a partir do 1 — o "2." do passo a passo aparecia no Jira como um segundo "1."
      const base = recuo(l);
      const itens = [];
      while (i < linhas.length && lista.re.test(linhas[i]) && recuo(linhas[i]) === base) {
        let texto = linhas[i].replace(lista.re, '');
        i += 1;
        while (i < linhas.length && /\S/.test(linhas[i]) && recuo(linhas[i]) > base && !adfItem(linhas[i])) { texto += ' ' + linhas[i].trim(); i += 1; }
        const sub = [];
        while (i < linhas.length && linhas[i].trim() && recuo(linhas[i]) > base) { sub.push(linhas[i]); i += 1; }
        const corte = sub.length ? Math.min(...sub.map(recuo)) : 0;
        itens.push({ type: 'listItem', content: [{ type: 'paragraph', content: adfInline(texto) }, ...(sub.length ? blocos(sub.map((s) => s.slice(corte)), midia) : [])] });
      }
      const inicio = Number(l.match(/^\s*(\d+)/)?.[1]) || 1;
      conteudo.push({ type: lista.tipo, ...(lista.tipo === 'orderedList' ? { attrs: { order: inicio } } : {}), content: itens });
      continue;
    }

    const paragrafo = [l.trim()];
    i += 1;
    while (i < linhas.length && !terminaParagrafo(linhas[i])) { paragrafo.push(linhas[i].trim()); i += 1; }
    conteudo.push({ type: 'paragraph', content: adfInline(paragrafo.join(' ')) });
  }
  // nota: painel/expand vazio o Jira recusa — um parágrafo vazio é o mínimo que ele aceita
  return conteudo.length ? conteudo : [{ type: 'paragraph', content: [] }];
}

// Markdown -> ADF. A versão anterior virava cada LINHA num parágrafo de texto puro, o que fazia
// título, tabela, bloco de código e negrito chegarem no Jira como markup cru (visto ao abrir os bugs
// de locação do QA-3080). Texto simples segue funcionando: linhas seguidas viram um parágrafo só.
export function adf(t, midia = {}) {
  return { type: 'doc', version: 1, content: blocos(String(t || '').split(/\r?\n/), midia) };
}

// Painel ADF (info/note/success/warning/error) — o mesmo bloco colorido do editor do Jira.
export function adfPanel(tipo, texto) {
  return { type: 'doc', version: 1, content: [{ type: 'panel', attrs: { panelType: tipo }, content: [{ type: 'paragraph', content: adfInline(texto) }] }] };
}

// quirk: sem width/height no nó media o Jira não sabe a proporção do print, reserva uma caixa de proporção padrão e centraliza a imagem dentro dela — o resto vira faixa em branco acima e abaixo do print
/** Largura e altura em pixels de um PNG, JPEG, GIF, WebP ou vídeo WebM, lidas do cabeçalho; null se não reconhecer. */
export function dimensoesDaImagem(buf) {
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) {
    // WebM (EBML): PixelWidth é o elemento 0xB0 e PixelHeight o 0xBA, com tamanho de 1 ou 2 bytes (0x81/0x82)
    const ler = (id) => {
      for (let i = 0; i + 4 < Math.min(buf.length, 1 << 20); i++) {
        if (buf[i] !== id) continue;
        if (buf[i + 1] === 0x82) return buf.readUInt16BE(i + 2);
        if (buf[i + 1] === 0x81) return buf[i + 2];
      }
      return 0;
    };
    const [largura, altura] = [ler(0xb0), ler(0xba)];
    return largura && altura ? { largura, altura } : null;
  }
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { largura: buf.readUInt16LE(6), altura: buf.readUInt16LE(8) };
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const tipo = buf.toString('ascii', 12, 16);
    if (tipo === 'VP8X') return { largura: 1 + buf.readUIntLE(24, 3), altura: 1 + buf.readUIntLE(27, 3) };
    if (tipo === 'VP8 ') return { largura: buf.readUInt16LE(26) & 0x3fff, altura: buf.readUInt16LE(28) & 0x3fff };
    if (tipo === 'VP8L') { const b = buf.readUInt32LE(21); return { largura: 1 + (b & 0x3fff), altura: 1 + ((b >> 14) & 0x3fff) }; }
    return null;
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    // JPEG: anda de segmento em segmento até um SOF (C0–CF, menos C4/C8/CC), que traz altura e largura
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marca = buf[i + 1];
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) return { largura: buf.readUInt16BE(i + 7), altura: buf.readUInt16BE(i + 5) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}
