# RC4-D2 — free dev ports 3011 (core) and 5173 (Vite) without relying on fragile netstat-only parsing.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
. (Join-Path $root 'rc4-d2-port-util.ps1')

Write-Host "[RC4-D2] Остановка процессов на портах 3011 и 5173..."

& (Join-Path $root 'stop-core-port.ps1') | Out-Host

$p5173 = @(Get-TcpListenPids -Port 5173)
if ($p5173.Count -gt 0) {
  foreach ($p in $p5173) {
    Write-Host "[RC4-D2] Останавливаю frontend (порт 5173), PID $p."
    try { Stop-Process -Id $p -Force -ErrorAction Stop }
    catch { Write-Host "[RC4-D2] Не удалось остановить PID ${p}: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  Start-Sleep -Milliseconds 500
}

if ((Get-TcpListenPids -Port 5173).Count -gt 0) {
  Write-Host "[RC4-D2] Предупреждение: порт 5173 может оставаться занят." -ForegroundColor Yellow
}

Write-Host "[RC4-D2] stop-all завершён."
