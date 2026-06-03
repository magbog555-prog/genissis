import assert from "node:assert/strict";
import { pnlEngine, PnLEngine, PnLInvariantError } from "../../core/pnl/pnl-engine.js";

function fill(input: {
  id: string;
  symbol?: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  commission?: number;
  commissionAsset?: string;
  expectedPrice?: number;
  time: number;
}) {
  const engine = new PnLEngine();
  return engine.normalizeFill({
    id: input.id,
    symbol: input.symbol ?? "BTCUSDT",
    side: input.side,
    price: input.price,
    qty: input.qty,
    commission: input.commission ?? 0,
    commissionAsset: input.commissionAsset ?? "USDT",
    expectedPrice: input.expectedPrice,
    time: input.time
  });
}

function testEntryCreatesTrade() {
  const engine = new PnLEngine();
  const f1 = fill({ id: "1", side: "BUY", price: 100, qty: 1, commission: 0.1, time: 1 });

  const snapshot = engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [f1],
    position: 1,
    lastPrice: 110
  });

  assert.equal(snapshot.activeTrades.length, 1);
  assert.equal(snapshot.activeTrades[0].entryPrice, 100);
  assert.equal(snapshot.unrealizedPnl, 10);
  assert.equal(snapshot.realizedPnl, 0);
}

function testPartialEntryAveragesPrice() {
  const engine = new PnLEngine();
  const f1 = fill({ id: "1", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const f2 = fill({ id: "2", side: "BUY", price: 200, qty: 1, commission: 0, time: 2 });

  const snapshot = engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [f1, f2],
    position: 2,
    lastPrice: 150
  });

  assert.equal(snapshot.activeTrades[0].entryPrice, 150);
  assert.equal(snapshot.activeTrades[0].qty, 2);
}

function testPartialExitAndFullClose() {
  const engine = new PnLEngine();
  const f1 = fill({ id: "1", side: "BUY", price: 100, qty: 2, commission: 0.2, time: 1 });
  const f2 = fill({ id: "2", side: "SELL", price: 110, qty: 1, commission: 0.1, time: 2 });

  let snapshot = engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [f1, f2],
    position: 1,
    lastPrice: 105
  });

  assert.equal(snapshot.activeTrades.length, 1);
  assert.equal(snapshot.activeTrades[0].qty, 1);
  assert.equal(snapshot.grossPnl, 10);
  assert.equal(snapshot.realizedPnl, 10);
  assert.equal(snapshot.unrealizedPnl, 5);

  const f3 = fill({ id: "3", side: "SELL", price: 120, qty: 1, commission: 0.1, time: 3 });
  snapshot = engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [f1, f2, f3],
    position: 0,
    lastPrice: 120
  });

  assert.equal(snapshot.activeTrades.length, 0);
  assert.equal(snapshot.closedTrades.length, 1);
  assert.equal(snapshot.grossPnl, 30);
  assert.equal(snapshot.realizedPnl, 30);
  assert.equal(snapshot.netPnl, 29.6);
}

function testMaeMfe() {
  const engine = new PnLEngine();
  const f1 = fill({ id: "1", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });

  engine.onReconcile({ symbol: "BTCUSDT", fills: [f1], position: 1, lastPrice: 100 });
  engine.onPriceTick("BTCUSDT", 90);
  engine.onPriceTick("BTCUSDT", 115);

  const trade = engine.getActiveTrade("BTCUSDT");
  assert.equal(trade?.mae, -10);
  assert.equal(trade?.mfe, 15);
}

function testMultiSymbolIsolation() {
  const engine = new PnLEngine();
  const btc = fill({ id: "btc-1", symbol: "BTCUSDT", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const eth = fill({ id: "eth-1", symbol: "ETHUSDT", side: "BUY", price: 10, qty: 2, commission: 0, time: 1 });

  engine.onReconcile({ symbol: "BTCUSDT", fills: [btc], position: 1, lastPrice: 101 });
  engine.onReconcile({ symbol: "ETHUSDT", fills: [eth], position: 2, lastPrice: 11 });

  const snapshot = engine.getPnL();
  assert.equal(snapshot.symbols.BTCUSDT.activeTrade?.qty, 1);
  assert.equal(snapshot.symbols.ETHUSDT.activeTrade?.qty, 2);
}

function testDuplicateConflictFails() {
  const engine = new PnLEngine();
  const f1 = fill({ id: "1", side: "BUY", price: 100, qty: 1, time: 1 });
  const f2 = fill({ id: "1", side: "BUY", price: 101, qty: 1, time: 1 });

  assert.throws(() => {
    engine.onReconcile({ symbol: "BTCUSDT", fills: [f1, f2], position: 1, lastPrice: 100 });
  }, PnLInvariantError);
}

function testRecoveredStartingPositionClosesFromFilteredSell() {
  const engine = new PnLEngine();
  const sell = fill({ id: "sell-only", side: "SELL", price: 105, qty: 1, commission: 0.1, time: 10 });

  const snapshot = engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [sell],
    position: 0,
    lastPrice: 100
  });

  assert.equal(snapshot.activeTrades.length, 0);
  assert.equal(snapshot.closedTrades.length, 1);
  assert.equal(snapshot.closedTrades[0].fills.length, 2);
  assert.equal(snapshot.closedTrades[0].fills[0].raw && (snapshot.closedTrades[0].fills[0].raw as any).source, "PNL_RECONCILE_RECOVERY");
  assert.equal(snapshot.grossPnl, 5);
  assert.equal(snapshot.realizedPnl, 5); // recovered BUY manual fee + SELL exchange fee
}

function testRecoveredOpenPositionHasUnrealizedPnl() {
  const engine = new PnLEngine();

  engine.onReconcile({
    symbol: "BTCUSDT",
    fills: [],
    position: 1,
    lastPrice: 100
  });

  const snapshot = engine.onPriceTick("BTCUSDT", 110);

  assert.equal(snapshot.activeTrade?.qty, 1);
  assert.equal(snapshot.unrealizedPnl, 10);
}

testEntryCreatesTrade();
testPartialEntryAveragesPrice();
testPartialExitAndFullClose();
testMaeMfe();
testMultiSymbolIsolation();
testDuplicateConflictFails();
testRecoveredStartingPositionClosesFromFilteredSell();
testRecoveredOpenPositionHasUnrealizedPnl();

pnlEngine.clear();

console.log(JSON.stringify({
  ok: true,
  suite: "pr33-pnl-engine",
  tests: [
    "entry creates trade",
    "partial entry averages price",
    "partial/full exit",
    "fees decrease pnl",
    "MAE/MFE",
    "multi-symbol isolation",
    "duplicate conflict fails",
    "recovered starting position closes from filtered sell",
    "recovered open position has unrealized pnl"
  ]
}, null, 2));
