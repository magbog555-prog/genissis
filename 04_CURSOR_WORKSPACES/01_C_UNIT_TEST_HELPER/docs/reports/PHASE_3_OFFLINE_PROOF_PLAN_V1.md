# PHASE 3 — Offline Proof Plan V1 (Slice 2)

| Field | Value |
|-------|--------|
| **Phase** | 3 — Slice 2 (1–2 instruments) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Proof type** | **Offline / replay-file only** |

---

## 0. Purpose

Prove Genesis can **accept, validate, and surface** MarketObservation records **without** live exchange, keys, or execution paths.

---

## 1. Proof ladder (Slice 2)

| Step | Proof | Artifact | Owner |
|------|-------|----------|-------|
| P1 | Schema documented | `PHASE_3_OBSERVATION_SCHEMA_V1.md` | Agent 01 ✓ |
| P2 | Quality gates documented | `PHASE_3_DATA_QUALITY_GATES_V1.md` | Agent 01 ✓ |
| P3 | Golden fixtures on disk | `tests/fixtures/phase3/market-observation/*.json` | Agent 01 ✓ |
| P4 | Fixture validator script | `tools/verification/validate-phase3-fixtures.mjs` | Agent 01 ✓ |
| P5 | Evidence row seed | Agent 03 matrix EM-P3-* (future) | Agent 03 |
| P6 | UI read-model sample | Operator shell mock / GET stub (future) | UI track |
| P7 | Live ingest | **BLOCKED** until Owner GO + charter | — |

---

## 2. Fixture inventory

```text
tests/fixtures/phase3/market-observation/
  slice2-manifest.json
  BTCUSDT-offline-sample.json
  ETHUSDT-offline-sample.json
```

**Source:** synthetic offline data — not copied from live API in this task.

---

## 3. Validator behavior (P4 — next implementation)

```bash
node tools/verification/validate-phase3-fixtures.mjs
```

Checks per file:

1. JSON parse  
2. QG-P3-01 … QG-P3-08  
3. Write `reports/phase3-fixture-validation.json`  
4. Exit 0 iff all PASS  

**Does not:** network, `npm install` in MBG, modify source target.

---

## 4. Negative proof cases (Slice 2b)

| Case | File | Expected |
|------|------|----------|
| Missing provenance | `negative-missing-provenance.json` | FAIL QG-P3-02 (planned) |
| Forbidden `admissionState` | `negative-admission-on-market.json` | FAIL QG-P3-05 ✓ |
| STALE freshness | `negative-stale-observation.json` | FAIL QG-P3-04 (planned) |

---

## 5. Separation from safe artifact

| Artifact | Contains market ingest? |
|----------|-------------------------|
| `genesis-safe-readonly` | **No** — Phase 3 observation is **separate deploy unit** (future) |
| Phase 3 fixtures | Foundation workspace only |

Bundle scan of safe artifact **must remain** execution-free after Phase 3 work.

---

## 6. Exit criteria (Slice 2 offline)

- [x] Schema + gates + fixtures on disk  
- [x] Validator script PASS  
- [ ] Evidence row(s) OPEN/PARTIAL (Agent 03)  
- [ ] Screen 4 binds to fixture read-model (UI track)  
- [ ] Owner record: no live GO  

---

## 7. Verdict

```text
OFFLINE PROOF PLAN:  DOCUMENTED
LIVE INGESTION:      FORBIDDEN (this slice)
NOTARY GREEN:        NOT CLAIMED
```

---

*End of PHASE_3_OFFLINE_PROOF_PLAN_V1.md*
