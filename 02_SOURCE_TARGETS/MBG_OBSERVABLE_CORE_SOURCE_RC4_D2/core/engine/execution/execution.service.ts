import crypto from "node:crypto";
import { binanceSpotTestnet } from "../../application/exchange/src/binance-spot-testnet.js";

export class ExecutionService {
  private activeOrderLock = false;

  private async withTimeout<T>(promise: Promise<T>, ms = 7000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Execution timeout")), ms)
      ),
    ]);
  }

  // =======================
  // LIMIT BUY
  // =======================
  async placeLimitBuy(symbol: string, quantity: number) {
    if (this.activeOrderLock) {
      throw new Error("Active order already in progress");
    }

    this.activeOrderLock = true;

    try {
      const ticker = await this.withTimeout(
        binanceSpotTestnet.getTicker(symbol)
      );

      const price = Number(ticker.bidPrice);

      console.log("[EXEC] placing LIMIT BUY", { symbol, quantity, price });

      const result = await this.withTimeout(
        binanceSpotTestnet.placeLimitOrder({
          symbol,
          side: "BUY",
          quantity,
          price,
          clientOrderId: crypto.randomUUID(),
        })
      );

      console.log("[EXEC RESULT]", result);
      return result;

    } finally {
      this.activeOrderLock = false;
    }
  }

  // =======================
  // LIMIT SELL
  // =======================
  async placeLimitSell(symbol: string, quantity: number) {
    if (this.activeOrderLock) {
      throw new Error("Active order already in progress");
    }

    this.activeOrderLock = true;

    try {
      const ticker = await this.withTimeout(
        binanceSpotTestnet.getTicker(symbol)
      );

      const price = Number(ticker.askPrice);

      console.log("[EXEC] placing LIMIT SELL", { symbol, quantity, price });

      const result = await this.withTimeout(
        binanceSpotTestnet.placeLimitOrder({
          symbol,
          side: "SELL",
          quantity,
          price,
          clientOrderId: crypto.randomUUID(),
        })
      );

      console.log("[EXEC RESULT]", result);
      return result;

    } finally {
      this.activeOrderLock = false;
    }
  }

  // =======================
  // ✅ MARKET SELL (ГЛАВНОЕ ЧТО ТЕБЕ НЕ ХВАТАЛО)
  // =======================
  async placeMarketSell(symbol: string, quantity: number) {
    if (this.activeOrderLock) {
      throw new Error("Active order already in progress");
    }

    this.activeOrderLock = true;

    try {
      console.log("[EXEC] MARKET SELL", { symbol, quantity });

      const result = await this.withTimeout(
        binanceSpotTestnet.placeMarketOrder({
          symbol,
          side: "SELL",
          quantity,
          clientOrderId: crypto.randomUUID(),
        })
      );

      console.log("[EXEC RESULT]", result);
      return result;

    } finally {
      this.activeOrderLock = false;
    }
  }
}