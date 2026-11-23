testa o ticket CX3-190 --ensaio

## Como rodar este teste
- Teste ASSISTIDO: o ambiente já está de pé e eu já fiz o login. Não suba nem derrube nada no ambiente.
- Navegador: o meu, pelo Claude in Chrome (pode ser Chrome ou Brave). As abas do sistema já estão no grupo do Claude. Nunca feche a última aba do grupo.
- URL do ambiente: <COLE AQUI A URL DO AMBIENTE>
- Empresa/unidade: <NOME DA EMPRESA DE TESTE>
- Usuário: usuario.teste (já logado). Senha, token, cartão e "Autorizar acesso" são comigo: pare e me peça.
- Branches do ambiente: frontend `feature/CX3-190` e backend `feature/CX3-190`.
- `--ensaio`: NÃO escreva nada no Jira (nem comentário, nem anexo, nem status, nem atribuição). Deixe tudo em `evidencias/CX3-190/rodada-01/`.

## Vídeo
- Grave CADA critério em vídeo com os scripts do `gravar-tela-chrome`
  (`.claude/skills/teste-qa-videos-apresentacao/skills/gravar-tela-chrome/scripts/`), um `.mp4` por critério: `CA-01.mp4`, `CA-02.mp4`…
- Se o navegador for o Brave, pule o `janela-propria.ps1` (ele só abre Chrome) e use a aba do grupo.
- Use `marcar.ps1` antes de cada passo, com uma legenda curta do que vai fazer.
- Um print por critério mostrando o resultado (depois de recarregar a tela), em `prints/`.
- Sempre rode o `parar.ps1`, mesmo se der erro.

## Massa
- CPFs de teste válidos: `node manual/tools/cpf.mjs CX3-190-<nome>` (ex.: `CX3-190-pai1`, `CX3-190-aluno1`). Digite o CPF devagar, a máscara come caractere colado.
- Nomes de teste começando com `QA CX3190` (ex.: `QA CX3190 ALUNO 1`, `QA CX3190 PAI 1`).
- Aluno "menor" = data de nascimento com 10 anos atrás. Aluno "maior" = 30 anos atrás.

## Nota fiscal (cuidado)
- A configuração de nota sincroniza com o eNotas de verdade: NÃO salve nenhuma configuração de nota.
- Antes de emitir qualquer nota, confira que o ambiente/empresa está em Homologação. Se não estiver, ou se tiver dúvida, PARE e me pergunte.
- Para conferir para quem a nota foi gerada: em Notas Fiscais (usuário usuario.teste), ícone "Visualizar JSON Envio para eNotas" da nota → nome e CPF do tomador.

## O que mudou (contexto, fala do dev)
Na tela "Adicionar cliente" (ADM → Clientes → Adicionar cliente), para pessoa física:
- apareceu o check "Responsável financeiro" ao lado do CPF da mãe e do CPF do pai, com um ícone (i) de ajuda;
- apareceu "Cadastrar outro responsável" (nome, CPF, check "Responsável financeiro" e "Remover");
- só um responsável pode ser marcado por vez;
- ao gravar com um marcado: a pessoa é achada pelo CPF (ou criada) em Pessoas, vinculada como Pessoa responsável do aluno, e nos Dados Financeiros a nota fica "em nome de terceiro" com o nome e o CPF dela;
- sem nenhum check marcado, o cadastro deve ser exatamente igual ao de antes.

## Critérios desta rodada
O ticket não tem critérios numerados: use ESTES como os CAs desta rodada e diga isso no relatório.

**CA-01 — Pai como responsável.** Aluno menor, com mãe e pai (nome e CPF). Marcar "Responsável financeiro" no pai e gravar até o fim do cadastro.
Esperado: no perfil do aluno o pai é a Pessoa responsável; nos Dados Financeiros, nota em nome de terceiro com nome e CPF do pai; o pai existe em Pessoas. Confira depois de recarregar.

**CA-02 — Mãe como responsável.** Igual ao CA-01, marcando a mãe. Esperado: o mesmo, com os dados da mãe.

**CA-03 — Outro responsável.** Aluno menor. "Cadastrar outro responsável", preencher nome e CPF, marcar o check e gravar.
Esperado: o mesmo do CA-01, com os dados desse outro responsável.

**CA-04 — Remover outro responsável.** Abrir "Cadastrar outro responsável", preencher, clicar em "Remover".
Esperado: os campos somem; gravando o aluno, esse responsável não é criado nem vinculado.

**CA-05 — Só um marcado por vez.** Marcar a mãe e depois o pai; depois marcar o outro responsável.
Esperado: ao marcar um, os outros desmarcam sozinhos.

**CA-06 — Reaproveita a pessoa pelo CPF.** Cadastrar um segundo aluno (irmão) marcando como responsável o MESMO pai do CA-01 (mesmo CPF).
Esperado: em Pessoas o pai aparece uma vez só; os dois alunos têm a mesma Pessoa responsável.

**CA-07 — Responsável marcado sem CPF.** Marcar o pai sem preencher o CPF dele.
Esperado: não deixa prosseguir e mostra a mensagem pedindo nome e CPF do responsável financeiro.

**CA-08 — CPF inválido / igual ao do aluno.** (a) CPF do responsável inválido; (b) CPF do responsável igual ao do aluno.
Esperado: erro nos dois casos, o cadastro não grava.

**CA-09 — Aluno maior de idade.** Aluno maior com o pai marcado.
Esperado: grava e vincula o pai do mesmo jeito do CA-01.

**CA-10 — Ajuda.** Passar o mouse no (i) ao lado do check. Esperado: aparece o texto de ajuda.

**CA-11 — Nota no nome do pai.** Com o aluno do CA-01: lançar um plano/produto, receber e emitir a nota (Gestão de Notas).
Esperado: o tomador (JSON eNotas) é o nome e o CPF do pai, sem erro.

**CA-12 — Caso do card: só o pai preenchido.** Aluno menor SÓ com pai (mãe vazia), pai marcado. Gravar e emitir a nota.
Esperado: a nota NÃO dá o erro "não possui CPF da mãe cadastrado"; o tomador é o pai.

**CA-13 — Nota no nome do outro responsável.** Com o aluno do CA-03, emitir a nota. Esperado: tomador = outro responsável.

**CA-14 — Sem marcar nada (nada muda).** Aluno menor com mãe e pai, SEM marcar nenhum check. Gravar e emitir a nota.
Esperado: grava normal, sem Pessoa responsável nova, sem "nota em nome de terceiro", ninguém novo em Pessoas; a nota sai como sempre saiu (como a configuração da empresa manda).

**CA-15 — Aluno antigo (nada muda).** Pegar um aluno já existente, cadastrado antes desta mudança, e emitir uma nota.
Esperado: sai igual a antes (mesmo tomador de sempre).

**CA-16 — Pessoa jurídica (nada muda).** Cadastro com CNPJ. Esperado: os checks não aparecem e grava normal.

**CA-17 — Voltar do boletim.** Marcar o pai, prosseguir para a tela seguinte e voltar.
Esperado: o check do pai continua marcado e os dados continuam lá.

## Entorno (se der tempo, até 20 min, sem vídeo se passar)
- Cliente semelhante → "Tornar responsável": os checks novos somem e vale a pessoa escolhida no modal.
- Menor sem CPF e sem responsável: a tela continua exigindo mãe/pai/responsável como antes.
- Editar um aluno pelo perfil (Dados pessoais) e salvar: funciona como antes.
- Contrato do aluno do CA-01: o responsável legal é o pai.

## No fim
- Veredito (aprovado / reprovado / não executável) com uma linha por critério.
- Para cada reprovado: passos, esperado × obtido, vídeo e print.
- Liste os dados que você criou (alunos, pessoas, notas).
- Deixe o comentário pronto em `evidencias/CX3-190/rodada-01/comentario.md` e me diga o caminho da pasta. Não publique nada.
