# Delivery Report — Wave 4 / Role 5 — CoreTrustReport

Canonical base: `mbg-core-v0.1-alpha3.zip`

Role: Role 5  
Task: CoreTrustReport / отчёт доверия ядра

## Summary

Implemented a read-only CoreTrustReport structure and builder as the unified core trust answer. The report aggregates current runtime evidence and explains whether normal trading is allowed, why it is blocked, which action classes are allowed, and what recovery actions are suggested.

CoreTrustReport does not execute recovery, call an exchange, connect V1/V2, add strategy logic, mutate reducers, or change snapshot state.

## Files changed

- `core/kernel/core-trust-report.ts`
- `core/runtime/src/runtime-engine.ts`
- `tests/scenarios/core-trust-report.ts`
- `package.json`
- `CORE_CONSTITUTION.md`
- `DELIVERY_REPORT_WAVE4_CORE_TRUST_REPORT.md`

## Implemented

- Added `CoreTrustReport` type.
- Added `BlockingReason` type with:
  - `code`
  - `domain`
  - `severity`
  - `message`
  - `evidence`
- Added `AllowedActionClass`:
  - `NORMAL`
  - `RISK_REDUCING`
  - `RECOVERY`
  - `DIAGNOSTIC`
  - `ADMIN`
  - `NONE`
- Added `buildCoreTrustReport()`.
- Added `RuntimeEngine.getCoreTrustReport()`.
- Report includes:
  - `revision`
  - `trustState`
  - `runtimeMode`
  - `tradingAllowed`
  - `allowedActionClasses`
  - `blockingReasons`
  - `nextRecoveryActions`
  - `bootstrap`
  - `exchangeTruth`
  - `freshness`
  - `healthTruth`
  - `replay`
  - `invariants`
  - `metadata`
  - `lastEvent`
  - `lastTransition`

## Read-only behavior

The report builder is read-only. It composes current snapshot/runtime evidence and gate decisions. It does not append events, call reducers, mutate snapshot, perform recovery, or call a real exchange.

## New script

```bash
npm run test:core:trust-report
```

## Command results

```text
npm run typecheck
PASS

npm test
PASS

npm run test:core:trust-report
PASS
```

Focused test output:

```text
core trust report checks passed
```

## Tests added

`tests/scenarios/core-trust-report.ts` covers:

1. report contains `trustState`;
2. report contains structured `blockingReasons`;
3. cold start report has `tradingAllowed === false`;
4. trusted report can set `tradingAllowed === true` only when ActionGate allows `PLACE_ORDER`;
5. report contains `bootstrap`, `exchangeTruth`, `freshness`, and `healthTruth`;
6. report is sufficient for frontend trust display without frontend-side trust recomputation.

## Risks / integration notes

- This task implements CoreTrustReport, not the full Kernel Authority module.
- `RuntimeEngine.getCoreTrustReport()` currently evaluates permissions directly through existing `ActionGate.evaluateAll()` and does not push decisions into runtime decision history.
- Trust classification is intentionally conservative:
  - replay mismatch becomes `COMPROMISED`;
  - halted system becomes `HALTED`;
  - conflicted exchange truth becomes `COMPROMISED`;
  - blocked but recoverable evidence becomes `RECOVERABLE`;
  - full allow with no blockers becomes `TRUSTED`.
- Future ActionGate Verdict v2 may provide richer verdict evidence; CoreTrustReport should consume that after integration merge if applicable.
- Constitution changes are minimal and may need semantic merge with the dedicated Constitution role.

## Intentionally not done

- V1 not connected.
- V2 not connected.
- Signal Layer not implemented.
- Decision Engine not implemented.
- Strategy logic not added.
- UI not added.
- Live trading not enabled.
- Real exchange keys not added.
- Recovery Planner not implemented.
- Kernel Authority as a full separate module not implemented.
- No state mutation inside CoreTrustReport.
