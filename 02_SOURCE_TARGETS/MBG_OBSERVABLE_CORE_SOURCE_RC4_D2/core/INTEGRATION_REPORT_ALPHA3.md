# INTEGRATION_REPORT_ALPHA3

## Status

`mbg-core-v0.1-alpha3` integration is complete.

Canonical base: `mbg-core-v0.1-alpha2.zip`

Integration owner: role 8 / Integration Owner / Merge Engineer.

## Inputs merged

- Role 2.3 — Constitution Update.
- Role 4.3 — ExchangeTruth Domain.
- Role 5.3 — Freshness Guard.
- Role 6.3 — Health Truth Cleanup.
- Role 7.3.1 — Wave 3 Scenario Audit v2.

## Scope boundaries

No V1, V2, Signal Layer, Decision Engine, UI, strategy logic, live trading, real exchange keys, Kernel Authority or CoreTrustReport module was added.

Existing base files outside the Wave 3 scope were preserved unless required by semantic integration.

## Constitution source

`CORE_CONSTITUTION.md` and `core/kernel/kernel-constitution.ts` were taken from Role 2.3 only.

Constitution changes from other roles were not accepted directly.

## Semantic merge decisions

### Alpha3 readiness model

Wave 3 expands normal trading readiness.

Normal trading / `PLACE_ORDER` requires:

- bootstrap reconciled;
- position reconciled;
- exchangeTruth fresh;
- market data fresh;
- freshness guard OK;
- health truth acceptable;
- websocket/connection truth connected;
- ActionGate allow.

Tests that previously expected allow after bootstrap reconcile were updated to establish fresh exchange truth, fresh market data and truthful healthy connection state before expecting ActionGate allow.

### Runtime audit readiness

Alpha3 updates runtime audit readiness model. Runtime audit must establish fresh exchange truth, fresh market data and acceptable health truth before expecting ActionGate allow or pending order state.

### Health Truth

Wave3 Health Truth makes unknown/stale/false connection state non-healthy. Allow scenarios must explicitly establish acceptable health truth before expecting ActionGate allow.

`clearPersistenceAndReset()` now resets websocketTruth / health truth / connection truth so connection state cannot leak between scenarios.

### ExchangeTruth + Freshness

ExchangeTruth domain from Role 4 is the source of exchange truth.

Freshness Guard from Role 5 calculates exchange freshness from exchangeTruth timestamps/status and connection freshness from Health Truth.

Freshness Guard was not disabled.

ExchangeTruth is not fresh by default.

`wsConnected` is not true by default.

ActionGate does not allow without exchangeTruth and health truth.

## Final event commit pipeline

The alpha2 pipeline remains intact:

```text
validate event
→ idempotency check
→ append journal
→ record idempotency
→ reduce snapshot
```

Invalid event:

```text
no journal
no snapshot mutation
no idempotency mutation
```

Duplicate event:

```text
no journal
no snapshot mutation
revision unchanged
```

## Conflicts and resolutions

### `runtime-engine.ts`

Conflict: Roles 4/5/6 all changed runtime state, ActionGate inputs, health snapshot and reset/replay semantics.

Resolution: semantic merge preserving alpha2 validation/idempotency pipeline while adding:

- ExchangeTruth state reduction;
- Freshness Guard inputs;
- Health Truth snapshot;
- websocketTruth tracking;
- reset cleanup for connection truth;
- ActionGate freshness enforcement.

### `action-gate.ts`

Conflict: Bootstrap gating from alpha2 needed to coexist with ExchangeTruth, Freshness and Health Truth gates.

Resolution: bootstrap denial remains first readiness block where applicable; after bootstrap/position reconcile, normal trading is additionally blocked by exchangeTruth/freshness/health reasons.

### `package.json`

Conflict: Roles added separate test scripts and verify requirements.

Resolution: package scripts include all alpha2 and alpha3 tests. `npm run verify` runs the complete alpha3 scope.

### Tests and runtime audit

Conflict: alpha2 tests/audit expected allow after bootstrap/position reconcile.

Resolution: tests were updated to the alpha3 readiness model; the system was not weakened to satisfy old expectations.

## Package scripts included

- `verify`
- `test:core-constitution`
- `test:core:cold-start`
- `test:core:bootstrap`
- `test:core:event-validation`
- `test:core:idempotency`
- `test:wave2:scenario-audit`
- `test:core:exchange-truth`
- `test:core:freshness`
- `test:core:health-truth`
- `test:wave3:scenario-audit`
- `audit:runtime`

## Verification results

All required checks passed.

```text
npm ci: PASS
npm run typecheck: PASS
npm test: PASS
npm run test:core-constitution: PASS
npm run test:core:cold-start: PASS
npm run test:core:bootstrap: PASS
npm run test:core:event-validation: PASS
npm run test:core:idempotency: PASS
npm run test:wave2:scenario-audit: PASS
npm run test:core:exchange-truth: PASS
npm run test:core:freshness: PASS
npm run test:core:health-truth: PASS
npm run test:wave3:scenario-audit: PASS 10/10
npm run audit:runtime: PASS
npm run verify: PASS (exit code 0)
```

Final `npm run verify` was executed after updating package metadata to `mbg-core-v0.1-alpha3` / `1.0.3`.

## Safety confirmation

Confirmed:

- Freshness Guard was not disabled.
- ExchangeTruth is not fresh by default.
- `wsConnected` is not true by default.
- ActionGate does not allow without ExchangeTruth.
- ActionGate does not allow without Health Truth.
- V1 was not added.
- V2 was not added.
- Signal Layer was not added.
- Decision Engine was not added.
- UI was not added.
- strategy logic was not added.
- live trading was not added.
- real exchange keys were not added.
- Kernel Authority / CoreTrustReport was not added.

## Changed file summary

Added:

- `DELIVERY_REPORT_WAVE3_EXCHANGE_TRUTH.md`
- `DELIVERY_REPORT_WAVE3_HEALTH_TRUTH.md`
- `DELIVERY_REPORT_WAVE3_SCENARIO_AUDIT_V2.md`
- `SCENARIO_AUDIT_WAVE3_HEALTH_TRUTH.md`
- `core/runtime/src/freshness.ts`
- `tests/scenarios/core-freshness.ts`
- `tests/scenarios/core-health-truth.ts`
- `tests/scenarios/exchange-truth.ts`
- `tests/scenarios/wave3-scenario-audit.ts`

Modified:

- `CORE_CONSTITUTION.md`
- `apps/runtime-api/src/app.ts`
- `core/contracts/src/events.ts`
- `core/events/validate-domain-event.ts`
- `core/gates/src/action-gate.ts`
- `core/kernel/kernel-constitution.ts`
- `core/runtime/src/runtime-engine.ts`
- `core/state/src/types.ts`
- `core/transitions/src/reducers.ts`
- `package-lock.json`
- `package.json`
- `tests/scenarios/audit-runtime.ts`
- `tests/scenarios/bootstrap-fsm.ts`
- `tests/scenarios/cold-start-unknown.ts`
- `tests/scenarios/core-constitution.test.mjs`
- `tests/scenarios/gate-scenarios.ts`
- `tests/scenarios/wave2-scenario-audit.ts`

Removed: none.
