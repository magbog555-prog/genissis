# DONOR COUPLING REGISTER — Sprint 2

| Field | Value |
|-------|--------|
| **Deliverable** | D-01 (CONDITIONAL YES) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Source** | `import-boundary-report.json` (19 edges); bundle scan v2; Owner `18_OWNER_SIGNOFF_RECORD_RU.md` |

---

## 0. Owner decision

**D-01:** 19 SAFE→DONOR couplings **acknowledged**, **not ignored**, **addressed in Sprint 2** via register + tier policy + isolation track.

This register does **not** declare couplings safe — it classifies disposition.

---

## 1. Summary

| Disposition | Count | Meaning |
|-------------|------:|---------|
| **ACCEPTED_RISK_OPERATORS** | 19 | OPERATOR tier bundle may include; documented; bundle scan + CI |
| **STRICT_TIER_EXCLUDE** | 3 families | live-stream, runtime-engine, mock-scenarios — excluded in STRICT build |
| **SPRINT2_TRACK_SPLIT** | 0 executed | Physical split deferred (D-02 PENDING) |
| **SCANNER_FALSE_POSITIVE** | 2 | DTO string `binance` / `binance-like` — not module imports |

---

## 2. Primary couplings (from Foundation Stage 5 / nVision CR-01)

| # | SAFE importer | DONOR dependency | Disposition | Sprint 2 action |
|---|---------------|------------------|-------------|---------------|
| 1 | `readonly-api/server.ts` | `live-market-stream` | ACCEPTED_RISK_OPERATORS | STRICT excludes live-stream; doc operator narrative (CR-04) |
| 2 | `connected-readonly-core-api.ts` | `runtime-engine` | ACCEPTED_RISK_OPERATORS | STRICT excludes `core/runtime/**`; track split (D-02) |
| 3 | `connected-readonly-core-api.ts` | `live-market-stream` | ACCEPTED_RISK_OPERATORS | STRICT exclude |
| 4 | `connected-readonly-core-api.ts` | `mock-scenarios` | ACCEPTED_RISK_OPERATORS | STRICT exclude; contract YB-07 |
| 5–19 | `kernel/*`, `integrity/*`, `gates/*`, `recovery/*` | `runtime-engine`, `freshness`, `idempotency` | ACCEPTED_RISK_OPERATORS | In closure build; STRICT excludes runtime |

*Full edge list: `reports/import-boundary-report.json` → `yellowInSafeCoupling`.*

---

## 3. Bundle scan RED items (v1 → v2)

| File | v1 finding | Root cause | v2 disposition |
|------|------------|------------|----------------|
| `normalize-runtime-snapshot.ts` | FORBIDDEN_IMPORT `binance` | String compare `providerFormat === "binance"` | **SCANNER_FALSE_POSITIVE** — scan v2 uses import-path detection |
| `computation-trace-dto.ts` | FORBIDDEN_IMPORT `binance` | Zod default `"binance-like"` | **SCANNER_FALSE_POSITIVE** — DTO_STRING_LITERAL WARN |

**Not** exchange adapter imports. **No** MBG source edit required for disposition.

---

## 4. Tier policy linkage

| Tier | Couplings in bundle | Scan expectation |
|------|---------------------|------------------|
| **OPERATOR** | Documented 19 + closure deps | `redCount === 0` after scan v2 |
| **STRICT** | No live-stream / runtime-engine paths staged | Smaller closure; audit ideal |

See `GENESIS_SAFE_ARTIFACT_DEFINITION_V1.md` §6.

---

## 5. Open items (not closed in Sprint 2)

| ID | Item | Owner |
|----|------|-------|
| D-02 | runtime-engine junction — document vs split | PENDING |
| D-04 | `core/core/state/**` scope v1.1 | PENDING |
| — | Physical package split (R12 nVision) | Sprint 2–3 architecture |

---

## 6. Verdict

```text
D-01 REGISTER:         COMPLETE (dispositions recorded)
19 COUPLINGS IGNORED:  NO
2 RED (substring):     RESOLVED via scan v2 + register
NOTARY GREEN:          NOT CLAIMED
```

---

*Does not modify import-boundary-report.json or MBG source.*
