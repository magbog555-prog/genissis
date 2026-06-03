#!/usr/bin/env node
/**
 * expand-profitops-batch-v3.mjs — Sprint 7: expand slice12 paper batch to n>=100.
 * Clones base ETH/BTC fixtures with entry/exit jitter, regime (TREND/RANGE/CHOP), session (ASIA/LONDON/NY).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeHistoryDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-history");
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");
const profitopsDir = path.join(workspaceRoot, "tests/fixtures/phase3/profitops");

const BATCH_SCHEMA = "genesis.phase3.slice12-profitops-trade-batch.v1";
const EXPANSION_ID = "profitops-expanded-sample-v3";
const TARGET_TRADES = 100;

const REGIME_TAGS = ["TREND", "RANGE", "CHOP"];
const SESSION_TAGS = ["ASIA", "LONDON", "NY"];

const BASE_TEMPLATES = {
  ETHUSDT: {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline.json",
    instSlug: "ethusdt"
  },
  BTCUSDT: {
    tradeHistory: "trade-history-liquidity-sweep-btcusdt-offline.json",
    paperExecution: "paper-execution-liquidity-sweep-btcusdt-offline.json",
    instSlug: "btcusdt"
  }
};

const LEGACY_REGIME_MAP = {
  TRENDING: "TREND",
  RANGING: "RANGE",
  VOLATILE: "CHOP"
};

function shaLineage(parts) {
  return `sha256:${createHash("sha256").update(parts.join("|")).digest("hex")}`;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function jitterPrice(price, seed, maxBps = 12) {
  const deltaBps = ((seed * 17 + 7) % (maxBps * 2 + 1)) - maxBps;
  return Math.round(price * (1 + deltaBps / 10_000));
}

function buildPlan(instrumentId, win, seed) {
  if (instrumentId === "BTCUSDT") {
    const entryLow = jitterPrice(95200, seed);
    const entryHigh = jitterPrice(95800, seed + 1);
    const invalidationLevel = jitterPrice(94000, seed + 2, 8);
    const entryMid = (entryLow + entryHigh) / 2;
    const takeProfitLevels = win
      ? [jitterPrice(97000, seed + 3), jitterPrice(97500, seed + 4)]
      : [invalidationLevel];
    return { entryZone: { low: entryLow, high: entryHigh }, invalidationLevel, takeProfitLevels, entryMid };
  }
  const entryLow = jitterPrice(3450, seed);
  const entryHigh = jitterPrice(3490, seed + 1);
  const invalidationLevel = jitterPrice(3410, seed + 2, 8);
  const takeProfitLevels = win
    ? [jitterPrice(3535, seed + 3), jitterPrice(3590, seed + 4)]
    : [invalidationLevel];
  return {
    entryZone: { low: entryLow, high: entryHigh },
    invalidationLevel,
    takeProfitLevels,
    entryMid: (entryLow + entryHigh) / 2
  };
}

function clonePair({ suffix, instrumentId, regimeTag, sessionTag, win, index }) {
  const tpl = BASE_TEMPLATES[instrumentId];
  const basePe = loadJson(path.join(paperExecutionDir, tpl.paperExecution));
  const baseTh = loadJson(path.join(tradeHistoryDir, tpl.tradeHistory));
  const tag = suffix.toUpperCase();
  const peId = `PEX-TC-ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`;
  const plan = buildPlan(instrumentId, win, index);
  const ts = `2026-06-03T${String(6 + Math.floor(index / 12) % 18).padStart(2, "0")}:${String((index * 11) % 60).padStart(2, "0")}:00.000Z`;

  const paperExecution = deepClone(basePe);
  paperExecution.paperExecutionId = peId;
  paperExecution.instrumentId = instrumentId;
  paperExecution.tradeCardRef = `TC-ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`;
  paperExecution.admissionRef = `ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`;
  paperExecution.scenarioRef = `SCN-LIQUIDITY-SWEEP-RECLAIM-${tag}`;
  paperExecution.simulationPlan = {
    entryZone: plan.entryZone,
    invalidationLevel: plan.invalidationLevel,
    takeProfitLevels: plan.takeProfitLevels
  };
  paperExecution.simulationTimestamps = {
    computedAt: ts,
    expiresAt: "2026-06-01T13:01:06.000Z"
  };
  paperExecution.provenance = {
    sourceId: `fixture:phase3/trade-card/trade-card-liquidity-sweep-${tpl.instSlug}-offline.json`,
    sourceKind: "DERIVED_ENGINE",
    derivation: "OFFLINE_SLICE12_EXPANDED_V3",
    lineageHash: shaLineage([peId, regimeTag, sessionTag, String(win)])
  };
  paperExecution.evidenceRefs = [`EM-P3-PEX-${suffix}`];

  const tradeHistory = deepClone(baseTh);
  tradeHistory.tradeHistoryId = `TH-${peId}`;
  tradeHistory.historyId = `TH-${peId}`;
  tradeHistory.instrumentId = instrumentId;
  tradeHistory.paperExecutionRef = peId;
  tradeHistory.tradeCardRef = paperExecution.tradeCardRef;
  tradeHistory.admissionRef = paperExecution.admissionRef;
  tradeHistory.scenarioRef = paperExecution.scenarioRef;
  tradeHistory.simulatedOutcome = {
    simulationStatus: "PAPER_SIMULATED",
    entryZone: plan.entryZone,
    invalidationLevel: plan.invalidationLevel,
    takeProfitLevels: plan.takeProfitLevels
  };
  tradeHistory.historyTimestamps = {
    computedAt: ts.replace(/:00\.000Z$/, ":01.000Z"),
    sourceComputedAt: ts
  };
  tradeHistory.provenance = {
    sourceId: `fixture:phase3/paper-execution/paper-execution-liquidity-sweep-${tpl.instSlug}-offline-${suffix}.json`,
    sourceKind: "DERIVED_ENGINE",
    derivation: "OFFLINE_SLICE12_EXPANDED_V3",
    lineageHash: shaLineage([`TH-${peId}`, regimeTag, sessionTag])
  };
  tradeHistory.evidenceRefs = [`EM-P3-TH-${suffix}`];

  const peName = `paper-execution-liquidity-sweep-${tpl.instSlug}-offline-${suffix}.json`;
  const thName = `trade-history-liquidity-sweep-${tpl.instSlug}-offline-${suffix}.json`;

  fs.mkdirSync(paperExecutionDir, { recursive: true });
  fs.mkdirSync(tradeHistoryDir, { recursive: true });
  fs.writeFileSync(path.join(paperExecutionDir, peName), JSON.stringify(paperExecution, null, 2));
  fs.writeFileSync(path.join(tradeHistoryDir, thName), JSON.stringify(tradeHistory, null, 2));

  return {
    tradeHistory: thName,
    paperExecution: peName,
    regimeTag,
    sessionTag
  };
}

function loadExistingBatchTrades() {
  const batchPath = path.join(profitopsDir, "slice12-trade-batch.json");
  if (!fs.existsSync(batchPath)) return [];
  const batch = loadJson(batchPath);
  return (batch.trades ?? []).map((t, i) => ({
    ...t,
    regimeTag: LEGACY_REGIME_MAP[t.regimeTag] ?? t.regimeTag ?? REGIME_TAGS[i % REGIME_TAGS.length],
    sessionTag: t.sessionTag ?? SESSION_TAGS[i % SESSION_TAGS.length]
  }));
}

function main() {
  const existing = loadExistingBatchTrades();
  const trades = [...existing];
  let index = trades.length;

  while (trades.length < TARGET_TRADES) {
    const suffix = `b${trades.length + 1}`;
    const instrumentId = index % 2 === 0 ? "ETHUSDT" : "BTCUSDT";
    const regimeTag = REGIME_TAGS[index % REGIME_TAGS.length];
    const sessionTag = SESSION_TAGS[index % SESSION_TAGS.length];
    const win = index % 10 !== 3 && index % 10 !== 7;
    trades.push(clonePair({ suffix, instrumentId, regimeTag, sessionTag, win, index }));
    index += 1;
  }

  const regimeTags = [...new Set(trades.map((t) => t.regimeTag))];
  const sessionTags = [...new Set(trades.map((t) => t.sessionTag))];

  const batch = {
    schema: BATCH_SCHEMA,
    slice: 12,
    mode: "PAPER_OFFLINE_ONLY",
    expansion: EXPANSION_ID,
    regimeTags,
    sessionTags,
    trades
  };

  fs.mkdirSync(profitopsDir, { recursive: true });
  fs.writeFileSync(path.join(profitopsDir, "slice12-trade-batch.json"), JSON.stringify(batch, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        expansion: EXPANSION_ID,
        tradeCount: trades.length,
        newFixtures: Math.max(0, trades.length - existing.length),
        regimeTags,
        sessionTags
      },
      null,
      2
    )
  );
}

main();
