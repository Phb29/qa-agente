<!--
MODELO DE PEDIDO — copie, preencha e cole no Claude quando quiser um teste com contexto extra
(critérios próprios, cuidados, massa). Para um teste simples, basta: "testa o ticket ABC-123".
Exemplo preenchido: exemplos/pedido-exemplo-cadastro-responsavel.md
Apague as seções que não precisar.
-->

testa o ticket <CHAVE> <--ensaio, se não quiser que ele escreva no Jira>

## Como rodar este teste
- Teste ASSISTIDO: o ambiente já está de pé e eu já fiz o login. Não suba nem derrube nada no ambiente.
- Navegador: o meu, pelo Claude in Chrome. As abas do sistema já estão no grupo do Claude. Nunca feche a última aba do grupo.
- URL do ambiente: <URL>
- Empresa / conta / filial: <se o sistema tiver>
- Usuário: <usuário> (já logado). Senha, token, cartão e "Autorizar acesso" são comigo: pare e me peça.
- Branches no ambiente: <repositório> `<branch>`, <repositório> `<branch>`.
- `--ensaio`: NÃO escreva nada no Jira. Deixe tudo em `evidencias/<CHAVE>/rodada-01/`.

## Vídeo
- Grave CADA critério em vídeo (`.claude/skills/teste-qa-videos-apresentacao/skills/gravar-tela-chrome/scripts/`), um `.mp4` por critério: `CA-01.mp4`, `CA-02.mp4`…
- Um print por critério mostrando o resultado (depois de recarregar a tela).

## Massa
- <como gerar documentos de teste — ex.: `node manual/tools/cpf.mjs <CHAVE>-<nome>`>
- <padrão de nome — ex.: "QA <CHAVE> CLIENTE 1">
- <dados que já existem e podem ser usados>

## Cuidados
- <ex.: NÃO salve a configuração de nota fiscal; só emita com o ambiente em Homologação>

## O que mudou (contexto, fala do dev)
<cole aqui o que o dev disse que mudou>

## Critérios desta rodada
<Se o ticket já tem critérios bons, apague esta seção. Se não tem, escreva:>

**CA-01 — <título>.** <onde, ação com valor concreto>.
Esperado: <resultado observável; o que continua depois de recarregar>.

**CA-02 — <título>.** …

## Entorno (se der tempo, até 20 min)
- <caminho vizinho que a mudança pode ter quebrado>

## No fim
- Veredito (aprovado / reprovado / não executável) com uma linha por critério.
- Para cada reprovado: passos, esperado × obtido, vídeo e print.
- Liste os dados que você criou.
- Deixe o comentário pronto em `evidencias/<CHAVE>/rodada-01/comentario.md` e me mostre antes de publicar.
