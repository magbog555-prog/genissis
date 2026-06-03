# CLEAN_MANIFEST.md — Role 1 Clean Package + Runbook

Package: `mbg-core-v0.1`  
Source baseline: `pr35_metadata_lifecycle_fix_v2`  
Scope: clean working base only. No runtime architecture changes, no V1 integration, no strategies/UI/Signal Layer/Decision Engine/trading-logic work.

## Kept

The clean package intentionally keeps only the project areas needed to compile, run the existing runtime API baseline, and execute current core checks:

- `core/`
  - State contracts, reducers, gates, runtime engine, persistence, invariants, system helpers, and existing internal modules required by typecheck.
- `application/`
  - Existing exchange/market adapters required by imports in the current runtime API and runtime modules.
- `engine/`
  - Existing engine-level code retained because it is part of the PR35 baseline dependency graph.
- `apps/runtime-api/`
  - Existing runtime API entrypoints and endpoints.
- `tests/`
  - Existing scenario tests used by current `npm run test` and related validation scripts.
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `README.md`
- `.gitignore`
- `RUNBOOK.md`
- `DELIVERY_REPORT_ROLE1.md`
- `CLEAN_MANIFEST.md`
- `PR35_METADATA_LIFECYCLE_FIX_REPORT.md`
- `PR35_RECONCILE_STRICT_GATE_FIX_REPORT.md`

## Removed

The following classes of files/directories were removed from the clean package:

- `config/`
- `data/`
- previous runtime state:
  - runtime snapshots;
  - runtime event segments;
  - transition segments;
  - journal files;
  - quarantine/corruption artifacts, if present in source state.
- `.env`
- `.env.example`
- local dependency directories:
  - `node_modules/`
- temporary/scratch/build artifacts:
  - `dist/`
  - `build/`
  - `coverage/`
  - `.cache/`
  - `.turbo/`
  - `.next/`
  - temp/scratch directories, if present.
- old archives or packaged outputs.
- PR29–PR34 delivery reports from the clean package top level.
- production/live artifacts and local operator artifacts, if present.

## Why removed

- `config/`
  - Removed because current alpha clean package must not ship strategy/hypothesis/operator configuration as part of the Trust Kernel baseline.
  - This avoids implying that V1, strategies, Signal Layer, Decision Engine, or trading configuration are in scope.
- `data/`
  - Removed because runtime snapshots, journals, and event logs are local state, not source code.
  - Shipping persisted state could create false confidence or contaminate replay/recovery checks.
- `.env`
  - Removed because environment files may contain secrets or deployment-specific settings.
- `.env.example`
  - Removed in this package because the existing baseline imports exchange/live-market modules and an unsafe or ambiguous example could encourage accidental live/testnet configuration before Core v0.1 trust semantics are hardened.
  - A safe example config is likely needed later, but should be created deliberately with no live keys, explicit safe defaults, and clear `DRY_RUN`/mock/offline semantics.
- `node_modules/`
  - Removed because dependencies must be reproducibly installed from `package-lock.json`.
- old archives/build/scratch artifacts
  - Removed because they are not part of the source baseline and can hide stale code or stale runtime state.
- old PR reports
  - Removed to keep integration focused on PR35 lineage only.

## Potentially risky removals

- `config/`
  - Risk: some legacy tests or manual scenarios may assume strategy/hypothesis config files exist.
  - Current role-1 verification keeps only the accepted baseline checks: `npm run test`, `npm run typecheck`, and `npm run verify`.
- `.env.example`
  - Risk: developers have no packaged config template.
  - Mitigation: `RUNBOOK.md` documents commands without requiring secrets; a later safe config example should be explicit, non-secret, and fail-closed.
- old PR reports
  - Risk: detailed historical review context is no longer packaged.
  - Mitigation: PR35 reports are retained as the nearest accepted lineage for this clean base.
- `data/`
  - Risk: developers starting the API will create new local runtime state.
  - Mitigation: `npm run reset:runtime` and the runbook document how to clear it safely.

## Absence confirmation

Confirmed absent from the final clean package archive:

- `.env`
- real keys or secret values
- runtime snapshots
- journal/runtime data
- `node_modules`
- production/live artifacts

Notes:

- Source code still contains environment variable names such as `BINANCE_API_KEY`/`BINANCE_API_SECRET` because those are code-level configuration references, not secret values.
- Source code still contains existing live/testnet adapter modules because removing them would be an architecture/runtime change outside Role 1.
- No live keys are included.

## Added/changed npm scripts

Added to `package.json`:

```bash
npm run verify
npm run reset:runtime
npm run core:status
npm run replay:check
```

Script behavior:

- `verify`
  - Runs `npm run reset:runtime && npm run typecheck && npm run test`.
- `reset:runtime`
  - Removes and recreates empty `data/runtime` and `data/journal` folders.
  - This is a local operational helper only; runtime data is not included in the archive.
- `core:status`
  - Prints the current core runtime view directly from `runtimeEngine` with `PERSISTENCE_ENABLED=false`.
  - Chosen as a safe minimal variant because it does not require starting the API or writing runtime state.
- `replay:check`
  - Prints `runtimeEngine.replayCheck()`.
  - This may create empty runtime persistence directories because the existing persistence constructor initializes `data/runtime` when persistence is enabled. The final archive is cleaned after verification.

## What was intentionally not done

- Did not connect V1.
- Did not add Signal Layer.
- Did not add Decision Engine.
- Did not add strategies.
- Did not add UI.
- Did not change trading logic.
- Did not rewrite runtime engine.
- Did not change health semantics.
- Did not introduce CoreTrustReport.
- Did not change cold-start semantics.
- Did not add live keys or deployment configuration.
