import WebSocket from "ws";
import { runtimeEngine } from "../../../core/runtime/src/runtime-engine.js";
import { markWsTick, systemState } from "../../../core/system/state.js";
import { pnlEngine } from "../../../core/pnl/pnl-engine.js";

export const liveMarketStatus = {
  connected: false,
  lastTickAt: systemState.lastWsTick,
  lastError: undefined as string | undefined
};

export function startBinanceLiveMarket(symbol = "btcusdt") {
  const url = `wss://stream.binance.com:9443/ws/${symbol}@ticker`;

  const ws = new WebSocket(url);

  ws.on("open", () => {
    liveMarketStatus.connected = true;
    console.log("[market] connected");
  });

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());

    markWsTick();
    liveMarketStatus.lastTickAt = systemState.lastWsTick;
    liveMarketStatus.lastError = undefined;

    const price = Number(msg.c);
    const symbolName = String(msg.s ?? symbol).toUpperCase();

    pnlEngine.onPriceTick(symbolName, price);

    runtimeEngine.ingestMarketTick({
      symbol: symbolName,
      price,
      bid: Number(msg.b),
      ask: Number(msg.a),
      volume: Number(msg.v),
      provider: "binance"
    });
  });

  ws.on("error", (err) => {
    liveMarketStatus.lastError = err instanceof Error ? err.message : String(err);
    console.error("[market error]", err);
  });

  ws.on("close", () => {
    liveMarketStatus.connected = false;
    console.warn("[market] disconnected");
  });

  return ws;
}
