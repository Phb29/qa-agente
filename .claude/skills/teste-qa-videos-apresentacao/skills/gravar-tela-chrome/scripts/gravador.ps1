# Processo oculto que segura o ffmpeg: quando o arquivo de parada aparece (ou o tempo maximo passa),
# manda "q" no stdin para o ffmpeg fechar o arquivo direito. Chamado pelo iniciar.ps1; nao use direto.
param(
  [Parameter(Mandatory)][string]$Ffmpeg,
  [Parameter(Mandatory)][string]$ArgsArquivo,
  [Parameter(Mandatory)][string]$Parada,
  [Parameter(Mandatory)][string]$Log,
  [Parameter(Mandatory)][long]$Hwnd,
  [Parameter(Mandatory)][string]$Titulos,
  [int]$MaxSegundos = 1800
)
. "$PSScriptRoot\win32.ps1"
$psi = New-Object Diagnostics.ProcessStartInfo
$psi.FileName = $Ffmpeg
$psi.Arguments = ((Get-Content $ArgsArquivo -Raw -Encoding UTF8 | ConvertFrom-Json) | ForEach-Object { if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardInput = $true
$psi.RedirectStandardError = $true
$p = [Diagnostics.Process]::Start($psi)
$erros = $p.StandardError.ReadToEndAsync()
$limite = (Get-Date).AddSeconds($MaxSegundos)
# registra cada troca de titulo da janela (navegacao OU outra aba ficando ativa)
$t0 = Get-Date; $ultimo = $null; $utf8 = [Text.UTF8Encoding]::new($false)
while (-not $p.HasExited -and -not (Test-Path $Parada) -and (Get-Date) -lt $limite) {
  $t = [Win32Grav]::Titulo($Hwnd)
  if ($t -ne $ultimo) {
    $seg = ((Get-Date) - $t0).TotalSeconds.ToString("0.0", [Globalization.CultureInfo]::InvariantCulture)
    [IO.File]::AppendAllText($Titulos, "$seg`t$t`n", $utf8); $ultimo = $t
  }
  Start-Sleep -Milliseconds 300
}
if (-not $p.HasExited) {
  $p.StandardInput.Write("q"); $p.StandardInput.Flush()
  if (-not $p.WaitForExit(20000)) { $p.Kill() }
}
$p.WaitForExit()
[IO.File]::WriteAllText($Log, $erros.Result + "`nexit=" + $p.ExitCode)
