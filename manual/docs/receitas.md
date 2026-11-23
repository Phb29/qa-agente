# Receitas de massa

<!--
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  MODELO EM BRANCO — vai crescendo com o uso.                                             ║
║                                                                                          ║
║  Receita = o passo a passo para preparar um dado que MAIS DE UM teste precisa            ║
║  (ex.: "cliente pronto para faturar", "usuário sem a permissão X").                      ║
║  Cada vez que um teste gastar tempo descobrindo como montar um dado, escreva a receita   ║
║  aqui — o próximo teste segue a receita em vez de redescobrir. Mudou um passo? Corrija.  ║
║                                                                                          ║
║  Pode começar vazio. Copie o modelo abaixo para cada receita nova.                       ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
-->

## <Nome da receita — ex.: Cliente pronto para faturar>

**Quando usar:** `<que critério precisa deste dado>`
**Por que tem receita:** `<o que dá errado sem ela — ex.: "o envio recusa cliente sem CPF, e a tela não avisa">`

1. **Onde:** `<tela ou rota — Menu → ... ou /rota/{id}>`
   - `<obstáculo conhecido — ex.: "abre um aviso em modal: clique Fechar antes de tudo">`
2. **Preencha:**
   - `<campo>`: `<valor ou como gerar — ex.: node manual/tools/cpf.mjs <CHAVE>-cliente1>`
   - `<campo>`: `<valor>`
3. **Salve:** `<botão>` → espere `<a mensagem de sucesso exata>`.
4. **Prova de que deu certo:** `<reabra a tela / GET /api/... e confira o campo X>`

<!--
──── EXEMPLO PREENCHIDO (apague quando tiver as suas) ────

## Cliente pronto para nota fiscal

**Quando usar:** qualquer critério que emite nota.
**Por que tem receita:** a nota não sai para cadastro incompleto e a tela não diz qual campo falta.

1. **Onde:** perfil do cliente → Dados pessoais (`/clientes/<id>/dados`).
   - Ao abrir, um aviso em modal fica na frente: clique **Fechar** antes, senão todo clique estoura.
2. **Preencha só o que falta:**
   - CPF: `node manual/tools/cpf.mjs <CHAVE>-cliente`, digitado devagar (a máscara come caractere colado).
   - Endereço: Rua `RUA TESTE QA <CHAVE>`, bairro `CENTRO`.
3. **Salve:** Salvar alterações → "Configurações salvas com sucesso."
4. **Prova:** reabra a tela e confira o CPF gravado.
-->
