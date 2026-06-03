import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

runtimeEngine.ingestMarketTick({
  symbol: "BTCUSDT",
  price: 65000,
  bid: 64999,
  ask: 65001,
  volume: 1,
  provider: "entities_probe"
});

runtimeEngine.ingestSignal({
  symbol: "BTCUSDT",
  side: "buy",
  confidence: 0.75,
  quantity: 0.01,
  reason: "entities_probe_signal"
});

console.dir(runtimeEngine.getEntitiesView(), { depth: null });
