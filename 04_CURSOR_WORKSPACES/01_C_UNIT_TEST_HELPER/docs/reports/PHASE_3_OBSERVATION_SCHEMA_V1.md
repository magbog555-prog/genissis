# PHASE 3 — MarketObservation Schema V1 (Offline / Slice 2)

| Field | Value |
|-------|--------|
| **Phase** | 3 — Governed Observation Layer |
| **Slice** | 2 — **1–2 instruments**, offline only |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Owner GO** | `27_OWNER_MULTI_GO_SESSION_RECORD_RU.md` (D-P3-EXEC) |
| **Contract alignment** | `GENESIS_CONTRACT_MAP_INITIAL` — MarketObservation (DRAFT) |
| **Status** | **DESIGN** — not ACCEPTED, not Notary GREEN |

---

## 0. Purpose

Define **MarketObservation** as a machine-readable **market fact envelope** for Phase 3 Slice 2: normalized observations from **offline fixtures** only (no live venue, no keys, no private endpoints).

**Layer law:** market data ≠ perception ≠ scenario ≠ admission ≠ execution.

---

## 1. Slice 2 scope

| In scope | Out of scope |
|----------|--------------|
| **2 instruments** (default pair: `BTCUSDT`, `ETHUSDT`) | Live WebSocket / REST to exchange |
| Event types: `OHLC_1M`, `TRADE_TICK` (optional one book snapshot later) | Order book full depth stream |
| `sourceKind: OFFLINE_FIXTURE` | `sourceKind: LIVE_VENUE` |
| Provenance + freshness on every record | Perception / Scenario / Admission fields |
| Quality flags (gap, stale, conflict) | Execution, Trade Card, signed orders |

---

## 2. Observation classes (Genesis doctrine)

| Class | `observationClass` | May appear in Slice 2 fixture? |
|-------|-------------------|-------------------------------|
| Verifiable fact | `FACT` | **Yes** (default) |
| Derived signal | `SIGNAL` | No (Slice 3+) |
| Opinion | `OPINION` | **No** |
| Forecast | `FORECAST` | **No** |
| Noise / quarantine | `NOISE` | Yes (negative tests) |

**Rule:** UI and downstream layers **must not** promote `FACT` → permission.

---

## 3. JSON Schema (documentary v1)

File naming: `market-observation.v1.schema.json` (future Agent 04). Fields below are normative for Slice 2.

### 3.1 Root object — `MarketObservation`

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `schema` | string | yes | `genesis.market-observation.v1` |
| `observationId` | string | yes | UUID or deterministic id |
| `instrument` | object | yes | §3.2 |
| `eventType` | enum | yes | `OHLC_1M`, `TRADE_TICK`, `BOOK_SNAPSHOT_L1` |
| `observationClass` | enum | yes | `FACT`, `NOISE` (Slice 2) |
| `timestamps` | object | yes | §3.3 |
| `provenance` | object | yes | §3.4 |
| `freshness` | object | yes | §3.5 |
| `quality` | object | yes | §3.6 |
| `payload` | object | yes | §3.7 |
| `evidenceRefs` | string[] | no | Links to fixture path / EM rows |

### 3.2 `instrument`

| Field | Type | Example |
|-------|------|---------|
| `symbol` | string | `BTCUSDT` |
| `venue` | string | `SYNTHETIC_OFFLINE` (Slice 2) |
| `marketType` | enum | `SPOT` |
| `quoteAsset` | string | `USDT` |
| `baseAsset` | string | `BTC` |

### 3.3 `timestamps`

| Field | Type | Meaning |
|-------|------|---------|
| `sourceEventTime` | ISO-8601 | When venue claims event occurred (fixture: synthetic) |
| `observedAt` | ISO-8601 | When Genesis accepted observation into observation store |
| `ingestedAt` | ISO-8601 | When offline ingest job wrote record (Slice 2: equals `observedAt`) |

### 3.4 `provenance` (required on every fact)

| Field | Type | Slice 2 value |
|-------|------|---------------|
| `sourceId` | string | `fixture:phase3/offline/{symbol}/{file}` |
| `sourceKind` | enum | `OFFLINE_FIXTURE` |
| `ingestMode` | enum | `REPLAY_FILE` |
| `lineageHash` | string | `sha256:` + hash of canonical JSON payload |
| `fixtureVersion` | string | `slice2-v1` |
| `derivation` | string | `NONE` (no transforms beyond normalize) |

**Forbidden in provenance:** `apiKey`, `privateEndpoint`, `signedOrder`, `walletId`.

### 3.5 `freshness`

| Field | Type | Description |
|-------|------|-------------|
| `maxAgeMs` | number | Policy threshold (e.g. 120000 for 1m OHLC offline demo) |
| `computedAgeMs` | number | `observedAt - sourceEventTime` |
| `status` | enum | `FRESH`, `STALE`, `UNKNOWN` |
| `clockSkewMs` | number | 0 for offline; reserved for live |

### 3.6 `quality`

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `OK`, `YELLOW`, `RED` |
| `completeness` | number | 0–1 (1.0 for complete fixture row) |
| `gapDetected` | boolean | Missing bars in sequence |
| `conflictDetected` | boolean | Two sources disagree (Slice 2: always false) |
| `reasonCodes` | string[] | e.g. `RC-DATA-STALE`, `RC-DATA-GAP` |

### 3.7 `payload` (by eventType)

**OHLC_1M:**

```json
{
  "open": "string decimal",
  "high": "string decimal",
  "low": "string decimal",
  "close": "string decimal",
  "volume": "string decimal",
  "barInterval": "1m",
  "barIndex": 0
}
```

**TRADE_TICK:**

```json
{
  "price": "string decimal",
  "quantity": "string decimal",
  "side": "BUY | SELL | UNKNOWN",
  "tradeId": "string"
}
```

---

## 4. Forbidden fields (SAFE / MarketObservation)

Per Boundary Language — **must be absent**:

```text
admissionState, scenarioDecision, orderPayload, executionIntentId,
exchangeEndpoint, signedPayload, rawOrderPayload, canExecute,
liveExchangeConnected: true (Slice 2 offline must be false or omitted)
```

---

## 5. Fixture plan (Slice 2)

| File | Instrument | Rows | Purpose |
|------|------------|------|---------|
| `tests/fixtures/phase3/market-observation/BTCUSDT-offline-sample.json` | BTCUSDT | 3 observations | Golden sample |
| `tests/fixtures/phase3/market-observation/ETHUSDT-offline-sample.json` | ETHUSDT | 3 observations | Second instrument |
| `tests/fixtures/phase3/market-observation/slice2-manifest.json` | — | index | CI / proof runner input |

Negative fixtures (future): `NOISE` class, missing `provenance`, `STALE` freshness.

---

## 6. ID conventions

```text
observationId = obs-{symbol}-{eventType}-{barIndex|tradeId}-{sourceEventTime compact}
lineageHash   = sha256(canonicalStringify({ instrument, eventType, timestamps.sourceEventTime, payload }))
```

---

## 7. Limitations (honest)

- Schema is **Foundation design** — Agent 04 owns machine JSON Schema / ReasonCode binding.
- Slice 2 does **not** prove venue truth — only **shape + governance** of observations.
- **Notary GREEN not claimed.**

---

*See `PHASE_3_DATA_QUALITY_GATES_V1.md`, `PHASE_3_OFFLINE_PROOF_PLAN_V1.md`, `PHASE_3_OBSERVATION_DESIGN_REPORT.md`.*
