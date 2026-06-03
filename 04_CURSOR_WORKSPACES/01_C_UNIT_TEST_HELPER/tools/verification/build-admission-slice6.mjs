#!/usr/bin/env node
/**
 * build-admission-slice6.mjs — derive AdmissionDecision offline from ScenarioCandidate.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const scenarioDir = path.join(workspaceRoot, "tests/fixtures/phase3/scenario");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/admission");

const ADMISSION_SCHEMA = "genesis.admission-decision.v1";
const SCENARIO_SCHEMA = "genesis.scenario-candidate.v1";
const ADMISSION_ID = "ADM-LIQUIDITY-SWEEP-RECLAIM-V1";
const ALLOWED_STATUSES = new Set(["WATCH", "WAIT", "PREPARE", "ALLOW", "BLOCK", "EXPIRED", "INVALIDATED"]);

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadScenario() {
  const inPath = path.join(scenarioDir, "liquidity-sweep-reclaim-ethusdt-offline.json");
  const doc = JSON.parse(fs.readFileSync(inPath, "utf8"));
  if (doc.schema !== SCENARIO_SCHEMA) throw new Error(`Scenario fixture schema mismatch: ${doc.schema}`);
  return doc;
}

function deriveStatus(scenario) {
  if (scenario.phase === "INVALIDATED") return "INVALIDATED";
  if (scenario.phase === "EXPIRED") return "EXPIRED";

  const confidence = Number(scenario.confidence ?? 0);
  if (scenario.phase === "RECLAIM_CONFIRMED" && confidence >= 0.75) return "ALLOW";
  if (scenario.phase === "RECLAIM_FORMING" && confidence >= 0.55) return "PREPARE";
  if (confidence >= 0.35) return "WAIT";
  return "WATCH";
}

function buildReasons(scenario, status) {
  const reasons = [];
  reasons.push(`Scenario phase ${scenario.phase}`);
  reasons.push(`Confidence ${scenario.confidence}`);
  if (status === "PREPARE") reasons.push("Pre-trade preparation only; execution remains blocked");
  if (status === "ALLOW") reasons.push("Signal quality threshold reached (offline gate only)");
  if (status === "WATCH" || status === "WAIT") reasons.push("Need additional confirmation");
  if (status === "EXPIRED" || status === "INVALIDATED") reasons.push("Scenario lifecycle closed");
  return reasons;
}

function buildDecision(scenario) {
  const status = deriveStatus(scenario);
  if (!ALLOWED_STATUSES.has(status)) throw new Error(`Derived unsupported status: ${status}`);

  const computedAt = new Date().toISOString();
  const expiresAt = scenario.expiresAt;
  const riskBudgetBps = status === "ALLOW" ? 20 : status === "PREPARE" ? 10 : 0;

  return {
    schema: ADMISSION_SCHEMA,
    admissionId: ADMISSION_ID,
    admissionStatus: status,
    instrumentId: scenario.instrumentId,
    scenarioRef: scenario.scenarioId,
    scenarioPhase: scenario.phase,
    confidence: scenario.confidence,
    reasons: buildReasons(scenario, status),
    guardrails: {
      executionAllowed: false,
      mode: "OFFLINE_ONLY",
      capitalLocked: true,
      maxRiskBudgetBps: riskBudgetBps
    },
    decisionTimestamps: {
      computedAt,
      expiresAt
    },
    provenance: {
      sourceId: "fixture:phase3/scenario/liquidity-sweep-reclaim-ethusdt-offline.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE6_RULES_V1",
      lineageHash: lineageHash([ADMISSION_ID, scenario.scenarioId, status, computedAt])
    },
    evidenceRefs: ["EM-P3-ADM-001"],
    contractVersion: "genesis.admission-decision.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["TradeCardEngine", "OperatorReadModel"],
    notaryGreenClaimed: false,
    liveIngestion: false
  };
}

function buildNegative(baseDecision) {
  return {
    ...baseDecision,
    admissionId: "ADM-NEG-LAYER-COLLAPSE-001",
    canExecute: true,
    provenance: {
      ...baseDecision.provenance,
      lineageHash: lineageHash(["NEG", baseDecision.admissionId, "canExecute"])
    }
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const scenario = loadScenario();
  const decision = buildDecision(scenario);
  const negative = buildNegative(decision);

  const goldenFile = "admission-liquidity-sweep-ethusdt-offline.json";
  const negativeFile = "negative-layer-collapse-admission.json";
  fs.writeFileSync(path.join(outDir, goldenFile), JSON.stringify(decision, null, 2));
  fs.writeFileSync(path.join(outDir, negativeFile), JSON.stringify(negative, null, 2));

  const manifest = {
    schema: "genesis.phase3.slice6-admission-manifest.v1",
    slice: 6,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/scenario/liquidity-sweep-reclaim-ethusdt-offline.json",
    admissionCount: 1,
    files: [goldenFile],
    negativeFiles: [negativeFile],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice6-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        admissionId: decision.admissionId,
        admissionStatus: decision.admissionStatus,
        instrumentId: decision.instrumentId,
        outDir: "tests/fixtures/phase3/admission"
      },
      null,
      2
    )
  );
}

main();
