#!/usr/bin/env node
/**
 * build-scenario-slice5.mjs — Derive one ScenarioCandidate (Liquidity Sweep and Reclaim) offline.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { PERCEPTION_SCHEMA } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const selectorDir = path.join(workspaceRoot, "tests/fixtures/phase3/selector");
const perceptionDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/scenario");

const SCENARIO_SCHEMA = "genesis.scenario-candidate.v1";
const BATCH_SCHEMA = "genesis.market-selector.batch.v1";
const SCENARIO_ID = "SCN-LIQUIDITY-SWEEP-RECLAIM-V1";
const SCENARIO_NAME = "Liquidity Sweep and Reclaim";
const EXPIRY_MS = 60 * 60 * 1000;

function parseIso(s) {
  return Date.parse(s);
}

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadTopSelectorScore() {
  const batchPath = path.join(selectorDir, "offline-ranked-batch.json");
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
  if (batch.schema !== BATCH_SCHEMA) throw new Error("Selector batch missing or invalid");
  const top = (batch.scores ?? []).find((s) => s.rank === 1);
  if (!top) throw new Error("No rank-1 selector score in offline batch");
  return { batch, top };
}

function loadPerception(snapshotId) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(perceptionDir, "slice3-manifest.json"), "utf8")
  );
  for (const file of manifest.files ?? []) {
    const doc = JSON.parse(fs.readFileSync(path.join(perceptionDir, file), "utf8"));
    if (doc.schema === PERCEPTION_SCHEMA && doc.snapshotId === snapshotId) return doc;
  }
  return null;
}

function derivePhase(perception, score) {
  if (perception.regime === "TRENDING" && score.compositeScore >= 60) return "RECLAIM_FORMING";
  if (perception.regime === "TRENDING") return "SWEEP_DETECTED";
  return "WATCH";
}

function deriveConfidence(score, perception) {
  let c = score.compositeScore / 100;
  if (perception.integrity !== "OK") c *= 0.5;
  if (perception.dataQuality?.status !== "OK") c *= 0.7;
  if (perception.aggressiveFlowImbalance < 0) c -= 0.05;
  return Math.min(0.95, Math.max(0.1, Math.round(c * 100) / 100));
}

function buildEvidence(perception, score) {
  const obsAt = perception.asOf;
  const items = [
    {
      evidenceId: "ev-scn-sweep-low-probe",
      kind: "PRICE_ACTION",
      description: "Prior range low probed with quick rejection (sweep signature)",
      sourceRef: perception.snapshotId,
      observedAt: perception.timestamps?.sourceWindowEnd ?? obsAt
    },
    {
      evidenceId: "ev-scn-reclaim-start",
      kind: "REGIME",
      description: `Regime ${perception.regime} supports reclaim continuation hypothesis`,
      sourceRef: perception.snapshotId,
      observedAt: obsAt
    },
    {
      evidenceId: "ev-scn-selector-top",
      kind: "SELECTOR",
      description: `Instrument rank ${score.rank} with compositeScore ${score.compositeScore}`,
      sourceRef: score.scoreId,
      observedAt: obsAt
    }
  ];
  if (typeof perception.aggressiveFlowImbalance === "number") {
    items.push({
      evidenceId: "ev-scn-flow-context",
      kind: "FLOW",
      description: `Aggressive flow imbalance ${perception.aggressiveFlowImbalance} (context only, not permission)`,
      sourceRef: perception.snapshotId,
      observedAt: obsAt
    });
  }
  return items;
}

function buildInvalidation(perception) {
  return {
    conditions: [
      "Close below swept liquidity level before reclaim confirmation",
      "Perception integrity degrades to RED",
      "Scenario expiresAt reached without reclaim confirmation"
    ],
    reasonCodes: [
      "RC-SCN-INV-CLOSE-BELOW-SWEEP",
      "RC-SCN-INV-INTEGRITY-RED",
      "RC-SCN-INV-EXPIRED"
    ],
    triggerRefs: [perception.snapshotId]
  };
}

function buildCandidate() {
  const { batch, top } = loadTopSelectorScore();
  const perception = loadPerception(top.sourceSnapshotRef);
  if (!perception) throw new Error(`Perception not found: ${top.sourceSnapshotRef}`);

  const asOfMs = parseIso(batch.asOf);
  const expiresAt = new Date(asOfMs + EXPIRY_MS).toISOString();
  const phase = derivePhase(perception, top);
  const confidence = deriveConfidence(top, perception);
  const evidence = buildEvidence(perception, top);
  const invalidation = buildInvalidation(perception);

  return {
    schema: SCENARIO_SCHEMA,
    scenarioId: SCENARIO_ID,
    scenarioName: SCENARIO_NAME,
    instrumentId: top.instrumentId,
    phase,
    evidence,
    invalidation,
    confidence,
    expiresAt,
    sourceSelectorRef: top.scoreId,
    sourceSnapshotRef: perception.snapshotId,
    provenance: {
      sourceId: "fixture:phase3/selector/offline-ranked-batch.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE5_RULES_V1",
      lineageHash: lineageHash([SCENARIO_ID, top.scoreId, perception.snapshotId, phase])
    },
    evidenceRefs: ["EM-P3-SCN-001"],
    contractVersion: "genesis.scenario-candidate.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["AdmissionEngine", "OperatorReadModel"]
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const candidate = buildCandidate();
  const outFile = "liquidity-sweep-reclaim-ethusdt-offline.json";
  fs.writeFileSync(path.join(outDir, outFile), JSON.stringify(candidate, null, 2));

  const manifest = {
    schema: "genesis.phase3.slice5-scenario-manifest.v1",
    slice: 5,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/selector/offline-ranked-batch.json",
    scenarioCount: 1,
    scenarioId: SCENARIO_ID,
    files: [outFile],
    negativeFiles: ["negative-admission-on-scenario.json"],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice5-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        scenarioId: SCENARIO_ID,
        instrumentId: candidate.instrumentId,
        phase: candidate.phase,
        confidence: candidate.confidence,
        outDir: "tests/fixtures/phase3/scenario"
      },
      null,
      2
    )
  );
}

main();
