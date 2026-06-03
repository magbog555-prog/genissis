# Delivery Report — Wave 10B Observable Read-only Summaries

Role: Role 6 — Observable Read Models / Trust, Integrity, ActionGate  
Base: `mbg-core-v0.1-alpha9.zip`  
Scope: observable read-only DTO summaries for Core UI API / Connected Observable Core Machine.

## Summary

Added deterministic UI-safe DTO summaries on top of the existing observable read-model layer.

The summaries cover:

- trust summaries;
- integrity summaries;
- recovery summaries;
- quarantine summaries;
- market integrity summaries;
- provenance integrity summaries;
- ActionGate verdict summaries;
- UI-safe explanations.

## Changed files

- `core/observable/observable-read-models.ts`
- `tests/scenarios/wave10b-observable-summaries.ts`
- `package.json`

## Added script

```bash
npm run test:core:observable-summaries
```

## Tests added

- `tests/scenarios/wave10b-observable-summaries.ts`

Covered scenarios:

1. same Core state produces the same DTO summaries;
2. deny reasons are preserved in UI-safe DTOs;
3. recovery hints are deterministic and observable-only;
4. market integrity and provenance summaries are visible;
5. observable DTO summary construction does not mutate runtime snapshot.

## Commands run

```bash
npm run typecheck
npm test
npm run test:core:observable-summaries
```

All commands passed.

## Semantic notes

- UI receives deterministic read-only summaries.
- UI-safe explanations preserve reason codes but expose only evidence keys, not a new decision system.
- ActionGate verdicts are summarized, not recalculated.
- Recovery hints are display-only and still require approved Core APIs and ActionGate for execution.
- Market and provenance status are observable evidence only; they do not grant permission.

## Known limitations

- This task does not add a new HTTP endpoint.
- This task does not connect UI to live Core.
- This task does not implement execution semantics.
- This task does not generate trust, permission, or verdicts in UI.
- This task does not change ActionGate, Kernel Authority, Recovery Planner, Integrity, or replay semantics.
