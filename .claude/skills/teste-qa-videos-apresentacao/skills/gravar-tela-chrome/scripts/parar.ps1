# Encerra a gravacao, gera <Nome>.mp4 e, se houve marcacoes, <Nome>.srt com os passos.
param(
  [Parameter(Mandatory)][string]$Saida,
  [Parameter(Mandatory)][string]$Nome,
  [int]$Espera = 2
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\comum.ps1"
$ffmpeg = Get-Ffmpeg
$est = Get-Estado $Saida $Nome
$e = $est.Dados
Start-Sleep -Seconds $Espera  # deixa o resultado do ultimo passo aparecer no video
$fimSeg = ((Get-AgoraMs) - $e.inicioMs) / 1000.0
# o gravador ve o arquivo de parada e manda "q" ao ffmpeg, que fecha o arquivo direito
Set-Content -Path $e.parada -Value "parar"
$proc = Get-Process -Id $e.pid -ErrorAction SilentlyContinue
if ($proc -and -not $proc.WaitForExit(30000)) { Stop-Process -Id $e.pid -Force }
if (-not (Test-Path $e.mkv)) { throw "ERRO: arquivo da gravacao nao existe: $($e.mkv)" }

$mp4 = Join-Path $Saida "$Nome.mp4"
& $ffmpeg -hide_banner -loglevel error -y -i $e.mkv -c copy -movflags +faststart $mp4
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $mp4)) { throw "ERRO: falha ao converter $($e.mkv) para mp4 (o mkv foi mantido)" }
$ffprobe = Join-Path (Split-Path $ffmpeg) "ffprobe.exe"
$dur = [double]::Parse((& $ffprobe -v error -show_entries format=duration -of csv=p=0 $mp4), [Globalization.CultureInfo]::InvariantCulture)
$titulosInfo = ""
if ($e.titulos -and (Test-Path $e.titulos)) {
  $vistos = @(Get-Content $e.titulos -Encoding UTF8 | Where-Object { $_ } | ForEach-Object { ($_ -split "`t", 2)[1] } | Select-Object -Unique)
  $titulosInfo = "`nTITULOS DA JANELA DURANTE A GRAVACAO (confira se algum nao e da aba do teste):`n" + (($vistos | ForEach-Object { "  - $_" }) -join "`n")
  Remove-Item $e.titulos -ErrorAction SilentlyContinue
}
Remove-Item $e.mkv, $e.parada, $est.Caminho, (Join-Path $Saida ".$Nome.ffmpeg.log"), (Join-Path $Saida ".$Nome.args.json") -ErrorAction SilentlyContinue

$tsv = Join-Path $Saida "$Nome.passos.tsv"
$srtInfo = ""
if (Test-Path $tsv) {
  $inv = [Globalization.CultureInfo]::InvariantCulture
  $passos = @(Get-Content $tsv -Encoding UTF8 | Where-Object { $_ } | ForEach-Object {
    $c = $_ -split "`t", 2; [pscustomobject]@{ T = [double]::Parse($c[0], $inv); Texto = $c[1] } })
  function Fmt([double]$s) { $t = [TimeSpan]::FromSeconds([math]::Max([double]0, $s)); "{0:00}:{1:00}:{2:00},{3:000}" -f [int][math]::Floor($t.TotalHours), $t.Minutes, $t.Seconds, $t.Milliseconds }
  $sb = New-Object Text.StringBuilder
  for ($i = 0; $i -lt $passos.Count; $i++) {
    $ini = $passos[$i].T
    $fim = if ($i + 1 -lt $passos.Count) { $passos[$i + 1].T } else { [math]::Min($dur, $ini + 6) }
    if ($fim -le $ini) { $fim = $ini + 1 }
    [void]$sb.AppendLine("$($i + 1)").AppendLine("$(Fmt $ini) --> $(Fmt $fim)").AppendLine($passos[$i].Texto).AppendLine()
  }
  $srt = Join-Path $Saida "$Nome.srt"
  [IO.File]::WriteAllText($srt, $sb.ToString(), [Text.UTF8Encoding]::new($false))
  $srtInfo = " legendas=$srt passos=$($passos.Count)"
  # um quadro do FIM de cada passo (logo antes da proxima marcacao, ou do fim do video),
  # que mostra o resultado do passo, para o agente conferir o video
  $conf = Join-Path $Saida "$Nome.conferencia"
  New-Item -ItemType Directory -Force $conf | Out-Null
  for ($i = 0; $i -lt $passos.Count; $i++) {
    $fimPasso = if ($i + 1 -lt $passos.Count) { $passos[$i + 1].T - 0.5 } else { $dur - 0.3 }
    $t = [math]::Max($passos[$i].T, [math]::Max([double]0, $fimPasso)).ToString("0.0", $inv)
    & $ffmpeg -hide_banner -loglevel error -y -ss $t -i $mp4 -frames:v 1 -vf "scale=960:-2" (Join-Path $conf ("passo-{0:00}.png" -f ($i + 1)))
  }
  $srtInfo += " quadros=$conf"
}
"PARADO mp4=$mp4 duracao=" + $dur.ToString("0.0", [Globalization.CultureInfo]::InvariantCulture) + "s" + $srtInfo + $titulosInfo
