import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";
console.log("initial", runtimeEngine.getSnapshot());
runtimeEngine.ingestMarketTick({ symbol: "BTCUSDT", price: 65000, bid: 64999, ask: 65001, provider: "demo" });
runtimeEngine.ingestSignal({ symbol: "BTCUSDT", side: "buy", confidence: 0.8, quantity: 0.01, reason: "demo_signal" });
console.log("after demo", runtimeEngine.getSnapshot());
console.log("permissions", runtimeEngine.getPermissions());
console.log("dispatch", runtimeEngine.dispatchAction({ type: "place_order", symbol: "BTCUSDT", side: "buy", quantity: 0.01 }));
