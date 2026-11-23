# Abre uma janela nova do Chrome para o agente gravar sem outras abas por perto.
# Depois disso o agente fecha as abas do grupo dele e chama tabs_context_mcp com createIfEmpty:
# o grupo novo nasce nessa janela (a mais recente/em foco).
param([string]$Perfil = "")  # pasta do perfil do Chrome (ex. "Profile 2"); vazio = o perfil em uso
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\comum.ps1"
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw "ERRO: chrome.exe nao encontrado" }
$antes = @([Win32Grav]::ListarChrome() | ForEach-Object { $_.Hwnd })
$a = @("--new-window", "about:blank")
if ($Perfil) { $a = @("--profile-directory=`"$Perfil`"") + $a }
Start-Process $chrome -ArgumentList $a | Out-Null
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 300
  $nova = @([Win32Grav]::ListarChrome() | Where-Object { $antes -notcontains $_.Hwnd })
  if ($nova.Count -ge 1) { Ativar-Janela $nova[0].Hwnd; "JANELA hwnd=$($nova[0].Hwnd) area=$($nova[0].X),$($nova[0].Y) $($nova[0].W)x$($nova[0].H)"; exit 0 }
}
throw "ERRO: a janela nova do Chrome nao apareceu"
