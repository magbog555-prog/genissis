# PR35 Reconcile Strict Gate Fix

## Problem

`PR35_REQUIRE_ENTRY_METADATA=true` correctly rejected BUY fills without PR35 metadata, but it also rejected BUY fills reconstructed during `PNL_RECONCILE`. That blocked runtime startup when old exchange fills or recovered positions had no PR35 metadata.

Runtime symptom:

```txt
PNL_INVARIANT_BROKEN
BUY fill missing required PR35 metadata
source: PNL_RECONCILE
```

## Fix

The strict entry metadata rule now applies only to non-reconcile BUY fills.

- New live/runtime BUY without metadata still fails fast.
- `PNL_RECONCILE` / `PNL_RECONCILE_RECOVERY` BUY fills are allowed.
- Reconcile BUY fills without metadata are marked as `manual_unknown_v1` with diagnostic tag `reconcile_without_entry_metadata`.

## Files changed

- `core/pnl/pnl-engine.ts`
- `tests/scenarios/pr35-metadata-pipeline.ts`

## Validation

Passed:

```bash
npm run typecheck
npm run test:pr35:metadata
npx tsx tests/scenarios/pr33-pnl-engine.ts
npx tsx tests/scenarios/pr33-2-pnl-hardening.ts
npx tsx scripts/test-strategy.ts
npx tsx scripts/test-hypothesis.ts
npx tsx scripts/test-enricher.ts
```

Note: direct `tsx` was used for PR33 scenario validation after `npm run` stayed open in this environment, but the scenario tests themselves completed successfully.

## Expected runtime behavior

With `PR35_REQUIRE_ENTRY_METADATA=true`:

- Startup reconcile should no longer halt on old unknown BUY fills.
- New runtime BUY fills still require PR35 metadata.
- If a new live BUY lacks metadata, runtime should still halt with `BUY fill missing required PR35 metadata`.
