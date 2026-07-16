#Requires -Version 5.1
param(
  [string]$Query,
  [string]$Organ,
  [string]$Category,
  [string]$Priority,
  [string]$Kind,
  [string]$CatalogPath
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $CatalogPath) {
  $sig = Get-ChildItem 'D:\genessis\architecture\books' -Recurse -Filter 'terminal_modules.json' | Select-Object -First 1
  if (-not $sig) { throw 'terminal_modules.json not found' }
  $CatalogPath = $sig.FullName
}

$data = Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($data.items)

if ($Category) { $items = $items | Where-Object { $_.category -match [regex]::Escape($Category) } }
if ($Priority) { $items = $items | Where-Object { $_.priority -eq $Priority } }
if ($Kind) { $items = $items | Where-Object { $_.kind -eq $Kind } }
if ($Organ) {
  $items = $items | Where-Object { @($_.genesis_organs) -contains $Organ -or (($_.genesis_organs -join ' ') -match $Organ) }
}
if ($Query) {
  $q = $Query
  $items = $items | Where-Object {
    $_.title -match $q -or $_.purpose -match $q -or $_.original_name -match $q -or $_.notes -match $q -or $_.kind -match $q
  }
}

$items | Sort-Object priority, category, title |
  Select-Object id, priority, category, kind, title, purpose, @{n='organs';e={ $_.genesis_organs -join ',' }}, relative_path |
  Format-Table -AutoSize

Write-Host ("Matched: {0} / {1}" -f @($items).Count, $data.total)
Write-Host "Catalog: $CatalogPath"
