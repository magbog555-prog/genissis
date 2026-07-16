# Backend Engineer Guide — TSLab Terminal Modules

**Audience:** Backend / Organ Runtime / Sensory / Research infra engineers  
**Source:** `architecture/books\терминал`  
**Related:** Organ passports · Sensory rollout · Research methodology

## Your job with this folder

Extract **engineering patterns** from TSLab modular cubes:

```text
state across recalc
lab/live environment guards
readiness predicates
cost models
clock / last-bar integrity
logging & stats sinks
exchange health probes
```

Do **not** import RAR contents into GENESIS services.  
Do **not** port vendor script code into Producer/runtime without separate Owner auth and Admission.

## Useful engineering analogies (ALLOW_RESEARCH)

| TSLab idea | GENESIS engineering read | Reuse class |
|---|---|---|
| `IsLabMode` | Strict env separation: fixture/lab vs live bindings | REUSE_CONCEPT |
| `IsReadyForTrade` / `CheckTradeSettings` | Integrity + freshness + settings gate before analysis ask-rights | REUSE_CONCEPT |
| `IsLastBar` | Event-horizon / closed-bar integrity (anti look-ahead) | REUSE_CONCEPT |
| `InterRecalcMemorizer` | Observer continuity / memoized state across recompute | REUSE_CONCEPT |
| `Commission` / ticket risk | Cost model fields in research backtests | REUSE_DATA_MODEL |
| `TradesLogger` / period stats | Research telemetry sinks | REUSE_CONCEPT |
| OKX ping checker | Connectivity health sensor pattern | REUSE_CONCEPT |
| Metronomes | Synthetic tempo sources for tests only | ADAPT_WITH_REVIEW |

## How to use in backend workstreams

### A) Sensory / organ design

When designing Volatility / Liquidity / Tempo / Spread:

1. Check modules tagged to that organ in `catalog/terminal_modules.json`.  
2. Translate to Frame slot requirements (not indicator ports).  
3. Document shared-source risks (especially Tempo).  

### B) Research platform pipeline

Map modules into methodology stages only as priors:

```text
Concept Registry → Hypothesis → Prototype → Shadow → Impact → Admission
```

Example prototype topics (offline only):

- closed-bar integrity checker inspired by IsLastBar  
- commission-aware PnL simulator inputs  
- exchange ping SLOs as non-trading health signals  

### C) What Backend must never do from this dump

- Unpack vendor bundles into `services/` without quarantine  
- Treat readiness cubes as Scenario/Candidate gates  
- Hardcode indicator formulas from retail archives as organ truth  
- Mix lab scripts with live market bindings  

## Suggested implementation checklist (research prototypes)

```text
[ ] Define ownership organ / non-goal
[ ] Declare required Frame slots
[ ] Declare integrity freshness policy
[ ] Add look-ahead / leakage notes
[ ] Add cost assumptions if PnL involved
[ ] Keep production_influence=false
[ ] Validate against GENESIS fixtures before any live shadow
```

## Integration map files

- Organ links narrative: `TERMINAL_TO_GENESIS_MAP.md`  
- Machine index: `catalog/terminal_modules.json`  
- Knowledge organs: `../knowledge_base/03_organs/`  
- Methodology: `../../research_platform/GENESIS_RESEARCH_METHODOLOGY_v1.md`

## Hard fence

```text
TSLab archive
≠ backend module
≠ organ passport change
≠ RFC-0005
≠ production influence
```
