# RC4-D2 — preflight port 3011 before starting readonly core (avoids raw EADDRINUSE as primary UX).
param(
  [switch]$SkipPortPreflight
)

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
. (Join-Path $root 'rc4-d2-port-util.ps1')

if (-not $SkipPortPreflight) {
  while ($true) {
    $pids = @(Get-TcpListenPids -Port 3011)
    if ($pids.Count -eq 0) { break }

    Write-Host ""
    Write-Host "[RC4-D2] Порт 3011 занят. Вероятно, уже запущен старый core." -ForegroundColor Yellow
    foreach ($p in $pids) {
      Write-Host "[RC4-D2] Найден процесс с PID $p."
    }
    Write-Host "[1] Остановить старый core и запустить новый"
    Write-Host "[2] Отменить запуск"
    $choice = Read-Host "Выберите действие (1 или 2)"

    if ($choice -eq '1') {
      & (Join-Path $root 'stop-core-port.ps1')
      if ($LASTEXITCODE -ne 0) {
        Write-Host "[RC4-D2] Не удалось освободить порт. Повторите выбор или закройте процесс вручную." -ForegroundColor Red
      }
      Start-Sleep -Milliseconds 400
      continue
    }
    if ($choice -eq '2') {
      Write-Host "[RC4-D2] Запуск отменён оператором." -ForegroundColor Cyan
      exit 0
    }
    Write-Host "[RC4-D2] Введите 1 или 2." -ForegroundColor DarkYellow
  }
}

Set-Location (Join-Path $root 'core')
Write-Host "[RC4-D2] Запуск readonly core API (npm run dev:readonly-api)..." -ForegroundColor Green
npm run dev:readonly-api
$code = $LASTEXITCODE
if ($code -ne 0) {
  Write-Host "[RC4-D2] Core завершился с кодом $code. Если в логе выше был EADDRINUSE — порт 3011 снова занят; используйте launcher\STOP_CORE_PORT.cmd или .\stop-core-port.ps1." -ForegroundColor Yellow
}
exit $code
