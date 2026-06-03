#!/usr/bin/env node
/**
 * build-paper-execution-slice8.mjs — derive PaperExecution offline from TradeCardDraft.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeCardDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-card");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");

const TRADE_CARD_SCHEMA = "genesis.trade-card-draft.v1";
const PAPER_EXECUTION_SCHEMA = "genesis.paper-execution.v1";
const GOLDEN_FILE = "paper-execution-liquidity-sweep-ethusdt-offline.json";
const NEGATIVE_FILE = "negative-forbidden-execution-field-paper-execution.json";

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadTradeCardDraft() {
  const inPath = path.join(tradeCardDir, "trade-card-liquidity-sweep-ethusdt-offline.json");
  const doc = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (doc.schema !== TRADE_CARD_SCHEMA) throw new Error(`TradeCard fixture schema mismatch: ${doc.schema}`);
  return doc;
}

function buildPaperExecution(tradeCard) {
  const computedAt = new Date().toISOString();
  const paperExecutionId = `PEX-${tradeCard.tradeCardId}`;

  return {
    schema: PAPER_EXECUTION_SCHEMA,
    paperExecutionId,
    instrumentId: tradeCard.instrumentId,
    tradeCardRef: tradeCard.tradeCardId,
    admissionRef: tradeCard.admissionRef,
    scenarioRef: tradeCard.scenarioRef,
    simulationStatus: "PAPER_SIMULATED",
    executionSurface: "BLOCKED",
    simulatedOnly: true,
    side: tradeCard.side,
    setupType: tradeCard.setupType,
    simulationPlan: {
      entryZone: tradeCard.pricePlan?.entryZone,
      invalidationLevel: tradeCard.pricePlan?.invalidationLevel,
      takeProfitLevels: tradeCard.pricePlan?.takeProfitLevels ?? []
    },
    riskGuardrails: {
      executionAllowed: false,
      mode: "OFFLINE_ONLY",
      capitalLocked: true,
      maxRiskBudgetBps: Number(tradeCard.riskPlan?.maxRiskBudgetBps ?? 0)
    },
    simulationTimestamps: {
      computedAt,
      expiresAt: tradeCard.draftTimestamps?.expiresAt
    },
    provenance: {
      sourceId: "fixture:phase3/trade-card/trade-card-liquidity-sweep-ethusdt-offline.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE8_RULES_V1",
      lineageHash: lineageHash([paperExecutionId, tradeCard.tradeCardId, tradeCard.scenarioRef, computedAt])
    },
    evidenceRefs: ["EM-P3-PEX-001"],
    contractVersion: "genesis.paper-execution.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["PaperExecutionReadModel", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };
}

function buildNegative(basePaperExecution) {
  return {
    ...basePaperExecution,
    paperExecutionId: "PEX-NEG-FORBIDDEN-EXECUTION-001",
    executionId: "EXEC-LIVE-FORBIDDEN-001",
    provenance: {
      ...basePaperExecution.provenance,
      lineageHash: lineageHash(["NEG", basePaperExecution.paperExecutionId, "executionId"])
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const tradeCard = loadTradeCardDraft();
  const paperExecution = buildPaperExecution(tradeCard);
  const negative = buildNegative(paperExecution);

  fs.writeFileSync(path.join(outDir, GOLDEN_FILE), JSON.stringify(paperExecution, null, 2));
  fs.writeFileSync(path.join(outDir, NEGATIVE_FILE), JSON.stringify(negative, null, 2));

  const manifest = {
    schema: "genesis.phase3.slice8-paper-execution-manifest.v1",
    slice: 8,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/trade-card/trade-card-liquidity-sweep-ethusdt-offline.json",
    paperExecutionCount: 1,
    files: [GOLDEN_FILE],
    negativeFiles: [NEGATIVE_FILE],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice8-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        paperExecutionId: paperExecution.paperExecutionId,
        instrumentId: paperExecution.instrumentId,
        outDir: "tests/fixtures/phase3/paper-execution"
      },
      null,
      2
    )
  );
}

main();
