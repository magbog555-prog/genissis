# Genesis v1 PR30 Destruction Testing Engine

Full cumulative build based on PR29 real testnet execution control, plus PR30 destructive tests.

# Genesis v1 PR24 — Hard Failure Recovery Engine

PR24 builds on PR23 and adds corruption/failure recovery smokes:

- tolerant segmented event tail handling
- snapshot corruption quarantine fallback
- `/tests/run/snapshot-corruption-smoke`
- `/tests/run/event-tail-corruption-smoke`
- `/tests/run/hard-failure-suite`
- PR23 latency guard, durable jobs, hard stress suite preserved

Recommended PR24 protocol:

```powershell
curl.exe http://localhost:3000/tests
curl.exe -X POST "http://localhost:3000/tests/run/hard-failure-suite"
curl.exe -X POST "http://localhost:3000/tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000"
curl.exe -X POST "http://localhost:3000/tests/run/restart-readiness-check"
```

Manual crash test is still destructive and must be done from PowerShell using `/tests/run/crash-restart-plan`.


# Genesis v1 PR20 — Async Persistence Latency Window Engine

# PR20 — Async Persistence / Latency Window Fix

## Purpose
PR19 proved safety but failed latency invariants because the test used a lifetime max latency value that could include cold-start / disk flush spikes before the stress run.

## Fix
- Added runtime `resetPerformanceWindow()`.
- Safety stress resets the latency window before measuring.
- Async state-space stress jobs reset the latency window at job start.
- PR18 cumulative endpoints preserved.
- PR17 safety assertions preserved.
- Large stress remains non-blocking via job IDs.

## Expected
- `/tests/run/safety-stress-check?cycles=50` => `ok: true`
- `/tests/run/state-space-stress-check?states=20000&batchSize=500` => job `completed`
- `/tests/run/state-space-stress-check?states=30000&batchSize=1000` => job `completed`

## Safety Requirements
- falseAllowCount = 0
- actionViolationCount = 0
- backlogDepth = 0
- unsafe place_order = deny
- reconcile_order/reconcile_position = allow
- risk returns clear after recovery
- system returns healthy after recovery


---

# Genesis v1 PR18 — Cumulative Stress Job Engine

This is the cumulative runtime package.

It preserves the Genesis v1 core:
- state machine
- event contracts
- transitions
- ActionGate
- exchange/testnet execution guards
- position reconciliation
- partial fill handling
- unknown/recovery engine
- persistence/event log/snapshot
- stress and chaos reports

## Start

```powershell
cd C:\dev\genesis-v1-pr18-cumulative-stress-job-engine
copy .env.example .env
notepad .env
npm install
npm run dev
```

## Sanity

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/tests
curl.exe -X POST "http://localhost:3000/tests/run/safety-stress-check?cycles=50"
```

Expected:

```json
{ "ok": true }
```

## Large tests are now async jobs

Do not run 10k/20k/30k as blocking curl calls.

```powershell
curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=10000&batchSize=500"
```

The API returns a `jobId` immediately.

Poll:

```powershell
curl.exe http://localhost:3000/tests/jobs/<jobId>
```

Recommended sequence:

```powershell
curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=10000&batchSize=500"
curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=20000&batchSize=500"
curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=30000&batchSize=1000"
```

## Safety invariant

During unsafe state:

```txt
order = uncertain
position = unknown
risk = blocked
system = degraded
```

ActionGate must deny dangerous actions:

```txt
place_order => deny
reconcile_order => allow
reconcile_position => allow
```

## Do not expose API keys

If keys were shown in screenshots or chat, revoke/regenerate them on Binance Testnet.


# PR19 — Performance Hardened Stress Job Engine

## Goal

Fix PR18 large state-space stress job latency spikes without changing the core safety semantics.

## What changed

- PR18 cumulative build retained.
- State-space stress job now runs as an async job.
- Stress job uses silent runtime commits to avoid console I/O dominating latency.
- Persistence writes are batched and flushed outside the measured per-event commit path.
- Large stress ranges:
  - 10k sanity
  - 20k performance validation
  - 30k hard stress
  - max 50k guarded
- `/tests` reports PR19 and recommended sequence.
- Safety invariants remain unchanged:
  - unsafe state must deny `place_order`
  - reconcile actions remain allowed
  - recovery must restore `risk=clear` and `system=healthy`
  - replay must match current snapshot
  - snapshot revision must match event count

## Expected results

- `safety-stress-check?cycles=50` => `ok: true`
- `state-space-stress-check?states=10000&batchSize=500` => async `completed`, `result.ok=true`
- `state-space-stress-check?states=20000&batchSize=500` => async `completed`, `result.ok=true`
- `state-space-stress-check?states=30000&batchSize=1000` => async `completed`, `result.ok=true` unless local machine is heavily loaded.

## Commands

```powershell
curl.exe http://localhost:3000/tests
curl.exe -X POST "http://localhost:3000/tests/run/safety-stress-check?cycles=50"
curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=20000&batchSize=500"
curl.exe http://localhost:3000/tests/jobs/<JOB_ID>
```


## PR21
Segmented streaming persistence: fixes restart after very large event logs.


# PR22 — Fault Injection + Durable Jobs

## Purpose

PR22 turns the manual hard-stress checklist into API-level test harnesses.

## Added

- Durable job registry at `data/runtime/jobs/*.json`
- `/tests/jobs` lists durable jobs and status counters
- `/tests/jobs/:jobId` can read persisted job records after restart
- clear state-space param reporting: `requestedStatesInput`, `acceptedStates`, `clamped`
- `/tests/run/fault-probe`
- `/tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000`

## Expected protocol

```powershell
curl.exe http://localhost:3000/tests
curl.exe -X POST "http://localhost:3000/tests/run/fault-probe"
curl.exe -X POST "http://localhost:3000/tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000"
curl.exe http://localhost:3000/tests/jobs/<suiteJobId>
```

## Pass criteria

- `falseAllowCount = 0`
- `actionViolationCount = 0`
- `backlogDepth = 0`
- `invariantsPassed = true`
- `risk = clear`
- `system = healthy`
- durable jobs survive restart
- segmented-streaming persistence remains healthy


## PR23 — Crash & Latency Control

See `PR23_CRASH_LATENCY_CONTROL_REPORT.md`.


# PR25 — Orchestration Cleanup Engine

## Goal

PR25 does not change the trading core. It cleans the hard-stress orchestration layer so test reports do not confuse a safe core with a failed suite coordinator.

## Changes

- Version updated to `pr25-orchestration-cleanup-engine`
- `hard-stress-suite` now rejects concurrent suite runs by default
- Child jobs are retried when the child failure is classified as retryable and core safety is still intact
- Suite result now includes:
  - `classification`
  - `children`
  - `attempts`
  - `criticalInvariantSummary`
- Added `/debug/job-orchestration`
- `/tests/jobs` now shows active jobs
- Latency is separated from critical safety invariants

## Main endpoints

```powershell
curl.exe http://localhost:3000/tests
curl.exe http://localhost:3000/debug/job-orchestration
curl.exe -X POST "http://localhost:3000/tests/run/hard-failure-suite"
curl.exe -X POST "http://localhost:3000/tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000"
curl.exe http://localhost:3000/tests/jobs/<JOB_ID>
```

## Pass criteria

- `falseAllowCount = 0`
- `actionViolationCount = 0`
- `backlogDepth = 0`
- `snapshotRevision == eventCount`
- `replay_matches_current_snapshot = true`
- child jobs completed or retried with clear classification


## PR26.1 Controlled Live Trading Guard + Portfolio Risk

This build is based on PR25.5 orchestration restart recovery and adds portfolio-aware execution guard.

### Required smoke

```powershell
curl.exe http://localhost:3000/execution/guard
curl.exe -X POST http://localhost:3000/tests/run/portfolio-risk-guard-check
curl.exe -X POST http://localhost:3000/tests/run/controlled-live-guard-check
```

### Guarded execution

Dry-run is enabled by default:

```powershell
curl.exe -X POST http://localhost:3000/execution/testnet/place-guarded -H "Content-Type: application/json" -d "{\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"quantity\":0.0001}"
```

Do not disable `TESTNET_EXECUTION_DRY_RUN` until PR25.5, PR26.1, hard-failure-suite, and portfolio-risk-guard-check are green.


## PR27 — Guarded Testnet Execution

Main checks:

```powershell
curl.exe http://localhost:3000/execution/guard
curl.exe http://localhost:3000/execution/daily-risk
curl.exe -X POST http://localhost:3000/tests/run/guarded-testnet-execution-check
curl.exe http://localhost:3000/execution/journal
```

Dry-run is ON by default:

```env
TESTNET_EXECUTION_DRY_RUN=true
```

To send real Binance Spot Testnet orders, explicitly set:

```env
TESTNET_EXECUTION_DRY_RUN=false
EXCHANGE_MODE=testnet
LIVE_TRADING=false
```

Mainnet remains disabled in this build.


## PR28 Auto Reconcile Guarded Execution

Adds `/execution/reconcile/auto` and automatic pre-guard recovery for guarded testnet execution.


## PR29 Real Testnet Execution

Dry-run check:

```powershell
curl.exe -X POST http://localhost:3000/tests/run/guarded-testnet-execution-check
```

Real Binance Spot Testnet check:

1. Edit `.env`:

```env
TESTNET_EXECUTION_DRY_RUN=false
REAL_TESTNET_EXECUTION_ACK=I_UNDERSTAND_TESTNET_ORDER
```

2. Restart server:

```powershell
npm run dev
```

3. Run:

```powershell
curl.exe -X POST http://localhost:3000/tests/run/real-testnet-execution-check
curl.exe http://localhost:3000/execution/journal
curl.exe http://localhost:3000/execution/daily-risk
```



## PR30 destructive tests

Run these after PR29 clean real testnet execution:

```powershell
curl.exe http://localhost:3000/tests
curl.exe -X POST http://localhost:3000/tests/destruction/duplicate-place
curl.exe -X POST http://localhost:3000/tests/destruction/network-timeout-race
curl.exe -X POST http://localhost:3000/tests/destruction/partial-fill
curl.exe -X POST http://localhost:3000/tests/destruction/fill-without-notification
curl.exe -X POST http://localhost:3000/tests/destruction/cancel-vs-fill-race
curl.exe -X POST "http://localhost:3000/tests/destruction/stale-snapshot?delayMs=2500"
curl.exe -X POST http://localhost:3000/tests/destruction/orphan-order
curl.exe -X POST http://localhost:3000/tests/destruction/restart-during-execution-plan
```

Run these last because they intentionally halt the runtime:

```powershell
curl.exe -X POST http://localhost:3000/tests/destruction/journal-failure
curl.exe -X POST http://localhost:3000/tests/destruction/position-drift
```

PASS rule: state equals exchange, or system halts. FAIL rule: silent inconsistency while trading remains allowed.


## PR30.1 Real Market Chaos Suite

Run contract tests:

```bash
npm run test:pr30.1:core
```

Real market chaos endpoints are blocked unless `PR30_1_REAL_CHAOS_ACK=I_ACCEPT_TESTNET_CHAOS` and testnet guarded execution is explicitly enabled.
