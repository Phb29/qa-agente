# Fluxo do Jira

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  MODELO EM BRANCO — preencha com o workflow do SEU Jira.                                 ║
║                                                                                          ║
║  É daqui que a skill manual-testar-ticket tira para qual status mover o ticket e para    ║
║  quem atribuir depois do veredito. Os nomes têm que ser EXATAMENTE os do seu board.      ║
║                                                                                          ║
║  Como descobrir os nomes:                                                                ║
║   • Abra um ticket no status de teste e veja os botões de transição.                     ║
║   • Ou: node scripts/jira.mts get <CHAVE>  (mostra o status atual)                       ║
║  Vários destinos possíveis? Separe com | — o primeiro que existir no ticket é usado.     ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

## Status

| Momento | Status no seu Jira | Exemplo |
|---|---|---|
| Ticket esperando teste (a fila) | `<Para Testar>` | `Para Testar` |
| Testando (o agente assume) | `<Testando>` | `Testando` |
| **Aprovado** → vai para | `<Aguardando Merge\|Validar>` | `Aguardando Merge\|Validar` |
| **Reprovado** → volta para | `<Em desenvolvimento\|Reprovado>` | `Em desenvolvimento\|Reprovado` |
| **Não executável** → vai para | `<Ação humana\|Bloqueado>` | `Bloqueado\|Aguardando resposta` |

Se a transição só existe passando por outro status, use `--via`:
`node scripts/jira.mts status <CHAVE> "<Reprovado>" --via "<Testando>"`.

## Pessoas

| Papel | Quem | Observação |
|---|---|---|
| Usuário do agente no Jira (se houver) | `<"Agent Tester" ou o seu próprio usuário>` | quem aparece como responsável enquanto testa |
| Dono da fila (recebe os não executáveis) | `<nome>` — o e-mail vai em `AGENT_OWNER_EMAIL` no `.env` | quem destrava ambiente e cobra insumo |
| Quem recebe o **aprovado** | ver `manual/docs/lideres-tecnicos.md` | por produto / projeto |
| Quem recebe o **reprovado** | quem implementou (linha `Devolver para:` do `get --comentarios`) | |

## Campos customizados

Se o seu Jira usa outros IDs, ajuste no `.env` (ver `.env.example`). Para descobrir o ID de um
campo: Jira → Configurações → Itens → Campos personalizados → o número na URL ao editar o campo.

| Campo | Variável no `.env` | Para quê |
|---|---|---|
| `<Categoria do problema>` | `JIRA_CATEGORIA_FIELD` | calibrar o teste pelo histórico da área |
| `<Dev responsável>` | `JIRA_DEV_RESPONSAVEL_FIELD` | para quem devolver o reprovado |
| `<Casos de teste>` | `JIRA_CASOS_FIELD` | onde gravar os casos para automação |
