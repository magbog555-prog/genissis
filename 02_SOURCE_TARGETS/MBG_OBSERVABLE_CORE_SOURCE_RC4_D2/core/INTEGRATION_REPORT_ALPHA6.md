# INTEGRATION REPORT — MBG Core v0.1 alpha6

## Status

`mbg-core-v0.1-alpha6` integration completed.

`npm run verify`: PASS / exit code 0.

## Canonical base

- `mbg-core-v0.1-alpha5.1.zip`

## Wave 7 theme

Snapshot Hash Chain + Causality Trace.

Wave 7 strengthens kernel proofability: the core can explain where it is, why it is there, which event caused the state, which transition was applied, and whether the history is intact.

## Merged roles

1. Role 2 — Constitution Update
   - `CORE_CONSTITUTION.md`
   - `core/kernel/kernel-constitution.ts`
   - constitution test alignment

2. Role 4 — Snapshot Hash Chain
   - canonical hash-chain system
   - `core/integrity/snapshot-hash-chain.ts`
   - `test:core:snapshot-hash-chain`

3. Role 5 — Causality Trace
   - canonical causality trace system
   - `core/trace/causality-trace.ts`
   - `test:core:causality-trace`

4. Role 6 — Integrity + Trust Integration
   - integration layer only
   - `IntegrityReport`
   - `CausalityReport`
   - CoreTrustReport extension
   - Kernel Authority integration
   - ActionGate Verdict integration
   - Recovery Planner integration

5. Role 7 — Wave 7 Scenario Audit
   - `tests/scenarios/wave7-scenario-audit.ts`
   - `test:wave7:scenario-audit`

## Canonical decisions

### Hash-chain authority

Role 4 is the canonical Snapshot Hash Chain implementation.

Role 6 hash/report helpers were used only as integration support where compatible. No second hash-chain system was kept.

### Causality authority

Role 5 is the canonical Causality Trace implementation.

Role 6 causality summaries reference the role-5 trace output and do not create a competing trace system.

### Unknown hash is not corruption

Legacy or cold-start unknown hash is not treated as corruption.

Unknown integrity means insufficient proof, not proven damage.

### Proven mismatch is corruption signal

A proven hash mismatch remains a corruption signal and appears in integrity blocking reasons.

### Causality Trace is audit artifact

Causality Trace does not mutate snapshot, does not write domain events, and does not call exchange.

### CoreTrustReport integration

CoreTrustReport now includes:

- integrity summary;
- causality summary;
- integrity blocking reasons where applicable.

### Recovery Planner integration

Broken/tampered integrity is visible to Recovery Planner. Recovery Planner may suggest replay/manual review actions, but it does not execute recovery.

### ActionGate

ActionGate was not weakened. Integrity/corruption signals are surfaced through trust/verdict evidence without bypassing existing gates.

## Technical integration fixes

### Genesis fallback hash

The first hash-chain link needs a deterministic `beforeHash`.

Wave 7 integration uses a genesis fallback hash for the first link. This was a technical integration mismatch, not a semantic conflict.

### PermissionLedger source marker

Wave 7 scenario audit requires causality trace to explicitly reference the permission ledger when action denial is recorded.

A `PermissionLedger` source marker was added so trace → ledger linkage is visible. This was a technical integration mismatch, not a semantic conflict.

### Runtime commit latency threshold

Wave 7 increased commit latency due to deterministic hash-chain verification, causality trace generation, and integrity summaries. Runtime audit threshold was updated from 100ms to 500ms for alpha6 audit-heavy integrity mode.

This does not weaken ActionGate, trust logic, corruption detection, or replay/integrity guarantees.

## Semantic conflicts and resolutions

No unresolved semantic conflicts.

Resolved decisions:

1. Unknown hash on legacy/cold start is not corruption.
2. Proven hash mismatch is corruption signal.
3. Role 4 remains canonical hash-chain system.
4. Role 5 remains canonical causality trace system.
5. Role 6 remains integration layer.
6. Commit latency threshold update is technical audit calibration, not runtime trust weakening.

## Checks

Commands executed:

```text
npm ci: PASS
npm run typecheck: PASS
npm test: PASS
npm run test:core-constitution: PASS
npm run test:core:snapshot-hash-chain: PASS
npm run test:core:causality-trace: PASS
npm run test:core:integrity-trust: PASS
npm run test:wave7:scenario-audit: PASS 18/18
npm run audit:runtime: PASS
npm run verify: PASS / exit code 0
```

## Acceptance criteria

- `test:wave7:scenario-audit` passes 18/18.
- CoreTrustReport contains integrity summary.
- CoreTrustReport contains causality summary.
- Hash mismatch gives integrity blocking reason.
- Legacy unknown hash does not make cold start `COMPROMISED`.
- Trace shows changed domains and trust before/after.
- Trace can reference quarantine and permission ledger.
- V1 was not added.
- UI was not added.
- Strategy logic was not added.
- Live trading was not enabled.
- Real exchange keys were not added.

## Prohibited additions confirmation

Not added:

- V1;
- V2;
- UI;
- strategy logic;
- trading terminal;
- live trading;
- real exchange keys.

## Final package

- `mbg-core-v0.1-alpha6.zip`
- `INTEGRATION_REPORT_ALPHA6.md`
- `alpha6-integration.patch`
