# Quem recebe o ticket aprovado

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  MODELO EM BRANCO — preencha com as pessoas da SUA empresa.                              ║
║                                                                                          ║
║  Quando o veredito é APROVADO, o ticket vai para o status de aprovação                   ║
║  (manual/docs/fluxo-jira.md) e é atribuído à pessoa desta tabela — normalmente quem      ║
║  faz o merge ou valida a entrega daquele produto.                                        ║
║                                                                                          ║
║  "Produto" é o prefixo da chave do ticket no Jira: ABC-123 → ABC.                        ║
║  O accountId o próprio Claude busca com: node scripts/jira.mts whois "Nome"              ║
║  Uma pessoa só para tudo? Deixe uma linha com "*" no produto.                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

| Produto (projeto do Jira) | Quem recebe o aprovado |
|---|---|
| `<ABC>` | `<Nome Sobrenome>` |
| `<XYZ>` | `<Nome Sobrenome>` |
| `*` (qualquer outro) | `<Nome Sobrenome>` |

Produto fora da tabela e sem `*`: o aprovado fica com o `Devolver para:` do
`node scripts/jira.mts get <CHAVE> --comentarios` — quem implementou a correção.
