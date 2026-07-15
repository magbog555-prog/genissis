#Requires -Version 5.1
<#
.SYNOPSIS
  Search the Genessis books library catalog.
.EXAMPLE
  .\Search-Library.ps1 -Query "wyckoff"
  .\Search-Library.ps1 -Tag risk
  .\Search-Library.ps1 -Category 02_trading_systems_practice
  .\Search-Library.ps1 -Author Schwager
  .\Search-Library.ps1 -Query "elder" -Open
#>
param(
  [string]$Query,
  [string]$Tag,
  [string]$Category,
  [string]$Author,
  [string]$Id,
  [switch]$Duplicates,
  [switch]$NeedsReview,
  [switch]$Open,
  [string]$LibraryPath = (Join-Path $PSScriptRoot 'library.json')
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$lib = Get-Content -LiteralPath $LibraryPath -Raw -Encoding UTF8 | ConvertFrom-Json
$items = @($lib.items)

if ($Id) { $items = $items | Where-Object { $_.id -eq $Id } }
if ($Category) { $items = $items | Where-Object { $_.category -match [regex]::Escape($Category) } }
if ($Author) { $items = $items | Where-Object { $_.author -match $Author } }
if ($Tag) { $items = $items | Where-Object { @($_.tags) -contains $Tag -or (($_.tags -join ' ') -match $Tag) } }
if ($Duplicates) { $items = $items | Where-Object { $_.duplicate_candidate -eq $true } }
if ($NeedsReview) {
  $items = $items | Where-Object {
    (@($_.tags) -contains 'needs-review') -or ($_.notes -match 'needs|review|unclear|identify')
  }
}
if ($Query) {
  $q = $Query
  $items = $items | Where-Object {
    $_.title -match $q -or $_.author -match $q -or $_.original_name -match $q -or
    $_.relative_path -match $q -or (($_.tags -join ' ') -match $q) -or $_.notes -match $q
  }
}

$items | Sort-Object category, author, title | Select-Object id, category, author, title, format, size_mb, relative_path, tags | Format-Table -AutoSize

Write-Host ("Matched: {0} / {1}" -f @($items).Count, $lib.total_books)

if ($Open) {
  foreach ($i in $items) {
    if (Test-Path -LiteralPath $i.absolute_path) { Invoke-Item -LiteralPath $i.absolute_path }
    else { Write-Warning "Missing: $($i.absolute_path)" }
  }
}
