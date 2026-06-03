#!/usr/bin/env node
/**
 * build-perception-slice3.mjs — Derive PerceptionSnapshot from golden market fixtures (offline).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const marketDir = path.join(workspaceRoot, "tests/fixtures/phase3/market-observation");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");

const MARKET_BATCH = "genesis.market-observation.batch.v1";

function parseIso(s) {
  return Date.parse(s);
}

function loadMarketBatch(fileName) {
  return JSON.parse(fs.readFileSync(path.join(marketDir, fileName), "utf8"));
}

function ohlcBars(observations) {
  return observations
    .filter((o) => o.eventType === "OHLC_1M")
    .sort((a, b) => (a.payload?.barIndex ?? 0) - (b.payload?.barIndex ?? 0));
}

function latestTrade(observations) {
  const trades = observations.filter((o) => o.eventType === "TRADE_TICK");
  if (!trades.length) return null;
  return trades.sort((a, b) => parseIso(b.timestamps.observedAt) - parseIso(a.timestamps.observedAt))[0];
}

function deriveRegime(bars) {
  if (bars.length < 2) return "UNKNOWN";
  const c0 = Number(bars[0].payload.close);
  const c1 = Number(bars[bars.length - 1].payload.close);
  if (!Number.isFinite(c0) || !Number.isFinite(c1) || c0 === 0) return "UNKNOWN";
  const pct = Math.abs((c1 - c0) / c0);
  return pct >= 0.001 ? "TRENDING" : "RANGING";
}

function deriveVolatility(bars) {
  if (!bars.length) return "UNKNOWN";
  const b = bars[bars.length - 1].payload;
  const close = Number(b.close);
  const range = Number(b.high) - Number(b.low);
  if (!Number.isFinite(close) || close === 0) return "UNKNOWN";
  const pct = range / close;
  if (pct < 0.001) return "LOW";
  if (pct < 0.005) return "MEDIUM";
  return "HIGH";
}

function deriveAggressiveFlow(trade) {
  if (!trade) return 0;
  if (trade.payload.side === "BUY") return 0.01;
  if (trade.payload.side === "SELL") return -0.01;
  return 0;
}

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function buildSnapshot(marketFile, evidenceRef) {
  const batch = loadMarketBatch(marketFile);
  if (batch.schema !== MARKET_BATCH) throw new Error(`Not a market batch: ${marketFile}`);
  const observations = batch.observations ?? [];
  const symbol = batch.instrument?.symbol ?? observations[0]?.instrument?.symbol;
  const bars = ohlcBars(observations);
  const trade = latestTrade(observations);

  const sourceTimes = observations.map((o) => parseIso(o.timestamps.sourceEventTime)).filter(Number.isFinite);
  const observedTimes = observations.map((o) => parseIso(o.timestamps.observedAt)).filter(Number.isFinite);
  const windowStart = new Date(Math.min(...sourceTimes)).toISOString();
  const windowEnd = new Date(Math.max(...sourceTimes)).toISOString();
  const asOf = new Date(Math.max(...observedTimes)).toISOString();
  const computedAt = new Date(Math.max(...observedTimes) + 500).toISOString();
  const freshnessMs = 500;
  const allOk = observations.every((o) => o.quality?.status === "OK");

  const refs = observations.map((o) => o.observationId);
  const asOfCompact = asOf.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return {
    schema: "genesis.perception-snapshot.v1",
    snapshotId: `psn-${symbol}-${asOfCompact}`,
    instrumentId: symbol,
    asOf,
    sourceObservationRefs: refs,
    freshnessMs,
    integrity: allOk ? "OK" : "YELLOW",
    regime: deriveRegime(bars),
    volatilityState: deriveVolatility(bars),
    liquidityState: "NORMAL",
    orderBookImbalance: 0,
    aggressiveFlowImbalance: deriveAggressiveFlow(trade),
    liquidationPressure: "LOW",
    fundingStress: "NEUTRAL",
    dataQuality: {
      status: allOk ? "OK" : "YELLOW",
      completeness: 1,
      reasonCodes: allOk ? [] : ["RC-DATA-PARTIAL-OBS"]
    },
    provenance: {
      sourceId: `fixture:phase3/market-observation/${marketFile}`,
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE3_RULES_V1",
      lineageHash: lineageHash(refs)
    },
    timestamps: {
      computedAt,
      sourceWindowStart: windowStart,
      sourceWindowEnd: windowEnd
    },
    evidenceRefs: [evidenceRef],
    contractVersion: "genesis.perception-snapshot.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["MarketSelector", "OperatorReadModel"],
    trustSignal: {
      operatorTier: "TIER_1",
      notaryStatus: "YELLOW",
      shellReadinessStatus: "NOT_READY",
      interpretation: "YELLOW_GUARDED"
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const golden = [
    { market: "BTCUSDT-offline-sample.json", out: "BTCUSDT-perception-snapshot.json", em: "EM-P3-PER-001" },
    { market: "ETHUSDT-offline-sample.json", out: "ETHUSDT-perception-snapshot.json", em: "EM-P3-PER-002" }
  ];

  const files = [];
  for (const { market, out, em } of golden) {
    const snap = buildSnapshot(market, em);
    const outPath = path.join(outDir, out);
    fs.writeFileSync(outPath, JSON.stringify(snap, null, 2));
    files.push(out);
  }

  const manifest = {
    schema: "genesis.phase3.slice3-perception-manifest.v1",
    slice: 3,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/market-observation",
    files,
    negativeFiles: ["negative-scenario-id-on-perception.json"],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice3-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ ok: true, written: files.length, outDir: "tests/fixtures/phase3/perception" }, null, 2));
}

main();
