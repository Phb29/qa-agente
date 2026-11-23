---
name: escrever-no-ticket
description: COMPARTILHADA — escreve num ticket do Jira, no COMENTÁRIO ou na DESCRIÇÃO, com texto rico (painel colorido, status, tabela, bloco recolhível, menção) e prints dentro do texto, pelo scripts/jira.mts. É o canal único de escrita no Jira dos dois agentes (suíte automatizada e teste manual). Use sempre que for comentar num ticket, abrir um com descrição ou reescrever a descrição; o CONTEÚDO (o template do veredito, do bug, da entrega) vem da skill que está trabalhando, esta só formata e publica.
---

# Escrever no ticket

Esta skill é o **como escrever**. O **o que dizer** é da skill que te trouxe até aqui: o veredito
do teste manual tem o template dele na skill do manual, o bug tem o dele em
`.claude/skills/auto-abrir-bug-produto/template.md`. Preencha o template de lá e publique com o
que está abaixo.

## Onde escrever

| Destino | Quando | Comando |
|---|---|---|
| **Comentário** | acrescentar ao ticket: veredito, entrega, devolução, evidência nova | `comment <CHAVE> --arquivo x.md` |
| **Descrição, ao abrir** | o corpo de um ticket que você está criando | `create "<título>" … --desc-arquivo x.md` |
| **Descrição, depois** | reescrever o corpo de um ticket que já existe — **substitui o inteiro** | `descricao <CHAVE> --arquivo x.md` |

Na dúvida, comentário: ele preserva o que já estava escrito; a descrição se perde ao ser regravada.
Quem decide *abrir* um ticket (board, tipo, etiqueta) é a skill dona do fluxo — esta só escreve o
texto dele.

## Como publicar

1. Escreva o texto num arquivo `.md`, **fora do git**, junto da evidência a que ele se refere
   (os prints ficam ao lado e são citados por caminho relativo ao `.md`).
2. Confira sem publicar: o comando do destino com `--dry-run`. Mostra quantas imagens subiriam e o
   que vai para o Jira. Erro de sintaxe (bloco sem fechar, cor ou painel inválido) aparece aqui,
   não no Jira.
3. Publique: o mesmo comando sem `--dry-run`. As imagens sobem como anexo do ticket e aparecem
   **dentro** do texto, no ponto em que foram citadas. No `create`, o ticket nasce com o texto e os
   prints entram em seguida — se o upload falhar, o texto já está lá.

Da pasta de uma vertical (`playwright/`, `manual/`), o script é `../scripts/jira.mts` — ele acha o
`.env` da raiz sozinho.

## O que o markdown aceita

| Escreva | Vira no Jira |
|---|---|
| `:::painel success` … `:::` | painel colorido: `info` `note` `success` `warning` `error` |
| `:::expand Título` … `:::` | bloco recolhível (o detalhe que não precisa estar à vista) |
| `{status:APROVADO\|green}` | etiqueta colorida: `green` `red` `yellow` `purple` `blue` `neutral` |
| `{@<accountId>\|Nome}` | menção que notifica a pessoa |
| `![legenda](prints/ca05.png)` | o print na largura da coluna, com a legenda em itálico embaixo (linha sozinha) |
| `![legenda](prints/ca05.png){60%}` | o mesmo, menor: largura de 1% a 100% (sem nada, é 100%). **Não use no comentário de veredito do teste manual**: lá a evidência vai sempre a 100%, porque reduzida ela não se lê |
| `![legenda](video/ca05.webm)` | o vídeo no lugar, com o player do Jira (mesma regra da linha) |
| `# título`, `- lista`, `1. lista`, tabela, ` ``` `código` ``` `, `---` | o equivalente do Jira |
| `**negrito**`, `*itálico*`, `` `código` `` | idem |

Blocos `:::` aninham (um `expand` dentro de um painel). **Linha em branco separa parágrafos**;
linhas seguidas sem linha em branco viram um parágrafo só.

## Regras que valem para os dois agentes

- **No comentário, diga quem comentou na primeira linha.** O agente (automatizado ou manual, e
  qual) e o tipo de comentário. É por essa linha que a rodada seguinte acha o histórico no ticket.
- **Curto no topo, detalhe recolhido.** Quem abre o ticket lê o veredito e o resumo; ambiente,
  dados alterados e caso de borda vão em `:::expand`.
- **Menção só com o accountId real** (`node scripts/jira.mts whois "<nome>"`). Sem ele, escreva o
  nome sem `{@…}` — menção com id errado notifica outra pessoa ou ninguém.
- **Nunca cole segredo**: token, senha, cookie, header de autorização. Print de DevTools e log de
  rede costumam trazer um — confira antes de citar.
- **Print é escolha, não despejo.** Os que provam o que você afirma vão no texto; o resto fica na
  pasta de evidência, citada no rodapé.
- **Recusou?** Se o Jira devolver erro, leia a mensagem, corrija o `.md` e confira de novo com
  `--dry-run`. Não caia para texto puro sem dizer isso no seu resumo final.

## Anexo sem texto

```
node scripts/jira.mts anexar <CHAVE> <arquivo> [...]       # sobe; devolve id e mediaId em JSON
node scripts/jira.mts anexos <CHAVE>                       # lista o que o ticket tem
node scripts/jira.mts baixar <CHAVE> <pasta> [--tipo video|imagem|todos]
```

`baixar` é o caminho para ler o vídeo ou o print que o dev ou o cliente anexou ao ticket.
