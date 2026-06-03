# RC4-D2 — stop whatever is LISTENING on TCP port 3011 (readonly core dev API).
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
. (Join-Path $root 'rc4-d2-port-util.ps1')

Write-Host "[RC4-D2] Проверка порта 3011..."
$pids = @(Get-TcpListenPids -Port 3011)

if ($pids.Count -eq 0) {
  Write-Host "[RC4-D2] Порт 3011 уже свободен."
  exit 0
}

foreach ($p in $pids) {
  Write-Host "[RC4-D2] Найден процесс PID $p."
}

Write-Host "[RC4-D2] Останавливаю core..."
foreach ($p in $pids) {
  try {
    Stop-Process -Id $p -Force -ErrorAction Stop
  }
  catch {
    Write-Host "[RC4-D2] Не удалось остановить PID ${p}: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Start-Sleep -Milliseconds 600

$still = @(Get-TcpListenPids -Port 3011)
if ($still.Count -gt 0) {
  Write-Host "[RC4-D2] ОШИБКА: порт 3011 всё ещё занят (PID: $($still -join ', '))." -ForegroundColor Red
  exit 1
}

Write-Host "[RC4-D2] Порт 3011 освобождён."
exit 0
