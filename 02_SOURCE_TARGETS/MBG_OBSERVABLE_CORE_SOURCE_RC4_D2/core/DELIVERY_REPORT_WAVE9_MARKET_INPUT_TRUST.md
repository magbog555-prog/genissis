# Role 6 Delivery Report — Wave 9 Market Input Integrity Trust Integration

## Scope

Role 6 integrated market input integrity semantics into the trust/report/gate/recovery layer over the alpha7 canonical base.

Touched areas:

- Kernel Authority
- CoreTrustReport
- IntegrityReport
- ActionGate
- Recovery Planner

No V1 live integration, exchange websocket connection, API keys, execution, UI controls, trading terminal, strategy logic, or live trading were added.

## Trust rules

- Market input is not truth by default.
- Risk-increasing actions require valid market input integrity.
- Unknown market input blocks risk-increasing actions but is not corruption by default.
- Stale market input blocks risk-increasing actions.
- Gap-detected market input blocks risk-increasing actions.
- Invalid/unverifiable market input blocks risk-increasing actions.
- Duplicate market input cannot create allow.
- Valid market input alone does not grant permission.
- Market input cannot override position, order, risk, exchange truth, health, replay, integrity, provenance or ActionGate blockers.
- Proven checksum mismatch is critical evidence and may move trust to `COMPROMISED`.

## Added report semantics

`CoreTrustReport` now includes:

- `marketInputStatus`
- `marketInputBlockingReasons`
- `marketInput`

`IntegrityReport` can carry:

- `marketInputStatus`
- `marketInputBlockingReasons`

Market input statuses:

- `unknown`
- `valid`
- `stale`
- `duplicate`
- `gap_detected`
- `checksum_mismatch`
- `invalid`
- `unverifiable`

Blocking reasons:

- `MARKET_INPUT_UNKNOWN`
- `MARKET_INPUT_MISSING_PROVENANCE`
- `MARKET_INPUT_STALE`
- `MARKET_INPUT_GAP`
- `MARKET_INPUT_DUPLICATE`
- `MARKET_INPUT_INVALID`
- `MARKET_INPUT_CHECKSUM_MISMATCH`
- `MARKET_INPUT_UNVERIFIABLE`

## ActionGate verdict examples

Risk-increasing action with unknown market input:

```json
{
  "actionType": "place_order",
  "decision": "deny",
  "marketInputStatus": "unknown",
  "marketInputBlockingReasons": ["MARKET_INPUT_UNKNOWN"],
  "blockingReasons": ["MARKET_INPUT_UNKNOWN"]
}
```

Risk-increasing action with sequence gap:

```json
{
  "actionType": "place_order",
  "decision": "deny",
  "marketInputStatus": "gap_detected",
  "marketInputBlockingReasons": ["MARKET_INPUT_GAP"]
}
```

Cancel/recovery with unknown market input remains available when no other gate rule blocks it:

```json
{
  "actionType": "cancel_order",
  "decision": "allow",
  "actionClass": "RISK_REDUCING",
  "marketInputStatus": "unknown"
}
```

Valid market input alone does not grant allow:

```json
{
  "actionType": "place_order",
  "marketInputStatus": "valid",
  "decision": "deny",
  "blockingReasons": ["bootstrap_not_reconciled"]
}
```

## Recovery hints

Added recovery action types:

- `WAIT_FOR_FRESH_MARKET_INPUT`
- `RUN_MARKET_REPLAY_CHECK`
- `RESYNC_MARKET_INPUT`
- `QUARANTINE_INVALID_MARKET_INPUT`

Mappings:

- `MARKET_INPUT_UNKNOWN` → wait for fresh input, resync market input
- `MARKET_INPUT_STALE` → wait for fresh input, resync market input
- `MARKET_INPUT_GAP` → run market replay check, resync market input
- `MARKET_INPUT_DUPLICATE` → run market replay check, resync market input
- `MARKET_INPUT_INVALID` → run market replay check, quarantine invalid input, manual review
- `MARKET_INPUT_CHECKSUM_MISMATCH` → run market replay check, quarantine invalid input, manual review
- `MARKET_INPUT_UNVERIFIABLE` → run market replay check, quarantine invalid input, manual review
- `MARKET_INPUT_MISSING_PROVENANCE` → attach provenance, resync market input

## Tests added

Added scenario:

- `tests/scenarios/wave9-market-input-trust.ts`

Added script:

- `npm run test:core:market-input-trust`

Covered scenarios:

1. unknown market input denies risk;
2. stale input denies risk;
3. gap denies risk;
4. invalid denies risk;
5. valid input alone does not grant allow;
6. recovery/cancel/reduce-only remain available;
7. unknown input is not corruption;
8. checksum mismatch can compromise trust if proven;
9. GateVerdict contains market input evidence;
10. CoreTrustReport contains market input status;
11. RecoveryPlanner suggests correct market input recovery path;
12. integration does not mutate snapshot during gate/report checks.

## Commands run

- `npm ci --ignore-scripts`
- `npm run typecheck`
- `npm test`
- `npm run test:core:market-input-trust`

All required commands exited with code 0 in the local task workspace.

## Semantic note — why ActionGate is not weakened

ActionGate is stricter after this change. A new blocker is added for risk-increasing actions when market input integrity is not valid. No rule was added that grants permission based only on valid market input. Valid market input is necessary for risk-increasing actions, but never sufficient. Existing bootstrap, exchange truth, freshness, health truth, position, order, risk, replay, integrity, provenance and ActionGate checks still apply.

Recovery, cancel and reduce-only classes are not falsely blocked by market input integrity gaps, preserving safe recovery paths.

## Known limitations

- This task does not implement market event contract validation itself.
- This task does not implement sequence/gap detection mechanics.
- This task does not implement checksum calculation for market observations.
- This task does not implement live V1 or exchange websocket ingestion.
- This task does not mutate reducers or Wave 7 hash-chain / causality ownership.
- This task consumes market input integrity evidence when supplied or derived by runtime, but does not create a second source of truth.
