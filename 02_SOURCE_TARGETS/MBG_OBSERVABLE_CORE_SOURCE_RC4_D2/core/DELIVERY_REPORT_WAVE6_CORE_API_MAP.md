# Delivery Report — Wave 6 / Core API Map

Role: Role 4  
Task: Wave 6 — Core API Map / карта публичных поверхностей ядра  
Canonical base: `mbg-core-v0.1-alpha5.zip`

## Summary

Created `CORE_API_MAP.md`, a documentation-only map of public MBG Core surfaces. No runtime logic was changed.

## Delivered files

- `CORE_API_MAP.md`
- `DELIVERY_REPORT_WAVE6_CORE_API_MAP.md`

## Public surfaces documented

1. CoreTrustReport — отчёт доверия ядра.
2. Kernel Authority — орган доверия ядра.
3. ActionGate Verdict — вердикт ворот действия.
4. Recovery Planner — планировщик восстановления.
5. Quarantine — карантин плохих данных.
6. Permission Ledger — журнал разрешений и отказов.
7. ExchangeTruth — биржевая истина.
8. Freshness — свежесть данных.
9. HealthTruth — честное здоровье системы.
10. Event Validation — проверка событий.
11. Event Idempotency — защита от повторного применения событий.
12. Bootstrap FSM — конечный автомат запуска.

## Explicit laws captured

- V1 does not compute trust.
- UI does not compute trust.
- Strategy logic does not bypass ActionGate.
- CoreTrustReport is the main trust output.
- Kernel Authority is the source of `trustState`.
- Recovery Planner advises but does not execute.
- Quarantine isolates bad data and does not mutate trusted state.
- Permission Ledger records decisions but does not authorize actions.

## Changed files

```text
CORE_API_MAP.md
DELIVERY_REPORT_WAVE6_CORE_API_MAP.md
```

## Commands run

```text
npm install
PASS

npm run typecheck
PASS

npm test
PASS
```

Notes:
- `npm install` was run because the extracted canonical archive did not include `node_modules`.
- `node_modules` is intentionally excluded from the delivered zip and patch.

## Risks

- `HealthTruthSnapshot` is still exported from `core/runtime/src/runtime-engine.ts`. The API map documents this as current alpha5 behavior and notes that it should move into a dedicated contract if it becomes a cross-package public contract.
- Some public method signatures are documented at the module/API level; future semantic merges should verify exact signatures if roles 5–8 modify these modules during Wave 6.

## Intentionally not done

- No runtime logic changed.
- No ActionGate changes.
- No V1/V2 integration.
- No Signal Layer.
- No Decision Engine.
- No strategy logic.
- No UI.
- No live trading.
- No real exchange keys.
- No package script changes.
