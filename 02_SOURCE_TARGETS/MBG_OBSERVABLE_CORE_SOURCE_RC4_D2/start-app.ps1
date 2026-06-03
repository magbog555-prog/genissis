# RC4-D2 — double-click friendly orchestrator: resolve 3011, then core + frontend in separate windows + browser.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
. (Join-Path $root 'rc4-d2-port-util.ps1')

Write-Host "[RC4-D2] START_APP — подготовка запуска..." -ForegroundColor Cyan

while ($true) {
  $pids = @(Get-TcpListenPids -Port 3011)
  if ($pids.Count -eq 0) { break }

  Write-Host ""
  Write-Host "[RC4-D2] Порт 3011 занят. Вероятно, уже запущен старый core." -ForegroundColor Yellow
  foreach ($p in $pids) {
    Write-Host "[RC4-D2] Найден процесс с PID $p."
  }
  Write-Host "[1] Остановить старый core и продолжить запуск приложения"
  Write-Host "[2] Отменить"
  $choice = Read-Host "Выберите действие (1 или 2)"

  if ($choice -eq '1') {
    & (Join-Path $root 'stop-core-port.ps1')
    Start-Sleep -Milliseconds 500
    continue
  }
  if ($choice -eq '2') {
    Write-Host "[RC4-D2] Запуск отменён оператором." -ForegroundColor Cyan
    exit 0
  }
  Write-Host "[RC4-D2] Введите 1 или 2." -ForegroundColor DarkYellow
}

$coreScript = Join-Path $root 'start-core.ps1'
$feScript = Join-Path $root 'start-frontend.ps1'

Write-Host "[RC4-D2] Открываю окно core..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass',
  '-File', $coreScript, '-SkipPortPreflight'
) -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "[RC4-D2] Открываю окно frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
  '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass',
  '-File', $feScript
) -WindowStyle Normal

Write-Host "[RC4-D2] Ожидание готовности core (http://127.0.0.1:3011/health)..." -ForegroundColor DarkGray
$deadline = (Get-Date).AddSeconds(45)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3011/health' -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) {
      $ready = $true
      break
    }
  }
  catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $ready) {
  Write-Host "[RC4-D2] Предупреждение: health не ответил за 45 с. Откройте http://localhost:5173 после готовности core." -ForegroundColor Yellow
}

Start-Sleep -Seconds 1
Write-Host "[RC4-D2] Открываю браузер: http://localhost:5173" -ForegroundColor Green
Start-Process 'http://localhost:5173'

Write-Host "[RC4-D2] Готово: core и frontend в отдельных окнах PowerShell; браузер запущен (или обновите вкладку)." -ForegroundColor Green
