#!/usr/bin/env node
/**
 * validate-trade-history-slice9.mjs — Slice 9 Trade History offline gate.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { collectForbiddenKeys, FORBIDDEN_KEYS_GLOBAL } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeHistoryDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-history");
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");

const TRADE_HISTORY_SCHEMA = "genesis.trade-history-read-model.v1";
const PAPER_EXECUTION_SCHEMA = "genesis.paper-execution.v1";
const FORBIDDEN_TRADE_HISTORY = new Set([
  ...FORBIDDEN_KEYS_GLOBAL,
  "orderIntent",
  "signedOrder",
  "exchangeRoute",
  "executionId",
  "executionRoute",
  "liveExecutionRoute"
]);

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isIsoString(s) {
  return typeof s === "string" && Number.isFinite(Date.parse(s));
}

function isSha256Prefixed(s) {
  return typeof s === "string" && /^sha256:[0-9a-f]{32,128}$/i.test(s);
}

function addViolation(violations, ruleId, severity, message, extra = {}) {
  violations.push({ ruleId, severity, message, ...extra });
}

function loadPaperExecutionIndex() {
  const index = new Map();
  const manifestPath = path.join(paperExecutionDir, "slice8-manifest.json");
  if (!fs.existsSync(manifestPath)) return index;
  const manifest = loadJson(manifestPath);
  for (const file of manifest.files ?? []) {
    const doc = loadJson(path.join(paperExecutionDir, file));
    if (doc.schema === PAPER_EXECUTION_SCHEMA && doc.paperExecutionId) index.set(doc.paperExecutionId, doc);
  }
  return index;
}

function validateTradeHistory(doc, options = {}) {
  const violations = [];
  const id = doc.tradeHistoryId ?? doc.historyId ?? "(no id)";
  const { expectFail = false, paperExecutionIndex = new Map() } = options;

  if (doc.schema !== TRADE_HISTORY_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${TRADE_HISTORY_SCHEMA}`, {
      tradeHistoryId: id,
      actual: doc.schema
    });
  }

  const required = [
    "schema",
    "tradeHistoryId",
    "instrumentId",
    "paperExecutionRef",
    "tradeCardRef",
    "admissionRef",
    "scenarioRef",
    "historyStatus",
    "executionSurface",
    "readModelOnly",
    "riskGuardrails",
    "historyTimestamps",
    "provenance",
    "contractVersion",
    "schemaVersion",
    "ownerRole",
    "consumerRoles"
  ];
  for (const key of required) {
    if (!(key in doc)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, { tradeHistoryId: id });
    }
  }

  if (doc.executionSurface !== "BLOCKED") {
    addViolation(violations, "RC-TH-EXECUTION-SURFACE", "RED", "executionSurface must remain BLOCKED", {
      tradeHistoryId: id,
      actual: doc.executionSurface
    });
  }
  if (doc.readModelOnly !== true) {
    addViolation(violations, "RC-TH-READMODEL-ONLY", "RED", "readModelOnly must be true", {
      tradeHistoryId: id
    });
  }
  if (doc.historyStatus !== "RECORDED_OFFLINE") {
    addViolation(violations, "RC-TH-HISTORY-STATUS", "RED", "historyStatus must be RECORDED_OFFLINE", {
      tradeHistoryId: id,
      actual: doc.historyStatus
    });
  }

  const guardrails = doc.riskGuardrails ?? {};
  if (guardrails.executionAllowed !== false) {
    addViolation(violations, "RC-TH-EXECUTION-BLOCK", "RED", "riskGuardrails.executionAllowed must be false", {
      tradeHistoryId: id
    });
  }
  if (guardrails.mode !== "OFFLINE_ONLY") {
    addViolation(violations, "RC-TH-MODE", "RED", "riskGuardrails.mode must be OFFLINE_ONLY", {
      tradeHistoryId: id
    });
  }

  const ts = doc.historyTimestamps ?? {};
  if (!isIsoString(ts.computedAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "historyTimestamps.computedAt must be ISO-8601", {
      tradeHistoryId: id
    });
  }
  if (!isIsoString(ts.sourceComputedAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "historyTimestamps.sourceComputedAt must be ISO-8601", {
      tradeHistoryId: id
    });
  }

  const prov = doc.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { tradeHistoryId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      tradeHistoryId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE9-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 9 offline", {
      tradeHistoryId: id
    });
  }

  if (doc.notaryGreenClaimed !== false) {
    addViolation(violations, "RC-TH-NOTARY", "RED", "notaryGreenClaimed must be false", {
      tradeHistoryId: id
    });
  }
  if (doc.liveIngestion !== false) {
    addViolation(violations, "RC-TH-LIVE-INGESTION", "RED", "liveIngestion must be false", {
      tradeHistoryId: id
    });
  }

  if (!expectFail && doc.paperExecutionRef && !paperExecutionIndex.has(doc.paperExecutionRef)) {
    addViolation(violations, "RC-TH-PAPER-EXEC-REF-MISSING", "RED", "paperExecutionRef not found in paper-execution fixtures", {
      tradeHistoryId: id,
      paperExecutionRef: doc.paperExecutionRef
    });
  }

  if (!expectFail && doc.paperExecutionRef && paperExecutionIndex.has(doc.paperExecutionRef)) {
    const pex = paperExecutionIndex.get(doc.paperExecutionRef);
    if (pex.instrumentId !== doc.instrumentId) {
      addViolation(violations, "RC-TH-INSTRUMENT-MISMATCH", "RED", "instrumentId must match paper execution instrument", {
        tradeHistoryId: id,
        expected: pex.instrumentId,
        actual: doc.instrumentId
      });
    }
    if (pex.tradeCardRef !== doc.tradeCardRef) {
      addViolation(violations, "RC-TH-TRADE-CARD-MISMATCH", "RED", "tradeCardRef must match paper execution tradeCardRef", {
        tradeHistoryId: id,
        expected: pex.tradeCardRef,
        actual: doc.tradeCardRef
      });
    }
    if (pex.admissionRef !== doc.admissionRef) {
      addViolation(violations, "RC-TH-ADMISSION-MISMATCH", "RED", "admissionRef must match paper execution admissionRef", {
        tradeHistoryId: id,
        expected: pex.admissionRef,
        actual: doc.admissionRef
      });
    }
    if (pex.scenarioRef !== doc.scenarioRef) {
      addViolation(violations, "RC-TH-SCENARIO-MISMATCH", "RED", "scenarioRef must match paper execution scenarioRef", {
        tradeHistoryId: id,
        expected: pex.scenarioRef,
        actual: doc.scenarioRef
      });
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_TRADE_HISTORY);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden execution fields on TradeHistoryReadModel", {
      tradeHistoryId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, tradeHistoryId: id };
}

function validateFile(fileName, expectFail, paperExecutionIndex) {
  const rel = `tests/fixtures/phase3/trade-history/${fileName}`;
  const doc = loadJson(path.join(tradeHistoryDir, fileName));
  const result = validateTradeHistory(doc, { expectFail, paperExecutionIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;
  return {
    file: rel,
    expectFail,
    pass: validationPass,
    tradeHistoryId: result.tradeHistoryId,
    historyId: doc.historyId,
    instrumentId: doc.instrumentId,
    paperExecutionRef: doc.paperExecutionRef,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(tradeHistoryDir, "slice9-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-trade-history-slice9.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const paperExecutionIndex = loadPaperExecutionIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    fileResults.push(validateFile(f, false, paperExecutionIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateFile(f, true, paperExecutionIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);
  const report = {
    schema: "genesis.trade-history-offline-slice9.v1",
    generatedAt: new Date().toISOString(),
    slice: 9,
    pass,
    summary: {
      tradeHistoryCount: manifest.tradeHistoryCount ?? (manifest.files ?? []).length,
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      tradeHistoryId: golden?.tradeHistoryId,
      historyId: golden?.historyId,
      instrumentId: golden?.instrumentId,
      paperExecutionRef: golden?.paperExecutionRef
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/trade-history-offline-slice9.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
