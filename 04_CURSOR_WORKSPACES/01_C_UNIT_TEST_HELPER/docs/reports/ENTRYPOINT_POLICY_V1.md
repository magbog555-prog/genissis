# ENTRYPOINT POLICY V1

| Field | Value |
|-------|--------|
| **Deliverable** | O-05 (Owner D-03) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Owner GO** | `18_OWNER_SIGNOFF_RECORD_RU.md` |
| **Status** | **ACTIVE** — MBG D-03 rename applied (2026-06-01) |

---

## 0. Purpose

Eliminate **ambiguous bootstrap** where operators or CI start the **lab stack** (`runtime-api`) while believing they run **readonly-safe** (`genesis-safe-readonly` / `readonly-api`).

Sprint 1 risk: **CR-05, CR-06** — `core/package.json` `"dev"` → `runtime-api`; safe path is `dev:readonly-api`.

---

## 1. Canonical names (Genesis program)

| Script name | Meaning | MBG command today | Foundation wrapper |
|-------------|---------|-------------------|-------------------|
| **`dev:readonly-safe`** | Operator / attestation path — **only** readonly-api | `npm run dev:readonly-api` (in `core/`) | `scripts/dev-readonly-safe.ps1` |
| **`dev:runtime-lab-unsafe`** | Lab / execution limbs — **explicit UNSAFE** | `npm run dev:runtime-lab-unsafe` (in `core/`) | `scripts/dev-runtime-lab-unsafe.ps1` |

**Forbidden for operator safe workflows:** bare `npm run dev` in `core/` (removed per D-03).

---

## 2. Current MBG state (post D-03)

Source: `02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2/core/package.json`

| Script | Target | Classification |
|--------|--------|----------------|
| `"dev:runtime-lab-unsafe"` | `tsx apps/runtime-api/src/server.ts` | **UNSAFE lab** (explicit name) |
| `"dev:readonly-api"` | `tsx apps/readonly-api/src/server.ts` | **SAFE operator entry** (canonical) |
| `"dev"` | — | **REMOVED** (was ambiguous UNSAFE default) |

See `docs/reports/D03_ENTRYPOINT_RENAME_REPORT.md`.

---

## 3. Operator rules

1. **Default for Genesis Sprint 2 safe work:** use `dev:readonly-safe` (wrapper or explicit `dev:readonly-api`).
2. **Never** use `npm run dev` in `core/` — script removed (D-03).
3. **Lab / execution testing** uses `npm run dev:runtime-lab-unsafe` or Foundation wrapper (types `LAB-UNSAFE` confirmation).
4. **CI / verify** must not start `runtime-api` unless task explicitly allows UNSAFE lab scope.
5. **Workspace root** scripts (if any) must alias readonly explicitly — no bare `dev:core` without documentation.

---

## 4. Foundation workspace enforcement

| Artifact | Role |
|----------|------|
| `scripts/dev-readonly-safe.ps1` | Safe entry wrapper |
| `scripts/dev-runtime-lab-unsafe.ps1` | Lab entry with confirmation gate |
| `tools/verification/entrypoint-check.mjs` | Policy + wrappers; RED if bare `dev` returns or lab/readonly scripts missing |
| `verify:foundation` | Includes `entrypoint:check` |

**Machine check:** `node tools/verification/entrypoint-check.mjs` — exit 0 if policy + wrappers + `dev:readonly-api` exist.

---

## 5. D-03 rename (applied)

Owner GO: `27_OWNER_MULTI_GO_SESSION_RECORD_RU.md` (D-03-FU).

```json
"dev:runtime-lab-unsafe": "tsx apps/runtime-api/src/server.ts",
"dev:readonly-api": "tsx apps/readonly-api/src/server.ts"
```

Bare `"dev"` removed. Optional future alias `dev:readonly-safe` → same as `dev:readonly-api` not required for gate PASS.

---

## 6. Relation to safe artifact

| Artifact | Entry |
|----------|-------|
| `genesis-safe-readonly` | `core/apps/readonly-api/src/server.ts` only |
| Forbidden in bundle | `core/apps/runtime-api/**` |

Entrypoint policy and bundle manifest **must agree**.

---

## 7. Limitations

- PowerShell wrappers are Windows-first; operators on Unix should run `npm run dev:readonly-api` in `core/` directly.
- Bare `npm run dev` in `core/` removed (D-03); `entrypoint-check` fails if `"dev"` script is reintroduced.
- Frontend `dev` (Vite) is separate; not covered here (D-06 pending).

---

## 8. Verdict

```text
ENTRYPOINT POLICY:     DOCUMENTED
MBG RENAME APPLIED:    YES (D-03)
FOUNDATION WRAPPERS:   PRESENT
NOTARY GREEN:          NOT CLAIMED
EXECUTION AUTHORIZED:  NO
```

---

*D-03 applied to MBG `core/package.json` scripts only. Sprint 1 historical reports unchanged.*
