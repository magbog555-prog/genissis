# INTEGRATION REPORT — MBG Core v0.1 alpha5.1

Status: PASS  
Role: 8 — Integration Owner / Merge Engineer  
Base: `mbg-core-v0.1-alpha5.zip`  
Target: `mbg-core-v0.1-alpha5.1`

## Scope

Wave 6 is a documentation and audit fixation wave over alpha5.

No runtime behavior change was introduced.

## Merged Inputs

- Role 2: `роль 2.6.zip` — Alpha5 Acceptance Report + Constitution Alignment.
- Role 4: `роль 4.6.zip` — Core API Map.
- Role 5: `роль 5.6.zip` — Core v0.1 Definition of Done.
- Role 6: `роль 6.6.zip` — V1 Bridge Preconditions.
- Role 7: `mbg-core-v0.1-alpha5-wave6-canonical-audit-checklist.zip` — Canonical Audit Checklist.

## Added / Updated Files

- `ALPHA5_ACCEPTANCE_REPORT.md`
- `CORE_API_MAP.md`
- `CORE_V0_1_DEFINITION_OF_DONE.md`
- `V1_BRIDGE_PRECONDITIONS.md`
- `CANONICAL_AUDIT_CHECKLIST.md`
- `tests/scenarios/canonical-audit-checklist.ts`
- `CORE_CONSTITUTION.md`
- `core/kernel/kernel-constitution.ts`
- `tests/scenarios/core-constitution.test.mjs`
- `package.json`
- `package-lock.json`

Delivery reports from Wave 6 roles were also included.

## Package Script Changes

- Added `test:canonical-audit-checklist`.
- Updated `verify` to include the canonical audit checklist.
- Updated package metadata from alpha5/alpha4 wording to alpha5.1.

`verify` keeps alpha5 runtime checks and adds Wave 6 audit coverage.

## Runtime / Architecture Constraints

Confirmed:

- Runtime behavior was not changed.
- Trust logic was not changed.
- ActionGate logic was not changed.
- V1 was not connected.
- V2 was not connected.
- UI was not added.
- Strategy logic was not added.
- Live trading was not enabled.
- Real exchange keys were not added.

## Canonical Audit Checklist

Result:

```text
canonical_audit_checklist: PASS 20/20
```

## Verification Results

Commands executed:

```text
npm ci: PASS
npm run typecheck: PASS
npm test: PASS
npm run test:core-constitution: PASS
npm run test:canonical-audit-checklist: PASS 20/20
npm run verify: PASS / exit code 0
```

Full `npm run verify` completed successfully. The verify script ran the alpha5 test set plus the Wave 6 canonical audit checklist.

## Integration Notes

The canonical audit checklist initially failed when called directly after runtime-generating tests because runtime journal files existed. The integration fix was to call it through `npm run test:canonical-audit-checklist`, which resets runtime state before running the checklist. This is an audit hygiene/script ordering fix only; it does not modify runtime behavior.

## Final Result

`mbg-core-v0.1-alpha5.1` is ready for review.
