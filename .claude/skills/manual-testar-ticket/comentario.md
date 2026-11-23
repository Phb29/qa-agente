<!--
O comentário tem a forma do veredito, e tem tamanho. Quem abre o ticket precisa saber em segundos o
que fazer, e o ticket que volta acumula rodadas: o que uma rodada anterior já disse não se repete.

- A · APROVADO        → uma linha por critério testado: o que se verificou e o vídeo; no reteste, os herdados
                        numa linha só, com a rodada de onde vêm. Alvo: até ~1.200 caracteres.
- B · REPROVADO       → só os reprovados, com detalhe; os aprovados numa linha no fim (vídeos anexados,
                        que o reteste herda). Alvo: até ~2.500.
- C · NÃO EXECUTÁVEL  → o motivo em 1–3 linhas e quem age, sem tabela de critérios. Alvo: até ~600.
- D · NÃO EXECUTÁVEL pelo mesmo motivo da rodada anterior, nada testado → uma linha.

Regras que valem para as quatro:

- **Um cabeçalho só**, a primeira linha: `🤖 Agente de teste · <VEREDITO> · rodada <N> · <placar>`.
  O veredito vai em TEXTO, não só em `{status:…}`: o `get --comentarios` não lê a etiqueta, e é por
  essa linha que a rodada seguinte se conta e acha o veredito anterior. N = 1 + os comentários
  anteriores do agente no ticket (passo 1 da skill), nunca o N escrito no último.
- **Vídeo nunca vai no corpo.** Ele sobe com `anexar`, com o nome do critério (`CA-01.webm`; da
  rodada 2 em diante `CA-01-r2.webm`; um segundo no mesmo critério `CA-01-b.webm`), e o comentário o
  cita pelo nome, em texto: `vídeo: CA-01.webm`. Nada de `![…](….webm)`.
- **Um print por critério testado**, logo abaixo da linha (ou do bloco) dele, no aprovado e no
  reprovado: no aprovado, o estado que confirma o critério depois de recarregar; no reprovado, o que
  quebrou. É o `<ID>-<o-que-mostra>.png` que o subagente guardou, na largura cheia (nunca `{NN%}`).
  O NÃO EXECUTÁVEL não leva print.
- **O cabeçalho vai sempre dentro do painel**: `success` no aprovado, `error` no reprovado, `warning`
  no não executável. Sem o painel, o comentário está fora da forma.
- **Como foi testado** vai inteiro só no primeiro comentário A ou B do ticket (com a nota de
  numeração dos critérios, se você numerou). Nos seguintes, uma linha com o que mudou (outra branch ou
  imagem, outro banco) — ou nada, se nada mudou. NE nunca o leva.
- **Infraestrutura não entra.** Id de pipeline ou job, log de deploy, erro de banco: isso é do dono da
  fila e vai na resposta ao QA. No ticket, o que faltou dito como o dev entende ("a branch X ainda não
  foi publicada no ambiente de teste").
- Sem rodapé fixo e sem repetir o que a skill faz depois (quem reatribui, como a fila pega).
-->

<!-- ═══════════════ CABEÇALHO (formas A, B e C; a D é ele mesmo) ═══════════════ -->

:::painel <success | error | warning>
🤖 **Agente de teste · <APROVADO | REPROVADO | NÃO EXECUTÁVEL> · rodada <N> · <A/M critérios> <· motivo, no NE: insumo incompleto | ambiente antes | ambiente caiu durante | massa ausente | instabilidade não reproduzível>**
:::

<!-- ═══════════════ FORMA A — APROVADO ═══════════════ -->

<Uma frase: o que o ticket muda e o que o teste concluiu.>

**✅ CA-01** — <o que se verificou, em uma frase, com o estado depois de recarregar> · vídeo: `CA-01.webm`

![<o que o print prova>](CA-01-<o-que-mostra>.png)

**✅ CA-02** — <…> · vídeo: `CA-02.webm`

![<…>](CA-02-<o-que-mostra>.png)

<Um bloco por critério, todos, cada um com o seu vídeo e o seu print abaixo — inclusive o provado pela
API (o print mostra o efeito na tela, ou a consulta que o prova aberta no navegador). Sem tabela, sem
seção.>

<!-- ═══════════════ FORMA B — REPROVADO ═══════════════ -->

<Uma frase: o que não funciona, dito como o usuário veria. É a primeira coisa que o dev lê.>

**❌ CA-04 — <o que quebra, em uma linha>**

1. <passo, com o valor usado>
2. <passo>

**Esperado:** <…> · **Obtido:** <…, o estado depois de recarregar> · vídeo: `CA-04.webm`

![<o que quebrou>](CA-04-<o-que-mostra>.png)

<A causa provável, se você a viu de fora (a resposta da API, a leitura que diverge), em uma frase.>

<Regressão confirmada (quebra com a branch, funciona na referência) também reprova e ganha a mesma
forma, com os dois vídeos citados:>

**❌ Regressão — <o caminho, em uma linha>** · <passos e esperado × obtido> · vídeos: `ENT-0X.webm` (com a branch) e `ENT-0X-referencia.webm` (sem ela)

**Aprovados nesta rodada** — vídeos anexados; o reteste retesta só o que a correção tocar e herda o resto:

**✅ CA-01** — <o que se verificou, em uma frase> · vídeo: `CA-01.webm`

![<o que o print prova>](CA-01-<o-que-mostra>.png)

<Critério não executável numa rodada reprovada: uma linha, "CA-05 não executável — massa ausente: …".>

<!-- ═══════════════ FORMA C — NÃO EXECUTÁVEL ═══════════════ -->

**O que falta:** <em 1–3 linhas, na língua do dev: a branch sem imagem publicada, o ambiente que não
subiu, o dado que o ticket não traz. Insumo incompleto: menciona quem devolve ({@id|Nome}).>

**Quem age:** <Nome do dono da fila (dono da fila) — o que ele faz. Sem o nome: "o dono da fila — …",
nunca "Quem age: , dono da fila">.

<Testou parte? Uma linha só, sem tabela nem vídeo: "CA-01 a CA-09 aprovados; CA-10 a CA-14 sem
massa: <o quê>." Se o ambiente caiu no meio: "CA-01 e CA-02 passaram antes de o ambiente cair; não
valem como veredito.">

<!-- ═══════════════ FORMA D — MESMO MOTIVO DE NOVO ═══════════════ -->
<Só o cabeçalho, com o motivo dentro. Vale quando o último comentário seu também foi NÃO EXECUTÁVEL
pela mesma causa e nada foi testado.>

:::painel warning
🤖 **Agente de teste · NÃO EXECUTÁVEL · rodada <N>** · de novo: <motivo>, como na rodada <N-1>. <O que mudou desde então, se algo — ex.: "o backend já foi publicado; falta o frontend".>
:::

<!-- ═══════════════ BLOCOS FINAIS (só A e B; apague o que não tiver conteúdo) ═══════════════ -->

:::expand Entorno e notas
- **Entorno:** <caminho> ok · <caminho> ok · <caminho> já existia (nota abaixo) · não explorado: <caminho> (<motivo>)
- **Nota:** <o que viu fora dos critérios e é acionável: o quê, onde, por que parece errado>
:::

:::expand Como foi testado
<Só no primeiro A/B do ticket. Nos seguintes, troque o bloco por uma linha fora dele:
"Mesmo ambiente da rodada <N>, agora com <serviço=branch nova | o banco do cliente>.">

- **Ambiente:** <URL ou nome do ambiente de teste> · dados <do ambiente | massa do ticket: …> · código <repositório=branch, …> · <dd/mm hh:mm–hh:mm> (<fuso do sistema.md>)
- **Usuários:** <usuário padrão do sistema.md><; usuário restrito em CA-xx, para …>
- **Critérios:** <numerados por mim, na ordem do ticket — só se o ticket não os numera>
- **Dados alterados:** <…> · **Não conferido:** <o quê e por quê>
:::

<!-- ═══════════════════════════════ EXEMPLOS ═══════════════════════════════
Como cada forma sai, preenchida. Os vídeos citados estão anexados ao ticket com esse nome.

──── A · APROVADO (rodada 2, depois de um reprovado) ────

:::painel success
🤖 **Agente de teste · APROVADO · rodada 2 · 4/4 critérios**
:::

A observação do pedido passa a aceitar até 500 caracteres, na criação e na edição, e o texto é gravado inteiro.

- **CA-03** — editar uma observação existente para 500 caracteres grava o texto novo (o conserto) · vídeo: `CA-03-r2.webm`
- **CA-04** — a observação editada aparece inteira no histórico do cliente e no relatório de pedidos (lê o que a edição grava: tocado) · vídeo: `CA-04-r2.webm`
- **Herdados da rodada 1:** CA-01 e CA-02 — criam a observação, não passam pela gravação da edição que a correção mudou · vídeos: `CA-01.webm`, `CA-02.webm`

Mesmo ambiente da rodada 1, agora com backend=hotfix/ABC-123 na versão corrigida.

:::expand Entorno e notas
- **Entorno:** pedido sem observação ok · orçamento (mesmo campo) ok · cancelamento do pedido ok
:::

──── B · REPROVADO (rodada 1) ────

:::painel error
🤖 **Agente de teste · REPROVADO · rodada 1 · 3/4 critérios**
:::

Editar a observação de um pedido já gravado corta o texto em 255 caracteres, sem aviso.

**❌ CA-03 — a edição grava só os primeiros 255 caracteres**

1. Cliente QA ABC123 CLIENTE 1, pedido 1042 com observação de 100 caracteres.
2. Pedidos → editar a observação → colar um texto de 500 caracteres → Salvar.
3. Recarregar e reabrir o pedido pela lista.

**Esperado:** os 500 caracteres · **Obtido:** a tela confirma, mas depois de recarregar ficam 255 · vídeo: `CA-03.webm`

![CA-03: o texto cortado no caractere 255, depois de recarregar](CA-03-texto-cortado.png)

O PUT de edição devolve 200 com o texto inteiro; o GET seguinte já vem cortado — a gravação da edição trunca.

**Aprovados nesta rodada:** CA-01, CA-02, CA-04 — vídeos anexados (`CA-01.webm`, `CA-02.webm`, `CA-04.webm`); o reteste herda os que a correção não tocar.

:::expand Entorno e notas
- **Entorno:** orçamento (mesmo campo) ok · cancelamento do pedido ok · não explorado: importação de pedidos (fora da tela)
- **Nota:** o contador de caracteres some no formulário de edição (só aparece na criação).
:::

:::expand Como foi testado
- **Ambiente:** homologação · dados do ambiente · código backend=hotfix/ABC-123, frontend=hotfix/ABC-123 · 06/10 14:10–14:52 (America/Sao_Paulo)
- **Usuários:** usuario.teste
- **Critérios:** numerados por mim, na ordem do ticket
- **Dados alterados:** pedido 1042, observação com 255 caracteres · **Não conferido:** nada
:::

──── C · NÃO EXECUTÁVEL (rodada 2) ────

:::painel warning
🤖 **Agente de teste · NÃO EXECUTÁVEL · rodada 2 · ambiente antes**
:::

**O que falta:** a branch `hotfix/ABC-123` do frontend não está publicada no ambiente de teste (a tela ainda mostra a versão anterior), então não dá para testar a mudança.

**Quem age:** <Nome do dono da fila> (dono da fila) — publicar a branch no ambiente.

──── D · NÃO EXECUTÁVEL de novo (rodada 3) ────

:::painel warning
🤖 **Agente de teste · NÃO EXECUTÁVEL · rodada 3** · de novo: branch não publicada, como na rodada 2. O backend já está; falta o frontend.
:::
-->
