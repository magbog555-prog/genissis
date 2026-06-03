#!/usr/bin/env node
/**
 * build-selector-slice4.mjs — Derive MarketSelectorScore[] from perception snapshots (offline).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { PERCEPTION_SCHEMA } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const perceptionDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/selector");

const SCORE_SCHEMA = "genesis.market-selector-score.v1";
const BATCH_SCHEMA = "genesis.market-selector.batch.v1";
const TOP_K = 3;

function parseIso(s) {
  return Date.parse(s);
}

function lineageHash(parts) {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sha256:${h}`;
}

function loadPerceptionSnapshots() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(perceptionDir, "slice3-manifest.json"), "utf8")
  );
  return (manifest.files ?? []).map((file) => {
    const doc = JSON.parse(fs.readFileSync(path.join(perceptionDir, file), "utf8"));
    if (doc.schema !== PERCEPTION_SCHEMA) {
      throw new Error(`Not a perception snapshot: ${file}`);
    }
    return doc;
  });
}

function scoreSnapshot(snap) {
  let composite = 0;
  const scoreFactors = [];
  const selectionReasons = [];
  const rejectionReasons = [];

  function add(factor, value, points, reasonCode) {
    composite += points;
    scoreFactors.push({ factor, value, points });
    if (points > 0 && reasonCode) selectionReasons.push(reasonCode);
  }

  if (snap.integrity === "OK") add("integrity", "OK", 20, "RC-SEL-INTEGRITY-OK");
  else if (snap.integrity === "YELLOW") add("integrity", "YELLOW", 5, "RC-SEL-INTEGRITY-YELLOW");
  else add("integrity", snap.integrity ?? "UNKNOWN", 0, null);

  if (snap.dataQuality?.status === "OK") add("dataQuality", "OK", 10, "RC-SEL-DQ-OK");
  else if (snap.dataQuality?.status === "YELLOW") add("dataQuality", "YELLOW", 3, null);
  else add("dataQuality", snap.dataQuality?.status ?? "UNKNOWN", 0, "RC-SEL-DQ-RED");

  if (snap.regime === "TRENDING") add("regime", "TRENDING", 20, "RC-SEL-REGIME-TRENDING");
  else if (snap.regime === "RANGING") add("regime", "RANGING", 5, "RC-SEL-REGIME-RANGING");
  else add("regime", snap.regime ?? "UNKNOWN", 0, "RC-SEL-REGIME-UNKNOWN");

  if (snap.volatilityState === "LOW") add("volatility", "LOW", 10, "RC-SEL-VOL-LOW");
  else if (snap.volatilityState === "MEDIUM") add("volatility", "MEDIUM", 5, "RC-SEL-VOL-MEDIUM");
  else add("volatility", snap.volatilityState ?? "UNKNOWN", 0, "RC-SEL-VOL-HIGH");

  if (snap.liquidityState === "NORMAL") add("liquidity", "NORMAL", 10, "RC-SEL-LIQ-NORMAL");
  else add("liquidity", snap.liquidityState ?? "UNKNOWN", 0, "RC-SEL-LIQ-THIN");

  if (typeof snap.freshnessMs === "number" && snap.freshnessMs <= 5000) {
    add("freshness", snap.freshnessMs, 5, "RC-SEL-FRESH-OK");
  } else {
    add("freshness", snap.freshnessMs ?? null, 0, "RC-SEL-FRESH-STALE");
    rejectionReasons.push("RC-SEL-FRESH-STALE");
  }

  if (snap.regime === "TRENDING" && typeof snap.aggressiveFlowImbalance === "number") {
    if (snap.aggressiveFlowImbalance > 0) add("flowAlignment", "WITH_TREND", 5, "RC-SEL-FLOW-ALIGNED");
    else if (snap.aggressiveFlowImbalance < 0) add("flowAlignment", "AGAINST_TREND", -5, null);
  }

  composite = Math.min(100, Math.max(0, composite));

  return { compositeScore: composite, scoreFactors, selectionReasons, rejectionReasons };
}

function buildScore(snap, rank, selectionStatus) {
  const scored = scoreSnapshot(snap);
  const asOfCompact = snap.asOf.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return {
    schema: SCORE_SCHEMA,
    scoreId: `sel-${snap.instrumentId}-${asOfCompact}`,
    instrumentId: snap.instrumentId,
    rank,
    selectionStatus,
    compositeScore: scored.compositeScore,
    sourceSnapshotRef: snap.snapshotId,
    scoreFactors: scored.scoreFactors,
    selectionReasons: scored.selectionReasons,
    rejectionReasons: scored.rejectionReasons,
    dataQuality: {
      status: snap.dataQuality?.status ?? "UNKNOWN",
      completeness: snap.dataQuality?.completeness ?? 0
    },
    provenance: {
      sourceId: `fixture:phase3/perception/${snap.instrumentId}-perception-snapshot.json`,
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE4_RULES_V1",
      lineageHash: lineageHash([snap.snapshotId, String(scored.compositeScore)])
    },
    contractVersion: "genesis.market-selector-score.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["ScenarioEngine", "OperatorReadModel"]
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const snapshots = loadPerceptionSnapshots();
  const ranked = snapshots
    .map((snap) => ({ snap, ...scoreSnapshot(snap) }))
    .sort((a, b) => b.compositeScore - a.compositeScore || a.snap.instrumentId.localeCompare(b.snap.instrumentId));

  const scores = ranked.map((entry, idx) => {
    const rank = idx + 1;
    const selectionStatus = rank <= TOP_K ? "SELECTED" : "REJECTED";
    return buildScore(entry.snap, rank, selectionStatus);
  });

  const asOf = new Date(
    Math.max(...snapshots.map((s) => parseIso(s.asOf)).filter(Number.isFinite))
  ).toISOString();
  const asOfCompact = asOf.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `sel-batch-offline-${asOfCompact}`,
    asOf,
    universeSize: snapshots.length,
    topK: TOP_K,
    scores,
    provenance: {
      sourceId: "fixture:phase3/perception/slice3-manifest.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: "OFFLINE_SLICE4_RULES_V1",
      lineageHash: lineageHash(scores.map((s) => s.scoreId))
    },
    evidenceRefs: ["EM-P3-SEL-001"],
    contractVersion: "genesis.market-selector-score.v1.0.0",
    schemaVersion: "1.0.0",
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["ScenarioEngine", "OperatorReadModel"]
  };

  const batchFile = "offline-ranked-batch.json";
  fs.writeFileSync(path.join(outDir, batchFile), JSON.stringify(batch, null, 2));

  const individualFiles = [];
  for (const score of scores) {
    const fileName = `${score.instrumentId}-selector-score.json`;
    fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(score, null, 2));
    individualFiles.push(fileName);
  }

  const manifest = {
    schema: "genesis.phase3.slice4-selector-manifest.v1",
    slice: 4,
    mode: "OFFLINE_ONLY",
    derivedFrom: "tests/fixtures/phase3/perception",
    files: [batchFile, ...individualFiles],
    negativeFiles: ["negative-admission-on-selector.json"],
    liveIngestion: false,
    notaryGreenClaimed: false
  };
  fs.writeFileSync(path.join(outDir, "slice4-manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      { ok: true, written: manifest.files.length, topInstrument: scores[0]?.instrumentId, outDir: "tests/fixtures/phase3/selector" },
      null,
      2
    )
  );
}

main();
