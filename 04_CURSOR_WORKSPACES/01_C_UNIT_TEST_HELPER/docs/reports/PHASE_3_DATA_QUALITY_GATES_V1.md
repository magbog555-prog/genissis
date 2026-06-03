# PHASE 3 — Data Quality Gates V1 (Offline)

| Field | Value |
|-------|--------|
| **Phase** | 3 — Slice 2 |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Mode** | Executable against **offline fixtures only** |

---

## 0. Purpose

Quality gates decide whether a **MarketObservation** may be stored, displayed on **Screen 4 (Market Truth)**, or cited in Evidence — **without** granting trading permission.

---

## 1. Gate summary

| Gate ID | Name | FAIL severity | Slice 2 |
|---------|------|---------------|---------|
| QG-P3-01 | Schema shape | RED | yes |
| QG-P3-02 | Provenance complete | RED | yes |
| QG-P3-03 | Freshness computable | RED | yes |
| QG-P3-04 | Freshness within threshold | YELLOW→STALE | yes |
| QG-P3-05 | Forbidden fields absent | RED | yes |
| QG-P3-06 | Instrument whitelist | RED | yes |
| QG-P3-07 | observationClass allowed | RED | yes |
| QG-P3-08 | No live venue markers | RED | yes |
| QG-P3-09 | Lineage hash match | YELLOW | optional Slice 2 |
| QG-P3-10 | Gap sequence (OHLC) | YELLOW | yes |

---

## 2. Gate definitions

### QG-P3-01 — Schema shape

- `schema === "genesis.market-observation.v1"`
- Required top-level keys present (see `PHASE_3_OBSERVATION_SCHEMA_V1.md` §3.1)

### QG-P3-02 — Provenance complete

Required: `sourceId`, `sourceKind`, `ingestMode`, `lineageHash`, `fixtureVersion`  
`sourceKind` must be `OFFLINE_FIXTURE` for Slice 2.

### QG-P3-03 — Freshness computable

`timestamps.sourceEventTime` and `timestamps.observedAt` parse as ISO-8601.  
`computedAgeMs` present and equals policy formula.

### QG-P3-04 — Freshness threshold

| `maxAgeMs` | `computedAgeMs` | `freshness.status` |
|------------|-----------------|-------------------|
| policy | ≤ maxAgeMs | `FRESH` |
| policy | > maxAgeMs | `STALE` |
| missing clock | — | `UNKNOWN` |

Slice 2 offline samples: `maxAgeMs: 120000`, samples use `FRESH`.

### QG-P3-05 — Forbidden fields absent

Reject if any forbidden field from Boundary Language appears anywhere in JSON (recursive key scan).

### QG-P3-06 — Instrument whitelist (Slice 2)

Allowed symbols: `BTCUSDT`, `ETHUSDT` only.  
`venue` must be `SYNTHETIC_OFFLINE`.

### QG-P3-07 — observationClass

Slice 2 allow: `FACT`, `NOISE` (negative tests only).  
Reject: `OPINION`, `FORECAST`, `SIGNAL`.

### QG-P3-08 — No live venue markers

Reject if:

- `provenance.sourceKind` ∈ `LIVE_VENUE`, `TESTNET_VENUE`
- `provenance.ingestMode` ∈ `LIVE_WS`, `LIVE_REST`
- `payload` contains `apiKey`, `listenKey`, private URL patterns

### QG-P3-09 — Lineage hash (optional)

Recompute `lineageHash` from canonical payload; mismatch → YELLOW `RC-DATA-LINEAGE-MISMATCH`.

### QG-P3-10 — OHLC gap sequence

For batch fixtures: `barIndex` must be contiguous or `quality.gapDetected: true` with reason code.

---

## 3. Aggregate quality status

| Condition | `quality.status` |
|-----------|------------------|
| Any RED gate | `RED` |
| Any YELLOW gate, no RED | `YELLOW` |
| All pass | `OK` |

**UNKNOWN never displayed as GREEN** on Screen 4.

---

## 4. Reason code mapping (draft)

| Gate | Suggested reason code |
|------|----------------------|
| QG-P3-04 STALE | `RC-DATA-STALE` |
| QG-P3-10 gap | `RC-DATA-GAP` |
| QG-P3-05 forbidden | `RC-MARKET-ADMISSION-STATE` / layer-specific |
| QG-P3-08 live marker | `RC-DATA-LIVE-FORBIDDEN-SLICE2` |

Agent 04 owns registry binding.

---

## 5. Future CI hook (not live)

```text
verify:phase3-offline-fixtures  →  validate all files in tests/fixtures/phase3/
```

Wired in `PHASE_3_OFFLINE_PROOF_PLAN_V1.md` — **not** in `verify:foundation` until Owner GO.

---

## 6. Verdict

```text
GATES DEFINED:     YES
EXECUTABLE OFFLINE: YES (fixture validator planned)
NOTARY GREEN:       NO
EXECUTION IMPLIED:  NO
```

---

*End of PHASE_3_DATA_QUALITY_GATES_V1.md*
