import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.clearPersistenceAndReset();

let price = 76000;
for (let i = 0; i < 100; i += 1) {
  price = Number((price + Math.sin(i / 10) * 2 + 0.1).toFixed(2));
  runtimeEngine.ingestMarketTick({
    symbol: "BTCUSDT",
    price,
    bid: Number((price - 0.01).toFixed(2)),
    ask: Number((price + 0.01).toFixed(2)),
    volume: 3000 + i,
    provider: "persistence-test"
  });

  if (i % 10 === 0) {
    runtimeEngine.ingestSignal({
      symbol: "BTCUSDT",
      side: i % 20 === 0 ? "buy" : "sell",
      confidence: 0.75,
      quantity: 0.01,
      reason: "persistence_recovery_script"
    });
  }

  if (i % 25 === 0) {
    runtimeEngine.dispatchAction({
      type: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      quantity: 0.01,
      price
    });
  }
}

const beforeRecover = runtimeEngine.replayCheck();
const recovered = runtimeEngine.recoverFromDisk();
const afterRecover = runtimeEngine.replayCheck();
const invariants = runtimeEngine.getInvariants();

const ok =
  beforeRecover.ok &&
  afterRecover.ok &&
  invariants.every((check) => check.ok) &&
  recovered.snapshotRevision === runtimeEngine.getSnapshot().revision;

console.log(JSON.stringify({
  name: "persistence_recovery_script",
  ok,
  beforeRecover,
  recovered,
  afterRecover,
  persistence: runtimeEngine.getPersistenceView(),
  invariants
}, null, 2));

if (!ok) process.exit(1);
