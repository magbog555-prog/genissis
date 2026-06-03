import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PnLEngine, type PnLFill } from "../../core/pnl/pnl-engine.js";

const runtimeTradeJournal = path.resolve(process.cwd(), "data", "runtime", "trade-journal.jsonl");
const legacyTradeJournal = path.resolve(process.cwd(), "data", "journal", "trade-journal.jsonl");

function resetJournals() {
  fs.rmSync(runtimeTradeJournal, { force: true });
  fs.rmSync(legacyTradeJournal, { force: true });
}

function engineFill(engine: PnLEngine, input: {
  id: string;
  symbol?: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  commission?: number;
  commissionAsset?: string;
  expectedPrice?: number;
  time: number;
}): PnLFill {
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

function testManualFeeAppliedWhenExchangeFeeZero() {
  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "mf-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const sell = engineFill(engine, { id: "mf-sell", side: "SELL", price: 110, qty: 1, commission: 0, time: 2 });

  const snapshot = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, sell], position: 0, lastPrice: 110 });

  assert.equal(snapshot.grossPnl, 10);
  assert.equal(snapshot.exchangeFees, 0);
  assert.equal(snapshot.estimatedFees, 0.21);
  assert.equal(snapshot.totalFees, 0.21);
  assert.equal(snapshot.netPnl, 9.79);
}

function testExchangeFeeHasPriorityOverManualFee() {
  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "xf-buy", side: "BUY", price: 100, qty: 1, commission: 0.1, time: 1 });
  const sell = engineFill(engine, { id: "xf-sell", side: "SELL", price: 110, qty: 1, commission: 0.1, time: 2 });

  const snapshot = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, sell], position: 0, lastPrice: 110 });

  assert.equal(snapshot.grossPnl, 10);
  assert.equal(snapshot.exchangeFees, 0.2);
  assert.equal(snapshot.estimatedFees, 0);
  assert.equal(snapshot.totalFees, 0.2);
  assert.equal(snapshot.netPnl, 9.8);
}

function testNetPnlEqualsGrossMinusFees() {
  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "net-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const sell = engineFill(engine, { id: "net-sell", side: "SELL", price: 130, qty: 1, commission: 0, time: 2 });

  const snapshot = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, sell], position: 0, lastPrice: 130 });
  assert.equal(snapshot.netPnl, Number((snapshot.grossPnl - snapshot.totalFees).toFixed(12)));
  assert.ok(snapshot.netPnl <= snapshot.grossPnl);
}

function testSlippageCalculated() {
  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "slip-buy", side: "BUY", price: 101, expectedPrice: 100, qty: 1, commission: 0, time: 1 });
  const sell = engineFill(engine, { id: "slip-sell", side: "SELL", price: 109, expectedPrice: 110, qty: 1, commission: 0, time: 2 });

  assert.equal(buy.slippageBps, 100);
  assert.equal(buy.slippageCost, 1);
  assert.equal(sell.slippageBps, -90.909090909091);
  assert.equal(sell.slippageCost, 1);

  const snapshot = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, sell], position: 0, lastPrice: 109 });
  assert.equal(snapshot.closedTrades[0].slippageCost, 2);
}

function testDuplicateFillDoesNotChangePnLOrQty() {
  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "dup-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const duplicateBuy = engineFill(engine, { id: "dup-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });

  const snapshot = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, duplicateBuy], position: 1, lastPrice: 100 });

  assert.equal(snapshot.activeTrades[0].qty, 1);
  assert.equal(snapshot.symbols.BTCUSDT.processedFillIds.length, 1);
  assert.equal(snapshot.duplicateFillIds.length, 1);
}

function testReplayGivesIdenticalState() {
  resetJournals();

  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "replay-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const sell = engineFill(engine, { id: "replay-sell", side: "SELL", price: 110, qty: 1, commission: 0, time: 2 });

  const original = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy, sell], position: 0, lastPrice: 110 });
  const lines = fs.readFileSync(runtimeTradeJournal, "utf-8").trim().split(/\r?\n/);

  const replayedEngine = new PnLEngine();
  const replayed = replayedEngine.replayJournalLines(lines);

  assert.deepEqual(replayed.grossPnl, original.grossPnl);
  assert.deepEqual(replayed.realizedPnl, original.realizedPnl);
  assert.deepEqual(replayed.unrealizedPnl, original.unrealizedPnl);
  assert.deepEqual(replayed.netPnl, original.netPnl);
  assert.equal(replayed.activeTrades.length, original.activeTrades.length);
  assert.equal(replayed.closedTrades.length, original.closedTrades.length);
}

function testRestartRecoversOpenTradeWithoutDuplication() {
  resetJournals();

  const engine = new PnLEngine();
  const buy = engineFill(engine, { id: "restart-buy", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const original = engine.onReconcile({ symbol: "BTCUSDT", fills: [buy], position: 1, lastPrice: 105 });
  const lines = fs.readFileSync(runtimeTradeJournal, "utf-8").trim().split(/\r?\n/);

  const restarted = new PnLEngine();
  restarted.replayJournalLines(lines);
  const afterReconcile = restarted.onReconcile({ symbol: "BTCUSDT", fills: [buy], position: 1, lastPrice: 106 });

  assert.equal(afterReconcile.activeTrades.length, 1);
  assert.equal(afterReconcile.closedTrades.length, 0);
  assert.equal(afterReconcile.activeTrades[0].fills.length, 1);
  assert.equal(afterReconcile.activeTrades[0].tradeId, original.activeTrades[0].tradeId);
}

function testMultiSymbolSmokeAndSummary() {
  const engine = new PnLEngine();

  const btcBuy = engineFill(engine, { id: "btc-buy", symbol: "BTCUSDT", side: "BUY", price: 100, qty: 1, commission: 0, time: 1 });
  const ethBuy = engineFill(engine, { id: "eth-buy", symbol: "ETHUSDT", side: "BUY", price: 10, qty: 2, commission: 0, time: 1 });
  const solBuy = engineFill(engine, { id: "sol-buy", symbol: "SOLUSDT", side: "BUY", price: 20, qty: 3, commission: 0, time: 1 });
  const btcSell = engineFill(engine, { id: "btc-sell", symbol: "BTCUSDT", side: "SELL", price: 111, qty: 1, commission: 0, time: 2 });

  engine.onReconcile({ symbol: "BTCUSDT", fills: [btcBuy, btcSell], position: 0, lastPrice: 111 });
  engine.onReconcile({ symbol: "ETHUSDT", fills: [ethBuy], position: 2, lastPrice: 11 });
  engine.onReconcile({ symbol: "SOLUSDT", fills: [solBuy], position: 3, lastPrice: 19 });

  const summary = engine.getSummary();

  assert.equal(summary.symbols.BTCUSDT.closedTrades, 1);
  assert.equal(summary.symbols.ETHUSDT.activeTrades, 1);
  assert.equal(summary.symbols.SOLUSDT.activeTrades, 1);
  assert.equal(summary.activeTrades, 2);
  assert.equal(summary.closedTrades, 1);

  const summed = Object.values(summary.symbols).reduce((sum, symbol) => sum + symbol.netPnl, 0);
  assert.equal(summary.netPnl, Number(summed.toFixed(12)));
}

function testOpenPositionAccounting() {
  const engine = new PnLEngine();
  engine.onReconcile({ symbol: "BTCUSDT", fills: [], position: 0.00012, lastPrice: 100000 });
  const snapshot = engine.onPriceTick("BTCUSDT", 100010);

  assert.equal(snapshot.activeTrade?.status, "OPEN");
  assert.equal(snapshot.activeTrade?.qty, 0.00012);
  assert.equal(snapshot.unrealizedPnl, 0.0012);
  assert.equal(snapshot.activeTrade ? 1 : 0, 1);
}

testManualFeeAppliedWhenExchangeFeeZero();
testExchangeFeeHasPriorityOverManualFee();
testNetPnlEqualsGrossMinusFees();
testSlippageCalculated();
testDuplicateFillDoesNotChangePnLOrQty();
testReplayGivesIdenticalState();
testRestartRecoversOpenTradeWithoutDuplication();
testMultiSymbolSmokeAndSummary();
testOpenPositionAccounting();

console.log(JSON.stringify({
  ok: true,
  suite: "pr33.2-pnl-hardening",
  tests: [
    "manual fee applies if exchange fee is zero",
    "exchange fee has priority over manual fee",
    "netPnl = grossPnl - totalFees",
    "slippage is calculated",
    "duplicate fill does not change PnL",
    "journal replay gives identical state",
    "restart recovers open trade without duplication",
    "BTC/ETH/SOL multi-symbol isolation",
    "all-symbol summary converges",
    "open position accounted as unrealized"
  ]
}, null, 2));
