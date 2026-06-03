# Delivery Report — Wave 7 Scenario Audit

Role: 7 — Scenario Audit / Test Owner / Canonical Audit

Canonical base: `mbg-core-v0.1-alpha5.1`

Target: post-integration Wave 7 canonical build

## Scope

This delivery adds scenario-audit coverage for Wave 7:

- Snapshot Hash Chain — цепочка хэшей снимков.
- Causality Trace — причинный след.
- Integrity summary integration into CoreTrustReport.
- Recovery guidance for broken integrity.
- Canonical boundary check that V1/V2/UI/strategy/live trading are not added.

The audit does not implement runtime architecture and does not mutate runtime behavior.

## Files changed

```txt
package.json
tests/scenarios/wave7-scenario-audit.ts
DELIVERY_REPORT_WAVE7_SCENARIO_AUDIT.md
```

## Added script

```bash
npm run test:wave7:scenario-audit
```

The script runs:

```bash
npm run typecheck && tsx tests/scenarios/wave7-scenario-audit.ts
```

## Scenarios covered

```txt
1. accepted event produces eventHash
2. accepted event produces snapshotHash
3. transition links beforeHash, eventHash, afterHash
4. changed snapshot changes snapshotHash
5. revision gap fails hash-chain verification
6. legacy unknown hash does not mark cold start as COMPROMISED
7. proven hash mismatch creates integrity blocking reason
8. accepted event produces causality trace
9. causality trace captures changed domains
10. causality trace captures trustState before/after
11. rejected event references quarantine in trace
12. denied action references permission ledger in trace
13. CoreTrustReport exposes integrity summary
14. CoreTrustReport exposes causality summary
15. broken integrity suggests recovery actions
16. trace is read-only and does not mutate snapshot
17. hash-chain verification is deterministic
18. no V1/UI/strategy/live trading added
```

## Expected Wave 7 runtime surfaces

The audit intentionally expects real core surfaces, not local stubs. It accepts any approved equivalent among these names:

### Hash chain / integrity

```txt
getHashChainView()
getSnapshotHashChainView()
getSnapshotHashChain()
getHashChain()
getIntegrityView()
verifyHashChain()
verifySnapshotHashChain()
verifyIntegrity()
```

### Causality trace

```txt
getCausalityTrace()
getCausalityTraceView()
getCausalityView()
getTrace()
```

### Existing surfaces reused

```txt
commitEventResult(event, { log: false })
getCoreTrustReport()
getRecoveryPlan() / getRecoveryPlannerView() / getRecoverySuggestions() / planRecovery()
getPermissionLedgerView() / getPermissionLedger() / getPermissionsLedgerView()
evaluateAction() / dispatchAction()
```

## Commands run on alpha5.1

```bash
npm run typecheck
```

Result: passed.

```bash
npm test
```

Result: passed.

```bash
npm run test:wave7:scenario-audit
```

Result on alpha5.1: failed on expected Wave 7 implementation gaps.

Observed alpha5.1 result:

```json
{
  "name": "wave7_scenario_audit",
  "total": 18,
  "passed": 2,
  "failed": 16
}
```

The passing scenarios are those covered by pre-existing alpha5.1 boundaries: cold-start trust is not COMPROMISED, and forbidden active V1/UI/strategy/live-trading wiring is absent. Wave 7 hash-chain and causality surfaces are not implemented in alpha5.1 yet.

## Expected result after Wave 7 integration

```json
{
  "name": "wave7_scenario_audit",
  "total": 18,
  "passed": 18,
  "failed": 0
}
```

## Risks and gaps

- The final Wave 7 API names must be aligned with one of the approved expected surfaces above, or the scenario audit must be updated by Role 7 after integration review.
- Revision-gap and hash-mismatch verification require an explicit verification input or diagnostic mode. The audit does not mutate canonical runtime state to create corruption.
- Causality trace must cover both accepted events and rejected/denied paths by referencing Quarantine and Permission Ledger.
- CoreTrustReport must expose integrity and causality summaries so frontend code does not infer integrity from raw flags.

## Intentionally not done

```txt
CORE_CONSTITUTION.md was not changed.
Runtime behavior was not changed.
ActionGate logic was not changed.
Kernel Authority logic was not changed.
Recovery Planner behavior was not changed.
Quarantine behavior was not changed.
Permission Ledger behavior was not changed.
V1/V2 were not connected.
UI was not added.
Strategy logic was not added.
Trading terminal was not added.
Live trading was not enabled.
Real exchange keys were not added.
Real exchange calls were not added.
```
