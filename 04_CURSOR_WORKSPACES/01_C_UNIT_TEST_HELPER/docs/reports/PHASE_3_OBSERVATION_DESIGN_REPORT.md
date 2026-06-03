# PHASE 3 — Observation Design Report (Slice 2 Offline)

| Field | Value |
|-------|--------|
| **Task** | Agent 01 — Phase 3 Market Observation design (offline only) |
| **Date** | 2026-06-01 |
| **Owner GO** | D-P3-EXEC (`27_OWNER_MULTI_GO_SESSION_RECORD_RU.md`) |
| **Status** | **DESIGN COMPLETE** — no live ingestion |

---

## 1. Deliverables on disk

| # | Artifact | Path |
|---|----------|------|
| 1 | Observation schema | `docs/reports/PHASE_3_OBSERVATION_SCHEMA_V1.md` |
| 2 | Quality gates | `docs/reports/PHASE_3_DATA_QUALITY_GATES_V1.md` |
| 3 | Offline proof plan | `docs/reports/PHASE_3_OFFLINE_PROOF_PLAN_V1.md` |
| 4 | This report | `docs/reports/PHASE_3_OBSERVATION_DESIGN_REPORT.md` |
| 5 | Fixtures manifest | `tests/fixtures/phase3/market-observation/slice2-manifest.json` |
| 6 | BTCUSDT sample | `tests/fixtures/phase3/market-observation/BTCUSDT-offline-sample.json` |
| 7 | ETHUSDT sample | `tests/fixtures/phase3/market-observation/ETHUSDT-offline-sample.json` |

---

## 2. Slice 2 summary

- **Instruments:** `BTCUSDT`, `ETHUSDT` (offline synthetic venue `SYNTHETIC_OFFLINE`)
- **Events per instrument:** 2× `OHLC_1M` + 1× `TRADE_TICK`
- **Every observation includes:** `provenance`, `freshness`, `quality`, forbidden-field-free payload
- **No:** API keys, live endpoints, execution fields, Notary GREEN

---

## 3. Screen 4 — Market Truth (operator UI)

Program numbering: **Screen 4 = Market Observation / Market Truth** (`genesis-system-status-board.json` → `visibleWhere: screen_map#4`).  
*(Note: `GENESIS_5_YEAR_VISION` lists Market Truth as screen 2 in 6-screen cockpit — program board uses screen 4 for this layer.)*

### 3.1 Layout zones (future Operator shell)

| Zone | nVision slot | Data source (Slice 2) |
|------|--------------|------------------------|
| **Banner** | OBS-SLOT-06 | Fixed text: «Наблюдение ≠ разрешение» / Observation ≠ permission |
| **Ingest strip** | OBS-SLOT-01 | `OFFLINE_FIXTURE` · `REPLAY_FILE` · 2 instruments · no live |
| **Instrument table** | OBS-SLOT-02 | Rows: BTCUSDT, ETHUSDT · class `FACT` |
| **Freshness column** | OBS-SLOT-03 | `freshness.status` + `computedAgeMs` / `maxAgeMs` |
| **Provenance column** | OBS-SLOT-04 | `provenance.sourceId`, `lineageHash` (truncated), fixture link |
| **Quality flags** | OBS-SLOT-05 | `quality.status` badges OK/YELLOW/RED — Slice 2 samples: **OK** |

### 3.2 Example row (BTCUSDT, as operator would read)

```text
BTCUSDT | OHLC 1m | FRESH (5s) | OK | fixture:phase3/offline/BTCUSDT… | FACT
```

**Must not show:** «Connected to Binance», green «ready to trade», ALLOW/admission.

### 3.3 Read-model shape (future GET)

```json
{
  "screen": "market_truth",
  "slice": 2,
  "ingestHealth": { "mode": "OFFLINE_FIXTURE", "live": false },
  "instruments": [
    { "symbol": "BTCUSDT", "latestFreshness": "FRESH", "quality": "OK" },
    { "symbol": "ETHUSDT", "latestFreshness": "FRESH", "quality": "OK" }
  ],
  "observationCount": 6,
  "disclaimer": "OBSERVATION_NOT_PERMISSION"
}
```

---

## 4. Genesis System Status Board

### 4.1 Current (before Agent 00 sync)

| Layer | Status |
|-------|--------|
| Market Observation | `BLOCKED` · proof null |

### 4.2 Recommended row after this design (Owner / Agent 00 sync only)

| Field | Proposed value |
|-------|----------------|
| **layer** | `market_observation` |
| **status** | `DESIGN_DRAFT` (not GREEN, not LIVE) |
| **lastChange** | `phase3_slice2_offline_design` |
| **visibleWhere** | `screen_map#4`, `01_C_UNIT_TEST_HELPER/tests/fixtures/phase3/` |
| **proof** | `PHASE_3_OBSERVATION_SCHEMA_V1.md` + 2 fixture files + slice2-manifest |
| **nextBlocker** | fixture validator CI; live ingest GO; Agent 04 schema machine |
| **notaryStatus** | null or YELLOW (unchanged program) |

**Markdown board line (example):**

```text
| Market Observation | DESIGN_DRAFT | Slice 2 offline fixtures | Screen 4 | schema + fixtures on disk | live GO; validator | Owner | — | — |
```

---

## 5. Cross-agent handoff

| Agent | Consumes |
|-------|----------|
| **04 Contracts** | Promote to `schemas/draft/market-observation.v1.json` |
| **03 Evidence** | EM-P3-OBS-001/002 rows from fixtures |
| **02 Notary** | Read-only — no GREEN from observation connect |
| **05 nVision** | Fill OBS-SLOT-01…06 on Screen 4 mock |
| **00 Orchestrator** | Sync status board + system state V18 |

---

## 6. Boundaries

```text
LIVE EXCHANGE:     NO
API KEYS:          NO
EXECUTION:         NO
NOTARY GREEN:      NOT CLAIMED
MBG SOURCE EDITS:  NO
SPRINT 1 REPORTS:  UNCHANGED
```

---

## 7. Next steps (Agent 01 / program)

1. Implement `validate-phase3-fixtures.mjs` (proof plan P4)  
2. Owner GO for live read-only venue (charter D-P3-04) — **separate** decision  
3. Agent 04 machine schema enforcement  

---

```text
ROLE: Genesis Foundation Lead Engineer
TASK STATUS: COMPLETE (design + fixtures offline)
SLICE 2: BTCUSDT + ETHUSDT fixtures on disk
NOTARY GREEN CLAIMED: NO
```

---

*End of PHASE_3_OBSERVATION_DESIGN_REPORT.md*
