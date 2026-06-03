# RC4_FINAL_ACCEPTANCE_REPORT

## RC4-D2 — Launch and port 3011 preflight

**RC4-D2 Launch & Port Preflight Utility** — **PASS** after `npm run verify:launchers`, `npm run verify:semantic-labels`, `npm run verify:rc4-d`, and `npm run build:frontend`.

Double-click **`START_APP.cmd`** / **`STOP_APP.cmd`**; **`launcher\*.cmd`** wrappers; **`start-core.ps1`** preflight on **3011** with operator-confirmed stop via **`stop-core-port.ps1`**. Raw **EADDRINUSE** is not the primary operator instruction.

## RC4-D1 — Semantic label debt closure

**RC4-D1 Semantic Label Debt Closure** — **PASS** (after `npm run verify:semantic-labels` and full `npm run verify:rc4-d`).

Operator copy distinguishes **local core trust**, **exchange trust**, and **exchange proof**; failure matrix avoids presenting bare `allowed` as trading permission; raw DTO JSON in panels is unchanged.

## Final status

**RC4-D FINAL CANDIDATE** — **OBSERVE-ONLY RELEASE CANDIDATE**

This is **not** certified for live trading deployment. It is a **read-only / observe-only** operator and audit workspace with a bounded API surface.

## What is accepted

- Core typecheck and default scenario tests (`npm run check:core`).
- RC4 verification chain through RC4-C UI and layout gates (`verify:rc4`, `verify:rc4-c`, frontend language/layout scripts).
- Readonly API exposes documented GET routes; **no POST handlers** in `connected-readonly-core-api.ts`.
- Live `verify:readonly-surface` checks (with temporary dev server) reject dangerous POSTs with non-success status.
- Frontend production build succeeds (`npm run build:frontend`).
- Operator UI surfaces **NO PROOF → NO ALLOW** messaging in line with the safety contract.
- RC4-D2 launcher / port **3011** preflight (`npm run verify:launchers`, `START_APP.cmd`, `stop-core-port.ps1`, `launcher\` CMDs).

## What is not included

- Order placement, cancellation, or execution controls in the UI.
- API keys, secrets, or signed exchange trading endpoints in this package.
- Automatic layout reset on reload (manual reset only).
- Any change to gate / trust normalization rules (RC4-D is verification + docs + packaging).

## Safety invariants (frozen for this candidate)

- `executionSurface` **closed** for observe-only operator scenarios.
- `actionVerdict` **prohibited** when proof is absent (canonical trace / snapshot path).
- **Trust** does not become **TRUSTED** without exchange proof in the read model contract.
- **Live connected ≠ trusted**; **fresh market data ≠ permission**.
- **NO PROOF → NO ALLOW** visible in operator copy paths.
- Dangerous **POST** URLs listed in `API_CONTRACT.md` remain **closed** on the readonly server.
- **readOnly: true** on readonly live-stream DTO defaults where defined.

## API endpoints (readonly core)

See `API_CONTRACT.md` for the canonical GET list and POST-forbidden list.

## Frontend panels

Workspace windows include core overview, live stream (panel 17), operator truth, pipeline, verdict, replay/revision, market integrity, provenance, recovery, failure matrix, and raw trace viewers — all **read-only** presentation of DTOs and snapshots.

## Layout persistence

- Storage key: `mbg.rc4c.layout.v1`  
- Schema: `rc4-c-layout-v1`  
- Persists: tabs (order + `activeTabId`), panel geometry, visibility, collapsed state, compact mode, language, theme/settings fields mirrored in the bundle.

## Known debts

See `UX_DEBT.md`. Remaining backlog highlights: **full RU / EN polish**, **professional terminal UX polish**, **resize / window behavior**, and a **full visual status system** (plus additional panel-level follow-ups listed there).

## How to verify

1. `npm run install:all` — PASS  
2. `npm run verify:launchers` — PASS (RC4-D2)  
3. `npm run verify:semantic-labels` — PASS (RC4-D1)  
4. `npm run verify:rc4-d` — PASS  
5. `npm run build:frontend` — PASS (also inside verify gate)  
6. Start core + frontend per `START_HERE.md` (e.g. **`START_APP.cmd`**) — UI opens, ApiAdapter path hits `127.0.0.1:3011`  
7. Manual smoke: operator banners show **NO PROOF → NO ALLOW** where applicable  
8. Optional: DevTools → confirm `mbg.rc4c.layout.v1` JSON after moving panels  

## Archive name (RC4-D2 launch / port preflight accepted artifact)

`MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D2_LAUNCH_PORT_PREFLIGHT_ACCEPTED.zip` (recommended: exclude `node_modules`; run `npm run install:all` after unpack).

## Archive name (RC4-D1 semantic closure artifact)

`MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D1_SEMANTIC_LABEL_CLOSURE.zip` (workspace tree without `node_modules`; run `npm run install:all` after unpack).

## Archive name (release artifact)

`MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D_FINAL_ACCEPTANCE.zip`
