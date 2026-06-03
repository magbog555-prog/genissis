# Wave 10B — Connected Read-only Core API Contracts

Base: `mbg-core-v0.1-alpha9.zip`

This document defines the mock-first, read-only Core API surface for the Observable Core Machine.

## Core principles

- UI observes; Core decides.
- API is read-only.
- API does not calculate trust in the frontend.
- API does not execute actions.
- API does not connect to live market, websocket, V1, exchange keys, or trading.
- Scenario switching is deterministic through `scenarioId`.
- Same scenario input returns the same canonical DTO output.

## Scenario switching

All endpoints accept:

```text
?scenarioId=<SCENARIO_ID>
```

or header:

```text
x-core-scenario-id: <SCENARIO_ID>
```

Unknown scenario IDs fall back to:

```text
HEALTHY_TRUSTED_READY
```

## Endpoint list

### `GET /core/status`

Returns current machine pulse/status for the selected scenario.

Schema:

```ts
CoreStatusResponse
```

Contains:

- adapter metadata;
- `MachinePulseDTO`;
- adapter-compatible `machine`;
- available scenario IDs;
- endpoint list.

### `GET /core/trace/latest`

Returns the latest adapter-compatible computation trace for the selected scenario.

Schema:

```ts
AdapterCompatibleComputationTraceResponse
```

Contains canonical `ComputationTraceDTO` fields plus frontend APIAdapter compatibility fields:

- `machine`;
- `event`;
- `adapterMeta`.

### `GET /core/trust/report`

Returns trust summary derived from the selected canonical trace.

Schema:

```ts
CoreTrustReportResponse
```

Contains:

- trust state;
- trading allowed flag;
- runtime mode;
- blocking reasons;
- ActionGate verdict DTO if present.

### `GET /core/integrity/report`

Returns deterministic integrity and causality summary for the selected trace.

Schema:

```ts
CoreIntegrityReportResponse
```

Contains:

- integrity status;
- snapshot hash;
- previous snapshot hash;
- event hash;
- transition hash;
- causality fields.

### `GET /core/revisions/timeline`

Returns deterministic revision timeline based on snapshot diff.

Schema:

```ts
CoreRevisionTimelineResponse
```

Contains:

- `SnapshotDiffDTO`;
- before/after revisions;
- before/after snapshot hashes.

### `GET /core/market-input/status`

Returns market input integrity summary.

Schema:

```ts
CoreMarketInputStatusResponse
```

Contains:

- `MarketInputIntegrityDTO`.

### `GET /core/recovery`

Returns recovery hints from the selected trace.

Schema:

```ts
CoreRecoveryResponse
```

Contains:

- whether recovery is required;
- `RecoveryHintDTO[]`.

### `GET /core/quarantine`

Returns quarantine records from the selected trace.

Schema:

```ts
CoreQuarantineResponse
```

Contains:

- quarantine count;
- `QuarantineRecordDTO[]`.

## Compatibility alias

### `GET /api/core/computation-trace/latest`

Compatibility endpoint for the frontend `ApiAdapter`.

Returns:

```ts
AdapterCompatibleComputationTraceResponse
```

The response includes root-level `machine`, `event`, and `pipeline`, matching the adapter expectation.

## Contract files

```text
core/contracts/ui/core-api-contracts.ts
core/ui-api/connected-readonly-core-api.ts
```

## Explicit non-goals

This API does not:

- open websocket authority;
- connect V1;
- connect live market;
- place orders;
- execute recovery;
- mutate snapshot;
- bypass ActionGate;
- calculate trust in UI.
