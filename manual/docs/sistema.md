# O sistema que você testa

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  MODELO EM BRANCO — preencha com os dados da SUA empresa / do SEU software.             ║
║                                                                                          ║
║  Este é o arquivo mais importante da adaptação: as skills e o agente leem daqui tudo    ║
║  o que é específico do sistema (URLs, logins, telas, regras de negócio, cuidados).      ║
║  O que não estiver aqui, o Claude não sabe — e vai perguntar ou marcar "não conferido". ║
║                                                                                          ║
║  Como preencher:                                                                         ║
║   • Troque cada <...> pelo valor real. Apague as linhas que não se aplicam.              ║
║   • Escreva como explicaria para um QA novo no time: curto, concreto, com exemplos.      ║
║   • Os blocos "Exemplo" mostram o nível de detalhe esperado — apague depois de preencher.║
║   • Aprendeu algo testando (um modal que sempre aparece, uma regra que pega)? Anote aqui.║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

## 1. Identificação

| Campo | Valor |
|---|---|
| Empresa | `<nome da empresa>` |
| Software / produto | `<nome do sistema>` |
| O que o sistema faz (1–2 linhas) | `<ex.: ERP para clínicas: agenda, prontuário, faturamento>` |
| Idioma da interface | `<pt-BR>` |
| Fuso horário dos testes | `<America/Sao_Paulo>` |

## 2. Ambientes

Onde o teste roda. **Nunca teste em produção** — liste aqui só os ambientes permitidos.

| Ambiente | URL | Para quê | Pode criar/alterar dado? |
|---|---|---|---|
| `<teste / homologação>` | `<https://hml.seusistema.com.br>` | onde os tickets são testados | sim |
| `<referência (opcional)>` | `<https://...>` | a mesma versão **sem** a branch do ticket, para comparar regressão | sim |
| `<produção>` | `<https://...>` | **PROIBIDO** — só listado para o Claude reconhecer e se recusar | **não** |

**Como as branches do ticket chegam ao ambiente:**
<!-- Explique o processo da sua empresa. Ex.: "o QA faz deploy manual pelo Jenkins, job X";
     "cada PR gera um ambiente efêmero em https://pr-<numero>.seusistema.dev";
     "o dev sobe a branch no servidor de homologação e avisa no ticket". -->
`<descreva aqui>`

**Como saber que o ambiente está íntegro (portão 1):**
<!-- O que conferir antes de testar. Ex.: "a tela inicial carrega sem erro"; "GET /health responde 200";
     "a versão no rodapé é a da branch". -->
- `<checagem 1>`
- `<checagem 2>`

**Telas ou passos que aparecem no primeiro acesso:**
<!-- Ex.: "num banco novo abre 'Atualizar banco de dados' — clique em Atualizar e espere a lista". -->
- `<se houver>`

## 3. Acesso e usuários de teste

O Claude **nunca digita senha, token ou dado de cartão**: ele para e pede ao QA. Aqui vão só os
**nomes** dos usuários e para que serve cada um.

| Usuário | Perfil | Quando usar |
|---|---|---|
| `<usuario.teste>` | `<administrador>` | padrão para todos os critérios |
| `<usuario.restrito>` | `<operador sem permissão X>` | critérios de permissão |

**Login com várias empresas / filiais / contas (se o sistema tiver):**
`<ex.: o login pede também o código da empresa; use a empresa de teste "EMPRESA QA 01">`

## 4. Módulos e telas

Mapa rápido para o Claude achar as telas. Use o caminho que o usuário faz no menu.

| Módulo | Tela | Como chegar | Observações |
|---|---|---|---|
| `<Cadastros>` | `<Clientes>` | `<Menu → Cadastros → Clientes>` | `<ex.: abre um aviso em modal; feche antes>` |
| `<Financeiro>` | `<Contas a receber>` | `<...>` | |

<!-- Exemplo:
| Vendas | Novo pedido | Menu → Vendas → Novo | o botão Salvar só habilita com cliente e 1 item |
-->

## 5. Regras de negócio que o tester precisa saber

O que não é óbvio pela tela e muda o resultado do teste.

- `<ex.: cliente menor de 18 anos exige um responsável cadastrado>`
- `<ex.: pedido acima de R$ 10.000 vai para aprovação do gerente antes de faturar>`

## 6. Cuidados — o que o teste NUNCA faz

Ações com efeito real fora do ambiente de teste (cobrança, nota fiscal, e-mail/SMS para cliente,
integração com banco ou governo). Para cada uma: o risco e como testar com segurança. Sem conseguir
garantir a segurança, o critério sai `NÃO EXECUTÁVEL / massa ausente` com o motivo.

| Ação perigosa | Risco | Como testar com segurança |
|---|---|---|
| `<emitir nota fiscal>` | `<nota real enviada à prefeitura>` | `<só com a configuração em Homologação; a prova é o JSON de envio>` |
| `<cobrar cartão / boleto>` | `<cobrança real no cliente>` | `<usar só o gateway sandbox X>` |
| `<enviar e-mail/SMS>` | `<mensagem para cliente real>` | `<só para endereços @seudominio-teste>` |

## 7. Integrações externas

| Integração | No ambiente de teste aponta para | Dá para testar? |
|---|---|---|
| `<gateway de pagamento>` | `<sandbox>` | `<sim>` |
| `<emissor de nota>` | `<homologação>` | `<sim, sem emitir de verdade>` |
| `<serviço X>` | `<produção>` | **não** → critério `NÃO EXECUTÁVEL / ambiente antes` |

## 8. Massa de teste

- **De onde vem o dado:** `<ex.: banco de homologação, renovado toda segunda; ou cópia do cliente pedida no ticket>`
- **Padrão de nome do que o teste cria:** `<ex.: "QA <CHAVE> CLIENTE 1">` — para achar e limpar depois.
- **Documentos de teste:** `node manual/tools/cpf.mjs <semente>` gera CPF válido (troque por outro
  gerador se o seu sistema usar outro documento).
- **Receitas** de dado que vários testes preparam: `manual/docs/receitas.md`.

## 9. Glossário

Termos do negócio que aparecem nos tickets.

| Termo | Significado |
|---|---|
| `<termo>` | `<explicação>` |

## 10. Detalhes técnicos da tela (opcional, poupa tempo do agente)

- Framework do front: `<Angular / React / JSF / ...>` — ex.: "modal do Angular (`ngb-modal-window`) engole o clique".
- Seletores estáveis: `<ex.: os campos têm data-cy="...">`
- APIs úteis para conferir estado: `<GET /api/clientes/{id}>`
