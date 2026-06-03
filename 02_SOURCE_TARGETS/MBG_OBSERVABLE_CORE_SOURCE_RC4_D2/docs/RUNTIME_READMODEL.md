# Runtime Read-Model — RC3

RC3 adds a read-only adapter from runtime engine state into the canonical `RuntimeSnapshot`.

## Purpose

RC1 restored launch and the frontend/core bridge.

RC2 introduced `RuntimeSnapshot` and proof-gated DTO normalization.

RC3 adds:

```text
runtimeEngine state
  → RuntimeReadModelAdapter
  → RuntimeSnapshot
  → Read-only API
  → Frontend
```

## RuntimeReadModel vs scenario/mock DTO

Scenario/mock DTOs are deterministic compatibility fixtures.

RuntimeReadModel is the future read-model of actual runtime engine state. In this RC3 package the endpoint is wired through a safe runtime-stub because Binance, market ingest and execution are intentionally not connected.

The API is honest about this:

```text
/health.runtimeSource = runtime-stub
```

## UI contract

The frontend must render only `RuntimeSnapshot`.

Forbidden:

```text
raw runtime DTO → UI components
```

Allowed:

```text
raw runtime read-model → normalizeRuntimeSnapshot() → RuntimeSnapshot → UI
```

## Runtime endpoints

```text
GET /api/core/runtime/snapshot
GET /api/core/runtime/status
GET /api/core/runtime/trust
GET /api/core/runtime/integrity
GET /api/core/runtime/causality-trace
GET /api/core/runtime/permission-ledger
```

All endpoints are read-only.

## No Binance / no execution

RC3 does not connect:

```text
Binance
API keys
Live market stream
Order placement
Execution
Trading buttons
```

## Proof conditions for allowed

`allowed` is possible only if:

```text
trust.state = TRUSTED
exchangeTruth.status = present
marketInputIntegrity.status = ok
permissionLedger.status = ok
kernelAuthority.status = pass
kernelAuthority.failed = 0
actionGate.status = pass
actionGate.failed = 0
```

If any proof is missing:

```text
verdict.result = prohibited
blockedBy contains the missing proof
```

## Missing market truth

RC3 has no live market truth by design, so the default packaged runtime snapshot is:

```text
trust = UNCERTAIN
verdict = prohibited
blockedBy includes exchangeTruth / marketInputIntegrity / permissionLedger
```


## Runtime Source Modes

RC3 HOTFIX1 supports explicit runtime source reporting.

Possible values:

- `runtime-stub`
- `runtime-engine`
- `runtime-unavailable`

`runtimeSource = runtime-engine` means the read model is built from actual `runtimeEngine` read state through a read-only accessor.

`runtimeSource = runtime-stub` means the system is using a deterministic stub source and must not be treated as live runtime state.

`runtimeSource = runtime-unavailable` means no runtime engine read state is available; the normalized RuntimeSnapshot must remain `UNCERTAIN -> prohibited`.

The API must never report `runtime-engine` while using stub data.

No source mode enables Binance, API keys, execution, or order placement.
