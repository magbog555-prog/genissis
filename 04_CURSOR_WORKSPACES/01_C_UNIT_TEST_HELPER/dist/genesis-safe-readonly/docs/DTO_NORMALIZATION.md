# DTO Normalization — RC2 RuntimeSnapshot

RC2 introduces a canonical `RuntimeSnapshot` read-model between Core, the read-only API, frontend adapters, mock scenarios and future runtime read-models.

## Why RuntimeSnapshot exists

RC1 restored the observable bridge between frontend and Core. RC2 makes that bridge stable by preventing UI components from depending on unstable raw DTO shapes.

The frontend must render a single safe contract:

```text
raw mock/core/scenario DTO
→ normalizeRuntimeSnapshot()
→ RuntimeSnapshot
→ UI
```

## Data sources

RC2 recognizes four source categories:

```text
mock
scenario
core-readonly
runtime
```

Mock DTO, Scenario DTO and Core Readonly DTO may differ internally. `RuntimeSnapshot` is the only stable render contract.

## Why raw DTO must not be rendered directly

Raw DTOs can miss fields such as:

```text
rules.kernelAuthority
rules.actionGate
pipeline
decisionTrace
marketInputIntegrity
recovery
quarantine
```

Rendering these directly caused the RC1 `kernelAuthority` crash. RC2 blocks that class of bug by normalizing every payload before UI use.

## Normalizer behavior

`normalizeRuntimeSnapshot(input, options)` must:

- accept unknown input
- never throw outward
- return a complete RuntimeSnapshot
- preserve read-only and deterministic metadata
- preserve source/scenario information where available
- preserve raw payload unless explicitly disabled
- convert missing data into safe blocking defaults

## Safe defaults

Missing or malformed data becomes:

```text
trust.state = UNCERTAIN
verdict.result = prohibited
machine.mode = UNKNOWN
kernelAuthority.status = unknown
actionGate.status = unknown
rules = []
pipeline = []
decisionTrace = []
quarantine.status = unknown
recovery.status = unknown
marketIntegrity.status = unknown
provenance.status = unknown
revisionTimeline = []
```

## Safety rule

```text
missing field
→ safe default
→ trust = UNCERTAIN
→ verdict = prohibited
```

Incomplete data must never allow action.

## RC2 boundary

RC2 does not connect Binance, API keys, live market ingest, order placement or execution. It preserves the RC1 read-only boundary.


## RC3 Runtime Read-Model

RC3 keeps `RuntimeSnapshot` as the only UI contract. Runtime read-model payloads are normalized before rendering. Runtime source `allowed` is accepted only with full exchange, market integrity, permission ledger, kernel and action-gate proof.
