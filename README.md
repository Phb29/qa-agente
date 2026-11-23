# QA Agente: agente de QA que testa tickets do Jira sozinho

Agente de QA feito com o **Claude Code**: ele pega um ticket do Jira, testa cada critério de aceite
pelo navegador, grava vídeo e print como evidência e dá o veredito, como um QA faria. Serve para
qualquer software e qualquer empresa.

## Sobre

Criei este agente para usar no meu trabalho de QA na **Pacto Soluções**, a empresa em que trabalho hoje.
Esta versão pública vem **sem nenhum dado da empresa**: as regras de QA estão prontas, e tudo o que
é de cada empresa (sistema, ambientes, fluxo do Jira, pessoas, repositórios) fica em modelos em
branco para você preencher.

Autor: **Paulo Henrique**

## Como funciona

O QA prepara o ambiente e faz o login. O Claude:

1. lê o ticket e os critérios de aceite;
2. confere se o ticket dá para testar (critérios claros, branches existentes) e se o ambiente está de pé;
3. testa **cada critério pelo navegador**, gravando um vídeo e tirando um print por critério;
4. explora o entorno da mudança procurando regressão;
5. dá o veredito — **aprovado**, **reprovado** ou **não executável** — e deixa o comentário pronto;
6. mostra tudo ao QA e, com o "pode", comenta, anexa as evidências e move o ticket no Jira.

Para usar na sua empresa, veja [Adaptar para outra empresa ou software](#adaptar-para-outra-empresa-ou-software).

## Começo rápido (outra empresa)

1. Clone o repositório e copie o `.env.example` para `.env` ([Instalar](#instalar)).
2. No `.env`, coloque o **e-mail, o token e a URL do seu Jira**.
3. Em `manual/docs/sistema.md`, descreva **o seu sistema**: ambientes, usuários de teste, telas,
   regras de negócio e o que o teste nunca pode fazer. É o arquivo mais importante.
4. Em `manual/docs/fluxo-jira.md`, escreva os **nomes dos status** do seu Jira.
5. Em `manual/docs/lideres-tecnicos.md`, diga **quem recebe o ticket aprovado** em cada projeto.
6. Em `manual/docs/mapa-servicos.md`, liste **os repositórios dos seus projetos** (opcional).
7. Rode um ticket em modo ensaio: `testa o ticket ABC-123 --ensaio`. Nada é escrito no Jira.

O passo a passo completo, com o que vai em cada arquivo, está logo abaixo.

---

## Requisitos

- Windows 10/11 (os scripts de gravação de vídeo são PowerShell; o resto roda em qualquer sistema).
- **Node 22.6 ou mais novo** (`node -v`). Os scripts `.mts` rodam direto no Node, sem `npm install`.
- **Claude Code** (app desktop ou `claude` no terminal).
- **Google Chrome** com a extensão **Claude in Chrome**, logada na mesma conta do Claude.
  (Alternativa: o MCP do Playwright do `.mcp.json`, sem o Chrome do QA.)
- **FFmpeg** para os vídeos: `winget install --id Gyan.FFmpeg -e` (feche e abra o terminal depois).
- Uma conta no **Jira Cloud** com permissão nos projetos que vai testar.
- Opcional: `gh` (GitHub CLI) logado, para o Claude conferir branches e PRs.

---

## Instalar

```bash
git clone https://github.com/Phb29/qa-agente.git
cd qa-agente
cp .env.example .env      # no PowerShell: Copy-Item .env.example .env
```

Use uma pasta **sem espaços** no caminho (ex.: `C:\QA\qa-agente`).

---

## Adaptar para outra empresa ou software

Faça uma vez por empresa (ou por sistema). Cada arquivo de modelo tem, no topo, um quadro explicando
**o que é, para que o Claude usa e como preencher**, e marcadores `<assim>` no lugar dos valores.

### Passo a passo

| # | O que fazer | Arquivo | Obrigatório? |
|---|---|---|---|
| 1 | Preencher e-mail, token e URL do Jira | `.env` | **sim** |
| 2 | Conferir a conexão: `node scripts/jira.mts whoami` mostra o seu nome | — | **sim** |
| 3 | Descrever **o sistema**: ambientes (teste, referência, produção proibida), usuários de teste, telas, regras de negócio, **cuidados** (nota, cobrança, e-mail) e integrações | `manual/docs/sistema.md` | **sim — é o principal** |
| 4 | Escrever os **status** do seu Jira (testando, aprovado, reprovado, não executável) e quem é o dono da fila | `manual/docs/fluxo-jira.md` | **sim** |
| 5 | Dizer **quem recebe o aprovado** em cada projeto | `manual/docs/lideres-tecnicos.md` | **sim** (pode ser uma linha `*`) |
| 6 | Listar os **repositórios**, para o Claude conferir as branches | `manual/docs/mapa-servicos.md` | não — vazio, ele marca "não conferido" |
| 7 | Combinar com os devs o **formato do ticket** (bloco `[agente-teste]`) | `manual/docs/padrao-ticket.md` | não — já vem pronto; mande ao time |
| 8 | Se o seu Jira tem **campos customizados** (categoria, dev responsável, QAs, casos de teste), colocar os IDs | `.env` (`JIRA_*_FIELD`) | não: sem o ID, o recurso é pulado |
| 9 | Ir anotando as **receitas de massa** que forem aparecendo | `manual/docs/receitas.md` | não — começa vazio |
| 10 | Rodar um ticket de teste com `--ensaio` (não escreve nada no Jira) | — | recomendado |

Ao terminar, confira se sobrou algum marcador:

```bash
grep -rn "<[a-zA-Z][^>]*>" manual/docs/sistema.md manual/docs/fluxo-jira.md manual/docs/lideres-tecnicos.md
```

### Onde mora cada coisa (o que mudar e o que não mudar)

| Tipo | Arquivos | Quando mexer |
|---|---|---|
| **A empresa / o software** | `manual/docs/*.md`, `.env` | **sempre**, ao adaptar |
| **A régua de QA** (vereditos, exigências, rodada × reteste) | `manual/CLAUDE.md` | só se o time quiser outras regras de QA |
| **O processo** (ordem dos passos, formato do comentário) | `.claude/skills/manual-testar-ticket/` | só se o processo for diferente (ex.: sem vídeo) |
| **O código** (Jira, vídeo, CPF) | `scripts/`, `manual/tools/`, `.claude/skills/teste-qa-videos-apresentacao/` | quase nunca |

### Regras novas de outro software

Encontrou uma regra do sistema que o Claude precisa saber? Escreva no `manual/docs/sistema.md`:

- **regra de negócio** (muda o resultado do teste) → seção 5;
- **algo que o teste nunca pode fazer** (efeito real fora do teste) → seção 6, com o jeito seguro de testar;
- **caminho de tela, modal chato, seletor estável** → seções 4 e 10;
- **como montar um dado que vários testes usam** → `manual/docs/receitas.md`.

O próprio Claude sugere, no fim de cada teste, o que vale acrescentar nesses arquivos.

---

## Usar

1. Publique no ambiente de teste as branches que o ticket pede e faça login no Chrome.
2. Abra o Claude Code **nesta pasta** (ele lê o `CLAUDE.md` e enxerga as skills de `.claude/`).
3. Peça:
   ```
   testa o ticket ABC-123
   ```
   ou `/manual-testar-ticket ABC-123`. Para só ensaiar, sem escrever nada no Jira: `testa o ticket ABC-123 --ensaio`.
4. Quando ele pedir, ponha as abas do sistema no **grupo do Claude** no Chrome. Nunca feche a última aba do grupo.
5. Senhas, tokens, cartões e o "Autorizar acesso" ficam com você: o Claude para e pede.
6. No fim ele mostra o veredito por critério e pergunta antes de comentar, anexar e mover o ticket.

As evidências ficam em `evidencias/<CHAVE>/rodada-NN/` (vídeos, prints, capturas e o `comentario.md`).
Essa pasta está no `.gitignore` porque pode ter dados de clientes.

### Pedido detalhado

Para um teste com contexto extra (critérios próprios, cuidados, massa), copie o `pedido-modelo.md`,
preencha e cole no Claude. Há um exemplo preenchido em `exemplos/`.

### Comandos úteis do Jira

```bash
node scripts/jira.mts                              # lista todos os comandos
node scripts/jira.mts whoami                       # confere as credenciais
node scripts/jira.mts get ABC-123 --comentarios    # lê o ticket
node scripts/jira.mts whois "Nome da Pessoa"       # acha o accountId
```

### Vídeos

Os scripts ficam em `.claude/skills/teste-qa-videos-apresentacao/skills/gravar-tela-chrome/scripts/`
(`iniciar.ps1`, `marcar.ps1`, `parar.ps1`; instruções no `SKILL.md` da pasta). O Claude marca a aba,
grava a janela do Chrome e salva um `.mp4` por critério. Durante a gravação, não cubra a janela do Chrome.

---

## Estrutura

| Caminho | Para quê |
|---|---|
| `CLAUDE.md` | ponto de entrada: o que ler e as regras do teste assistido |
| `manual/CLAUDE.md` | a régua do QA: vereditos, critério × nota, reteste (genérica) |
| `manual/docs/sistema.md` | **modelo** — o sistema testado: ambientes, usuários, telas, regras, cuidados |
| `manual/docs/fluxo-jira.md` | **modelo** — status e pessoas do seu Jira |
| `manual/docs/lideres-tecnicos.md` | **modelo** — quem recebe o aprovado por projeto |
| `manual/docs/mapa-servicos.md` | **modelo** — repositórios para conferir branches |
| `manual/docs/receitas.md` | **modelo** — receitas de massa de teste |
| `manual/docs/padrao-ticket.md` | o combinado com os devs sobre o formato do ticket |
| `manual/tools/` | gerador de CPF de teste, quadros de vídeo, conversas abertas em PR |
| `.claude/skills/manual-testar-ticket` | o passo a passo do teste + modelo de comentário |
| `.claude/skills/escrever-no-ticket` | como escrever comentário rico no Jira |
| `.claude/skills/teste-qa-videos-apresentacao` | gravação de tela do Chrome em vídeo |
| `.claude/agents/manual-testar-criterio.md` | subagente que testa um critério por vez |
| `scripts/jira.mts` + `scripts/lib/` | leitura e escrita no Jira (comentar, anexar, mover, atribuir) |
| `pedido-modelo.md` / `exemplos/` | modelo de pedido detalhado e um exemplo preenchido |
| `.env.example` | modelo de configuração |

## Não vem no repositório

- `.env` com credenciais: cada um usa as suas.
- Evidências de testes (podem ter dados de clientes).
