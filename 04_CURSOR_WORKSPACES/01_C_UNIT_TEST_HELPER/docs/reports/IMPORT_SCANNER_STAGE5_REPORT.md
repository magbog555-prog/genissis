# IMPORT_SCANNER_STAGE5_REPORT.md

## Stage 5 — Import Scanner (imports only)

| Field | Value |
|-------|--------|
| **Stage** | 5 — Import Scanner |
| **Date** | 2026-05-31 |
| **Scope config** | `foundation-scope.config.json` v1.0 |
| **Source target** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **Scan root** | `core/**` (120 TypeScript/JavaScript files) |
| **MBG modified** | No |
| **Route scanner** | Not re-run |
| **Env scanner** | Not run (Stage 6) |

---

## 1. Deliverables

| Artifact | Path |
|----------|------|
| Import scanner | `tools/verification/scan-imports.mjs` |
| Machine report | `reports/import-boundary-report.json` |
| Negative fixture | `tests/negative/unsafe-import.fixture.json` |

**Run command:**

```bash
node tools/verification/scan-imports.mjs
```

**Gate:** exit `0` when `redInSafeCount === 0`. Current run: **PASS**.

---

## 2. Executive verdict

```text
RED in SAFE:              0   ← foundation gate PASS
Direct SAFE → UNSAFE:     0   ← no binance/exchange/execution imports in SAFE
YELLOW in SAFE:          19   ← DONOR/UNKNOWN coupling (review required)
UNSAFE FINDING:           5   ← expected lab imports
```

**Answer to Stage 5 question:** SAFE operator contour **does not import** `runtime-api`, `application/exchange`, `application/market`, or `engine/execution` directly. **Import boundary to UNSAFE is clean at RED level.**

**However:** SAFE **does import DONOR modules** (`runtime-engine`, `live-stream`, `mock-scenarios`). This is the **architectural coupling** flagged after Stage 4 — now **proven in imports**, not RED, but **YELLOW** until isolated or reclassified.

---

## 3. Summary (machine)

| Metric | Value |
|--------|-------|
| Files scanned | 120 |
| Import edges | 311 |
| GREEN (SAFE → SAFE/EXTERNAL) | 41 |
| YELLOW (SAFE coupling) | 19 |
| RED in SAFE | **0** |
| FINDING (UNSAFE) | 5 |
| DONOR_FINDING | 6 |
| OK | 240 |

---

## 4. What SAFE does NOT import (critical pass)

No importer with `importerScope: SAFE` has:

| Forbidden target | Found in SAFE? |
|------------------|----------------|
| `application/exchange` (binance-spot-testnet) | **No** |
| `application/market` (binance-live-market) | **No** |
| `engine/execution` (execution.service) | **No** |
| `apps/runtime-api` | **No** |
| Specifier containing `binance`, `testnet`, `execution.service` | **No** |

`safeDirectUnsafeOrForbidden` array in report: **empty**.

---

## 5. YELLOW — SAFE imports DONOR (coupling map)

These are **not RED** (DONOR ≠ UNSAFE) but block a “pure” safe artifact until reviewed:

### 5.1 Operator readonly path (RC4-D surface)

| Importer | Imports | Target scope |
|----------|---------|--------------|
| `apps/readonly-api/src/server.ts` | `live-market-stream.js` | DONOR |
| `ui-api/connected-readonly-core-api.ts` | `runtime-engine.js` | DONOR |
| `ui-api/connected-readonly-core-api.ts` | `live-market-stream.js` | DONOR |
| `ui-api/connected-readonly-core-api.ts` | `mock-scenarios.js` | DONOR |

**Meaning:** Readonly API is route-clean (Stage 4) but **shares runtime engine and market stream** with lab stack.

### 5.2 Trust kernel → shared runtime (internal coupling)

| Importer (SAFE) | Imports DONOR |
|-----------------|---------------|
| `kernel/core-trust-report.ts` | `runtime-engine`, `freshness` |
| `kernel/kernel-authority.ts` | `runtime-engine`, `freshness` |
| `integrity/integrity-report.ts` | `runtime-engine` |
| `gates/action-gate.ts` | `freshness` |
| `recovery/recovery-planner.ts` | `runtime-engine`, `freshness` |
| `quarantine/quarantine.ts` | `idempotency` |

**Meaning:** Declared SAFE kernel **depends on DONOR `core/runtime/**`** — honest for current MBG design, but Genesis safe artifact must eventually **split or gate** this dependency.

### 5.3 Scope config gap — `core/state/**`

Several SAFE files import `core/core/state/src/types.js` → classified **UNKNOWN** (not listed in scope config):

- `kernel/*`, `integrity/*`, `gates/*`, `recovery/*`

**Recommendation for scope review:** add `core/core/state/**` to **SAFE** or **DONOR** in next config revision (likely **SAFE** — pure types).

---

## 6. Transitive check (SAFE → DONOR → ?)

Scanner performs **1-hop transitive** scan from SAFE into DONOR modules.

**Result:** No `TRANSITIVE_SAFE_NO_UNSAFE_IMPORT` (RED) edges found.

DONOR `runtime-engine` does not statically import `application/exchange` or `engine/execution` at import-statement level.

**Limitation:** Does not prove runtime behavior; only static import graph.

---

## 7. UNSAFE zone (expected FINDING)

**5 FINDING** edges — all `importerScope: UNSAFE` importing exchange/execution-related modules, e.g.:

- `runtime-api/src/app.ts` → `binance-spot-testnet`, `binance-live-market`
- `engine/execution/execution.service.ts` → `binance-spot-testnet`

Per constitution: **FINDING**, not foundation failure.

---

## 8. Comparison with Stage 4

| Layer | Stage 4 (routes) | Stage 5 (imports) |
|-------|------------------|-------------------|
| Readonly operator surface | GET only, 0 RED | 0 RED; imports DONOR runtime/live-stream |
| Lab runtime-api | POST FINDING | Imports binance adapters FINDING |
| Architectural gap | “import not proven” | **Proven:** SAFE ↔ DONOR coupling, not SAFE ↔ UNSAFE |

---

## 9. Critical rules applied

| Rule | Result |
|------|--------|
| SAFE_NO_UNSAFE_IMPORT | **PASS** (0 RED) |
| SAFE must not import exchange/execution/binance | **PASS** |
| SAFE_IMPORTS_DONOR_COUPLING | **19 YELLOW** (documented) |
| UNKNOWN never GREEN | Enforced in report semantics |
| Transitive UNSAFE into SAFE | **None detected** (1-hop) |

---

## 10. Limitations

1. Static `import` / `require` only — no dynamic `import()`.
2. npm packages (express, zod, ws) classified EXTERNAL → GREEN from SAFE unless forbidden token match.
3. Transitive depth = 1 hop from SAFE through DONOR only.
4. `core/core/state/**` missing from scope config → false UNKNOWN yellows until config amended.

---

## 11. Gate for Stage 6

| Criterion | Status |
|-----------|--------|
| `import-boundary-report.json` generated | YES |
| `redInSafeCount === 0` | YES |
| No SAFE → UNSAFE direct imports | YES |
| MBG unchanged | YES |
| Env scanner not run | YES |

**Recommended owner action:** Review YELLOW coupling list; consider adding `core/core/state/**` to scope config.

**Then:** GO Stage 6 — Env Scanner only.

---

*End of IMPORT_SCANNER_STAGE5_REPORT.md*
