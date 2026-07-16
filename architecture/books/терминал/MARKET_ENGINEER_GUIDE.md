# Market Engineer Guide — TSLab Terminal Modules

**Audience:** Market Architect / Market Engineer  
**Source:** `architecture/books/терминал`  
**Related:** Knowledge Base reverse organ map · Research Platform methodology

## Your job with this folder

Treat every archive as a **market cognition primitive** that someone already decomposed for a terminal:

```text
What market question does this block answer?
Which GENESIS organ would own that question?
Is it observation, guard, cost, tempo, or story?
What does the crowd already do with this?
```

Do **not** treat blocks as ready scenarios or LONG/SHORT authority.

## How to use in project workflow

### 1) Reverse from organ (preferred)

Open organ dossier in knowledge base, then find terminal modules tagged with that organ in `catalog/terminal_modules.csv`.

Example:

| Organ | Look in terminal | Why |
|---|---|---|
| `volatility` | Volatility Index, Adaptive SMA, Bollinger | amplitude/regime sensors |
| `session_profile` | VWAP, BarDate, SystemTime, trade interval | session geography/time |
| `spread_entry_cost` | Commission, Ticket Risk, ReadyForTrade | cost/readiness priors |
| `liquidity` | Balance control, LockedMoney, ReadyForTrade | size/lock awareness |
| `market_tempo` | Metronomes, IsLastBar, SystemTime | pace/hygiene |
| `cross_symbol_correlation` | Correlation | cross relations |
| `chart_structure` | SMA/EMA/LSMA/MFI/DiNapoli/Ruler | geometry toolkit |

### 2) Build research priors, not rules

For each useful module write a research card:

```text
module_id: T0xx
pattern: <name>
organ(s): ...
market question: ...
crowd_exposure: HIGH|MEDIUM|...
hypothesis: ...
required GENESIS data: ...
forbidden inference: no Scenario / no Decision
```

File hypotheses under knowledge-base research queue discipline (`INTERNAL_HYPOTHESIS`).

### 3) Second-order market reading

Retail terminals popularize indicator/ORB/readiness cubes. Use that as **crowd map**:

- Where do stops/entries cluster if everyone uses same readiness/breakout folklore?
- Which “ready to trade” predicates create synchronized flow?
- How does commission ignorance inflate fake expectancy?

## Priority modules for Market Engineer (P1)

1. **Is Lab Mode** — separates toy semantics from live semantics (critical cognitive fence)  
2. **Is Ready For Trade / Check Trade Settings** — readiness as multi-condition observation, not permission  
3. **Is Last Bar** — anti-look-ahead hygiene analogy  
4. **Ticket Risk / Balance Control / Commission** — cost & risk realism vocabulary  
5. **OKX Ping Checker** — venue health as market context, not alpha  

## What to ignore first

- Giant opaque bundles (`Mega Toolzer`, dated updates) until inspected  
- Pure UI cosmetics (ruler/drawing) unless needed for UX research  
- Duplicate SMA/EMA folklore except as crowd-feature baselines  

## Deliverables Market Engineer should produce from this library

1. Organ ←→ module coverage notes (extend `TERMINAL_TO_GENESIS_MAP.md`)  
2. Crowd-exposure tags for indicator families used by terminal users  
3. Research hypotheses only — never production thresholds  
4. Explicit “insufficient evidence / no-trade analysis” conditions in family language  

## Fence reminder

```text
Terminal readiness cube ≠ Candidate permission
Indicator signal ≠ Organ Agreement
PnL helper ≠ Admission proof
```
