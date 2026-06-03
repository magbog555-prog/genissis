# MBG Core v0.1 — Wave 2 Scenario Audit Delivery Report v3

Role: 7 — Scenario Audit / Test Owner  
Canonical base: `mbg-core-v0.1-alpha1-followup.zip`  
Target integration: `mbg-core-v0.1-alpha2` after Roles 4, 5, and 6 merge.

## Scope

This delivery updates the Wave 2 scenario audit to match the implemented boundaries from:

- Role 4: Bootstrap FSM events.
- Role 5: core-side `commitEventResult(event, { log: false })` validation API.
- Role 6: Event Idempotency diagnostics.

No runtime behavior, reducer behavior, ActionGate behavior, strategy logic, V1, Signal Layer, Decision Engine, UI, live trading, ExchangeTruth, Freshness Guard, Metadata-as-Events, or CoreTrustReport was changed.

`CORE_CONSTITUTION.md` was not modified. Test requirements are documented only in this delivery report.

## Changed files

```txt
package.json
tests/scenarios/wave2-scenario-audit.ts
DELIVERY_REPORT_WAVE2_SCENARIO_AUDIT_V3.md
```

## Added command

```bash
npm run test:wave2:scenario-audit
```

Command definition:

```bash
PERSISTENCE_ENABLED=false tsx tests/scenarios/wave2-scenario-audit.ts
```

## Scenario list

1. `bootstrap not reconciled -> PLACE_ORDER denied`
2. `failed bootstrap cannot transition to reconciled directly`
3. `invalid market tick rejected and no state change`
4. `duplicate market event is ignored without revision bump or canonical append`
5. `duplicate eventId conflict is rejected without state or journal mutation`
6. `duplicate fill is ignored and does not double PnL`
7. `duplicate reconcile is ignored without state or journal mutation`
8. `market tick alone does not allow trading`
9. `position reconciled but bootstrap not reconciled -> still denied`
10. `bootstrap reconciled + valid state -> allow only if ActionGate allows`

## Wave 2 coverage mapping

```txt
Bootstrap FSM:
- bootstrap not reconciled -> PLACE_ORDER denied
- failed bootstrap cannot transition to reconciled directly
- position reconciled but bootstrap not reconciled -> still denied
- bootstrap reconciled + valid state -> allow only if ActionGate allows

Event Validation:
- invalid market tick rejected and no state change
- failed bootstrap cannot transition to reconciled directly

Event Idempotency:
- duplicate market event -> duplicate_ignored
- duplicate eventId content conflict -> duplicate_conflict
- duplicate fill -> duplicate_ignored
- duplicate position reconcile -> duplicate_ignored

Combined Safety:
- market tick alone does not allow trading
- position reconciled but bootstrap not reconciled -> still denied
- bootstrap reconciled + valid state -> allow only if ActionGate allows
```

## Role 5 validation expectations

Invalid event scenarios now use only:

```ts
runtimeEngine.commitEventResult(event, { log: false })
```

They assert:

```txt
result.ok === false
snapshot.revision unchanged
snapshot unchanged
event not appended to canonical journal
```

They do not expect `throw` as the primary behavior.

## Role 6 idempotency expectations

Duplicate scenarios now assert the final idempotency diagnostic:

```txt
duplicate_ignored
duplicate_conflict
```

They also assert:

```txt
revision unchanged
snapshot unchanged
duplicate/conflict not appended as canonical
same eventId has exactly one canonical accepted journal entry
```

## Valid fill provenance

`validFill()` now includes provenance and validation fields expected by Role 5:

```txt
provider
source
executionId
fillId
tradeId
symbol
side
quantity
filledQuantity
filledQuantityDelta
fillPrice
price
exchangeStatus
commission
commissionAsset
reportedAt
```

The duplicate-fill scenario therefore tests idempotency/accounting protection, not validation failure.

## Bootstrap FSM events used

```txt
bootstrap.loading_snapshot
bootstrap.replaying_tail
bootstrap.awaiting_exchange_truth
bootstrap.reconciled
bootstrap.failed
```

`bootstrap.recovery_started` is not used in this scenario set because the required minimum scenarios do not exercise recovery flow. It remains a candidate for a dedicated recovery scenario if Role 4 exposes a recovery acceptance path.

## Expected alpha2 result

After Roles 4/5/6 are merged, the target result is:

```json
{
  "total": 10,
  "passed": 10,
  "failed": 0
}
```

## Local command results on available base

The available local package is still `mbg-core-v0.1-alpha1-followup`, not the merged alpha2 package.

```bash
npm install
```

Result: passed.

```bash
npm run typecheck
```

Result: passed.

```bash
npm run test:wave2:scenario-audit
```

Result on alpha1-followup: failed with `total=10`, `passed=1`, `failed=9`; not representative for alpha2 because the base does not contain the final Role 4/5/6 implementations. The suite is intentionally alpha2-targeted and requires:

```txt
runtimeEngine.commitEventResult(event, { log: false })
Bootstrap FSM events from Role 4
core validation from Role 5
idempotency diagnostics from Role 6
```

This is not a fail-by-design suite for alpha2. It is expected to pass on the merged alpha2 package.

## Risks and gaps

1. The exact concrete shape of the Role 6 result object was not available in the local alpha1 base. The test accepts diagnostics exposed as top-level `code/status/reason/diagnostic`, nested `diagnostic`, or nested `idempotency` fields, but the diagnostic value must be exactly `duplicate_ignored` or `duplicate_conflict`.

2. The suite checks the in-memory canonical journal through `runtimeEngine.getEvents(10000)`. If alpha2 stores canonical journal visibility elsewhere, Integration Owner may need to provide a read-only helper without changing core behavior.

3. The final ActionGate allow scenario assumes Role 4 exposes `bootstrap.reconciled` as the event that removes bootstrap denial when market and position are valid. If Role 4 names an additional ready state, the test should be adjusted to that published FSM contract.

4. `bootstrap.recovery_started` is documented but not asserted in this minimal scenario set.

## Intentionally not done

- Did not modify `CORE_CONSTITUTION.md`.
- Did not change runtime architecture.
- Did not change core behavior, reducers, validation, idempotency, persistence, or ActionGate.
- Did not add V1, Signal Layer, Decision Engine, strategies, UI, live trading, exchange keys, CoreTrustReport, ExchangeTruth, Freshness Guard, or Metadata-as-Events.
