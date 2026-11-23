---
name: gravar-tela-chrome
description: Use quando um agente precisa gravar em video (mp4) o que ele faz no Chrome pelo claude-in-chrome - teste de ticket, reproducao de bug, evidencia de criterio de aceite, demonstracao de fluxo. Windows + FFmpeg. Tambem quando o usuario pedir "grava o teste", "quero o video do teste", "grava a tela enquanto testa".
---

# Gravar tela do Chrome

Grava em mp4 a janela do Chrome onde o agente trabalha, com legenda (.srt) dos passos.
Grava a **area da tela** onde a janela esta, porque a captura direta da janela sai preta no Chrome.
Por isso o video mostra **a aba ativa da janela e o que estiver na frente dela**. Se outra aba
ficar ativa (outro agente, o usuario), o video mostra essa outra aba. Os passos abaixo existem para
evitar isso e para detectar quando acontecer.

## Como chamar os scripts

Cada chamada e independente (variaveis nao persistem entre chamadas). Use sempre o caminho completo:

- Ferramenta PowerShell:
  `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\skills\gravar-tela-chrome\scripts\<script>.ps1" <parametros>`
- Git Bash:
  `powershell -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -m ~/.claude/skills/gravar-tela-chrome/scripts)/<script>.ps1" <parametros>`

Abaixo, `<script>.ps1 ...` significa essa linha completa.

## Fluxo

1. **Tente uma janela propria**, antes de abrir a aba do teste (melhor esforco: quem escolhe a
   janela do grupo e o Chrome, e as vezes ele usa outra):
   - `janela-propria.ps1` (opcional `-Perfil "Profile 2"` se o agente usa um perfil especifico do
     Chrome) abre uma janela nova, vazia e em foco. Responde `JANELA hwnd=<H>`.
   - Logo em seguida, feche as abas que o seu grupo tiver (`tabs_close_mcp`; sem grupo, nada a
     fechar) e chame `tabs_context_mcp` com `createIfEmpty: true`. Use a aba que ele devolver.
   - No passo 3, compare o `hwnd=` do `GRAVANDO` com `<H>`. Diferente = a aba ficou numa janela com
     outras abas: a gravacao funciona, mas a barra de abas dessa janela aparece no video (titulos
     de outras abas visiveis). Anote isso no relatorio se for relevante.
2. **Marque a aba**: navegue para a URL inicial e, com `javascript_tool`,
   `document.title = "[grav-<nome>] " + document.title`.
3. **Inicie**: `iniciar.ps1 -Saida "<pasta>" -Nome "<nome>" -Filtro "[grav-<nome>]"`.
   O script acha a aba pelo marcador, traz a aba e a janela para a frente e responde
   `GRAVANDO ...`. Opcionais: `-Fps` (padrao 15), `-MaxMinutos` (padrao 30).
4. **A cada passo do teste, ANTES de executa-lo**:
   1. remarque o titulo (a navegacao apaga o marcador): o mesmo `javascript_tool` do passo 2;
   2. `marcar.ps1 -Saida "<pasta>" -Nome "<nome>" -Texto "CA-02: salvar sem nome mostra erro"`;
   3. execute o passo no Chrome.

   Passo que so confere algo (sem acao no Chrome) tambem leva `marcar`.
   O `marcar` confere se a aba do teste e a que aparece. Se outra aba entrou na frente, ele traz a
   do teste de volta e responde `AVISO: ...`: o trecho anterior do video pode mostrar outra aba
   (anote no relatorio). `ERRO: a aba do teste nao esta na janela gravada` = o marcador sumiu do
   titulo: remarque e repita; se persistir, pare e regrave.
5. **Pare SEMPRE**, inclusive se o teste falhar ou der erro no meio:
   `parar.ps1 -Saida "<pasta>" -Nome "<nome>"`. Ele espera 2 s (`-Espera`) para o resultado do
   ultimo passo aparecer, fecha o arquivo e responde `PARADO mp4=... quadros=<pasta> ...` mais a
   lista de **titulos que a janela mostrou** durante a gravacao. Sem o `parar`, o FFmpeg segue
   gravando ate `-MaxMinutos`.
6. **Confira o video antes de dizer que ele esta bom**: abra (Read) cada `passo-NN.png` da pasta
   `quadros`. Cada um e o **fim** do passo NN (logo antes do proximo `marcar`, ou o fim do video) e
   deve mostrar a aba do teste com o resultado esperado daquele passo.
   Na lista de titulos do `parar`, as paginas do proprio teste aparecem sem o marcador (normal).
   Titulo de algo que nao faz parte do teste (outro site, WhatsApp, YouTube...) ou quadro errado =
   o video mostra outra coisa em algum trecho: regrave ou reporte isso.
7. **Limpe**: feche as abas que voce abriu (`tabs_close_mcp`). A janela do `janela-propria` pode
   ficar aberta (vazia); nao feche janelas que voce nao abriu.

## Arquivos

Em `<pasta>` (se o agente tem pasta de evidencias, ex. `evidencias/<CHAVE>/rodada-NN/`, use-a):
`<nome>.mp4`, `<nome>.srt`, `<nome>.passos.tsv` e `<nome>.conferencia/passo-NN.png`.
O `parar` apaga o `.mkv` temporario e os arquivos ocultos `.<nome>.*` de controle.

## Regras

- Uma gravacao por vez por janela. Agentes em paralelo: cada um com a sua janela (passo 1), e as
  janelas nao podem se sobrepor na tela.
- Durante a gravacao ninguem usa a maquina na frente dessa janela; nao minimize nem mova a janela.
  Monitor secundario funciona (coordenadas negativas sao normais).
- Nao abra outra aba para o teste no meio da gravacao: ela nao aparece. Para trocar de aba, pare,
  marque a aba nova e inicie outra gravacao (outro `-Nome`).

## Erros comuns

| Mensagem | O que fazer |
|---|---|
| `0 janelas/abas ... com '<filtro>'` | Marcador sumiu (navegacao). Remarque e repita o `iniciar`. |
| `2 janelas/abas ...` | Filtro pouco especifico; use `[grav-<nome>]`. |
| `gravacao '<nome>' ja esta rodando` | Faltou o `parar` de uma gravacao anterior: pare-a primeiro. |
| `o Windows nao deixou trazer a janela ... para a frente` | Peca ao usuario para clicar na janela do Chrome e repita. |
| `FALTA: ffmpeg` | Peca ao usuario: `winget install --id Gyan.FFmpeg -e`. |
