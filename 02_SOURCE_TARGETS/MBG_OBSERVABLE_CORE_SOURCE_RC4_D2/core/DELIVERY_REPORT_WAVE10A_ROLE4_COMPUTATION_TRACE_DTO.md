# Delivery Report — Wave 10A Role 4: Canonical ComputationTrace DTO

## Role

Role 4 — Contracts / Reducer / DTO.

## Base

`mbg-core-v0.1-alpha8.zip`

## Scope

Created canonical UI DTO contracts for a mock-first Connected Observable Core Machine.

This delivery is contract-only. It does not add websocket authority, V1, execution, trading, order placement, UI controls, layout semantics, or frontend-side trust computation.

## Added / changed files

- `core/contracts/ui/computation-trace-dto.ts`
- `core/contracts/ui/index.ts`
- `core/contracts/src/ui.ts`
- `core/ui-api/mock-scenarios.ts`
- `tests/scenarios/wave10a-computation-trace-dto.ts`
- `package.json`

## DTO contracts added

- `ComputationTraceDTO`
- `MachinePulseDTO`
- `PipelineStepDTO`
- `FormulaExplanationDTO`
- `RuleEvaluationDTO`
- `SnapshotDiffDTO`
- `GateVerdictDTO`
- `LedgerRecordDTO`
- `QuarantineRecordDTO`
- `RecoveryHintDTO`
- `MarketInputIntegrityDTO`
- `ProvenanceDTO`

## Mock scenario contracts added

- `HEALTHY_TRUSTED_READY`
- `EXCHANGE_TRUTH_UNKNOWN_DENY`
- `MARKET_INPUT_UNKNOWN_DENY`
- `MARKET_INPUT_STALE_DENY`
- `MARKET_INPUT_GAP_DENY`
- `DUPLICATE_EVENT_IDEMPOTENT`
- `INVALID_EVENT_QUARANTINE`
- `MISSING_PROVENANCE_DENY`
- `PROVENANCE_MISMATCH_COMPROMISE`
- `SNAPSHOT_HASH_MISMATCH`
- `REPLAY_MISMATCH_BLOCK`
- `RECOVERY_ONLY_MODE`
- `CANCEL_REDUCE_ONLY_ALLOWED`
- `VALID_OBSERVATION_NO_PERMISSION`
- `FULL_READY_GATE_DECIDES`

## Public exports

- `core/contracts/ui/index.ts`
- `core/contracts/src/ui.ts`
- `core/ui-api/mock-scenarios.ts`

## Semantic notes

- UI observes; Core decides.
- DTOs expose core decisions and evidence, not UI state.
- DTOs do not encode layout, theme, component, websocket, execution, or trading authority.
- Mock scenario payloads are deterministic and adapter-safe.
- `VALID_OBSERVATION_NO_PERMISSION` explicitly shows that valid market observation does not grant permission.
- `FULL_READY_GATE_DECIDES` explicitly shows that ActionGate remains the final action enforcement surface.
- DTO timestamps use `*FromEvent` fields to preserve replay determinism.

## Tests added

- `tests/scenarios/wave10a-computation-trace-dto.ts`

## Script added

- `npm run test:core:computation-trace-dto`

## Commands run

- `npm ci --ignore-scripts` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS
- `npm run test:core:computation-trace-dto` — PASS

## Replay-safety note

The DTO layer uses deterministic mock payloads and canonical DTO stringify. It does not use `Date.now()`, `Math.random()`, websocket state, runtime memory, or external services to build scenario payloads.

## Known limitations

- This task does not implement an HTTP API endpoint.
- This task does not connect the frontend reference package.
- This task does not subscribe to runtime events.
- This task does not change ActionGate, trust logic, reducers, persistence, or runtime behavior.
- This task does not include UI layout or display semantics.
