import "dotenv/config";

import { startBinanceLiveMarket } from "../../../application/market/src/binance-live-market.js";
import { haltSystem } from "../../../core/system/state.js";
import { startLoop, startupSafetyCheck } from "../../../core/system/trading-runtime.js";

async function main() {
  try {
    startBinanceLiveMarket((process.env.SYMBOL ?? "btcusdt").toLowerCase());

    await startupSafetyCheck();

    await startLoop();
  } catch (e) {
    haltSystem(e instanceof Error ? e.message : String(e));
  }
}

void main();
