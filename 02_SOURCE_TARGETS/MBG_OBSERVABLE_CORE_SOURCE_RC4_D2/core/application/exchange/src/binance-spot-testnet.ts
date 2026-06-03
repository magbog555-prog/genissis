
import crypto from "node:crypto";

export type ExchangeMode = "mock" | "testnet";

export interface ExchangeStatus {
  configured: boolean;
  mode: ExchangeMode;
  baseUrl: string;
  symbol: string;
  liveTrading: boolean;
  safety: {
    mainnetDisabled: boolean;
    spotOnly: boolean;
  };
}

export interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime?: number;
  price?: string;
  origQty?: string;
  executedQty?: string;
  status?: string;
  timeInForce?: string;
  type?: string;
  side?: string;
}

const TESTNET_BASE_URL = "https://testnet.binance.vision";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function assertNoMainnet() {
  const mode = env("EXCHANGE_MODE") ?? "mock";
  if (mode !== "mock" && mode !== "testnet") {
    throw new Error(`Unsafe EXCHANGE_MODE=${mode}. Only "mock" or "testnet" are allowed in this build.`);
  }
  const base = env("BINANCE_BASE_URL");
  if (base && !base.includes("testnet.binance.vision")) {
    throw new Error(`Unsafe BINANCE_BASE_URL=${base}. Mainnet URLs are disabled in this build.`);
  }
}

function normalizeQuantity(quantity: number): string {
  return quantity.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function normalizePrice(price: number): string {
  return price.toFixed(2);
}

export class BinanceSpotTestnetClient {
  readonly mode: ExchangeMode;
  readonly baseUrl: string;
  readonly symbol: string;
  readonly liveTrading: boolean;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private timeOffsetMs = 0;
  private lastTimeSyncAt = 0;
  private timeSyncInFlight?: Promise<void>;
  private timeSyncTimer?: ReturnType<typeof setInterval>;

  constructor() {
    assertNoMainnet();
    this.mode = (env("EXCHANGE_MODE") ?? "mock") as ExchangeMode;
    this.baseUrl = env("BINANCE_BASE_URL") ?? TESTNET_BASE_URL;
    this.symbol = (env("SYMBOL") ?? "BTCUSDT").toUpperCase();
    this.liveTrading = env("LIVE_TRADING") === "true";
    this.apiKey = env("BINANCE_API_KEY");
    this.apiSecret = env("BINANCE_API_SECRET");
  }



  private serverNow(): number {
    return Date.now() + this.timeOffsetMs;
  }

  async getServerTime(): Promise<number> {
    const response = await fetch(`${this.baseUrl}/api/v3/time`);
    if (!response.ok) {
      throw new Error(`Binance GET /api/v3/time failed: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as { serverTime?: number };
    const serverTime = Number(body.serverTime);
    if (!Number.isFinite(serverTime)) {
      throw new Error("Binance server time response is invalid");
    }

    return serverTime;
  }

  async syncTime(): Promise<void> {
    if (this.timeSyncInFlight) {
      return this.timeSyncInFlight;
    }

    this.timeSyncInFlight = (async () => {
      const serverTime = await this.getServerTime();
      this.timeOffsetMs = serverTime - Date.now();
      this.lastTimeSyncAt = Date.now();
    })();

    try {
      await this.timeSyncInFlight;
    } finally {
      this.timeSyncInFlight = undefined;
    }
  }

  startTimeSync(intervalMs = 60_000): void {
    if (this.timeSyncTimer) return;

    void this.syncTime().catch((err) => {
      console.warn("⚠️ Binance time sync failed:", err instanceof Error ? err.message : String(err));
    });

    this.timeSyncTimer = setInterval(() => {
      void this.syncTime().catch((err) => {
        console.warn("⚠️ Binance time sync failed:", err instanceof Error ? err.message : String(err));
      });
    }, intervalMs);

    this.timeSyncTimer.unref?.();
  }

  stopTimeSync(): void {
    if (this.timeSyncTimer) {
      clearInterval(this.timeSyncTimer);
      this.timeSyncTimer = undefined;
    }
  }

  getTimeOffsetMs(): number {
    return this.timeOffsetMs;
  }

  status(): ExchangeStatus {
    return {
      configured: Boolean(this.apiKey && this.apiSecret),
      mode: this.mode,
      baseUrl: this.baseUrl,
      symbol: this.symbol,
      liveTrading: this.liveTrading,
      safety: {
        mainnetDisabled: true,
        spotOnly: true
      }
    };
  }

  private assertReady() {
    if (this.mode !== "testnet") {
      throw new Error(`Exchange is not in testnet mode. Current EXCHANGE_MODE=${this.mode}`);
    }
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("BINANCE_API_KEY and BINANCE_API_SECRET are required for testnet execution.");
    }
  }

  private sign(query: string): string {
    this.assertReady();
    return crypto.createHmac("sha256", this.apiSecret!).update(query).digest("hex");
  }

  private async signedRequest<T>(method: "GET" | "POST" | "DELETE", path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    this.assertReady();

    if (Date.now() - this.lastTimeSyncAt > 60_000) {
      await this.syncTime();
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    search.set("timestamp", String(this.serverNow()));
    search.set("recvWindow", env("BINANCE_RECV_WINDOW_MS") ?? "10000");

    const query = search.toString();
    const signature = this.sign(query);
    const url = `${this.baseUrl}${path}?${query}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-MBX-APIKEY": this.apiKey!,
        "Content-Type": "application/json"
      }
    });

    const text = await response.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      const details = body?.msg ?? body?.raw ?? response.statusText;
      const message = `Binance ${method} ${path} failed: ${response.status} ${details}`;

      if (response.status === 400 && String(details).toLowerCase().includes("recvwindow")) {
        await this.syncTime();
      }

      throw new Error(message);
    }

    return body as T;
  }

  async getAccount() {
    return this.signedRequest<any>("GET", "/api/v3/account");
  }

  async getOpenOrders(symbol = this.symbol) {
    return this.signedRequest<any[]>("GET", "/api/v3/openOrders", { symbol: symbol.toUpperCase() });
  }

  async getOrder(orderId: string | number, symbol = this.symbol) {
    return this.signedRequest<any>("GET", "/api/v3/order", { symbol: symbol.toUpperCase(), orderId });
  }

  async getTicker(symbol = this.symbol) {
  const res = await fetch(
    `${this.baseUrl}/api/v3/ticker/bookTicker?symbol=${symbol.toUpperCase()}`
  );

  if (!res.ok) {
    throw new Error(`Ticker fetch failed: ${res.status}`);
  }

  const data = await res.json();

return {
  bidPrice: Number(data.bidPrice),
  askPrice: Number(data.askPrice)
};

}

  async placeLimitOrder(input: {
    symbol?: string;
    side?: "BUY" | "SELL";
    quantity: number;
    price: number;
    clientOrderId?: string;
  }): Promise<BinanceOrderResponse> {
    const symbol = (input.symbol ?? this.symbol).toUpperCase();
    const side = input.side ?? "BUY";

    return this.signedRequest<BinanceOrderResponse>("POST", "/api/v3/order", {
      symbol,
      side,
      type: "LIMIT",
      timeInForce: "GTC",
      quantity: normalizeQuantity(input.quantity),
      price: normalizePrice(input.price),
      newClientOrderId: input.clientOrderId
    });
  }

  async placeMarketOrder(input: {
    symbol?: string;
    side?: "BUY" | "SELL";
    quantity: number;
    clientOrderId?: string;
  }): Promise<BinanceOrderResponse & { fills?: Array<{ price: string; qty: string; commission?: string; commissionAsset?: string; tradeId?: number }> }> {
    const symbol = (input.symbol ?? this.symbol).toUpperCase();
    const side = input.side ?? "BUY";

    return this.signedRequest<any>("POST", "/api/v3/order", {
      symbol,
      side,
      type: "MARKET",
      quantity: normalizeQuantity(input.quantity),
      newClientOrderId: input.clientOrderId,
      newOrderRespType: "FULL"
    });
  }



  async getMyTrades(symbol = this.symbol) {
    return this.signedRequest<any[]>("GET", "/api/v3/myTrades", {
      symbol: symbol.toUpperCase(),
      limit: 1000
    });
  }

  async marketBuy(symbol = this.symbol, quoteOrderQty = 10, clientOrderId?: string): Promise<BinanceOrderResponse & { fills?: Array<{ price: string; qty: string; commission?: string; commissionAsset?: string; tradeId?: number }> }> {
    return this.signedRequest<any>("POST", "/api/v3/order", {
      symbol: symbol.toUpperCase(),
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: normalizePrice(quoteOrderQty),
      newClientOrderId: clientOrderId,
      newOrderRespType: "FULL"
    });
  }

  async marketSell(symbol = this.symbol, quantity: number, clientOrderId?: string): Promise<BinanceOrderResponse & { fills?: Array<{ price: string; qty: string; commission?: string; commissionAsset?: string; tradeId?: number }> }> {
    return this.placeMarketOrder({
      symbol: symbol.toUpperCase(),
      side: "SELL",
      quantity,
      clientOrderId
    });
  }

  async cancelOrder(input: { symbol?: string; orderId?: string | number; clientOrderId?: string }) {
    const symbol = (input.symbol ?? this.symbol).toUpperCase();
    const params: Record<string, string | number | undefined> = { symbol };
    if (input.orderId) params.orderId = input.orderId;
    if (input.clientOrderId) params.origClientOrderId = input.clientOrderId;
    return this.signedRequest<any>("DELETE", "/api/v3/order", params);
  }
}


export function splitSpotSymbol(symbol: string) {
  const normalized = symbol.toUpperCase();
  const knownQuotes = ["USDT", "FDUSD", "USDC", "BUSD", "BTC", "ETH", "BNB", "USD"];
  const quoteAsset = knownQuotes.find((q) => normalized.endsWith(q)) ?? "USDT";
  const asset = normalized.slice(0, normalized.length - quoteAsset.length);
  return { asset, quoteAsset };
}

export function buildPositionPayloadFromAccount(input: {
  account: any;
  symbol: string;
  markPrice?: number;
  source?: "exchange" | "runtime" | "manual";
}) {
  const symbol = input.symbol.toUpperCase();
  const { asset, quoteAsset } = splitSpotSymbol(symbol);
  const balances = input.account?.balances ?? [];
  const base = balances.find((b: any) => String(b.asset).toUpperCase() === asset);
  const free = Number(base?.free ?? 0);
  const locked = Number(base?.locked ?? 0);
  const quantity = Number((free + locked).toFixed(12));
  const markPrice = Number(input.markPrice ?? 0);
  const exposure = Number(Math.abs(quantity * markPrice).toFixed(8));

  return {
    symbol,
    asset,
    quoteAsset,
    free,
    locked,
    quantity,
    markPrice,
    exposure,
    source: input.source ?? "exchange"
  };
}

export const binanceSpotTestnet = new BinanceSpotTestnetClient();
