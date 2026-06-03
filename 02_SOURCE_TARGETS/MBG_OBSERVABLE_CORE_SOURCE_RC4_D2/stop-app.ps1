# RC4-D2 — stop core (3011) and frontend dev (5173) using the same rules as stop-all.
$ErrorActionPreference = 'Continue'
& (Join-Path $PSScriptRoot 'stop-all.ps1')
