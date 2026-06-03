# Genesis Foundation — LAB entry (UNSAFE). Requires explicit intent.
$ErrorActionPreference = "Stop"
$GenesisRoot = if ($env:GENESIS_ROOT) { $env:GENESIS_ROOT } else { Resolve-Path (Join-Path $PSScriptRoot "..\..\..") }
$SourceTarget = if ($env:SOURCE_TARGET_ROOT) { $env:SOURCE_TARGET_ROOT } else { Join-Path $GenesisRoot "02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2" }
$CoreRoot = Join-Path $SourceTarget "core"
if (-not (Test-Path $CoreRoot)) { throw "MBG core not found: $CoreRoot" }
Write-Warning "[genesis] dev:runtime-lab-unsafe -> runtime-api (execution limbs). NOT genesis-safe-readonly."
$confirm = Read-Host "Type LAB-UNSAFE to continue"
if ($confirm -ne "LAB-UNSAFE") { throw "Aborted." }
Push-Location $CoreRoot
try {
  npm run dev:runtime-lab-unsafe
} finally {
  Pop-Location
}
