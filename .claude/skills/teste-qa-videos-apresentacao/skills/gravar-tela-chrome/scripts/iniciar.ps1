# Inicia a gravacao da janela do Chrome cujo titulo contem -Filtro.
# Grava a AREA da tela onde a janela esta (captura direta da janela sai preta no Chrome),
# entao a janela e trazida para a frente e precisa continuar visivel ate o fim.
param(
  [Parameter(Mandatory)][string]$Saida,
  [Parameter(Mandatory)][string]$Nome,
  [Parameter(Mandatory)][string]$Filtro,
  [int]$Fps = 15,
  [int]$MaxMinutos = 30
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\comum.ps1"
$ffmpeg = Get-Ffmpeg
New-Item -ItemType Directory -Force $Saida | Out-Null
$estadoPath = Join-Path $Saida ".$Nome.gravacao.json"
if (Test-Path $estadoPath) {
  $antigo = Get-Content $estadoPath -Raw | ConvertFrom-Json
  if (Get-Process -Id $antigo.pid -ErrorAction SilentlyContinue) { throw "ERRO: gravacao '$Nome' ja esta rodando (pid $($antigo.pid)). Rode parar.ps1 antes." }
}

# A aba do claude-in-chrome costuma ficar em segundo plano (o titulo da janela e o da aba ATIVA).
# Se nenhuma janela mostra o filtro, percorre as abas de cada janela com Ctrl+Tab ate achar.
$janelas = @([Win32Grav]::ListarChrome() | Where-Object { $_.Titulo.Contains($Filtro) })
if ($janelas.Count -eq 0) {
  foreach ($cand in [Win32Grav]::ListarChrome()) {
    if (Ativar-Aba $cand.Hwnd $Filtro) { $janelas = @($cand); break }
  }
}
if ($janelas.Count -ne 1) {
  $todas = ([Win32Grav]::ListarChrome() | ForEach-Object { "  - " + $_.Titulo }) -join "`n"
  throw "ERRO: $($janelas.Count) janelas/abas do Chrome com '$Filtro' no titulo (precisa ser 1). Janelas abertas:`n$todas"
}
$j = $janelas[0]
Ativar-Janela $j.Hwnd
$j = @([Win32Grav]::ListarChrome() | Where-Object { $_.Hwnd -eq $j.Hwnd })[0]
$w = $j.W - ($j.W % 2); $h = $j.H - ($j.H % 2)

$mkv = Join-Path $Saida "$Nome.mkv"
$log = Join-Path $Saida ".$Nome.ffmpeg.log"
$parada = Join-Path $Saida ".$Nome.parar"
$argsArq = Join-Path $Saida ".$Nome.args.json"
$titulos = Join-Path $Saida ".$Nome.titulos.tsv"
Remove-Item $mkv, $parada, $log, $titulos, (Join-Path $Saida "$Nome.passos.tsv") -ErrorAction SilentlyContinue
# mkv + flush_packets: se algo matar o processo, o que ja foi gravado continua legivel
$ffArgs = @("-hide_banner", "-loglevel", "warning", "-y", "-f", "gdigrab", "-framerate", "$Fps", "-draw_mouse", "1",
  "-offset_x", "$($j.X)", "-offset_y", "$($j.Y)", "-video_size", "${w}x${h}", "-i", "desktop",
  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-flush_packets", "1", $mkv)
ConvertTo-Json $ffArgs | Set-Content -Encoding UTF8 $argsArq
$gravador = Join-Path $PSScriptRoot "gravador.ps1"
$p = Start-Process powershell -WindowStyle Hidden -PassThru -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", "`"$gravador`"", "-Ffmpeg", "`"$ffmpeg`"", "-ArgsArquivo", "`"$argsArq`"", "-Parada", "`"$parada`"",
  "-Log", "`"$log`"", "-Hwnd", "$($j.Hwnd)", "-Titulos", "`"$titulos`"", "-MaxSegundos", "$($MaxMinutos * 60)")
$inicio = Get-AgoraMs
@{ pid = $p.Id; inicioMs = $inicio; mkv = $mkv; parada = $parada; hwnd = $j.Hwnd; marcador = $Filtro; titulos = $titulos; janela = $j.Titulo; area = "$($j.X),$($j.Y) ${w}x${h}"; fps = $Fps } |
  ConvertTo-Json | Set-Content -Encoding UTF8 $estadoPath

Start-Sleep -Seconds 2
if ($p.HasExited -or -not (Test-Path $mkv)) {
  Remove-Item $estadoPath -ErrorAction SilentlyContinue
  $txt = if (Test-Path $log) { Get-Content $log -Raw } else { "(sem log)" }
  throw "ERRO: ffmpeg nao iniciou. Log:`n$txt"
}
"GRAVANDO pid=$($p.Id) hwnd=$($j.Hwnd) area=$($j.X),$($j.Y) ${w}x${h} janela=`"$($j.Titulo)`" arquivo=$mkv"
