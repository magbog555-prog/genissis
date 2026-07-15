#Requires -Version 5.1
param(
  [string]$Query,
  [string]$Organ,
  [string]$Family,
  [string]$Concept,
  [string]$Priority,
  [string]$KbRoot = 'D:\genessis\architecture\books\knowledge_base'
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Load-Json($p) { Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json }

$sources = (Load-Json (Join-Path $KbRoot '01_sources\knowledge_sources.json')).items
$concepts = (Load-Json (Join-Path $KbRoot '02_concepts\knowledge_concepts.json')).items
$hyps = (Load-Json (Join-Path $KbRoot '06_research_hypotheses\research_hypotheses.json')).items

if ($Priority) { $sources = $sources | Where-Object { $_.core_priority -eq $Priority } }
if ($Organ) {
  $sources = $sources | Where-Object { @($_.relevance.organs) -contains $Organ }
  $concepts = $concepts | Where-Object { @($_.related_organs) -contains $Organ }
}
if ($Family) {
  $sources = $sources | Where-Object { @($_.relevance.thinking_families) -contains $Family }
  $concepts = $concepts | Where-Object { @($_.related_families) -contains $Family }
}
if ($Concept) { $concepts = $concepts | Where-Object { $_.concept_id -eq $Concept -or $_.name_en -match $Concept -or $_.name_ru -match $Concept } }
if ($Query) {
  $q = $Query
  $sources = $sources | Where-Object { $_.title -match $q -or $_.author -match $q -or $_.notes -match $q }
  $concepts = $concepts | Where-Object { $_.name_en -match $q -or $_.name_ru -match $q -or $_.definition_original -match $q }
  $hyps = $hyps | Where-Object { $_.statement -match $q -or $_.hypothesis_id -match $q }
}

Write-Host '=== SOURCES ==='
$sources | Select-Object source_id, core_priority, author, title, crowd_exposure | Format-Table -AutoSize
Write-Host '=== CONCEPTS ==='
$concepts | Select-Object concept_id, crowd_exposure, internal_status, name_en | Format-Table -AutoSize
Write-Host '=== HYPOTHESES (sample) ==='
$hyps | Select-Object -First 15 hypothesis_id, internal_status, statement | Format-List
Write-Host ("counts sources={0} concepts={1} hyps={2}" -f @($sources).Count, @($concepts).Count, @($hyps).Count)
