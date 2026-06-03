#!/usr/bin/env node
/**
 * One-shot generator: slice12 expanded offline paper fixtures (b6..b20) + batch manifest.
 * Synthetic PAPER only — varied ETH/BTC, win/loss, regimes.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeHistoryDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-history");
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");
const profitopsDir = path.join(workspaceRoot, "tests/fixtures/phase3/profitops");

function shaLineage(parts) {
  return `sha256:${createHash("sha256").update(parts.join("|")).digest("hex")}`;
}

/** @type {Array<{suffix:string,instrumentId:"ETHUSDT"|"BTCUSDT",regimeTag:string,win:boolean,profile:"tight"|"wide"}>} */
const SPECS = [
  { suffix: "b6", instrumentId: "ETHUSDT", regimeTag: "TRENDING", win: true, profile: "wide" },
  { suffix: "b7", instrumentId: "BTCUSDT", regimeTag: "RANGING", win: true, profile: "tight" },
  { suffix: "b8", instrumentId: "BTCUSDT", regimeTag: "TRENDING", win: false, profile: "tight" },
  { suffix: "b9", instrumentId: "ETHUSDT", regimeTag: "VOLATILE", win: true, profile: "tight" },
  { suffix: "b10", instrumentId: "ETHUSDT", regimeTag: "RANGING", win: false, profile: "tight" },
  { suffix: "b11", instrumentId: "BTCUSDT", regimeTag: "VOLATILE", win: true, profile: "wide" },
  { suffix: "b12", instrumentId: "ETHUSDT", regimeTag: "TRENDING", win: true, profile: "tight" },
  { suffix: "b13", instrumentId: "BTCUSDT", regimeTag: "RANGING", win: true, profile: "wide" },
  { suffix: "b14", instrumentId: "ETHUSDT", regimeTag: "RANGING", win: false, profile: "tight" },
  { suffix: "b15", instrumentId: "BTCUSDT", regimeTag: "TRENDING", win: true, profile: "tight" },
  { suffix: "b16", instrumentId: "ETHUSDT", regimeTag: "VOLATILE", win: true, profile: "wide" },
  { suffix: "b17", instrumentId: "BTCUSDT", regimeTag: "TRENDING", win: false, profile: "tight" },
  { suffix: "b18", instrumentId: "ETHUSDT", regimeTag: "TRENDING", win: true, profile: "tight" },
  { suffix: "b19", instrumentId: "BTCUSDT", regimeTag: "RANGING", win: true, profile: "wide" },
  { suffix: "b20", instrumentId: "ETHUSDT", regimeTag: "RANGING", win: false, profile: "tight" }
];

function planFor(spec) {
  if (spec.instrumentId === "BTCUSDT") {
    const entry = { low: 95200, high: 95800 };
    const invalidationLevel = 94000;
    const entryMid = (entry.low + entry.high) / 2;
    const takeProfitLevels = spec.win
      ? spec.profile === "wide"
        ? [97200, 97800]
        : [96400]
      : [invalidationLevel];
    return { entryZone: entry, invalidationLevel, takeProfitLevels, entryMid };
  }
  const entry = { low: 3450, high: 3490 };
  const invalidationLevel = 3410;
  const entryMid = (entry.low + entry.high) / 2;
  const takeProfitLevels = spec.win
    ? spec.profile === "wide"
      ? [3560, 3620]
      : [3510, 3525]
    : [invalidationLevel];
  return { entryZone: entry, invalidationLevel, takeProfitLevels, entryMid };
}

function writePair(spec, index) {
  const tag = spec.suffix.toUpperCase();
  const peId = `PEX-TC-ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`;
  const plan = planFor(spec);
  const ts = `2026-06-03T${String(9 + Math.floor(index / 2)).padStart(2, "0")}:${String((index * 7) % 60).padStart(2, "0")}:00.000Z`;

  const paperExecution = {
    schema: "genesis.paper-execution.v1",
    paperExecutionId: peId,
    instrumentId: spec.instrumentId,
    tradeCardRef: `TC-ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`,
    admissionRef: `ADM-LIQUIDITY-SWEEP-RECLAIM-${tag}`,
    scenarioRef: `SCN-LIQUIDITY-SWEEP-RECLAIM-${tag}`,
    simulationStatus: "PAPER_SIMULATED",
    executionSurface: "BLOCKED",
    simulatedOnly: true,
    side: "LONG",
    setupType: "LIQUIDITY_SWEEP_RECLAIM",
    simulationPlan: {
      entryZone: plan.entryZone,
      invalidationLevel: plan.invalidationLevel,
      takeProfitLevels: plan.takeProfitLevels
    },
    riskGuardrails: {
      executionAllowed: false,
      mode: "OFFLINE_ONLY",
      capitalLocked: true,
      maxRiskBudgetBps: 10
    },
    simulationTimestamps: {
      computedAt: ts,
      expiresAt: "2026-06-01T13:01:06.000Z"
    },
    provenance: {
      sourceId: `fixture:phase3/trade-card/trade-card-liquidity-sweep-${spec.instrumentId.toLowerCase()}-offline.json`,
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE12_EXPANDED_V2",
      lineageHash: shaLineage([peId, spec.regimeTag, String(spec.win)])
    },
    evidenceRefs: [`EM-P3-PEX-${spec.suffix}`],
    contractVersion: "genesis.paper-execution.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["PaperExecutionReadModel", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const tradeHistory = {
    schema: "genesis.trade-history-read-model.v1",
    tradeHistoryId: `TH-${peId}`,
    historyId: `TH-${peId}`,
    instrumentId: spec.instrumentId,
    paperExecutionRef: peId,
    tradeCardRef: paperExecution.tradeCardRef,
    admissionRef: paperExecution.admissionRef,
    scenarioRef: paperExecution.scenarioRef,
    historyStatus: "RECORDED_OFFLINE",
    executionSurface: "BLOCKED",
    readModelOnly: true,
    side: "LONG",
    setupType: "LIQUIDITY_SWEEP_RECLAIM",
    simulatedOutcome: {
      simulationStatus: "PAPER_SIMULATED",
      entryZone: plan.entryZone,
      invalidationLevel: plan.invalidationLevel,
      takeProfitLevels: plan.takeProfitLevels
    },
    riskGuardrails: paperExecution.riskGuardrails,
    historyTimestamps: {
      computedAt: ts.replace(/:00\.000Z$/, ":01.000Z"),
      sourceComputedAt: ts
    },
    provenance: {
      sourceId: `fixture:phase3/paper-execution/paper-execution-liquidity-sweep-${spec.instrumentId === "BTCUSDT" ? "btc" : "eth"}usdt-offline-${spec.suffix}.json`,
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE12_EXPANDED_V2",
      lineageHash: shaLineage([`TH-${peId}`, spec.regimeTag])
    },
    evidenceRefs: [`EM-P3-TH-${spec.suffix}`],
    contractVersion: "genesis.trade-history-read-model.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["TradeHistoryReadModel", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const inst = spec.instrumentId === "BTCUSDT" ? "btcusdt" : "ethusdt";
  const peName = `paper-execution-liquidity-sweep-${inst}-offline-${spec.suffix}.json`;
  const thName = `trade-history-liquidity-sweep-${inst}-offline-${spec.suffix}.json`;

  fs.mkdirSync(paperExecutionDir, { recursive: true });
  fs.mkdirSync(tradeHistoryDir, { recursive: true });
  fs.writeFileSync(path.join(paperExecutionDir, peName), JSON.stringify(paperExecution, null, 2));
  fs.writeFileSync(path.join(tradeHistoryDir, thName), JSON.stringify(tradeHistory, null, 2));

  return {
    tradeHistory: thName,
    paperExecution: peName,
    regimeTag: spec.regimeTag
  };
}

const BASE_TRADES = [
  {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline.json",
    regimeTag: "TRENDING"
  },
  {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline-b2.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline-b2.json",
    regimeTag: "RANGING"
  },
  {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline-b3.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline-b3.json",
    regimeTag: "RANGING"
  },
  {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline-b4.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline-b4.json",
    regimeTag: "TRENDING"
  },
  {
    tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline-b5.json",
    paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline-b5.json",
    regimeTag: "RANGING"
  },
  {
    tradeHistory: "trade-history-liquidity-sweep-btcusdt-offline.json",
    paperExecution: "paper-execution-liquidity-sweep-btcusdt-offline.json",
    regimeTag: "TRENDING"
  }
];

const expanded = SPECS.map((spec, i) => writePair(spec, i));
const trades = [...BASE_TRADES, ...expanded];
const regimeTags = [...new Set(trades.map((t) => t.regimeTag))];

const batch = {
  schema: "genesis.phase3.slice12-profitops-trade-batch.v1",
  slice: 12,
  mode: "PAPER_OFFLINE_ONLY",
  expansion: "profitops-expanded-sample-v2",
  regimeTags,
  trades
};

fs.mkdirSync(profitopsDir, { recursive: true });
fs.writeFileSync(path.join(profitopsDir, "slice12-trade-batch.json"), JSON.stringify(batch, null, 2));
console.log(JSON.stringify({ ok: true, tradeCount: trades.length, regimeTags }, null, 2));
