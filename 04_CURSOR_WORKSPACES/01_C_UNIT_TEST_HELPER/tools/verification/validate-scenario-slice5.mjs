#!/usr/bin/env node
/**
 * validate-scenario-slice5.mjs — Slice 5 ScenarioCandidate offline gate (single scenario)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import {
  collectForbiddenKeys,
  FORBIDDEN_KEYS_GLOBAL,
  PERCEPTION_SCHEMA
} from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const scenarioDir = path.join(workspaceRoot, "tests/fixtures/phase3/scenario");
const selectorDir = path.join(workspaceRoot, "tests/fixtures/phase3/selector");
const perceptionDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");

const SCENARIO_SCHEMA = "genesis.scenario-candidate.v1";
const BATCH_SCHEMA = "genesis.market-selector.batch.v1";
const ALLOWED_SCENARIO_ID = "SCN-LIQUIDITY-SWEEP-RECLAIM-V1";
const ALLOWED_PHASES = new Set([
  "WATCH",
  "SWEEP_DETECTED",
  "RECLAIM_FORMING",
  "RECLAIM_CONFIRMED",
  "EXPIRED",
  "INVALIDATED"
]);
const FORBIDDEN_SCENARIO = new Set([...FORBIDDEN_KEYS_GLOBAL]);

const REQUIRED = [
  "schema",
  "scenarioId",
  "instrumentId",
  "phase",
  "evidence",
  "invalidation",
  "confidence",
  "expiresAt",
  "provenance",
  "contractVersion",
  "schemaVersion",
  "ownerRole",
  "consumerRoles"
];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isIsoString(s) {
  return typeof s === "string" && Number.isFinite(Date.parse(s));
}

function isSha256Prefixed(s) {
  return typeof s === "string" && /^sha256:[0-9a-f]{32,128}$/i.test(s);
}

function loadSelectorIndex() {
  const index = new Map();
  const batchPath = path.join(selectorDir, "offline-ranked-batch.json");
  if (!fs.existsSync(batchPath)) return index;
  const batch = loadJson(batchPath);
  if (batch.schema !== BATCH_SCHEMA) return index;
  for (const score of batch.scores ?? []) {
    if (score.scoreId) index.set(score.scoreId, score);
  }
  return index;
}

function loadSnapshotIndex() {
  const index = new Map();
  const manifestPath = path.join(perceptionDir, "slice3-manifest.json");
  if (!fs.existsSync(manifestPath)) return index;
  const manifest = loadJson(manifestPath);
  for (const file of manifest.files ?? []) {
    const doc = loadJson(path.join(perceptionDir, file));
    if (doc.schema === PERCEPTION_SCHEMA && doc.snapshotId) {
      index.set(doc.snapshotId, doc);
    }
  }
  return index;
}

function addViolation(violations, ruleId, severity, message, extra = {}) {
  violations.push({ ruleId, severity, message, ...extra });
}

function validateCandidate(doc, options = {}) {
  const violations = [];
  const id = doc.scenarioId ?? "(no id)";
  const { expectFail = false, selectorIndex = new Map(), snapshotIndex = new Map() } = options;

  if (doc.schema !== SCENARIO_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${SCENARIO_SCHEMA}`, {
      scenarioId: id,
      actual: doc.schema
    });
  }

  for (const key of REQUIRED) {
    if (!(key in doc)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, {
        scenarioId: id
      });
    }
  }

  if (!expectFail && doc.scenarioId !== ALLOWED_SCENARIO_ID) {
    addViolation(violations, "RC-SCN-SINGLE-SCENARIO", "RED", "Slice 5 allows only Liquidity Sweep and Reclaim", {
      scenarioId: id,
      actual: doc.scenarioId
    });
  }

  if (!ALLOWED_PHASES.has(doc.phase)) {
    addViolation(violations, "RC-SCN-PHASE", "RED", "phase not in allowed ScenarioCandidate vocabulary", {
      scenarioId: id,
      actual: doc.phase
    });
  }

  if (typeof doc.confidence !== "number" || doc.confidence < 0 || doc.confidence > 1) {
    addViolation(violations, "RC-SCN-CONFIDENCE", "RED", "confidence must be number in [0, 1]", {
      scenarioId: id,
      actual: doc.confidence
    });
  }

  if (!isIsoString(doc.expiresAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "expiresAt must be ISO-8601", { scenarioId: id });
  }

  if (!Array.isArray(doc.evidence) || doc.evidence.length === 0) {
    addViolation(violations, "RC-SCN-EVIDENCE", "RED", "evidence must be non-empty array", { scenarioId: id });
  } else {
    for (const [i, ev] of doc.evidence.entries()) {
      if (!ev.evidenceId || !ev.kind || !ev.description) {
        addViolation(violations, "RC-SCN-EVIDENCE-ITEM", "RED", `evidence[${i}] missing evidenceId/kind/description`, {
          scenarioId: id
        });
      }
    }
  }

  const inv = doc.invalidation ?? {};
  if (!Array.isArray(inv.conditions) || inv.conditions.length === 0) {
    addViolation(violations, "RC-SCN-INVALIDATION", "RED", "invalidation.conditions must be non-empty array", {
      scenarioId: id
    });
  }

  const prov = doc.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { scenarioId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      scenarioId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE5-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 5 offline", {
      scenarioId: id
    });
  }

  if (!expectFail && doc.sourceSelectorRef && !selectorIndex.has(doc.sourceSelectorRef)) {
    addViolation(violations, "RC-SCN-SELECTOR-REF-MISSING", "RED", "sourceSelectorRef not found in selector batch", {
      scenarioId: id,
      sourceSelectorRef: doc.sourceSelectorRef
    });
  }

  if (!expectFail && doc.sourceSnapshotRef && !snapshotIndex.has(doc.sourceSnapshotRef)) {
    addViolation(violations, "RC-SCN-SNAPSHOT-REF-MISSING", "RED", "sourceSnapshotRef not found in perception fixtures", {
      scenarioId: id,
      sourceSnapshotRef: doc.sourceSnapshotRef
    });
  }

  if (!expectFail && doc.instrumentId) {
    const top = [...selectorIndex.values()].find((s) => s.rank === 1);
    if (top && doc.instrumentId !== top.instrumentId) {
      addViolation(violations, "RC-SCN-TOP-INSTRUMENT", "RED", "scenario must target top selector instrument", {
        scenarioId: id,
        expected: top.instrumentId,
        actual: doc.instrumentId
      });
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_SCENARIO);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on ScenarioCandidate", {
      scenarioId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, scenarioId: id };
}

function validateFile(fileName, expectFail, selectorIndex, snapshotIndex) {
  const rel = `tests/fixtures/phase3/scenario/${fileName}`;
  const doc = loadJson(path.join(scenarioDir, fileName));
  const result = validateCandidate(doc, { expectFail, selectorIndex, snapshotIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    scenarioId: result.scenarioId,
    instrumentId: doc.instrumentId,
    phase: doc.phase,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(scenarioDir, "slice5-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-scenario-slice5.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const selectorIndex = loadSelectorIndex();
  const snapshotIndex = loadSnapshotIndex();
  const fileResults = [];

  if ((manifest.files ?? []).length !== 1) {
    console.error(
      JSON.stringify({ ok: false, error: "Slice 5 requires exactly one golden scenario fixture" })
    );
    process.exit(1);
  }

  for (const f of manifest.files ?? []) {
    fileResults.push(validateFile(f, false, selectorIndex, snapshotIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateFile(f, true, selectorIndex, snapshotIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);

  const report = {
    schema: "genesis.scenario-offline-slice5.v1",
    generatedAt: new Date().toISOString(),
    slice: 5,
    pass,
    summary: {
      scenarioCount: manifest.scenarioCount ?? (manifest.files ?? []).length,
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      scenarioId: golden?.scenarioId,
      instrumentId: golden?.instrumentId,
      phase: golden?.phase
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/scenario-offline-slice5.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
