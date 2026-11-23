# Registra um passo do teste no instante atual da gravacao (vira legenda .srt no parar.ps1).
param(
  [Parameter(Mandatory)][string]$Saida,
  [Parameter(Mandatory)][string]$Nome,
  [Parameter(Mandatory)][string]$Texto
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\comum.ps1"
$e = (Get-Estado $Saida $Nome).Dados
# O agente remarca o titulo da aba antes de cada passo; se a janela mostra outra aba, traz a do teste de volta.
$aviso = ""
if (-not [Win32Grav]::Titulo($e.hwnd).Contains($e.marcador)) {
  $outra = [Win32Grav]::Titulo($e.hwnd)
  if (-not (Ativar-Aba $e.hwnd $e.marcador)) {
    throw "ERRO: a aba do teste nao esta na janela gravada (titulo atual: '$outra'). Remarque o titulo da aba com '$($e.marcador)' e repita; se continuar, pare e regrave."
  }
  $aviso = "AVISO: a janela mostrava outra aba ('$outra'); a aba do teste foi trazida de volta. O trecho anterior do video pode mostrar a outra aba. "
}
$seg = [math]::Round(((Get-AgoraMs) - $e.inicioMs) / 1000.0, 1)
$linha = "{0}`t{1}" -f $seg.ToString([Globalization.CultureInfo]::InvariantCulture), ($Texto -replace "[`t`r`n]", " ")
[IO.File]::AppendAllText((Join-Path $Saida "$Nome.passos.tsv"), "$linha`n", [Text.UTF8Encoding]::new($false))
"${aviso}MARCADO ${seg}s $Texto"
