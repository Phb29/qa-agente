# Funcoes compartilhadas pelos scripts de gravacao (ASCII puro: PowerShell 5.1 le .ps1 sem BOM como ANSI).
. "$PSScriptRoot\win32.ps1"

function Get-Ffmpeg {
  $c = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $w = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($w) { return $w.FullName }
  throw "FALTA: ffmpeg - winget install --id Gyan.FFmpeg -e"
}

function Get-Estado([string]$Saida, [string]$Nome) {
  $p = Join-Path $Saida ".$Nome.gravacao.json"
  if (-not (Test-Path $p)) { throw "ERRO: nenhuma gravacao '$Nome' iniciada em $Saida" }
  return @{ Caminho = $p; Dados = (Get-Content $p -Raw | ConvertFrom-Json) }
}

function Get-AgoraMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

function Ativar-Janela([long]$hwnd) {
  if ([Win32Grav]::Minimizada($hwnd)) { [Win32Grav]::ShowWindow([IntPtr]$hwnd, 9) | Out-Null; Start-Sleep -Milliseconds 600 }
  if (-not [Win32Grav]::TrazerParaFrente($hwnd)) { throw "ERRO: o Windows nao deixou trazer a janela do Chrome para a frente. Clique nela uma vez e repita." }
  Start-Sleep -Milliseconds 300
}

# Percorre as abas da janela com Ctrl+Tab ate o titulo conter o marcador. Devolve $true se achou.
function Ativar-Aba([long]$hwnd, [string]$marcador) {
  Ativar-Janela $hwnd
  if ([Win32Grav]::Titulo($hwnd).Contains($marcador)) { return $true }
  $shell = New-Object -ComObject WScript.Shell
  $primeiro = [Win32Grav]::Titulo($hwnd)
  for ($i = 0; $i -lt 60; $i++) {
    $shell.SendKeys("^{TAB}"); Start-Sleep -Milliseconds 250
    $t = [Win32Grav]::Titulo($hwnd)
    if ($t.Contains($marcador)) { return $true }
    if ($t -eq $primeiro) { return $false }
  }
  return $false
}
