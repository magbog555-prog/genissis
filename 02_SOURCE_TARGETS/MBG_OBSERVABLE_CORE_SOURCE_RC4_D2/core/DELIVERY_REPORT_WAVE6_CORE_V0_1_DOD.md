# DELIVERY_REPORT_WAVE6_CORE_V0_1_DOD

## Task

Wave 6 — Core v0.1 Definition of Done.

## Role

Role 5.

## Canonical base

`mbg-core-v0.1-alpha5.zip`

## Delivered artifact

Added:

- `CORE_V0_1_DEFINITION_OF_DONE.md`

## Scope

Documentation-only task. No runtime logic was changed.

## Summary

Created the MBG Core v0.1 Definition of Done document. It defines when the core may be considered ready and separates criteria into:

- must-have for v0.1;
- should-have for v0.1;
- later for v0.2.

The document covers the required minimum criteria:

1. alpha5 tests;
2. `npm run verify`;
3. no real `.env` keys;
4. no live trading defaults;
5. V1 outside the core;
6. strategies outside the core;
7. UI does not compute trust;
8. state changes through events;
9. invalid events outside canonical journal;
10. duplicates do not mutate repeatedly;
11. cold start unknown + blocked;
12. Bootstrap FSM mandatory;
13. ExchangeTruth mandatory for normal trading;
14. Freshness Guard mandatory for normal trading;
15. HealthTruth does not lie;
16. Kernel Authority source of trustState;
17. CoreTrustReport main trust output;
18. ActionGate Verdict explains allow/deny;
19. Recovery Planner does not execute actions;
20. Quarantine does not mutate state;
21. Permission Ledger does not allow actions;
22. all prohibitions have machine-readable reasons.

## Changed files

- `CORE_V0_1_DEFINITION_OF_DONE.md`
- `DELIVERY_REPORT_WAVE6_CORE_V0_1_DOD.md`

## Command results

```text
npm run typecheck
PASS / exit code 0

npm test
PASS / exit code 0
```

## Risks

- This is a Definition of Done document, not an automated compliance checker.
- Some checklist items require release review beyond TypeScript and scenario tests, for example package secret review and verifying no live trading defaults.
- Future Role 8 integration should decide whether to wire this document into `npm run verify` via a documentation presence test.

## Intentionally not done

- No runtime logic changes.
- No V1 or V2 integration.
- No UI.
- No strategy logic.
- No Signal Layer.
- No Decision Engine.
- No live trading.
- No automatic recovery.
- No package rename.
