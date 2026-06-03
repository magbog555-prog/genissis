#!/usr/bin/env node
/**
 * build-trade-card-slice7.mjs — derive TradeCardDraft offline from AdmissionDecision.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const admissionDir = path.join(workspaceRoot, "tests/fixtures/phase3/admission");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-card");

const ADMISSION_SCHEMA = "genesis.admission-decision.v1";
const TRADE_CARD_SCHEMA = "genesis.trade-card-draft.v1";
const GOLDEN_FILE = "trade-card-liquidity-sweep-ethusdt-offline.json";
const NEGATIVE_FILE = "negative-layer-collapse-trade-card.json";

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadAdmissionDecision() {
  const inPath = path.join(admissionDir, "admission-liquidity-sweep-ethusdt-offline.json");
  const doc = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (doc.schema !== ADMISSION_SCHEMA) throw new Error(`Admission fixture schema mismatch: ${doc.schema}`);
  return doc;
}

function buildTradeCard(admission) {
  const computedAt = new Date().toISOString();
  const tradeCardId = `TC-${admission.admissionId}`;
  const riskBps = Number(admission.guardrails?.maxRiskBudgetBps ?? 0);

  return {
    schema: TRADE_CARD_SCHEMA,
    tradeCardId,
    instrumentId: admission.instrumentId,
    admissionRef: admission.admissionId,
    scenarioRef: admission.scenarioRef,
    side: "LONG",
    setupType: "LIQUIDITY_SWEEP_RECLAIM",
    draftStatus: "DRAFT_OFFLINE",
    confidence: admission.confidence,
    thesis: [
      "AdmissionDecision prepared for offline-only pre-trade planning",
      "Trade Card remains draft; execution stays blocked"
    ],
    pricePlan: {
      entryZone: { low: 3450, high: 3490 },
      invalidationLevel: 3410,
      takeProfitLevels: [3535, 3590]
    },
    riskPlan: {
      executionAllowed: false,
      mode: "OFFLINE_ONLY",
      capitalLocked: true,
      maxRiskBudgetBps: riskBps
    },
    draftTimestamps: {
      computedAt,
      expiresAt: admission.decisionTimestamps?.expiresAt
    },
    provenance: {
      sourceId: "fixture:phase3/admission/admission-liquidity-sweep-ethusdt-offline.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE7_RULES_V1",
      lineageHash: lineageHash([tradeCardId, admission.admissionId, admission.scenarioRef, computedAt])
    },
    evidenceRefs: ["EM-P3-TC-001"],
    contractVersion: "genesis.trade-card-draft.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["ExecutionPlanner", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };
}

function buildNegative(baseTradeCard) {
  return {
    ...baseTradeCard,
    tradeCardId: "TC-NEG-LAYER-COLLAPSE-001",
    executionIntentId: "EXI-FORBIDDEN-001",
    provenance: {
      ...baseTradeCard.provenance,
      lineageHash: lineageHash(["NEG", baseTradeCard.tradeCardId, "executionIntentId"])
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const admission = loadAdmissionDecision();
  const tradeCard = buildTradeCard(admission);
  const negative = buildNegative(tradeCard);

  fs.writeFileSync(path.join(outDir, GOLDEN_FILE), JSON.stringify(tradeCard, null, 2));
  fs.writeFileSync(path.join(outDir, NEGATIVE_FILE), JSON.stringify(negative, null, 2));

  const manifest = {
    schema: "genesis.phase3.slice7-trade-card-manifest.v1",
    slice: 7,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/admission/admission-liquidity-sweep-ethusdt-offline.json",
    tradeCardCount: 1,
    files: [GOLDEN_FILE],
    negativeFiles: [NEGATIVE_FILE],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice7-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        tradeCardId: tradeCard.tradeCardId,
        instrumentId: tradeCard.instrumentId,
        outDir: "tests/fixtures/phase3/trade-card"
      },
      null,
      2
    )
  );
}

main();
