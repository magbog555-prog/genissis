# D-03 MBG Entrypoint Rename Report

| Field | Value |
|-------|--------|
| **Deliverable** | P0.4 / D-03 (Owner GO) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Owner GO** | `27_OWNER_MULTI_GO_SESSION_RECORD_RU.md` (D-03-FU) |
| **Target** | `02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2/core/package.json` |

---

## 1. Change summary

| Before | After |
|--------|-------|
| `"dev"` → `runtime-api` | **Removed** |
| — | `"dev:runtime-lab-unsafe"` → `tsx apps/runtime-api/src/server.ts` |
| `"dev:readonly-api"` → readonly-api | **Unchanged** (canonical safe entry) |

**Diff scope:** `scripts` section only — no dependency, lockfile, or source logic changes.

---

## 2. Rationale (D-03)

Ambiguous `npm run dev` caused operator/bootstrap risk (CR-05, CR-06): lab stack started without explicit UNSAFE intent. Rename makes lab path **named**; safe path remains `dev:readonly-api`.

---

## 3. Foundation workspace updates (not MBG)

| File | Change |
|------|--------|
| `tools/verification/entrypoint-check.mjs` | RED if bare `dev` exists; require `dev:runtime-lab-unsafe` + `dev:readonly-api` |
| `scripts/dev-runtime-lab-unsafe.ps1` | `npm run dev:runtime-lab-unsafe` |
| `docs/reports/ENTRYPOINT_POLICY_V1.md` | Post-rename state |

**Not modified:** Sprint 1 historical reports, machine JSON from Sprint 1 stages.

---

## 4. Verification

```text
node tools/verification/entrypoint-check.mjs
Result: PASS (exit 0, no RED findings)
```

---

## 5. Operator commands (post-rename)

| Intent | Command |
|--------|---------|
| Safe readonly | `cd core && npm run dev:readonly-api` or `scripts/dev-readonly-safe.ps1` |
| Lab UNSAFE | `cd core && npm run dev:runtime-lab-unsafe` or `scripts/dev-runtime-lab-unsafe.ps1` |

---

## 6. Boundaries

```text
NOTARY GREEN:         NOT CLAIMED
EXECUTION ENABLED:    NO (script rename only)
OTHER MBG FILES:      UNCHANGED
```

---

*End of D03_ENTRYPOINT_RENAME_REPORT.md*
