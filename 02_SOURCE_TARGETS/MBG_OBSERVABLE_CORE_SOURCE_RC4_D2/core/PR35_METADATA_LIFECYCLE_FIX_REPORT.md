# PR35 Metadata Lifecycle Fix

## Status

```txt
PR35 Runtime Grouping: PASS
PR35 Metadata Lifecycle: PASS for BUY identity + SELL inheritance
```

## What changed

1. `core/pnl/pnl-engine.ts`
   - BUY creates and owns `trade.metadata` identity.
   - SELL inherits `activeTrade.metadata`.
   - SELL may add or preserve `exitReason`.
   - `trade.metadata.exitReason` is populated when a trade closes.
   - Optional live guard added:

```txt
PR35_REQUIRE_ENTRY_METADATA=true
```

When enabled, a new BUY without non-UNKNOWN PR35 metadata throws `PnLInvariantError`.

2. `tests/scenarios/pr35-metadata-pipeline.ts`
   - Added lifecycle test where SELL carries only `exitReason` and must inherit BUY strategy identity.
   - Added test that `PR35_REQUIRE_ENTRY_METADATA=true` rejects UNKNOWN BUY entries.
   - Replay now checks both `strategyId` and `exitReason`.

3. `core/strategy/order-metadata-store.ts`
   - Added `deleteOrderMetadata` and `deleteOrderMetadataMany`.

4. `core/runtime/trading-runtime.ts`
   - Closed trades trigger metadata-store cleanup for closed order keys.

## Verified locally

```txt
npm run typecheck
npm run test:pr33:pnl
npm run test:pr33.2:pnl-hardening
npm run test:pr35:metadata
npx tsx scripts/test-strategy.ts
npx tsx scripts/test-hypothesis.ts
npx tsx scripts/test-enricher.ts
```

## Launch plan

1. Install fresh dependencies:

```bash
rm -rf node_modules
npm ci
```

2. Run regression checks:

```bash
npm run typecheck
npm run test:pr33:pnl
npm run test:pr33.2:pnl-hardening
npm run test:pr35:metadata
```

3. Run PR35 config probes:

```bash
npx tsx scripts/test-strategy.ts
npx tsx scripts/test-hypothesis.ts
npx tsx scripts/test-enricher.ts
```

4. Run analytics before live:

```bash
npx tsx scripts/expectancy-from-journal.ts
```

5. For the next short runtime check, enable strict entry metadata:

```bash
PR35_REQUIRE_ENTRY_METADATA=true
PR35_STRATEGY_ID=liquidity_sweep_v1
PR35_HYPOTHESIS_ID=H-ZAKOL-001
PR35_SETUP_TYPE=LIQUIDITY_SWEEP
PR35_SOURCE_LOGIC=zakol
PR35_ENTRY_REASON=runtime_buy_decision
PR35_EXIT_REASON=runtime_sell_decision
```

6. After a short run, inspect analytics. Expected result for new trades:

```txt
byStrategyId includes liquidity_sweep_v1 for BUY-created trades
bySetupType includes LIQUIDITY_SWEEP
closed trade.metadata.exitReason is populated
SELL fill metadata inherits liquidity_sweep_v1
manual_unknown_v1 appears only for old/historical/manual entries
```

## Packaging note

The patched archive should not include `.env`, `node_modules`, or personal scratch folders containing secrets. Use `.env.example` and local environment variables instead.
