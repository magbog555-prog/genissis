# TSLab Terminal Modules Library

**Canonical path:** `D:\genessis\architecture\books\терминал`  
**Platform:** TSLab cubes / scripts / toolkits  
**Doctrine:** `TSLab module ≠ GENESIS production rule`

## What this is

A cleaned inventory of local **TSLab terminal building blocks** (indicators, trade guards, datetime, risk/stats, IO, UI, connectivity, toolkits).  
Organized so Market and Backend engineers can find reusable **patterns**, not dump RARs.

## Taxonomy

| Folder | Meaning |
|---|---|
| `01_indicators` | Indicators (SMA/EMA/VWAP/BB/MFI/…) |
| `02_trade_control` | Readiness, position side, lab-mode, intervals |
| `03_time_datetime` | Clocks, bar date, last-bar, intervals |
| `04_risk_money_stats` | Balance/risk/commission/correlation/PnL stats |
| `05_data_io_utils` | State memo, file IO, metronomes, getters |
| `06_messaging_ui` | Messages, ruler, drawing |
| `07_toolkits_bundles` | Large vendor packs (inspect first) |
| `08_connectivity` | Exchange ping / API health |
| `09_uncategorized` | Overflow |
| `catalog/` | Machine index |

## Start here

1. `README.md` (this file)
2. `MARKET_ENGINEER_GUIDE.md`
3. `BACKEND_ENGINEER_GUIDE.md`
4. `TERMINAL_TO_GENESIS_MAP.md`
5. `catalog/terminal_modules.json` / `.csv`

## Search

```powershell
D:\genessis\architecture\books\терминал\catalog\Search-Terminal.ps1 -Query "ready"
D:\genessis\architecture\books\терминал\catalog\Search-Terminal.ps1 -Organ volatility
D:\genessis\architecture\books\терминал\catalog\Search-Terminal.ps1 -Priority P1
```

## Priority for GENESIS research (not production)

**P1:** Is Lab Mode · Is Ready For Trade · Check Trade Settings · Is Last Bar · Balance/Risk tickets · Commission · Recalc Memorizer · OKX ping checker

## Hard fence

```text
BOOK / TSLAB BLOCK
  → concept / pattern prior
    → research hypothesis
      → GENESIS test
        → Admission
          → only then Production Rule
```

Never reverse. Never wire these archives into Producer.
