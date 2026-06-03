# Delivery Report — Wave 10B / Connected Read-only Core API

Role: Role 4 — Contracts / Reducer / DTO  
Base: `mbg-core-v0.1-alpha9.zip`

## Summary

Implemented a mock-first connected read-only Core API surface for the Observable Core Machine.

The API exposes deterministic, canonical DTO responses for UI/APIAdapter consumption without adding websocket authority, V1, market connection, execution, trading, exchange keys, or order placement.

## Added API surface

Endpoints:

```text
GET /core/status
GET /core/trace/latest
GET /core/trust/report
GET /core/integrity/report
GET /core/revisions/timeline
GET /core/market-input/status
GET /core/recovery
GET /core/quarantine
```

Compatibility endpoint:

```text
GET /api/core/computation-trace/latest
```

Scenario catalog endpoint:

```text
GET /api/core/scenarios
```

## Scenario switching

All endpoints support deterministic scenario switching by:

```text
?scenarioId=<SCENARIO_ID>
x-core-scenario-id: <SCENARIO_ID>
```

Unknown scenario IDs fall back to:

```text
HEALTHY_TRUSTED_READY
```

## API contracts

Added:

```text
core/contracts/ui/core-api-contracts.ts
CORE_READONLY_API_CONTRACTS.md
```

Main response contracts:

```text
AdapterCompatibleComputationTraceResponse
CoreStatusResponse
CoreTrustReportResponse
CoreIntegrityReportResponse
CoreRevisionTimelineResponse
CoreMarketInputStatusResponse
CoreRecoveryResponse
CoreQuarantineResponse
```

## Implementation

Added:

```text
core/ui-api/connected-readonly-core-api.ts
```

The implementation provides:

- deterministic response builders;
- read-only Express router;
- read-only Express app factory;
- adapter-safe response structure;
- MockAdapter/APIAdapter compatibility;
- canonical JSON stringification for deterministic output.

## Tests added

```text
tests/scenarios/wave10b-connected-readonly-core-api.ts
```

Script added:

```text
npm run test:core:connected-readonly-api
```

The test validates:

- DTO schema validation;
- endpoint response builders;
- deterministic output for all canonical endpoints;
- scenario switching;
- APIAdapter-compatible `/api/core/computation-trace/latest`;
- read-only HTTP route behavior.

## Commands run

```text
npm ci --ignore-scripts
PASS

npm run typecheck
PASS

npm test
PASS

npm run test:core:connected-readonly-api
PASS
```

## Changed files

```text
CORE_READONLY_API_CONTRACTS.md
core/contracts/ui/core-api-contracts.ts
core/contracts/ui/index.ts
core/ui-api/connected-readonly-core-api.ts
core/ui-api/index.ts
package.json
tests/scenarios/wave10b-connected-readonly-core-api.ts
```

## Semantic notes

- UI observes; Core decides.
- API responses expose Core DTO evidence and do not create authority.
- `machine`, `event`, and `adapterMeta` are compatibility projections for APIAdapter.
- Canonical computation trace remains the source payload.
- Same scenario produces the same DTO output.
- Scenario switching is mock-first and read-only.

## Known limitations

- This is mock-first only.
- No live Core runtime wiring is added.
- No websocket authority is added.
- No V1/V2 integration is added.
- No live market connection is added.
- No execution/trading/order placement is added.
- No UI controls or frontend state are added.
