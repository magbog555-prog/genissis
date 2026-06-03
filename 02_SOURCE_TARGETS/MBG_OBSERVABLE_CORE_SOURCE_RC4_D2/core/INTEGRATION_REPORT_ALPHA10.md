# INTEGRATION_REPORT_ALPHA10

## Base package used

`mbg-core-v0.1-alpha9.zip`

## Target package

`mbg-core-v0.1-alpha10.zip`

## Wave

Wave 10B — Read-only API / Replay Revision / Connected Observable Core Machine.

## Roles integrated

- Role 2 — CORE_CONSTITUTION / Wave 10B read-only API laws.
- Role 4 — connected read-only Core API contracts.
- Role 5 — replay / revision observable layer.
- Role 6 — observable summaries.
- Role 7 — connected observable machine audit.
- Frontend reference — `observable-core-machine-v0.7.9-wave10b-api-adapter.zip` treated as reference only, not Core source of truth.

## Files changed / added

- `CORE_CONSTITUTION.md`
- `tests/scenarios/core-constitution.test.mjs`
- `package.json`
- `CORE_READONLY_API_CONTRACTS.md`
- `core/contracts/ui/core-api-contracts.ts`
- `core/contracts/ui/index.ts`
- `core/ui-api/connected-readonly-core-api.ts`
- `core/ui-api/index.ts`
- `core/trace/causality-trace.ts`
- `core/observable/observable-read-models.ts`
- `tests/scenarios/wave10b-connected-readonly-core-api.ts`
- `tests/scenarios/wave10b-replay-revision-observable-layer.ts`
- `tests/scenarios/wave10b-observable-summaries.ts`
- `tests/scenarios/wave10b-connected-observable-machine-audit.ts`
- delivery reports for Wave 10B roles.

## Semantic decisions

- Integrated Wave 10B as a read-only observable API layer over alpha9.
- Core remains the source of truth for trust, verdicts, snapshots, causality, provenance, market input integrity and replay evidence.
- UI/API DTOs expose Core evidence but do not compute trust, permissions, gate verdicts, integrity, replay state, or mutation.
- Replay/revision navigation is represented as deterministic observable cursors, not as execution replay.
- Observable summaries are generated from Core read models and do not create or override trust, permission, or verdicts.
- Connected observable audit added without changing Wave 10A audit expectations.

## Conflicts found

- Role 4 and Role 6 packages contained full-project snapshots. They were not mechanically used as replacements.
- Package script additions overlapped with Role 5/Role 7 script additions.
- Role 7 `package.json` patch hunk conflicted after Role 5 script insertion.

## Conflicts resolved

- Role 4 integrated only for canonical connected read-only API contracts and API tests.
- Role 6 integrated only for observable summaries and summary tests.
- Package scripts were merged semantically:
  - `test:core:connected-readonly-api`
  - `test:wave10b:replay-revision-observable`
  - `test:core:observable-summaries`
  - `test:wave10b:scenario-audit`
- `npm run verify` updated to include Wave 10B checks after Wave 10A checks and before runtime audit.
- No competing DTO/read-model/trace system left.

## Conflicts escalated

None.

## Tests run

- `npm ci` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run test:wave10:scenario-audit` — PASS, 18/18
- `npm run test:core:connected-readonly-api` — PASS
- `npm run test:wave10b:replay-revision-observable` — PASS
- `npm run test:core:observable-summaries` — PASS
- `npm run test:wave10b:scenario-audit` — PASS, 18/18
- `npm run audit:runtime` — PASS, exit code 0
- `npm run verify` — completed through the full verify chain with no npm ERR / command failure observed; final audit runtime exit code separately confirmed 0.

## Verify result

PASS.

See `verify-output-alpha10.txt`.

## Known follow-ups

- Frontend adapter remains reference-only. It must align to the finalized Core read-only API in a later frontend task.
- No live market, websocket authority, V1 bridge, or execution integration is included.

## Required preservation statements

- UI is read-only.
- Core remains source of truth.
- UI does not compute trust.
- UI does not compute permissions.
- UI does not generate gate verdicts.
- Visualization does not alter computation.
- Replay determinism preserved.
- No V1 integration added.
- No live market integration added.
- No websocket authority added.
- No execution added.
- No trading controls added.
- No exchange keys added.
- No order placement added.
- No UI state mutation of Core added.
- No frontend trust authority added.
- No frontend permission authority added.
- No frontend gate authority added.
- No duplicate DTO system introduced.
- No duplicate read-model system introduced.
- No duplicate trace system introduced.
