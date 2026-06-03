# Genesis Foundation — safe operator entry (D-03 / P0.1 portable roots)
$ErrorActionPreference = "Stop"
$GenesisRoot = if ($env:GENESIS_ROOT) { $env:GENESIS_ROOT } else { Resolve-Path (Join-Path $PSScriptRoot "..\..\..") }
$SourceTarget = if ($env:SOURCE_TARGET_ROOT) { $env:SOURCE_TARGET_ROOT } else { Join-Path $GenesisRoot "02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2" }
$CoreRoot = Join-Path $SourceTarget "core"
if (-not (Test-Path $CoreRoot)) { throw "MBG core not found: $CoreRoot (set SOURCE_TARGET_ROOT or GENESIS_ROOT)" }
Write-Host "[genesis] dev:readonly-safe -> npm run dev:readonly-api (readonly-api only)"
Push-Location $CoreRoot
try {
  npm run dev:readonly-api
} finally {
  Pop-Location
}
