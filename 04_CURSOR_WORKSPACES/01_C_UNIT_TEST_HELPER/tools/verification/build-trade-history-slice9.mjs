#!/usr/bin/env node
/**
 * build-trade-history-slice9.mjs — derive Trade History read-model offline from PaperExecution.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-history");

const PAPER_EXECUTION_SCHEMA = "genesis.paper-execution.v1";
const TRADE_HISTORY_SCHEMA = "genesis.trade-history-read-model.v1";
const GOLDEN_FILE = "trade-history-liquidity-sweep-ethusdt-offline.json";
const NEGATIVE_FILE = "negative-forbidden-execution-field-layer-collapse-trade-history.json";

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadPaperExecution() {
  const inPath = path.join(paperExecutionDir, "paper-execution-liquidity-sweep-ethusdt-offline.json");
  const doc = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (doc.schema !== PAPER_EXECUTION_SCHEMA) throw new Error(`PaperExecution fixture schema mismatch: ${doc.schema}`);
  return doc;
}

function buildTradeHistory(paperExecution) {
  const computedAt = new Date().toISOString();
  const tradeHistoryId = `TH-${paperExecution.paperExecutionId}`;

  return {
    schema: TRADE_HISTORY_SCHEMA,
    tradeHistoryId,
    historyId: tradeHistoryId,
    instrumentId: paperExecution.instrumentId,
    paperExecutionRef: paperExecution.paperExecutionId,
    tradeCardRef: paperExecution.tradeCardRef,
    admissionRef: paperExecution.admissionRef,
    scenarioRef: paperExecution.scenarioRef,
    historyStatus: "RECORDED_OFFLINE",
    executionSurface: "BLOCKED",
    readModelOnly: true,
    side: paperExecution.side,
    setupType: paperExecution.setupType,
    simulatedOutcome: {
      simulationStatus: paperExecution.simulationStatus,
      entryZone: paperExecution.simulationPlan?.entryZone,
      invalidationLevel: paperExecution.simulationPlan?.invalidationLevel,
      takeProfitLevels: paperExecution.simulationPlan?.takeProfitLevels ?? []
    },
    riskGuardrails: {
      executionAllowed: false,
      mode: "OFFLINE_ONLY",
      capitalLocked: true,
      maxRiskBudgetBps: Number(paperExecution.riskGuardrails?.maxRiskBudgetBps ?? 0)
    },
    historyTimestamps: {
      computedAt,
      sourceComputedAt: paperExecution.simulationTimestamps?.computedAt
    },
    provenance: {
      sourceId: "fixture:phase3/paper-execution/paper-execution-liquidity-sweep-ethusdt-offline.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE9_RULES_V1",
      lineageHash: lineageHash([tradeHistoryId, paperExecution.paperExecutionId, paperExecution.scenarioRef, computedAt])
    },
    evidenceRefs: ["EM-P3-TH-001"],
    contractVersion: "genesis.trade-history-read-model.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["TradeHistoryReadModel", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };
}

function buildNegative(baseTradeHistory) {
  return {
    ...baseTradeHistory,
    tradeHistoryId: "TH-NEG-FORBIDDEN-EXECUTION-001",
    historyId: "TH-NEG-FORBIDDEN-EXECUTION-001",
    executionId: "EXEC-LIVE-FORBIDDEN-TH-001",
    provenance: {
      ...baseTradeHistory.provenance,
      lineageHash: lineageHash(["NEG", baseTradeHistory.tradeHistoryId, "executionId"])
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const paperExecution = loadPaperExecution();
  const tradeHistory = buildTradeHistory(paperExecution);
  const negative = buildNegative(tradeHistory);

  fs.writeFileSync(path.join(outDir, GOLDEN_FILE), JSON.stringify(tradeHistory, null, 2));
  fs.writeFileSync(path.join(outDir, NEGATIVE_FILE), JSON.stringify(negative, null, 2));

  const manifest = {
    schema: "genesis.phase3.slice9-trade-history-manifest.v1",
    slice: 9,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/paper-execution/paper-execution-liquidity-sweep-ethusdt-offline.json",
    tradeHistoryCount: 1,
    files: [GOLDEN_FILE],
    negativeFiles: [NEGATIVE_FILE],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice9-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        tradeHistoryId: tradeHistory.tradeHistoryId,
        instrumentId: tradeHistory.instrumentId,
        outDir: "tests/fixtures/phase3/trade-history"
      },
      null,
      2
    )
  );
}

main();
