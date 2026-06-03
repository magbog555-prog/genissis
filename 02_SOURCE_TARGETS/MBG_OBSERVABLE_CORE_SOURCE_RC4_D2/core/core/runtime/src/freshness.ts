import { RuntimeSnapshot } from "../../state/src/types.js";

export type FreshnessStatus = "unknown" | "fresh" | "stale" | "expired" | "unavailable";

export type FreshnessDenyReason =
  | "market_data_stale"
  | "exchange_truth_stale"
  | "connection_state_unknown"
  | "freshness_unknown";

export interface FreshnessConfig {
  maxMarketAgeMs: number;
  maxExchangeAgeMs: number;
  maxConnectionAgeMs: number;
}

export interface FreshnessInputs {
  lastMarketEventAt?: string | null;
  lastBookTickerAt?: string | null;
  lastExchangeReconcileAt?: string | null;
  exchangeTruthStatus?: string | null;
  lastConnectionHeartbeatAt?: string | null;
  connectionStatus?: true | false | "unknown" | "stale" | null;
  maxMarketAgeMs?: number;
  maxExchangeAgeMs?: number;
  maxConnectionAgeMs?: number;
}

export interface FreshnessCheck {
  status: FreshnessStatus;
  lastObservedAt?: string;
  ageMs?: number;
  maxAgeMs: number;
  reason?: FreshnessDenyReason;
}

export interface FreshnessReport {
  asOf: string;
  marketDataFreshness: FreshnessCheck;
  exchangeTruthFreshness: FreshnessCheck;
  connectionFreshness: FreshnessCheck;
  blockingReasons: FreshnessDenyReason[];
  okForNormalTrading: boolean;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  maxMarketAgeMs: Number(process.env.MBG_MAX_MARKET_AGE_MS ?? 15_000),
  maxExchangeAgeMs: Number(process.env.MBG_MAX_EXCHANGE_AGE_MS ?? 60_000),
  maxConnectionAgeMs: Number(process.env.MBG_MAX_CONNECTION_AGE_MS ?? 30_000)
};

function parseTimestamp(value: string | null | undefined): number | undefined {
  if (value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function latestTimestamp(values: Array<string | null | undefined>): string | undefined {
  let selected: { raw: string; ms: number } | undefined;
  for (const value of values) {
    const ms = parseTimestamp(value);
    if (ms === undefined || typeof value !== "string") continue;
    if (!selected || ms > selected.ms) selected = { raw: value, ms };
  }
  return selected?.raw;
}

function classifyTimestamp(
  value: string | null | undefined,
  nowMs: number,
  maxAgeMs: number,
  staleReason: FreshnessDenyReason,
  unknownReason: FreshnessDenyReason = "freshness_unknown"
): FreshnessCheck {
  if (value === null) {
    return { status: "unavailable", maxAgeMs, reason: staleReason };
  }

  const observedMs = parseTimestamp(value);
  if (observedMs === undefined || typeof value !== "string") {
    return { status: "unknown", maxAgeMs, reason: unknownReason };
  }

  const ageMs = nowMs - observedMs;

  if (ageMs < 0) {
    return {
      status: "unknown",
      lastObservedAt: value,
      ageMs,
      maxAgeMs,
      reason: unknownReason
    };
  }

  if (ageMs <= maxAgeMs) {
    return {
      status: "fresh",
      lastObservedAt: value,
      ageMs,
      maxAgeMs
    };
  }

  return {
    status: ageMs > maxAgeMs * 2 ? "expired" : "stale",
    lastObservedAt: value,
    ageMs,
    maxAgeMs,
    reason: staleReason
  };
}

export function collectFreshnessInputs(snapshot: RuntimeSnapshot): FreshnessInputs {
  return {
    lastMarketEventAt: snapshot.market.lastTickAt,
    lastBookTickerAt: snapshot.market.bid !== undefined && snapshot.market.ask !== undefined ? snapshot.market.lastTickAt : undefined,
    lastExchangeReconcileAt: snapshot.exchangeTruth.lastPositionReconcileAt ?? snapshot.exchangeTruth.lastAccountReconcileAt ?? snapshot.exchangeTruth.lastOrderReconcileAt ?? snapshot.exchangeTruth.lastFillSyncAt,
    exchangeTruthStatus: snapshot.exchangeTruth.status,
    lastConnectionHeartbeatAt: snapshot.system.lastConnectionHeartbeatAt,
    maxMarketAgeMs: DEFAULT_FRESHNESS_CONFIG.maxMarketAgeMs,
    maxExchangeAgeMs: DEFAULT_FRESHNESS_CONFIG.maxExchangeAgeMs,
    maxConnectionAgeMs: DEFAULT_FRESHNESS_CONFIG.maxConnectionAgeMs
  };
}

export function calculateFreshness(
  inputs: FreshnessInputs,
  options: { now: string | Date; config?: Partial<FreshnessConfig> }
): FreshnessReport {
  const nowMs = options.now instanceof Date ? options.now.getTime() : Date.parse(options.now);
  if (!Number.isFinite(nowMs)) {
    throw new Error(`Invalid freshness evaluation timestamp: ${String(options.now)}`);
  }

  const config: FreshnessConfig = {
    ...DEFAULT_FRESHNESS_CONFIG,
    ...options.config,
    maxMarketAgeMs: inputs.maxMarketAgeMs ?? options.config?.maxMarketAgeMs ?? DEFAULT_FRESHNESS_CONFIG.maxMarketAgeMs,
    maxExchangeAgeMs: inputs.maxExchangeAgeMs ?? options.config?.maxExchangeAgeMs ?? DEFAULT_FRESHNESS_CONFIG.maxExchangeAgeMs,
    maxConnectionAgeMs: inputs.maxConnectionAgeMs ?? options.config?.maxConnectionAgeMs ?? DEFAULT_FRESHNESS_CONFIG.maxConnectionAgeMs
  };

  const marketObservedAt = latestTimestamp([inputs.lastMarketEventAt, inputs.lastBookTickerAt]);

  const marketDataFreshness = classifyTimestamp(
    marketObservedAt,
    nowMs,
    config.maxMarketAgeMs,
    "market_data_stale",
    "freshness_unknown"
  );

  const exchangeTruthFreshness =
    inputs.exchangeTruthStatus && inputs.exchangeTruthStatus !== "fresh"
      ? {
          status: inputs.exchangeTruthStatus === "unavailable" ? "unavailable" : inputs.exchangeTruthStatus === "stale" ? "stale" : "unknown",
          maxAgeMs: config.maxExchangeAgeMs,
          reason: inputs.exchangeTruthStatus === "stale" ? "exchange_truth_stale" : "exchange_truth_stale"
        } as FreshnessCheck
      : classifyTimestamp(
          inputs.lastExchangeReconcileAt,
          nowMs,
          config.maxExchangeAgeMs,
          "exchange_truth_stale",
          "freshness_unknown"
        );

  const connectionFreshness =
    inputs.connectionStatus === true
      ? classifyTimestamp(
          inputs.lastConnectionHeartbeatAt,
          nowMs,
          config.maxConnectionAgeMs,
          "connection_state_unknown",
          "connection_state_unknown"
        )
      : inputs.connectionStatus === false || inputs.connectionStatus === "unknown" || inputs.connectionStatus === "stale"
        ? {
            status: inputs.connectionStatus === "stale" ? "stale" : "unknown",
            maxAgeMs: config.maxConnectionAgeMs,
            reason: "connection_state_unknown"
          } as FreshnessCheck
        : classifyTimestamp(
            inputs.lastConnectionHeartbeatAt,
            nowMs,
            config.maxConnectionAgeMs,
            "connection_state_unknown",
            "connection_state_unknown"
          );

  const blockingReasons = [
    marketDataFreshness.reason,
    exchangeTruthFreshness.reason,
    connectionFreshness.reason
  ].filter((reason): reason is FreshnessDenyReason => Boolean(reason));

  return {
    asOf: new Date(nowMs).toISOString(),
    marketDataFreshness,
    exchangeTruthFreshness,
    connectionFreshness,
    blockingReasons: Array.from(new Set(blockingReasons)),
    okForNormalTrading:
      marketDataFreshness.status === "fresh" &&
      exchangeTruthFreshness.status === "fresh" &&
      connectionFreshness.status === "fresh"
  };
}

export function calculateSnapshotFreshness(
  snapshot: RuntimeSnapshot,
  options: { now: string | Date; config?: Partial<FreshnessConfig> }
): FreshnessReport {
  return calculateFreshness(collectFreshnessInputs(snapshot), options);
}
