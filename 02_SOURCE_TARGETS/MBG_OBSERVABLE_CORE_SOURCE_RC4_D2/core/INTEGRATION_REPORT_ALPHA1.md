# INTEGRATION_REPORT_ALPHA1

## Summary

Canonical package assembled: `mbg-core-v0.1-alpha1`.

Integration role: Role 8 — Integration Owner / Merge Engineer.

Main rule followed: no new architecture, no new features, no semantic redesign. The package was assembled by applying accepted Role 2 and Role 3 artifacts on top of the Role 1 clean package.

## Base Used

- Base archive: `mbg-core-v0.1-role1-final-for-alpha1.zip`
- Extracted root used as integration base: `mbg-core-v0.1`
- Final package name in `package.json`: `mbg-core-v0.1-alpha1`
- Version: `1.0.1`

## Merged Artifacts

- Role 1 base: mbg-core-v0.1-role1-final-for-alpha1.zip
- Role 2: CORE_CONSTITUTION.md
- Role 2: core/kernel/kernel-constitution.ts
- Role 2: tests/scenarios/core-constitution.test.mjs
- Role 2: package script test:core-constitution
- Role 2: ROLE2_CORE_CONSTITUTION_DELIVERY_REPORT.md
- Role 3: role3-cold-start-unknown.patch contents
- Role 3 reference: mbg-core-role3-cold-start-unknown1.zip for exact target files only
- Role 3: package script test:core:cold-start

## Changed Files

### Added files

- `CORE_CONSTITUTION.md`
- `ROLE2_CORE_CONSTITUTION_DELIVERY_REPORT.md`
- `core/kernel/kernel-constitution.ts`
- `data/journal/.gitkeep`
- `tests/scenarios/cold-start-unknown.ts`
- `tests/scenarios/core-constitution.test.mjs`

### Modified files

- `core/gates/src/action-gate.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/state/src/types.ts`
- `core/transitions/src/reducers.ts`
- `package-lock.json`
- `package.json`
- `tests/scenarios/audit-runtime.ts`
- `tests/scenarios/gate-scenarios.ts`

### Removed files

- None.

## Final package scripts

- `dev`: `tsx apps/runtime-api/src/server.ts`
- `test`: `tsx tests/scenarios/gate-scenarios.ts`
- `demo`: `tsx tests/scenarios/demo.ts`
- `audit:runtime`: `tsx tests/scenarios/audit-runtime.ts`
- `scenario:entities`: `tsx tests/scenarios/entities-probe.ts`
- `scenario:stress`: `tsx tests/scenarios/stress-observed.ts`
- `scenario:stateful-stress`: `tsx tests/scenarios/stateful-stress.ts`
- `test:persistence`: `tsx tests/scenarios/persistence-recovery.ts`
- `test:exchange-config`: `tsx tests/scenarios/exchange-config.ts`
- `test:position`: `tsx tests/scenarios/position-reconcile.ts`
- `test:recovery`: `tsx tests/scenarios/recovery-unknown.ts`
- `test:safety-stress`: `tsx tests/scenarios/stress-observed.ts`
- `test:pr30.1:chaos`: `tsx tests/scenarios/pr30-1-chaos-suite.ts`
- `test:pr30.1:core`: `npm run typecheck && npm run test:pr30.1:chaos`
- `typecheck`: `tsc --noEmit`
- `test:pr33:pnl`: `npm run typecheck && tsx tests/scenarios/pr33-pnl-engine.ts`
- `test:pr33.2:pnl-hardening`: `npm run typecheck && tsx tests/scenarios/pr33-2-pnl-hardening.ts`
- `test:pr35:metadata`: `npm run typecheck && tsx tests/scenarios/pr35-metadata-pipeline.ts`
- `verify`: `npm run reset:runtime && npm run typecheck && npm test && npm run test:core-constitution && npm run test:core:cold-start && npm run audit:runtime`
- `reset:runtime`: `node -e "const fs=require('node:fs'); fs.rmSync('data/runtime',{recursive:true,force:true}); fs.rmSync('data/journal',{recursive:true,force:true}); fs.mkdirSync('data/runtime/events',{recursive:true}); fs.mkdirSync('data/runtime/transitions',{recursive:true}); fs.mkdirSync('data/journal',{recursive:true}); fs.writeFileSync('data/journal/.gitkeep', ''); console.log('runtime state reset: data/runtime and data/journal recreated empty')"`
- `core:status`: `PERSISTENCE_ENABLED=false tsx -e "import { runtimeEngine } from './core/runtime/src/runtime-engine.ts'; console.log(JSON.stringify(runtimeEngine.getRuntimeView(), null, 2));"`
- `replay:check`: `tsx -e "import { runtimeEngine } from './core/runtime/src/runtime-engine.ts'; console.log(JSON.stringify(runtimeEngine.replayCheck(), null, 2));"`
- `test:core-constitution`: `node tests/scenarios/core-constitution.test.mjs`
- `test:core:cold-start`: `npm run typecheck && tsx tests/scenarios/cold-start-unknown.ts`

Required scripts preserved/available:

- `verify`
- `reset:runtime`
- `core:status`
- `replay:check`
- `test:core-constitution`
- `test:core:cold-start`

## Merge Conflicts / Review Notes

### Conflict 1 — Role 3 patch format

`role3-cold-start-unknown.patch` could not be applied directly with `git apply --check`.

Observed error:

```text
error: corrupt patch at line 20
```

The malformed hunk is in the `package.json` part of the patch, around the corrupted package-json closing brace line.

Resolution:

- Did not silently ignore the conflict.
- Did not use the full Role 3 archive as the package base.
- Applied the intended Role 3 changes only to the explicitly requested files:
  - `core/state/src/types.ts`
  - `core/transitions/src/reducers.ts`
  - `core/gates/src/action-gate.ts`
  - `core/runtime/src/runtime-engine.ts`
  - `tests/scenarios/cold-start-unknown.ts`
  - existing scenario tests affected by the patch
- Used `mbg-core-role3-cold-start-unknown1.zip` only as reference for exact target file content.
- Merged `package.json` manually to preserve Role 1 scripts and add Role 2/3 scripts.

### Conflict 2 — package.json scripts

Role 1 already contained canonical runbook scripts. Role 2 and Role 3 both introduced additional scripts.

Resolution:

- Preserved all Role 1 scripts, including:
  - `verify`
  - `reset:runtime`
  - `core:status`
  - `replay:check`
- Added:
  - `test:core-constitution`
  - `test:core:cold-start`
- Did not wholesale replace `package.json` from Role 2 or Role 3.

## Verification Results

| Command | Result | Duration |
|---|---:|---:|
| `npm install` | PASS | 14.42s |
| `npm run typecheck` | PASS | 32.51s |
| `npm test` | PASS | 12.91s |
| `npm run test:core-constitution` | PASS | 5.59s |
| `npm run test:core:cold-start` | PASS | 32.9s |
| `npm run audit:runtime` | PASS | 12.3s |
| `npm run verify` | PASS | 36.02s |
| `npm run core:status` | PASS | 10.5s |
| `npm run replay:check` | PASS | 7.52s |
| `npm run reset:runtime` | PASS | 2.39s |

## Cold Start Unknown Confirmation

Confirmed by tests and integrated code:

- Initial `position.status` is `unknown`.
- Initial `risk.status` is `blocked`.
- Initial `risk.reasons` includes `bootstrap_position_not_reconciled`.
- Initial `system.status` remains `bootstrapping`.
- `ActionGate` denies `place_order` before exchange position reconciliation.
- After market tick alone, trading remains blocked.
- After `position.reconciled`, zero position becomes `flat`, risk can become `clear`, and `place_order` can be allowed only through `ActionGate`.

## Constitution Confirmation

Role 2 constitution artifacts are present:

- `CORE_CONSTITUTION.md`
- `core/kernel/kernel-constitution.ts`
- `tests/scenarios/core-constitution.test.mjs`

`npm run test:core-constitution` passed.

## Runtime Reset / Status / Replay

- `npm run reset:runtime` passed.
- `npm run core:status` passed.
- `npm run replay:check` passed.

Runtime reset created an empty runtime/journal structure:

- `data/runtime/events/`
- `data/runtime/transitions/`
- `data/journal/.gitkeep`

## Scope Confirmation

The integration did not add:

- V1
- Signal Layer
- Decision Engine
- UI
- live trading logic
- new strategy logic

Notes:

- Any existing legacy directories/files present in the Role 1 base were not expanded or treated as new additions.
- No ActionGate bypass was introduced.
- Role 3 behavior keeps trading blocked until trusted reconciliation conditions are represented in state.

## Remaining Risks

1. The previously damaged Role 3 patch has been replaced for this package handoff by `alpha1-integration.patch`, generated from the accepted alpha1 package to this follow-up package.
2. The Role 1 base still contains some legacy-named components inherited from earlier PRs. They were not newly introduced by this merge.
3. `npm run verify` now runs the full alpha1 verification scope required by review: `reset:runtime`, `typecheck`, `test`, `test:core-constitution`, `test:core:cold-start`, and `audit:runtime`.
4. `npm install` was used successfully and updated `package-lock.json` to reflect the final `package.json` name/scripts.
5. Runtime reset artifacts under `data/` are generated by the required verification script and included as empty runtime state scaffolding.

## Final Decision

`mbg-core-v0.1-alpha1` is assembled as the canonical alpha1 package from Role 1 + Role 2 + Role 3 inputs.

All required checks passed.


## Alpha1 Review Follow-up

Status: completed after Alpha1 review acceptance.

Required follow-up changes:

1. Updated `npm run verify` to execute the full alpha1 verification chain:

```txt
npm run reset:runtime
npm run typecheck
npm test
npm run test:core-constitution
npm run test:core:cold-start
npm run audit:runtime
```

2. Added clean integration patch:

```txt
alpha1-integration.patch
```

The patch is generated from the accepted uploaded alpha1 package to this follow-up package and contains only the required follow-up delta.

## Final Verification Result

Command executed:

```txt
npm run verify
```

Result:

```txt
PASS
exit code: 0
```

Expanded verify command:

```txt
npm run reset:runtime && npm run typecheck && npm test && npm run test:core-constitution && npm run test:core:cold-start && npm run audit:runtime
```

## Scope Control

No new runtime, strategy, V1, Signal Layer, Decision Engine, UI, or live-trading changes were added.
