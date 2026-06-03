import fs from "node:fs";
import path from "node:path";
import { pnlEngine } from "../../core/pnl/pnl-engine.js";
import { resolveTradeMetadata, withExitReason } from "../../core/strategy/trade-metadata.js";

const runtimeJournalPath = path.resolve(process.cwd(), "data", "runtime", "trade-journal.jsonl");
const legacyJournalPath = path.resolve(process.cwd(), "data", "journal", "trade-journal.jsonl");

function readIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
}

function writeOrRemove(filePath: string, content: string | null): void {
  if (content === null) {
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function resetJournal() {
  for (const p of [runtimeJournalPath, legacyJournalPath]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "", "utf-8");
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const backup = new Map<string, string | null>([
  [runtimeJournalPath, readIfExists(runtimeJournalPath)],
  [legacyJournalPath, readIfExists(legacyJournalPath)]
]);

try {
  resetJournal();
  pnlEngine.clear();

  const entryMetadata = resolveTradeMetadata({
    strategyId: "liquidity_sweep_v1",
    hypothesisId: "H-ZAKOL-001",
    setupType: "LIQUIDITY_SWEEP",
    sourceLogic: "zakol",
    entryReason: "pr35_test_entry",
    tags: ["pr35-test"]
  });

  const buy = pnlEngine.normalizeFill({
    id: "pr35-buy-1",
    orderId: "pr35-order-buy-1",
    symbol: "BTCUSDT",
    side: "BUY",
    price: 100,
    qty: 1,
    quoteQty: 100,
    commission: 0,
    commissionAsset: "USDT",
    time: 1000,
    metadata: entryMetadata
  });

  pnlEngine.onFill(buy);

  const active = pnlEngine.getActiveTrade("BTCUSDT");
  assert(active?.metadata?.strategyId === "liquidity_sweep_v1", "active trade missing metadata");
  assert(active?.metadata?.hypothesisId === "H-ZAKOL-001", "active trade missing hypothesis");

  // SELL intentionally carries only exit metadata. PnL must inherit BUY identity
  // from the active trade, otherwise PR34 grouping becomes split/unknown.
  const sellMetadata = withExitReason(undefined, "pr35_test_exit");
  const sell = pnlEngine.normalizeFill({
    id: "pr35-sell-1",
    orderId: "pr35-order-sell-1",
    symbol: "BTCUSDT",
    side: "SELL",
    price: 101,
    qty: 1,
    quoteQty: 101,
    commission: 0,
    commissionAsset: "USDT",
    time: 2000,
    metadata: sellMetadata
  });

  pnlEngine.onFill(sell);

  const closed = pnlEngine.getClosedTrades()[0];
  assert(closed?.metadata?.strategyId === "liquidity_sweep_v1", "closed trade lost strategyId");
  assert(closed?.metadata?.setupType === "LIQUIDITY_SWEEP", "closed trade lost setupType");
  assert(closed?.metadata?.exitReason === "pr35_test_exit", "closed trade lost exitReason");

  const closedSellFill = closed?.fills.find((fill) => fill.side === "SELL");
  assert(closedSellFill?.metadata?.strategyId === "liquidity_sweep_v1", "SELL fill did not inherit strategyId");
  assert(closedSellFill?.metadata?.setupType === "LIQUIDITY_SWEEP", "SELL fill did not inherit setupType");
  assert(closedSellFill?.metadata?.exitReason === "pr35_test_exit", "SELL fill lost exitReason");

  const lines = fs.readFileSync(runtimeJournalPath, "utf-8").split("\n").filter(Boolean);
  assert(lines.some((line) => line.includes('"trade_created"') && line.includes('"liquidity_sweep_v1"')), "journal trade_created missing metadata");
  assert(lines.some((line) => line.includes('"trade_closed"') && line.includes('"pr35_test_exit"')), "journal trade_closed missing exit metadata");

  const replay = pnlEngine.replayJournalLines(lines);
  assert(replay.closedTrades[0]?.metadata?.strategyId === "liquidity_sweep_v1", "replay lost metadata");
  assert(replay.closedTrades[0]?.metadata?.exitReason === "pr35_test_exit", "replay lost exitReason");

  pnlEngine.clear();
  const previousRequireEntryMetadata = process.env.PR35_REQUIRE_ENTRY_METADATA;
  process.env.PR35_REQUIRE_ENTRY_METADATA = "true";

  try {
    const unknownBuy = pnlEngine.normalizeFill({
      id: "pr35-unknown-buy-1",
      orderId: "pr35-unknown-order-buy-1",
      symbol: "BTCUSDT",
      side: "BUY",
      price: 100,
      qty: 1,
      quoteQty: 100,
      commission: 0,
      commissionAsset: "USDT",
      time: 3000
    });

    let threw = false;
    try {
      pnlEngine.onFill(unknownBuy);
    } catch (error) {
      threw = error instanceof Error && error.message.includes("BUY fill missing required PR35 metadata");
    }

    assert(threw, "PR35_REQUIRE_ENTRY_METADATA did not reject UNKNOWN BUY");

    pnlEngine.clear();
    const reconcileBuy = pnlEngine.normalizeFill({
      id: "pr35-reconcile-buy-1",
      orderId: "pr35-reconcile-order-buy-1",
      symbol: "BTCUSDT",
      side: "BUY",
      price: 100,
      qty: 1,
      quoteQty: 100,
      commission: 0,
      commissionAsset: "USDT",
      time: 4000,
      raw: { source: "PNL_RECONCILE" }
    });

    const reconcileSnapshot = pnlEngine.onReconcile({
      symbol: "BTCUSDT",
      fills: [reconcileBuy],
      position: 1,
      lastPrice: 100
    });

    const reconcileActive = reconcileSnapshot.activeTrades[0];
    assert(reconcileActive?.metadata?.strategyId === "manual_unknown_v1", "reconcile BUY should remain UNKNOWN");
    assert(
      reconcileActive?.metadata?.tags?.includes("reconcile_without_entry_metadata"),
      "reconcile BUY missing diagnostic metadata tag"
    );
  } finally {
    if (previousRequireEntryMetadata === undefined) {
      delete process.env.PR35_REQUIRE_ENTRY_METADATA;
    } else {
      process.env.PR35_REQUIRE_ENTRY_METADATA = previousRequireEntryMetadata;
    }
  }

  console.log("PR35 METADATA PIPELINE PASS");
} finally {
  for (const [filePath, content] of backup.entries()) {
    writeOrRemove(filePath, content);
  }
}
