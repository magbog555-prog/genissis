#!/usr/bin/env node
/**
 * validate-selector-slice4.mjs — Slice 4 MarketSelectorScore offline gate
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
const selectorDir = path.join(workspaceRoot, "tests/fixtures/phase3/selector");
const perceptionDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");

const SCORE_SCHEMA = "genesis.market-selector-score.v1";
const BATCH_SCHEMA = "genesis.market-selector.batch.v1";
const FORBIDDEN_SELECTOR = new Set([...FORBIDDEN_KEYS_GLOBAL, "scenarioId"]);

const REQUIRED_SCORE = [
  "schema",
  "scoreId",
  "instrumentId",
  "rank",
  "selectionStatus",
  "compositeScore",
  "sourceSnapshotRef",
  "scoreFactors",
  "selectionReasons",
  "rejectionReasons",
  "dataQuality",
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

function validateScore(score, options = {}) {
  const violations = [];
  const id = score.scoreId ?? "(no id)";
  const { expectFail = false, snapshotIndex = new Map() } = options;

  if (score.schema !== SCORE_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${SCORE_SCHEMA}`, {
      scoreId: id,
      actual: score.schema
    });
  }

  for (const key of REQUIRED_SCORE) {
    if (!(key in score)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, { scoreId: id });
    }
  }

  if (typeof score.compositeScore !== "number" || score.compositeScore < 0 || score.compositeScore > 100) {
    addViolation(violations, "RC-SEL-SCORE-RANGE", "RED", "compositeScore must be number in [0, 100]", {
      scoreId: id,
      actual: score.compositeScore
    });
  }

  if (!["SELECTED", "REJECTED"].includes(score.selectionStatus)) {
    addViolation(violations, "RC-SEL-STATUS", "RED", "selectionStatus must be SELECTED or REJECTED", {
      scoreId: id,
      actual: score.selectionStatus
    });
  }

  const prov = score.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { scoreId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      scoreId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE4-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 4 offline", {
      scoreId: id
    });
  }

  if (!expectFail && score.sourceSnapshotRef && !snapshotIndex.has(score.sourceSnapshotRef)) {
    addViolation(violations, "RC-SEL-SNAPSHOT-REF-MISSING", "RED", "sourceSnapshotRef not found in golden perception fixtures", {
      scoreId: id,
      sourceSnapshotRef: score.sourceSnapshotRef
    });
  }

  const forbiddenHits = collectForbiddenKeys(score, FORBIDDEN_SELECTOR);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on MarketSelectorScore", {
      scoreId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, scoreId: id };
}

function validateBatchFile(fileName, expectFail, snapshotIndex) {
  const rel = `tests/fixtures/phase3/selector/${fileName}`;
  const doc = loadJson(path.join(selectorDir, fileName));
  const violations = [];

  if (doc.schema !== BATCH_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${BATCH_SCHEMA}`, { file: rel });
  }

  if (!isIsoString(doc.asOf)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "asOf must be ISO-8601", { file: rel });
  }

  if (!Array.isArray(doc.scores) || doc.scores.length === 0) {
    addViolation(violations, "RC-SEL-BATCH-SCORES", "RED", "scores must be non-empty array", { file: rel });
  }

  const scoreResults = [];
  if (Array.isArray(doc.scores)) {
    const ranks = new Set();
    for (const score of doc.scores) {
      const result = validateScore(score, { expectFail, snapshotIndex });
      scoreResults.push(result);
      violations.push(...result.violations);
      if (typeof score.rank === "number") {
        if (ranks.has(score.rank)) {
          addViolation(violations, "RC-SEL-RANK-DUPLICATE", "RED", `duplicate rank ${score.rank}`, {
            batchId: doc.batchId
          });
        }
        ranks.add(score.rank);
      }
    }

    if (!expectFail && doc.scores.length > 1) {
      for (let i = 1; i < doc.scores.length; i++) {
        const prev = doc.scores[i - 1].compositeScore;
        const cur = doc.scores[i].compositeScore;
        if (cur > prev) {
          addViolation(violations, "RC-SEL-RANK-ORDER", "RED", "scores must be sorted by compositeScore descending", {
            batchId: doc.batchId
          });
          break;
        }
      }
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_SELECTOR);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on MarketSelector batch", {
      file: rel,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  const validationPass = expectFail ? redCount > 0 : redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    batchId: doc.batchId,
    redCount,
    scoreCount: doc.scores?.length ?? 0,
    violations,
    scoreResults
  };
}

function validateScoreFile(fileName, expectFail, snapshotIndex) {
  const rel = `tests/fixtures/phase3/selector/${fileName}`;
  const score = loadJson(path.join(selectorDir, fileName));
  const result = validateScore(score, { expectFail, snapshotIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    scoreId: result.scoreId,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(selectorDir, "slice4-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-selector-slice4.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const snapshotIndex = loadSnapshotIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    if (f === "offline-ranked-batch.json") {
      fileResults.push(validateBatchFile(f, false, snapshotIndex));
    } else if (f.endsWith("-selector-score.json")) {
      fileResults.push(validateScoreFile(f, false, snapshotIndex));
    }
  }

  for (const f of manifest.negativeFiles ?? []) {
    if (f.includes("batch")) {
      fileResults.push(validateBatchFile(f, true, snapshotIndex));
    } else {
      fileResults.push(validateScoreFile(f, true, snapshotIndex));
    }
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const report = {
    schema: "genesis.selector-offline-slice4.v1",
    generatedAt: new Date().toISOString(),
    slice: 4,
    pass,
    summary: {
      goldenFiles: fileResults.filter((r) => !r.expectFail).length,
      goldenPass: fileResults.filter((r) => !r.expectFail && r.pass).length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      topInstrument: fileResults.find((r) => r.batchId)?.scores?.[0]?.instrumentId
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const batchResult = fileResults.find((r) => r.batchId);
  if (batchResult) {
    const batchDoc = loadJson(path.join(selectorDir, "offline-ranked-batch.json"));
    report.summary.topInstrument = batchDoc.scores?.[0]?.instrumentId;
    report.summary.topScore = batchDoc.scores?.[0]?.compositeScore;
  }

  const outPath = path.join(workspaceRoot, "reports/selector-offline-slice4.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
