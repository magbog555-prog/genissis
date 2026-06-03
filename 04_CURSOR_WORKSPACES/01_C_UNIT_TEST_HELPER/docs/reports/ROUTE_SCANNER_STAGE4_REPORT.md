# ROUTE_SCANNER_STAGE4_REPORT.md

## Stage 4 — Route Scanner (routes only)

| Field | Value |
|-------|--------|
| **Stage** | 4 — Route Scanner |
| **Date** | 2026-05-31 |
| **Scope config** | `tools/verification/foundation-scope.config.json` v1.0 (APPROVED) |
| **Source target** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **MBG modified** | No |
| **Import scanner** | Not run (Stage 5) |
| **Env scanner** | Not run (Stage 6) |

---

## 1. Deliverables

| Artifact | Path |
|----------|------|
| Route scanner | `tools/verification/scan-routes.mjs` |
| Scope helper | `tools/verification/scope-match.mjs` |
| Machine report | `reports/route-inventory.json` |
| Negative fixture | `tests/negative/route-post-order.fixture.json` |

**Run command:**

```bash
node tools/verification/scan-routes.mjs
```

Exit code **0** when no RED in SAFE. Current run: **PASS** (`redInSafeCount: 0`).

---

## 2. Scan coverage

| Surface scanned | File(s) | Scope |
|-----------------|---------|-------|
| Readonly operator API | `core/core/ui-api/connected-readonly-core-api.ts` | SAFE |
| Readonly server entry | `core/apps/readonly-api/src/server.ts` | SAFE (no routes registered here) |
| Lab runtime API | `core/apps/runtime-api/src/app.ts` | UNSAFE |

**Not scanned in Stage 4:** `frontend/**` fetch calls, `*.patch`, dynamic middleware, import graph.

---

## 3. Summary (machine)

```text
totalRoutes:        123
SAFE routes:         26  (all GET — scanStatus GREEN)
UNSAFE routes:       97
RED in SAFE:          0  ← foundation gate PASS
FINDING (UNSAFE):    17  (expected execution-surface routes)
DONOR routes:         0  (no route registrations in donor roots)
UNKNOWN routes:       0  (apps/ui-api fully classified)
```

---

## 4. SAFE surface result (readonly-api)

**Verdict: PASS — no mutating routes in SAFE.**

All 26 SAFE registrations are **GET only**, including:

- `/health`, `/`
- `/api/core/status`, `/api/core/overview`
- `/api/core/runtime/snapshot`, `/api/core/self-truth/audit`
- `/api/core/live-stream/status|health|last-event`
- Loop-registered `CONNECTED_READONLY_CORE_ENDPOINTS` (`/core/status`, `/core/trust/report`, …)

**RC1_POST_SURFACE = "closed"** — consistent with scan (no `router.post` in connected-readonly file).

This supports RC4-D claim: operator readonly surface has **no POST handlers** in SAFE code.

---

## 5. UNSAFE findings (expected, not foundation failure)

**17 routes** tagged `FINDING` / `UNSAFE_EXECUTION_ROUTE` in `runtime-api` — documented lab capability:

| Method | Path | Line (app.ts) |
|--------|------|---------------|
| POST | `/trade/place` | 1653 |
| POST | `/trade/cancel` | 1710 |
| POST | `/order` | 4866 |
| POST | `/execution/testnet/place-guarded` | 2458 |
| POST | `/execution/testnet/cancel-guarded` | 2549 |
| POST | `/execution/testnet/reconcile-order` | 2612 |
| POST | `/reconcile/order` | 1759 |
| POST | `/reconcile/position` | 1792 |
| POST | `/actions/dispatch` | 1443 |
| POST | `/market/tick` | 1425 |
| POST | `/signals` | 1431 |
| POST | `/execution/reconcile/auto` | 2417 |
| POST | `/debug/force/order-uncertain` | 1449 |
| … | (+ testnet/chaos routes) | … |

Per scope constitution: **UNSAFE violation = FINDING**, not RED. Sprint 1 does not fail because lab runtime exposes execution.

---

## 6. Architectural confirmation

```text
┌─────────────────────────────────────────────────────────────┐
│  SAFE (readonly-api)     │  GET only · 0 RED              │
├──────────────────────────┼──────────────────────────────────┤
│  UNSAFE (runtime-api)    │  POST trade/order/execution      │
│                          │  17 FINDING · 80 OK (lab/debug)  │
└─────────────────────────────────────────────────────────────┘
```

**Key proof for Genesis Foundation:** Safe operator artifact (connected-readonly) is **technically separated** from mutating routes at the **registration** level in scanned files. Coupling risk (shared runtime-engine) remains for **Stage 5 Import Scanner**.

---

## 7. Critical rules applied

| Rule | Stage 4 result |
|------|----------------|
| SAFE_NO_ORDER_ROUTE | **0 violations** in SAFE |
| SAFE mutating HTTP | **0** POST/PUT/PATCH/DELETE in SAFE |
| UNSAFE execution routes | **17 FINDING** (logged) |
| UNKNOWN never GREEN | N/A (no UNKNOWN routes in scan set) |

---

## 8. Limitations (explicit)

1. Regex-based static extraction — may miss programmatic `app[method](path)` patterns.
2. Route prefix mounting (`app.use('/api', router)`) — paths recorded as declared in source string.
3. No runtime server started — no live HTTP probe (unlike `verify-readonly-surface.mjs` in MBG).
4. Patch files excluded.

---

## 9. Gate for Stage 5

| Criterion | Status |
|-----------|--------|
| `route-inventory.json` generated | YES |
| `scan-routes.mjs` in Foundation workspace | YES |
| RED in SAFE = 0 | YES |
| MBG unchanged | YES |
| Import/env scanners not run | YES (per pipeline) |

**Recommended owner action:** Review this report + `reports/route-inventory.json`.  
**Then:** GO Stage 5 — Import Scanner only.

---

## 10. Version

| Version | Date | Note |
|---------|------|------|
| 1.0 | 2026-05-31 | Initial route scan |

---

*End of ROUTE_SCANNER_STAGE4_REPORT.md*
