---
name: manual-testar-ticket
description: TESTE MANUAL — testa um ticket do Jira como um QA sênior, de caixa-preta. Lê os critérios de aceite, confere se o ticket dá para testar, confere o ambiente, testa cada critério no navegador com evidência e captura, e fecha com um veredito (aprovado, reprovado ou não executável) comentado no Jira e o ticket movido. A rodada 1 testa todos os critérios; o reteste testa o que reprovou e o que a correção declarada pelo dev tocou, e herda o resto. Use quando passarem a chave ou o link de um ticket para testar.
---

<!--
Esta skill é genérica. Tudo o que é da sua empresa ela lê de manual/docs/:
  sistema.md (ambientes, usuários, telas, cuidados) · fluxo-jira.md (status e pessoas)
  lideres-tecnicos.md · mapa-servicos.md · padrao-ticket.md · receitas.md
Para adaptar a outro software, preencha esses arquivos — não precisa mexer aqui.
Mexa aqui só se o seu PROCESSO for diferente (ex.: não há vídeo, não há reteste).
-->

# Testar ticket

**Quem você é e como decide está em `manual/CLAUDE.md`**: os portões, os três vereditos, a lista
fechada de motivos do não executável, o que um ticket precisa ter, observar × assertar, evidência e
captura, rodada 1 × reteste. Esta skill é a ordem em que isso acontece e os comandos de cada passo.
Onde as duas parecerem divergir, vale o CLAUDE.md.

**O sistema que você testa está em `manual/docs/sistema.md`** — ambientes, usuários, telas, regras e
cuidados. Leia antes do passo 4. Se ele ainda estiver com os marcadores `<...>` do modelo, pare e diga
ao QA que o pacote precisa ser configurado (README, seção "Adaptar para outra empresa").

Você testa como o cliente usaria: pela tela e, quando o critério pede, pela API. **Não lê o código
nem o diff do dev** — o que o dev mudou você sabe pelo que ele declarou no ticket.

Entrada: a chave (`ABC-123`) ou o link do ticket.

**`--ensaio`**: tudo acontece de verdade — os critérios são testados, o veredito sai — **menos
escrever no ticket**. Nada de `atribuir`, `status`, `comment` nem `anexar`: o comentário fica em
`evidencias/<CHAVE>/rodada-NN/comentario.md` (conferido com `comment <CHAVE> --arquivo … --dry-run`), e a
saída diz o caminho. É como se testa o agente num ticket real sem que o dev veja nada.

**Contexto é o que custa.** Cada chamada ao modelo relê a conversa inteira, então o que entra nela
fica pago até o fim. Daí três regras:
- **Não releia print** que você ou o subagente tiraram — confira pelo texto (`find`, snapshot
  com `target`, a resposta da API). Print é evidência para o ticket, não para você. (A imagem que veio
  **anexada ao ticket** é outra coisa: essa você lê.)
- **Quem navega é o subagente** (passo 7). Aqui você só abre o navegador para conferir o ambiente e
  para o que nenhum critério cobre.
- **Snapshot sempre com `target`** (`main`, a tabela, o modal), nunca a página inteira.

Os comandos de Jira são `node scripts/jira.mts …`, a partir da raiz do repo. Tudo que o teste gera
(prints, vídeos, capturas, o texto do comentário) vai para `evidencias/<CHAVE>/rodada-NN/`, fora do
git — **o que importa sobe para o ticket** (passo 8).

## 1. Ler o ticket

`get <CHAVE> --comentarios` traz a descrição, todos os comentários e a linha `Devolver para:` — a
pessoa que recebe o ticket de volta se ele não passar. Tire dele:

- **Critérios de aceite.** Use a numeração do ticket (`CA-01`…); sem numeração, numere na ordem em
  que aparecem e diga isso no relatório. A mesma numeração vale em todas as rodadas.
- **O bloco `[agente-teste]`** do dev (formato em `manual/docs/padrao-ticket.md`; vale o mais recente):
  o `ambiente`, a `massa` e as `branches` de cada repositório. Escrito de outro jeito também vale, se
  for inequívoco; o nome da branch é o escrito, nunca deduzido.
- **A categoria**, se o ticket tiver.
- **O número desta rodada**: 1 + quantos comentários seus já há no ticket — os que começam por
  `🤖 Agente de teste · <VEREDITO> · rodada N`. **Conte; não copie o N do último.** Todo comentário seu
  conta, inclusive o NÃO EXECUTÁVEL que não testou nada. É esse N que vai no cabeçalho e na pasta
  `rodada-NN`.
- **A rodada anterior**: o último desses comentários — o veredito e o motivo estão na primeira linha.
- **É reteste?** É quando o último comentário seu que **testou critérios** foi REPROVADO. No reteste,
  leia **a declaração do dev**: o bloco `[agente-teste] reteste` dizendo o que corrigiu e onde.
- **Anexos.** `baixar <CHAVE> evidencias/<CHAVE>/rodada-NN/anexos`. Imagem você lê direto; vídeo vira
  quadros com `bash manual/tools/video-quadros.sh <vídeo> <pasta> 2` (leia primeiro os mosaicos).

## 2. Portão 0 — o ticket dá para testar?

Confira, contra a seção 3 do `manual/CLAUDE.md`. O que é do **ticket** devolve o ticket; o que é de
**um critério** derruba só ele, e o ticket segue com os outros:

| Confira | Como | Faltou → |
|---|---|---|
| Cada critério tem onde, ação, resultado observável e estado durável | lendo | **só o critério**: `NÃO EXECUTÁVEL / insumo incompleto`. Devolve o ticket se não sobrar nenhum |
| Cada critério cabe no ambiente de teste | lendo, contra `manual/docs/sistema.md` (integrações, cuidados) | **só o critério**: `NÃO EXECUTÁVEL / ambiente antes`, dizendo o que falta |
| Uma branch para cada repositório alterado | **resolva, não exija**: (1) o bloco `[agente-teste]`; (2) o PR citado — `gh pr view <n> -R <org>/<repo> --json headRefName` (MR do GitLab: `curl -s -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://gitlab.com/api/v4/projects/<grupo>%2F<repo>/merge_requests/<n>` → `source_branch`); (3) a branch com a chave do ticket no nome (`git ls-remote --heads <url> \| grep -i <CHAVE>`), se houver **uma só** | devolve **só** se nada resolver, ou se resolver em mais de uma |
| Cada branch existe | `git ls-remote --heads <url> <branch>` (URL em `manual/docs/mapa-servicos.md`) | devolve |
| Nenhum PR das branches com conversa de revisão aberta | `bash manual/tools/threads-abertas.sh <url> <branch>` (GitHub) | devolve, dizendo em quais PRs |
| Reteste: a declaração do dev do que corrigiu | lendo | devolve |
| A massa que não dá para criar | lendo | segue — vira `massa ausente` no critério que precisar dela |

Sem acesso para conferir (repositório fora do mapa, `gh` sem login, mapa vazio) não é falta do ticket:
siga e registre "não conferido: <o quê>".

Na dúvida se um critério cabe, teste: o portão 0 tira do escopo o que é certo que não cabe, não o
que talvez não caiba.

**Devolver** é o veredito `NÃO EXECUTÁVEL / insumo incompleto`: comentário dizendo exatamente o que
faltou e mencionando a pessoa de `Devolver para:` (passo 8), ticket no status de não executável de
`manual/docs/fluxo-jira.md` (passo 9). **Não abra o navegador.**

## 3. Assumir

(Em `--ensaio`, pule — o ticket fica como está.)

Mova para o status "Testando" de `manual/docs/fluxo-jira.md` e atribua ao usuário do agente de lá
(ou a você mesmo, QA, se não houver): `status <CHAVE> "<Testando>"` e `atribuir <CHAVE> "<usuário>"`.
Anote a hora: é o início da rodada.

## 4. Portão 1 — o ambiente está íntegro?

O QA já publicou as branches e fez o login (teste assistido). Confira:

1. A URL é a do ambiente de teste de `manual/docs/sistema.md` (ou a do bloco `[agente-teste]`).
   **Se for a de produção, pare** e avise o QA.
2. Faça as checagens de "Como saber que o ambiente está íntegro" do `sistema.md`. A tela principal
   carrega sem erro.
3. Se o `sistema.md` diz como ver a versão publicada, confira que é a da branch do ticket.
4. Cada parte que as branches alteram responde: a tela que o critério usa abre, e a rede não mostra
   erro desse serviço.
5. Telas de primeiro acesso (atualização de banco etc.): siga o `sistema.md`. Falha numa delas é
   registrada com a mensagem — pode ser o próprio defeito do ticket.

Falhou → `NÃO EXECUTÁVEL / ambiente antes`, dizendo ao QA o que viu. Não tente consertar. Anote a hora.

## 5. O escopo da rodada e o mapa de caminhos

**Rodada 1 testa todos os critérios.** O **reteste** testa os reprovados e os **tocados** pela
correção, e herda os outros — os três grupos e a régua de "mesma operação" estão em
`manual/CLAUDE.md` ("Rodada 1 × reteste"). Para herdar, o vídeo do critério precisa estar anexado ao
ticket (`anexos <CHAVE>`): sem ele, o critério é retestado.

> Exemplo. Rodada 1: CA-05 falhou — editar o pedido não recalculava o desconto. O dev declara: "ao
> editar, o desconto é recalculado sobre o total novo". A operação é **recalcular o desconto na
> edição**. Rodada 2: CA-05 (reprovado) e CA-04 (edita o pedido: tocado) a fundo; CA-01 a CA-03
> (criam o pedido, não editam) herdados; no entorno, editar pedido sem desconto.

Antes de testar, escreva em `evidencias/<CHAVE>/rodada-NN/mapa.md` o que você vai cobrir:

- **Por critério:** criar e editar (o mesmo campo costuma estar nos dois); cada jeito de entrar com o
  dado (digitar, colar, API); cada variante que o ticket cita; o limite e um passo além; recarregar e
  reabrir pela lista.
- **Entorno:** até 5 caminhos vizinhos do que a correção mexeu, em ordem de risco — o que divide o
  mesmo campo, a mesma regra ou o mesmo estado. Não é lista do que a tela tem: é do que a mudança
  pode ter quebrado.

Cada linha termina com um destino: testado, ou não testado com o motivo. No reteste, cada critério
diz também o grupo e o porquê: `CA-03 · herdado · cria o pedido; não passa pela edição`.

**Calibre pela fragilidade:** com categoria, `search` pelos defeitos recentes daquela categoria e
tela; onde já quebrou, cave mais. Sem categoria, teste sem essa calibragem e diga isso numa nota.

## 6. Usuários

Use os usuários de teste de `manual/docs/sistema.md` ("Acesso e usuários de teste"): o padrão para
tudo, e o restrito só quando o critério exigir — o relatório diz onde cada um foi usado. **Senha é com
o QA:** se for preciso logar de novo, pare no campo e peça.

Teste só no ambiente de teste. Nunca em produção, nunca em dado que outro time usa (se o
`sistema.md` listar algum).

## 7. Testar cada critério

Para cada critério do escopo, **delegue ao subagente `manual-testar-criterio`** (ferramenta `Agent`),
**um por vez** — o navegador é um só, e dois subagentes juntos se atropelam. O contexto dele é
descartado ao fim do critério, e é isso que mantém o seu pequeno. Não teste o critério você mesmo.

O pedido a cada um leva tudo de que ele precisa, porque ele não lê o ticket:

- o id e o texto do critério, e as linhas dele no `mapa.md`;
- a chave do ticket e a pasta `evidencias/<CHAVE>/rodada-NN/`;
- o caminho até a tela (do `sistema.md`, seção "Módulos e telas") e o `aprendido da tela` dos
  subagentes anteriores;
- a massa disponível, inclusive a `massa criada` pelos anteriores;
- o usuário a usar;
- os **cuidados** do `sistema.md` que valem para aquela tela (ex.: não emitir nota em produção);
- no entorno, a URL do ambiente de referência, se houver;
- no reteste, o que o dev declarou ter mudado.

Ele grava o vídeo, testa, guarda print e captura, e devolve o veredito do critério em poucas linhas.
Você confia no resultado; só delegue de novo se a resposta vier incompleta (sem veredito, ou
reprovado sem esperado × obtido), dizendo o que faltou.

**O subagente navega; quem decide é você.** Ele desiste cedo de um obstáculo. Voltou
`NÃO EXECUTÁVEL (massa ausente)` ou "não alcancei a tela": antes de aceitar, pense no caminho que ele
não tentou — editar o perfil de acesso, criar pela API o que a tela não deixa salvar, apagar o que
impede, uma receita de `manual/docs/receitas.md` — e delegue **de novo, uma vez**, com esse caminho
escrito no pedido.

Todo critério é gravado, inclusive o que se prova pela API: o vídeo mostra onde o efeito aparece na
tela, ou o GET aberto no navegador — o leitor do ticket não lê `curl`.

## 7b. Explorar o entorno e confirmar regressão

Com os critérios feitos, percorra as linhas de **entorno** do mapa — até 20 min, cada uma por um
subagente como no passo 7 (`ENT-01`…). Passou → um item na linha de entorno do comentário, sem vídeo.

Quebrou → repita do zero (a regra da instabilidade vale aqui) e, confirmado, **repita os mesmos passos
no ambiente de referência** (se o `sistema.md` tiver um), gravando `ENT-0X-referencia`:

| Na referência | É | No veredito |
|---|---|---|
| funciona | **regressão** — a correção quebrou | reprova, numa linha própria "Regressão fora dos critérios", com os dois vídeos |
| também quebra | já existia | nota, com o vídeo do ticket |
| não deu para comparar (sem referência) | regressão provável | nota destacada, **não reprova** |

Horário: monte os dados em volta da hora atual, nunca mexa no relógio, e registre hora e fuso.
Dados que você alterou para testar entram no relatório com o estado final.

Limite: 4 horas desde o passo 3. Passou disso, termine o critério em andamento e pare; os que
faltaram vão para o relatório como não verificados, e você avisa o QA — a não ser que algum já tenha
reprovado, porque reprovado tem prioridade.

## 8. Portão 2, veredito e comentário

**Portão 2:** rode de novo o passo 4. Falhou → `NÃO EXECUTÁVEL / ambiente caiu durante` e **descarte
os resultados da rodada**, inclusive os que passaram.

**Veredito:** consolide como manda o `manual/CLAUDE.md`, sobre todos os critérios — no reteste, os
herdados contam com o veredito da rodada de onde vêm.

**Comentário** (em `--ensaio`, só o arquivo e o `--dry-run`): preencha [`comentario.md`](comentario.md)
em `evidencias/<CHAVE>/rodada-NN/comentario.md`. **O comentário tem a forma do veredito, e é curto**:

| Veredito | O que o comentário mostra | Alvo |
|---|---|---|
| APROVADO (forma A) | uma linha por critério: o id, o que se verificou em uma frase, e `vídeo: CA-01.webm`, com **o print do critério logo abaixo** | ~1.200 caracteres, mais os prints |
| REPROVADO (forma B) | um bloco por reprovado (e por regressão), com passos, esperado × obtido, o vídeo citado e **o print do que quebrou**. Os aprovados no fim, cada um com o seu print — os vídeos deles vão **anexados**, porque é com eles que o reteste os herda | ~2.500, mais os prints |
| NÃO EXECUTÁVEL (forma C) | o motivo da lista fechada em 1–3 linhas, na língua do dev, e quem age. Sem tabela, sem vídeo | ~600 |
| NÃO EXECUTÁVEL **pelo mesmo motivo** da rodada anterior, nada testado (forma D) | **uma linha só**: "de novo: <motivo>, como na rodada N" | uma linha |

O que a forma não muda: todo critério testado tem evidência, todo veredito diz o que não foi
verificado e por quê, e parcial não vira aprovado. O que se corta é repetição e infraestrutura, não rigor.

- **Um cabeçalho só**, sempre dentro do painel colorido: `:::painel success` no APROVADO,
  `:::painel error` no REPROVADO, `:::painel warning` no NÃO EXECUTÁVEL. Dentro dele, em negrito,
  `🤖 Agente de teste · <VEREDITO> · rodada <N> · <placar>` — é por essa linha que a próxima rodada se
  orienta.
- **Vídeo é anexo, nunca corpo.** Copie para `evidencias/<CHAVE>/rodada-NN/anexar/` com o nome do
  critério: `CA-01.webm` na rodada 1, `CA-01-r2.webm` da rodada 2 em diante. Suba com
  `anexar <CHAVE> <arquivos>` e cite pelo nome, em texto. Nunca `![…](….webm)`.
- **Um print por critério testado**, logo abaixo da linha dele: no aprovado, o estado que confirma
  depois de recarregar; no reprovado, o que quebrou. É o `<ID>-<o-que-mostra>.png` que o subagente
  guardou — escolha pelo nome, não o abra.
- **Como foi testado** (ambiente, código, horário, usuários, dados alterados, não conferido) vai
  inteiro só no primeiro comentário A ou B do ticket. Nos seguintes, uma linha com o que mudou.
- **Quem age**, no NÃO EXECUTÁVEL, é o dono da fila de `manual/docs/fluxo-jira.md`, pelo nome
  (`whois <AGENT_OWNER_EMAIL do .env>`). Sem o nome, escreva o papel ("o dono da fila — publicar a branch").
- **Capturas**: nas formas A e B, as capturas da rodada viram **um** arquivo, `captura-rN.md` (os
  `captura/CA-XX.md` concatenados), anexado uma vez.

**Antes de publicar, mostre o resumo ao QA e espere o "pode"** (teste assistido). Publique pela skill
`escrever-no-ticket`: `comment <CHAVE> --arquivo …` (confira antes com `--dry-run`) e
`anexar <CHAVE> anexar/*`.

Antes de publicar, releia o status do ticket. Se ele saiu de "Testando" enquanto você testava,
publique dizendo isso e **não mova** o ticket no passo 9.

## 9. Mover o ticket

(Em `--ensaio`, pule.) Os status e as pessoas vêm de `manual/docs/fluxo-jira.md`:

| Veredito | Comando | Com quem fica |
|---|---|---|
| APROVADO | `status <CHAVE> "<status de aprovado>"` — nenhum alcançável → fica em Testando, e o motivo vai no próprio comentário | quem está em `manual/docs/lideres-tecnicos.md` para o produto (prefixo da chave) — `whois "<nome>"` → `atribuir <CHAVE> <accountId>`; fora da tabela → `Devolver para:` |
| REPROVADO | `status <CHAVE> "<status de reprovado>"` (com `--via "<Testando>"` se o fluxo exigir) | `Devolver para:` — `atribuir <CHAVE> <accountId>` |
| NÃO EXECUTÁVEL | `status <CHAVE> "<status de não executável>"` | o **dono da fila**: `atribuir <CHAVE> <AGENT_OWNER_EMAIL do .env>`; sem ele, quem estava |

**Mover sempre atribui.** O ticket nunca termina atribuído ao usuário do agente fora de "Testando".

Os destinos separados por `|` são tentados em ordem, e só por transição direta. Achou na lista de
transições um nome de aprovação que o `fluxo-jira.md` não traz? Use-o, diga no relatório qual foi, e
sugira ao QA acrescentá-lo ao `fluxo-jira.md`. `Devolver para:` vazio → o ticket não é atribuído, e o
comentário diz que ninguém foi achado.

## Saída (curta)

Ticket, rodada, escopo, veredito, a contagem por resultado e o link do comentário — em `--ensaio`, o
caminho do `comentario.md`. No NÃO EXECUTÁVEL de ambiente, diga ao QA o diagnóstico inteiro (o que
falhou, a mensagem de erro), que não vai no ticket.

Aprendeu algo sobre o sistema que vai poupar tempo no próximo ticket (um modal, um caminho, uma
regra)? **Sugira ao QA** acrescentar em `manual/docs/sistema.md` ou `manual/docs/receitas.md`.
