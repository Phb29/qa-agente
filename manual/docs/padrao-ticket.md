# Padrão do ticket para o agente de teste

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  JÁ VEM PRONTO — ajuste se o seu time combinar outro formato.                            ║
║                                                                                          ║
║  É o combinado com devs e PO sobre o que o ticket precisa trazer. Mande este arquivo     ║
║  para o time. O que o agente exige, e por quê, está em manual/CLAUDE.md (seção 3).       ║
║  Se mudar os nomes dos campos do bloco abaixo, mude também no passo 1 da skill           ║
║  .claude/skills/manual-testar-ticket/SKILL.md.                                           ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

Para devs e PO: o que o ticket precisa ter para o agente testar e como pedir reteste.

## 1. O bloco `[agente-teste]`

Num **comentário** do ticket (se houver mais de um, vale o mais recente):

```
[agente-teste]
ambiente: https://hml.seusistema.com.br
massa: empresa de teste "EMPRESA QA 01"; cliente 1042 já tem pedido aberto
branches:
- backend: feature/ABC-123
- frontend: feature/ABC-123
```

- **`ambiente`** (opcional) — onde a branch está publicada, se não for o ambiente padrão de
  `manual/docs/sistema.md`.
- **`massa`** (opcional) — o dado de que o teste precisa e que não dá para criar pela tela (uma
  empresa específica, uma cópia de cliente). Sem `massa`, o teste parte do dado do ambiente e cria o
  que o critério pede.
- **`branches`** — uma linha por repositório alterado, `<repositório>: <branch>`, com a branch exata
  (o agente não deduz nomes). O nome do repositório segue `manual/docs/mapa-servicos.md`.

Escrito de outro jeito também vale, desde que inequívoco. Faltou `branches`, ou um critério não diz
onde, o quê, o resultado esperado e o que persiste → o ticket volta para quem o mandou, com o que
faltou.

## 2. Critério de aceite bom

Cada critério diz quatro coisas:

1. **Onde** — tela ou rota.
2. **Ação** — com valor concreto ("preencher a data com 10/03/2026", não "preencher os campos").
3. **Resultado observável** — o que aparece e dá para conferir.
4. **Estado durável** — o que continua lá depois de recarregar.

> **CA-01** — Em *Clientes → Novo*, cadastrar um cliente com CPF já existente e clicar em Salvar.
> Aparece "CPF já cadastrado" e o cliente **não** é criado (a busca pelo CPF continua com 1 resultado).

## 3. Como entrar na fila

Mova o ticket para o status de fila definido em `manual/docs/fluxo-jira.md` (ex.: *Para Testar*) ou
peça ao QA. Ao começar, o agente move o ticket para *Testando*.

## 4. Reteste depois de uma reprovação

O relatório do agente diz quais critérios falharam e por quê. Depois de corrigir:

1. Suba a correção nas mesmas branches (ou informe branches novas no bloco `[agente-teste]`).
2. Comente **o que foi corrigido** — é com isso que o agente sabe onde olhar com mais cuidado, porque
   ele não lê o código:

```
[agente-teste] reteste
corrigido: CA-05
o que mudou: ao editar o pedido, o desconto passa a ser recalculado sobre o total novo
onde: Vendas > editar pedido; o total do pedido
```

   `onde` é a **tela, o fluxo ou a regra** que a correção alterou — não a classe.

3. Ponha o ticket na fila de novo (seção 3).

O agente retesta o que falhou e o que a correção tocou, e herda o resto. Ticket que voltou sem chegar
a ser testado (faltou algo, ambiente fora) é testado inteiro.
