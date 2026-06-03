#!/usr/bin/env node
/**
 * mbg-readonly-to-observation.mjs — MBG readonly API → Genesis MarketObservation
 * Owner GO: 42_OWNER_GO_WIRE_AND_L2_HYBRID_UI_RU.md
 * Allowed: GET http://127.0.0.1:3011 only. No keys. No POST.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "../verification/genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();

const BASE_URL = (process.env.CORE_READONLY_API_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const OBS_SCHEMA = "genesis.market-observation.v1";
const BATCH_SCHEMA = "genesis.market-observation.batch.v1";

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function compactIso(iso) {
  if (!iso) return "unknown";
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function fetchJson(urlPath, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}${urlPath}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${urlPath}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapEventType(mbgType) {
  const t = String(mbgType ?? "unknown").toLowerCase();
  if (t === "trade") return "TRADE_TICK";
  if (t === "kline") return "OHLC_1M";
  if (t === "bookticker") return "BOOK_SNAPSHOT_L1";
  return "TRADE_TICK";
}

function buildObservationFromLastEvent(lastEvent, liveStatus, health, healthPayload) {
  const symbol = String(lastEvent?.symbol ?? liveStatus?.symbol ?? "BTCUSDT").toUpperCase();
  const baseAsset = symbol.replace(/USDT$/, "") || symbol.slice(0, 3);
  const observedAt = new Date().toISOString();
  const sourceEventTime = lastEvent?.eventTime ?? lastEvent?.receivedAt ?? observedAt;
  const sourceMs = Date.parse(sourceEventTime);
  const observedMs = Date.parse(observedAt);
  const computedAgeMs = Number.isFinite(sourceMs) ? Math.max(0, observedMs - sourceMs) : 0;
  const hasPrice = lastEvent?.price != null && Number.isFinite(Number(lastEvent.price));
  const eventType = mapEventType(lastEvent?.eventType);
  const obsId = `obs-wire-${symbol}-${eventType}-${compactIso(sourceEventTime)}`;

  const qualityStatus = hasPrice ? "OK" : "DEGRADED";
  const degradationReason = hasPrice ? null : "Live stream last-event has no numeric price yet";
  return {
    schema: OBS_SCHEMA,
    observationId: obsId,
    instrument: {
      symbol,
      venue: "MBG_READONLY_API",
      marketType: "SPOT",
      baseAsset,
      quoteAsset: "USDT"
    },
    eventType,
    observationClass: hasPrice ? "FACT" : "NOISE",
    timestamps: {
      sourceEventTime: Number.isFinite(sourceMs) ? new Date(sourceMs).toISOString() : observedAt,
      observedAt,
      ingestedAt: observedAt
    },
    provenance: {
      sourceId: `mbg:readonly-api:3011/api/core/live-stream/last-event`,
      sourceKind: "MBG_READONLY_API",
      ingestMode: "LIVE_REST",
      lineageHash: lineageHash([
        BASE_URL,
        "/api/core/live-stream/last-event",
        symbol,
        String(lastEvent?.eventType ?? "unknown"),
        String(lastEvent?.price ?? "null")
      ]),
      fixtureVersion: "wire-v1",
      derivation: "MBG_READONLY_TO_OBSERVATION_V1"
    },
    freshness: {
      maxAgeMs: Number(liveStatus?.freshnessThresholdMs ?? 5000),
      computedAgeMs,
      status: computedAgeMs <= 5000 ? "FRESH" : "STALE",
      clockSkewMs: 0
    },
    quality: {
      status: qualityStatus,
      completeness: hasPrice ? 1 : 0.5,
      gapDetected: !hasPrice,
      conflictDetected: false,
      reasonCodes: hasPrice ? [] : ["RC-WIRE-NO-LIVE-EVENT-YET"],
      ...(degradationReason ? { degradationReason } : {})
    },
    payload: {
      price: hasPrice ? String(lastEvent.price) : null,
      quantity: lastEvent?.quantity != null ? String(lastEvent.quantity) : null,
      side: null,
      mbgEventType: lastEvent?.eventType ?? "unknown",
      executionSurface: lastEvent?.executionSurface ?? "closed",
      readOnly: lastEvent?.readOnly ?? true,
      provider: lastEvent?.provider ?? "Binance",
      rawSummary: lastEvent?.rawSummary ?? { present: false }
    },
    evidenceRefs: ["EM-P3-WIRE-001"],
    wireMeta: {
      coreHealth: healthPayload?.service ?? health?.service ?? "mbg-core-connected-readonly-api",
      liveStreamConnected: Boolean(liveStatus?.liveExchangeConnected),
      connectionStatus: liveStatus?.connectionStatus ?? "unknown",
      trustState: liveStatus?.trustState ?? "UNCERTAIN",
      actionVerdict: liveStatus?.actionVerdict ?? "prohibited"
    }
  };
}

export async function wireMbgToObservation(options = {}) {
  const writeSample = options.writeSample !== false;
  const outSample = path.join(
    workspaceRoot,
    "tests/fixtures/phase3/market-observation/mbg-wire-live-sample.json"
  );

  let health;
  try {
    health = await fetchJson("/health");
  } catch (err) {
    return {
      ok: false,
      status: "YELLOW",
      coreReachable: false,
      baseUrl: BASE_URL,
      message: `Core not reachable on ${BASE_URL}: ${err.message}`,
      observation: null
    };
  }

  const [liveStatus, lastEvent, overview] = await Promise.all([
    fetchJson("/api/core/live-stream/status"),
    fetchJson("/api/core/live-stream/last-event"),
    fetchJson("/api/core/overview")
  ]);

  const observation = buildObservationFromLastEvent(lastEvent, liveStatus, health, health);
  const batch = {
    schema: BATCH_SCHEMA,
    slice: "wire",
    mode: "MBG_READONLY_API",
    instrument: observation.instrument,
    observations: [observation],
    wireEndpoints: ["/health", "/api/core/live-stream/status", "/api/core/live-stream/last-event", "/api/core/overview"],
    mbgOverview: {
      overallState: overview?.overallState,
      trustState: overview?.trustState,
      executionSurface: overview?.executionSurface
    },
    notaryGreenClaimed: false,
    liveIngestion: true,
    executionAllowed: false
  };

  if (writeSample) {
    fs.mkdirSync(path.dirname(outSample), { recursive: true });
    fs.writeFileSync(outSample, JSON.stringify(batch, null, 2));
  }

  return {
    ok: true,
    status: "PASS",
    coreReachable: true,
    baseUrl: BASE_URL,
    samplePath: "tests/fixtures/phase3/market-observation/mbg-wire-live-sample.json",
    observationId: observation.observationId,
    instrumentId: observation.instrument.symbol,
    eventType: observation.eventType,
    observation,
    batch
  };
}

async function main() {
  const result = await wireMbgToObservation();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
