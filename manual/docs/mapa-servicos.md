# Repositórios do sistema

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  MODELO EM BRANCO — preencha com os repositórios da SUA empresa.                         ║
║                                                                                          ║
║  Para quê: o dev escreve no ticket "repo-x: feature/ABC-123". O Claude usa esta tabela   ║
║  para conferir se a branch existe (git ls-remote) e se há conversa de revisão aberta     ║
║  no PR (manual/tools/threads-abertas.sh) — ANTES de gastar tempo testando.               ║
║                                                                                          ║
║  Sem acesso aos repositórios? Deixe a tabela vazia: o Claude pula a conferência e        ║
║  registra "não conferido" no relatório. O teste continua.                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

| Nome do repositório no ticket | O que é | URL para `git ls-remote` | Entra no ambiente de teste? |
|---|---|---|---|
| `<backend>` | `<API principal>` | `<git@github.com:SUA-ORG/backend.git>` | `<sim>` |
| `<frontend>` | `<tela web>` | `<git@github.com:SUA-ORG/frontend.git>` | `<sim>` |
| `<servico-x>` | `<microserviço de notificação>` | `<...>` | `<não — ticket que altera ele é NÃO EXECUTÁVEL / ambiente antes>` |

<!--
Dicas:
- Se o nome que o dev usa no ticket é diferente do nome do repositório, ponha os dois na 1ª coluna
  (ex.: "api (api-core)").
- Se uma branch de um repositório vira um serviço diferente no ambiente, explique na 2ª coluna.
- PR no GitLab? A skill usa GITLAB_TOKEN do .env e o grupo que você escrever aqui: <grupo-gitlab>.
-->

"Não conferido" não é falta do ticket: o agente segue e registra que não conferiu.
