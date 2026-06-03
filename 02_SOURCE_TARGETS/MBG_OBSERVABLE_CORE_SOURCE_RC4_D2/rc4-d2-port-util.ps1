# RC4-D2 — shared TCP LISTENING helpers (dot-source only).
# Parses netstat so locale (LISTENING / Прослушивается) does not break detection.

function Get-TcpListenPids {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )
  $seen = @{}
  $out = New-Object System.Collections.Generic.List[int]
  netstat -ano | ForEach-Object {
    $line = $_
    if ($line -notmatch '(?i)LISTENING|Прослушивается') { return }
    if ($line -notmatch ":$Port\s+") { return }
    if ($line -match '\s(\d+)\s*$') {
      $id = [int]$Matches[1]
      if (-not $seen.ContainsKey($id)) {
        $seen[$id] = $true
        $out.Add($id) | Out-Null
      }
    }
  }
  return , $out.ToArray()
}

function Test-TcpPortFree {
  param([int]$Port)
  return ((Get-TcpListenPids -Port $Port).Count -eq 0)
}
