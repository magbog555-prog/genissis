# INTEGRATION_REPORT_ALPHA8

## Summary

Wave 9 — Market Input Integrity semantic integration completed.

Base package used:

```text
mbg-core-v0.1-alpha7.zip
```

Target package produced:

```text
mbg-core-v0.1-alpha8.zip
```

Roles integrated:

- Role 2 — CORE_CONSTITUTION / Wave 9 laws.
- Role 4 — MarketInputObservation, `market.input.*` contracts, validation, reducer domain, idempotency.
- Role 5 — CausalityTrace market input visibility.
- Role 6 — marketInputStatus, CoreTrustReport, IntegrityReport, ActionGate policy, RecoveryPlanner hints.
- Role 7 — Wave 9 scenario audit.

## Role 2 Constitution Integration

Wave 9 laws integrated.

Role 2 constitution delivery integrated.

Role 0 follow-up fixes applied:
- Base code corrected to `mbg-core-v0.1-alpha7`.
- Wave 9 market input integrity semantics added to CORE_CONSTITUTION.
- No V1/live/execution/UI permission added.

## Semantic Decisions

- Market input is not truth by default.
- Market input must be validated before state mutation.
- Market input must carry provenance and payload hash.
- Freshness is explicit, never assumed.
- Sequence gaps and stale observations block market trust.
- Duplicate market input is idempotent.
- Unknown market input is not corruption by default.
- Valid market input alone does not grant permission.
- Market input cannot override other blockers.
- CausalityTrace is read-only and exposes market input evidence without becoming a source of truth.
- CoreTrustReport exposes `marketInputStatus` and `marketInputBlockingReasons`.
- ActionGate denies risk-increasing actions when market input is unknown, stale, gapped, invalid, unverifiable, or checksum-mismatched.
- Recovery/cancel/reduce-only actions remain available.

## Legacy Fixture Fixes

Legacy Wave 4 full-ready fixture updated with valid market input observation required by Wave 9.

Additional legacy readiness fixtures updated where needed so pre-Wave-9 “full ready” states include complete market input integrity evidence rather than weakening Wave 9 policy:
- recovery planner trusted fixture;
- runtime audit ready-state fixture.

`MARKET_INPUT_UNKNOWN` remains a valid blocker.

## Files Changed

Primary changed areas:
- `CORE_CONSTITUTION.md`
- `package.json`
- `core/contracts/src/actions.ts`
- `core/contracts/src/events.ts`
- `core/events/validate-domain-event.ts`
- `core/market-input/*`
- `core/state/src/types.ts`
- `core/transitions/src/reducers.ts`
- `core/runtime/src/idempotency.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/trace/causality-trace.ts`
- `core/integrity/integrity-report.ts`
- `core/kernel/core-trust-report.ts`
- `core/kernel/kernel-authority.ts`
- `core/gates/src/action-gate.ts`
- `core/recovery/recovery-planner.ts`
- `tests/scenarios/wave9-market-input-contracts.ts`
- `tests/scenarios/wave9-market-input-causality.ts`
- `tests/scenarios/wave9-market-input-trust.ts`
- `tests/scenarios/wave9-market-input-integrity-audit.ts`
- legacy fixture updates in Wave 2/3/4/freshness/kernel/action-gate/recovery/runtime tests.

## Conflicts Found

- Legacy Wave 4 “full ready state -> TRUSTED” fixture lacked Wave 9 market input evidence and returned `UNCERTAIN` due to `MARKET_INPUT_UNKNOWN`.
- Recovery planner trusted fixture lacked Wave 9 market input evidence.
- Runtime audit ready-state fixture attempted order placement without market input evidence and was denied by `MARKET_INPUT_UNKNOWN`.
- Role 6 market-input policy initially risked blocking legacy paths without an active market-input report; final behavior preserves Wave 8 compatibility while enforcing Wave 9 when market-input integrity is active.

## Conflicts Resolved

- Added valid `market.input.observed` fixtures to legacy ready-state tests.
- Preserved `MARKET_INPUT_UNKNOWN` as a blocker.
- Did not weaken market input policy.
- Did not make market input trusted or fresh by default.
- Did not allow valid market input to grant permission by itself.
- Kept canonical Wave 7 hash-chain and causality ownership.

## Conflicts Escalated

None.

## Tests Run

The following commands were run during integration/finalization:

```bash
npm ci
npm run typecheck
npm test
npm run test:core-constitution
npm run test:core:metadata-events
npm run test:wave8:causality-provenance
npm run test:core:provenance-trust
npm run test:wave8:scenario-audit
npm run test:core:snapshot-hash-chain
npm run test:core:causality-trace
npm run test:core:integrity-trust
npm run test:wave7:scenario-audit
npm run test:core:market-input-contracts
npm run test:wave9:market-input-causality
npm run test:core:market-input-trust
npm run test:wave9:scenario-audit
npm run audit:runtime
npm run verify
```

Final required verification:

```text
npm run verify — PASS
npm run test:wave9:scenario-audit — 18/18 PASS
npm run test:wave7:scenario-audit — 18/18 PASS
npm run test:wave4:scenario-audit — 10/10 PASS
```

Verify output is included as `verify-output-alpha8.txt`.

## Verify Result

```text
PASS
```

## Acceptance Criteria

- Wave 9 laws integrated.
- Base corrected to alpha7 in CORE_CONSTITUTION.
- MarketInputObservation canonical.
- `market.input.*` events canonical.
- Validation before mutation.
- Duplicate input idempotent.
- Gap detected.
- Stale detected.
- Missing provenance blocks/rejects input.
- payloadHash required.
- CausalityTrace exposes market input integrity.
- CoreTrustReport exposes marketInputStatus.
- ActionGate denies risk on unsafe market input.
- Valid market input alone does not grant permission.
- Recovery/cancel/reduce-only preserved.
- Replay preserves market input state.
- Wave 9 audit 18/18 PASS.
- npm run verify PASS.
- No V1/websocket/live/execution/UI leak.

## Red-Line Preservation Statement

ActionGate not weakened.

Replay determinism preserved.

unknown hash != corruption preserved.

unknown provenance != corruption preserved.

unknown market input != corruption preserved.

valid market input alone does not grant permission.

market input not fresh by default.

market input not trusted by default.

No V1 integration added.

No websocket added.

No live trading added.

No execution added.

No UI controls added.

No duplicate hash-chain / causality / provenance / market-input system.

No second source of truth introduced.

## Known Follow-ups

None required for alpha8 canonical acceptance.
