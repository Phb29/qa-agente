# Teste manual assistido de tickets

Este pacote faz **teste manual de tickets do Jira**: ler o ticket, testar critério a critério no
navegador, gravar a evidência, comentar o veredito e mover o ticket. Escreva sempre em pt-BR.

**Leia nesta ordem antes do primeiro ticket:**

1. `manual/docs/sistema.md` — **o sistema que você testa**: ambientes, usuários, telas, regras de
   negócio e o que nunca fazer. Se ele ainda estiver com os marcadores `<...>` do modelo, avise o QA
   que o pacote não foi configurado e pergunte o que precisar.
2. `manual/CLAUDE.md` — **a régua**: os vereditos (aprovado, reprovado, não executável), o que é
   critério e o que é nota, rodada 1 × reteste, o que vai no comentário.
3. `manual/docs/fluxo-jira.md` — para qual status mover e para quem atribuir.

O passo a passo está na skill `manual-testar-ticket`.

## Como o teste roda (assistido)

O QA (humano) prepara o ambiente e faz os logins; o Claude testa pelo navegador.

- **Ambiente:** o de teste descrito em `manual/docs/sistema.md`, com as branches do ticket que o QA
  publicou. **Nunca teste em produção.**
- **Navegador:** Claude in Chrome (o Chrome do QA, já logado). O QA põe as abas no grupo do Claude.
  - **Nunca feche a última aba do grupo**: o grupo some e o QA precisa arrastar as abas de volta.
  - Se `list_connected_browsers` vier vazio com a extensão logada na mesma conta, reinicie o app do
    Claude ou abra uma sessão nova.
  - Sem o Chrome, dá para usar o MCP do Playwright (`.mcp.json`) ou o navegador embutido do app, mas
    aí o vídeo sai pelo próprio Playwright ou não há vídeo, só prints.
- **Jira:** `node scripts/jira.mts` (chaves `JIRA_*` no `.env`). Sem argumento, ele imprime a lista de
  comandos. Comentário rico: skill `escrever-no-ticket`.

## Regras do teste assistido

1. **Senha, token, cartão: quem digita é o QA.** O Claude para no campo, pede e espera. Vale também
   para telas de "Autorizar acesso" e confirmações de segurança.
2. **Mover o ticket sempre atribui.** Status e responsável vão juntos, pela tabela de
   `manual/docs/fluxo-jira.md` (aprovado → quem está em `manual/docs/lideres-tecnicos.md`;
   reprovado → quem implementou).
3. **Ações com efeito real** (nota fiscal, cobrança, e-mail para cliente, integrações): siga a seção
   "Cuidados" de `manual/docs/sistema.md`. Sem conseguir garantir que é seguro, não faça: o critério
   sai não executável e você avisa o QA.
4. **Vídeo por critério:** grave cada critério com os scripts de
   `.claude/skills/teste-qa-videos-apresentacao/skills/gravar-tela-chrome/scripts/`. O vídeo vai
   **anexado** ao ticket com o nome do critério (`CA-01.mp4`), nunca dentro do texto do comentário.
   Os prints, sim, entram no texto: `![legenda](prints/arquivo.jpg)`.
5. **Antes de publicar no Jira** (comentário, status, atribuição), mostre o resumo ao QA e espere o "pode".
6. Evidências ficam em `evidencias/<CHAVE>/rodada-NN/` e **não vão para git nenhum** (podem ter dado
   de cliente; o `.gitignore` já as exclui).
