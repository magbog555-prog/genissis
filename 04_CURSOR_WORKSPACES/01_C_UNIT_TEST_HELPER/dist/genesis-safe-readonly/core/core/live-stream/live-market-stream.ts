
import WebSocket from "ws";

export type LiveStreamConnectionStatus = "disconnected" | "connecting" | "connected" | "degraded" | "error";
export type LiveStreamFreshnessStatus = "fresh" | "stale" | "unknown";
export type LiveStreamSequenceStatus = "ok" | "gap" | "unknown";
export type LiveStreamExchangeProofStatus = "missing" | "pending" | "verified";

export interface RawSummary {
  present: boolean;
  omittedForUiSafety: true;
  reason?: string;
}

export interface LiveMarketStreamDTO {
  dto: "LiveMarketStreamDTO";
  adapterMode: "live-readonly";
  provider: "Binance";
  symbol: string;
  connectionStatus: LiveStreamConnectionStatus;
  liveExchangeConnected: boolean;
  lastEventAt: string | null;
  ageMs: number | null;
  latencyMs: number | null;
  marketFreshnessStatus: LiveStreamFreshnessStatus;
  sequenceStatus: LiveStreamSequenceStatus;
  reconnectCount: number;
  disconnectReason: string | null;
  exchangeProofStatus: LiveStreamExchangeProofStatus;
  exchangeProofValid: false;
  executionSurface: "closed";
  actionVerdict: "prohibited";
  trustState: "UNCERTAIN";
  readOnly: true;
  streamUrl: string | null;
}

export interface LiveMarketStreamEventDTO {
  dto: "LiveMarketStreamEventDTO";
  provider: "Binance";
  symbol: string;
  eventType: "trade" | "ticker" | "bookTicker" | "kline" | "unknown";
  eventTime: string | null;
  receivedAt: string;
  price: number | null;
  quantity: number | null;
  rawSummary: RawSummary;
  executionSurface: "closed";
  readOnly: true;
}

export interface LiveStreamConfig {
  enabled: boolean;
  provider: "binance";
  symbol: string;
  url: string;
  mode: "readonly";
  freshnessThresholdMs: number;
}

export function readLiveStreamConfig(env: NodeJS.ProcessEnv = process.env): LiveStreamConfig {
  const symbol = String(env.LIVE_STREAM_SYMBOL ?? "BTCUSDT").toUpperCase();
  const lowerSymbol = symbol.toLowerCase();
  return {
    enabled: String(env.LIVE_STREAM_ENABLED ?? "false").toLowerCase() === "true",
    provider: "binance",
    symbol,
    url: String(env.LIVE_STREAM_URL ?? `wss://stream.binance.com:9443/ws/${lowerSymbol}@trade`),
    mode: "readonly",
    freshnessThresholdMs: Number(env.LIVE_STREAM_FRESHNESS_THRESHOLD_MS ?? 5000)
  };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isoFromEpochMs(value: unknown): string | null {
  const n = numberOrNull(value);
  if (n === null || n <= 0) return null;
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function eventType(raw: Record<string, unknown>): LiveMarketStreamEventDTO["eventType"] {
  const e = raw.e;
  if (e === "trade") return "trade";
  if (e === "24hrTicker" || e === "ticker") return "ticker";
  if (e === "bookTicker" || "b" in raw || "a" in raw) return "bookTicker";
  if (e === "kline") return "kline";
  return "unknown";
}

export function normalizeBinancePublicEvent(raw: unknown, receivedAt = new Date()): LiveMarketStreamEventDTO | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const symbol = typeof record.s === "string" ? record.s.toUpperCase() : "BTCUSDT";
  const eventTime = isoFromEpochMs(record.E ?? record.T);
  const type = eventType(record);
  const price = numberOrNull(record.p ?? record.c ?? record.b);
  const quantity = numberOrNull(record.q ?? record.Q);
  return {
    dto: "LiveMarketStreamEventDTO",
    provider: "Binance",
    symbol,
    eventType: type,
    eventTime,
    receivedAt: receivedAt.toISOString(),
    price,
    quantity,
    rawSummary: {
      present: true,
      omittedForUiSafety: true,
      reason: "live_payload_omitted_for_ui_safety"
    },
    executionSurface: "closed",
    readOnly: true
  };
}

export class LiveReadOnlyMarketStream {
  private socket: WebSocket | null = null;
  private status: LiveMarketStreamDTO;
  private lastEvent: LiveMarketStreamEventDTO | null = null;
  private readonly config: LiveStreamConfig;

  constructor(config: LiveStreamConfig = readLiveStreamConfig()) {
    this.config = config;
    this.status = this.buildInitialStatus();
  }

  private buildInitialStatus(): LiveMarketStreamDTO {
    return {
      dto: "LiveMarketStreamDTO",
      adapterMode: "live-readonly",
      provider: "Binance",
      symbol: this.config.symbol,
      connectionStatus: this.config.enabled ? "disconnected" : "disconnected",
      liveExchangeConnected: false,
      lastEventAt: null,
      ageMs: null,
      latencyMs: null,
      marketFreshnessStatus: "unknown",
      sequenceStatus: "unknown",
      reconnectCount: 0,
      disconnectReason: this.config.enabled ? "not_started" : "disabled",
      exchangeProofStatus: "missing",
      exchangeProofValid: false,
      executionSurface: "closed",
      actionVerdict: "prohibited",
      trustState: "UNCERTAIN",
      readOnly: true,
      streamUrl: this.config.enabled ? this.config.url : null
    };
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.status = {
        ...this.status,
        connectionStatus: "disconnected",
        liveExchangeConnected: false,
        disconnectReason: "disabled",
        exchangeProofStatus: "missing",
        exchangeProofValid: false,
        executionSurface: "closed",
        actionVerdict: "prohibited",
        trustState: "UNCERTAIN",
        readOnly: true
      };
      return;
    }

    if (this.socket && this.isConnected()) return;
    this.status = {
      ...this.status,
      connectionStatus: "connecting",
      disconnectReason: null,
      streamUrl: this.config.url,
      exchangeProofStatus: "pending",
      exchangeProofValid: false,
      executionSurface: "closed",
      actionVerdict: "prohibited",
      trustState: "UNCERTAIN"
    };

    try {
      this.socket = new WebSocket(this.config.url);
      this.socket.on("open", () => {
        this.status = {
          ...this.status,
          connectionStatus: "connected",
          liveExchangeConnected: true,
          disconnectReason: null,
          exchangeProofStatus: "pending",
          exchangeProofValid: false,
          executionSurface: "closed",
          actionVerdict: "prohibited",
          trustState: "UNCERTAIN"
        };
      });
      this.socket.on("message", (message) => {
        try {
          const raw = JSON.parse(message.toString());
          this.ingestRawEvent(raw);
        } catch {
          this.status = {
            ...this.status,
            connectionStatus: this.status.connectionStatus === "connected" ? "degraded" : this.status.connectionStatus,
            disconnectReason: "invalid_json_payload"
          };
        }
      });
      this.socket.on("error", (error) => {
        this.status = {
          ...this.status,
          connectionStatus: "error",
          liveExchangeConnected: false,
          disconnectReason: error instanceof Error ? error.message : "websocket_error",
          exchangeProofStatus: "missing",
          exchangeProofValid: false,
          actionVerdict: "prohibited",
          trustState: "UNCERTAIN",
          executionSurface: "closed"
        };
      });
      this.socket.on("close", () => {
        this.status = {
          ...this.status,
          connectionStatus: "disconnected",
          liveExchangeConnected: false,
          disconnectReason: this.status.disconnectReason ?? "closed",
          exchangeProofStatus: "missing",
          exchangeProofValid: false,
          actionVerdict: "prohibited",
          trustState: "UNCERTAIN",
          executionSurface: "closed"
        };
      });
    } catch (error) {
      this.status = {
        ...this.status,
        connectionStatus: "error",
        liveExchangeConnected: false,
        disconnectReason: error instanceof Error ? error.message : "websocket_start_failed",
        exchangeProofStatus: "missing",
        exchangeProofValid: false,
        actionVerdict: "prohibited",
        trustState: "UNCERTAIN",
        executionSurface: "closed"
      };
    }
  }

  async stop(): Promise<void> {
    try {
      this.socket?.close();
    } catch {
      // read-only stop is best-effort
    } finally {
      this.socket = null;
      this.status = {
        ...this.status,
        connectionStatus: "disconnected",
        liveExchangeConnected: false,
        disconnectReason: "stopped",
        exchangeProofStatus: "missing",
        exchangeProofValid: false,
        executionSurface: "closed",
        actionVerdict: "prohibited",
        trustState: "UNCERTAIN"
      };
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN || this.status.connectionStatus === "connected";
  }

  ingestRawEvent(raw: unknown): LiveMarketStreamEventDTO | null {
    const event = normalizeBinancePublicEvent(raw);
    if (!event) {
      this.status = {
        ...this.status,
        connectionStatus: this.status.connectionStatus === "connected" ? "degraded" : this.status.connectionStatus,
        disconnectReason: "invalid_live_event",
        marketFreshnessStatus: "unknown",
        sequenceStatus: "unknown",
        exchangeProofStatus: this.status.liveExchangeConnected ? "pending" : "missing",
        exchangeProofValid: false,
        actionVerdict: "prohibited",
        trustState: "UNCERTAIN",
        executionSurface: "closed"
      };
      return null;
    }

    const received = Date.parse(event.receivedAt);
    const sourceTime = event.eventTime ? Date.parse(event.eventTime) : received;
    const latencyMs = Number.isFinite(received) && Number.isFinite(sourceTime) ? Math.max(0, received - sourceTime) : null;
    this.lastEvent = event;
    this.status = {
      ...this.status,
      connectionStatus:
        this.status.connectionStatus === "connecting" || this.status.connectionStatus === "disconnected"
          ? "connected"
          : this.status.connectionStatus,
      liveExchangeConnected: true,
      lastEventAt: event.receivedAt,
      ageMs: 0,
      latencyMs,
      marketFreshnessStatus: "fresh",
      sequenceStatus: "ok",
      disconnectReason: null,
      exchangeProofStatus: "pending",
      exchangeProofValid: false,
      actionVerdict: "prohibited",
      trustState: "UNCERTAIN",
      executionSurface: "closed",
      readOnly: true
    };
    return event;
  }

  getStatus(now = new Date()): LiveMarketStreamDTO {
    const ageMs = this.status.lastEventAt ? Math.max(0, now.getTime() - Date.parse(this.status.lastEventAt)) : null;
    const marketFreshnessStatus: LiveStreamFreshnessStatus =
      ageMs === null ? this.status.marketFreshnessStatus : ageMs <= this.config.freshnessThresholdMs ? "fresh" : "stale";
    return {
      ...this.status,
      ageMs,
      marketFreshnessStatus,
      exchangeProofValid: false,
      exchangeProofStatus: this.status.liveExchangeConnected ? "pending" : "missing",
      actionVerdict: "prohibited",
      trustState: "UNCERTAIN",
      executionSurface: "closed",
      readOnly: true
    };
  }

  getLastEvent(): LiveMarketStreamEventDTO | null {
    return this.lastEvent;
  }

  getHealth() {
    const status = this.getStatus();
    return {
      ok: true,
      readOnly: true,
      connectionStatus: status.connectionStatus,
      liveExchangeConnected: status.liveExchangeConnected,
      exchangeProofStatus: status.exchangeProofStatus,
      exchangeProofValid: false,
      executionSurface: "closed" as const,
      actionVerdict: "prohibited" as const,
      trustState: "UNCERTAIN" as const
    };
  }
}

export const liveReadOnlyMarketStream = new LiveReadOnlyMarketStream();
