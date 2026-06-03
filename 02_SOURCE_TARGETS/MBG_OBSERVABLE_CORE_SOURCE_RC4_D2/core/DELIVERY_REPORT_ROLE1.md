# Role 1 Delivery Report — Clean Package + Runbook

## Package

`mbg-core-v0.1`

Based on `pr35_metadata_lifecycle_fix_v2`.

## Removed files/folders

Top-level items removed from the clean package:

- `.env.example`
- `PR10_CONTROLLED_TESTNET_EXECUTION_REPORT.md`
- `PR11_ORDER_RECONCILE_LAYER_REPORT.md`
- `PR12_EVIL_CORE_STRESS_REPORT.md`
- `PR13_ULTRA_CHAOS_REPORT.md`
- `PR14_LONGRUN_BACKPRESSURE_REPORT.md`
- `PR15_NONBLOCKING_STRESS_REPORT.md`
- `PR16_SAFE_STRESS_REPORT.md`
- `PR17_SAFE_STRESS_OK_REPORT.md`
- `PR18_CUMULATIVE_STRESS_JOB_REPORT.md`
- `PR18_TEST_PLAN.md`
- `PR19_PERFORMANCE_HARDENING_REPORT.md`
- `PR1_PATCH_REPORT.md`
- `PR1_SAFETY_HARDENING.md`
- `PR20_ASYNC_PERSISTENCE_LATENCY_WINDOW_REPORT.md`
- `PR21_SEGMENTED_STREAMING_PERSISTENCE_REPORT.md`
- `PR22_FAULT_INJECTION_DURABLE_JOBS_REPORT.md`
- `PR23_CRASH_LATENCY_CONTROL_REPORT.md`
- `PR24_HARD_FAILURE_RECOVERY_REPORT.md`
- `PR25_ORCHESTRATION_CLEANUP_REPORT.md`
- `PR26_CONTROLLED_LIVE_TRADING_GUARD_PORTFOLIO_REPORT.md`
- `PR27_GUARDED_TESTNET_EXECUTION_REPORT.md`
- `PR27_GUARDED_TESTNET_EXECUTION_REPORT.tar`
- `PR28_AUTO_RECONCILE_GUARDED_EXECUTION.md`
- `PR29_REAL_TESTNET_EXECUTION_CONTROL_REPORT.md`
- `PR2_COMMAND_LOG_REPORT.md`
- `PR30_1_REAL_MARKET_CHAOS_SUITE_REPORT.md`
- `PR30_DESTRUCTION_TESTING_REPORT.md`
- `PR31_NIGHT_RUN_INVARIANT_FIX_REPORT.md`
- `PR31_RUNTIME_CONSOLIDATION_REPORT.md`
- `PR32_DAYTIME_STABILIZATION_HARDENING_REPORT.md`
- `PR33_PNL_ENGINE_REPORT.md`
- `PR3_EXECUTION_SAFETY_REPORT.md`
- `PR4_RECONCILE_FIRST_REPORT.md`
- `PR5_FULL_SAFETY_REPORT.md`
- `PR6_EXCHANGE_INTEGRATION_REPORT.md`
- `PR7_EXTERNAL_STREAM_REPORT.md`
- `PR8_QUARANTINE_RECOVERY_REPORT.md`
- `PR9_CHAOS_STRESS_REPORT.md`
- `close-position.js`
- `config`
- `data`
- `expectancy-output.json`
- `scripts`

Additional cleanup policy applied:

- no `.env` files;
- no runtime snapshots/journals/events;
- no old archives;
- no scratch/temp/build/dist/coverage folders;
- no production artifacts.

## Left modules

Top-level items left in the clean package:

- `.gitignore`
- `PR35_METADATA_LIFECYCLE_FIX_REPORT.md`
- `PR35_RECONCILE_STRICT_GATE_FIX_REPORT.md`
- `README.md`
- `RUNBOOK.md`
- `application`
- `apps`
- `core`
- `engine`
- `package-lock.json`
- `package.json`
- `tests`
- `tsconfig.json`

Core project modules preserved:

- `core/`
- `application/`
- `engine/`
- `apps/runtime-api/`
- `tests/`

PR35 report history preserved when present:

- `PR35_METADATA_LIFECYCLE_FIX_REPORT.md`
- `PR35_RECONCILE_STRICT_GATE_FIX_REPORT.md`

## Added files

- `RUNBOOK.md`
- `DELIVERY_REPORT_ROLE1.md`

## Commands

Install:

```bash
npm install
```

Run API:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

Typecheck:

```bash
npm run typecheck
```

Reset runtime state:

```bash
rm -rf data/runtime data/journal
mkdir -p data/runtime/events data/runtime/transitions data/journal
touch data/journal/.gitkeep
```

## Review principle

No architecture/runtime rewrite was performed. The package cleanup removes stateful/local/noisy artifacts and keeps the codebase focused on the PR35 core baseline.

## Risks

- Some preserved tests and modules still reference legacy strategy/metadata/PnL code because removing those modules would be an architectural change and would break typechecking.
- Runtime reset commands recreate local `data/` directories during development, but those directories are intentionally not shipped.
- Existing API health semantics are not changed by this role; they may still require hardening in a later Trust Kernel task.
- Existing package scripts may expose scenario tests beyond the minimal smoke test; they are preserved only where their target files exist.


## Verification results

`npm install`

```text
exit code: 0
found 0 vulnerabilities
```

`npm run test`

```text
exit code: 0
> mbg-core-v0.1@1.0.1 test
> tsx tests/scenarios/gate-scenarios.ts

[runtime] event=market.tick.received eventId=d49b6f75-e7fc-4827-86d5-0ef076346994 snapshot=0->1 changed=market,risk,system
5 gate scenario base checks passed
```

`npm run typecheck`

```text
exit code: 0
> mbg-core-v0.1@1.0.1 typecheck
> tsc --noEmit
```


## Follow-up before integration into `mbg-core-v0.1-alpha1`

Added:

- `CLEAN_MANIFEST.md`
- npm script: `verify`
- npm script: `reset:runtime`
- npm script: `core:status`
- npm script: `replay:check`

Changed:

- `package.json`
- `RUNBOOK.md`
- `DELIVERY_REPORT_ROLE1.md`

Confirmed absent from the clean package archive:

- `.env`
- real keys or secret values
- runtime snapshots
- journal/runtime data
- `node_modules`
- production/live artifacts

`.env.example` status:

- Intentionally removed from Role 1 clean package.
- Reason: the existing PR35 baseline still contains live/testnet adapter paths; a vague example config could create operator confusion or false confidence.
- Recommendation: add a safe example later only with mock/offline or dry-run defaults and no live keys.

Intentionally not done:

- No V1 integration.
- No Signal Layer.
- No Decision Engine.
- No strategies.
- No UI.
- No trading logic changes.
- No runtime rewrite.
- No health semantics changes.
- No CoreTrustReport implementation.


## Final follow-up verification results

Commands executed after adding `CLEAN_MANIFEST.md` and npm scripts:

```bash
npm install
```

Result:

```text
exit code: 0
found 0 vulnerabilities
```

```bash
npm run verify
```

Result:

```text
exit code: 0
verify = npm run reset:runtime && npm run typecheck && npm run test
5 gate scenario base checks passed
```

```bash
npm run typecheck
```

Result:

```text
exit code: 0
```

```bash
npm run test
```

Result:

```text
exit code: 0
5 gate scenario base checks passed
```

```bash
npm run core:status
```

Result:

```text
exit code: 0
printed runtimeEngine.getRuntimeView() with PERSISTENCE_ENABLED=false
```

```bash
npm run replay:check
```

Result:

```text
exit code: 0
replayCheck.ok = true
mode = snapshot-first-streaming-tail
```

```bash
npm run reset:runtime
```

Result:

```text
exit code: 0
runtime state reset: data/runtime and data/journal recreated empty
```

Final packaging cleanup:

- removed local `node_modules`;
- removed local `data/runtime`;
- removed local `data/journal`;
- did not include runtime state in final archive.
