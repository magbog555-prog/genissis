#!/usr/bin/env node
/**
 * validate-paper-execution-slice8.mjs — Slice 8 PaperExecution offline gate.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { collectForbiddenKeys, FORBIDDEN_KEYS_GLOBAL } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");
const tradeCardDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-card");

const PAPER_EXECUTION_SCHEMA = "genesis.paper-execution.v1";
const TRADE_CARD_SCHEMA = "genesis.trade-card-draft.v1";
const FORBIDDEN_PAPER_EXECUTION = new Set([
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

function loadTradeCardIndex() {
  const index = new Map();
  const manifestPath = path.join(tradeCardDir, "slice7-manifest.json");
  if (!fs.existsSync(manifestPath)) return index;
  const manifest = loadJson(manifestPath);
  for (const file of manifest.files ?? []) {
    const doc = loadJson(path.join(tradeCardDir, file));
    if (doc.schema === TRADE_CARD_SCHEMA && doc.tradeCardId) index.set(doc.tradeCardId, doc);
  }
  return index;
}

function validatePaperExecution(doc, options = {}) {
  const violations = [];
  const id = doc.paperExecutionId ?? "(no id)";
  const { expectFail = false, tradeCardIndex = new Map() } = options;

  if (doc.schema !== PAPER_EXECUTION_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${PAPER_EXECUTION_SCHEMA}`, {
      paperExecutionId: id,
      actual: doc.schema
    });
  }

  const required = [
    "schema",
    "paperExecutionId",
    "instrumentId",
    "tradeCardRef",
    "admissionRef",
    "scenarioRef",
    "simulationStatus",
    "executionSurface",
    "simulatedOnly",
    "riskGuardrails",
    "simulationTimestamps",
    "provenance",
    "contractVersion",
    "schemaVersion",
    "ownerRole",
    "consumerRoles"
  ];
  for (const key of required) {
    if (!(key in doc)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, { paperExecutionId: id });
    }
  }

  if (doc.simulationStatus !== "PAPER_SIMULATED") {
    addViolation(violations, "RC-PEX-SIMULATION-STATUS", "RED", "simulationStatus must be PAPER_SIMULATED", {
      paperExecutionId: id,
      actual: doc.simulationStatus
    });
  }
  if (doc.executionSurface !== "BLOCKED") {
    addViolation(violations, "RC-PEX-EXECUTION-SURFACE", "RED", "executionSurface must remain BLOCKED", {
      paperExecutionId: id,
      actual: doc.executionSurface
    });
  }
  if (doc.simulatedOnly !== true) {
    addViolation(violations, "RC-PEX-SIMULATED-ONLY", "RED", "simulatedOnly must be true", {
      paperExecutionId: id
    });
  }

  const guardrails = doc.riskGuardrails ?? {};
  if (guardrails.executionAllowed !== false) {
    addViolation(violations, "RC-PEX-EXECUTION-BLOCK", "RED", "riskGuardrails.executionAllowed must be false", {
      paperExecutionId: id
    });
  }
  if (guardrails.mode !== "OFFLINE_ONLY") {
    addViolation(violations, "RC-PEX-MODE", "RED", "riskGuardrails.mode must be OFFLINE_ONLY", {
      paperExecutionId: id
    });
  }

  const ts = doc.simulationTimestamps ?? {};
  if (!isIsoString(ts.computedAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "simulationTimestamps.computedAt must be ISO-8601", {
      paperExecutionId: id
    });
  }
  if (!isIsoString(ts.expiresAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "simulationTimestamps.expiresAt must be ISO-8601", {
      paperExecutionId: id
    });
  }

  const prov = doc.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { paperExecutionId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      paperExecutionId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE8-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 8 offline", {
      paperExecutionId: id
    });
  }

  if (doc.notaryGreenClaimed !== false) {
    addViolation(violations, "RC-PEX-NOTARY", "RED", "notaryGreenClaimed must be false", {
      paperExecutionId: id
    });
  }
  if (doc.liveIngestion !== false) {
    addViolation(violations, "RC-PEX-LIVE-INGESTION", "RED", "liveIngestion must be false", {
      paperExecutionId: id
    });
  }

  if (!expectFail && doc.tradeCardRef && !tradeCardIndex.has(doc.tradeCardRef)) {
    addViolation(violations, "RC-PEX-TRADE-CARD-REF-MISSING", "RED", "tradeCardRef not found in trade-card fixtures", {
      paperExecutionId: id,
      tradeCardRef: doc.tradeCardRef
    });
  }

  if (!expectFail && doc.tradeCardRef && tradeCardIndex.has(doc.tradeCardRef)) {
    const tradeCard = tradeCardIndex.get(doc.tradeCardRef);
    if (tradeCard.instrumentId !== doc.instrumentId) {
      addViolation(violations, "RC-PEX-INSTRUMENT-MISMATCH", "RED", "instrumentId must match trade card instrument", {
        paperExecutionId: id,
        expected: tradeCard.instrumentId,
        actual: doc.instrumentId
      });
    }
    if (tradeCard.admissionRef !== doc.admissionRef) {
      addViolation(violations, "RC-PEX-ADMISSION-MISMATCH", "RED", "admissionRef must match trade card admissionRef", {
        paperExecutionId: id,
        expected: tradeCard.admissionRef,
        actual: doc.admissionRef
      });
    }
    if (tradeCard.scenarioRef !== doc.scenarioRef) {
      addViolation(violations, "RC-PEX-SCENARIO-MISMATCH", "RED", "scenarioRef must match trade card scenarioRef", {
        paperExecutionId: id,
        expected: tradeCard.scenarioRef,
        actual: doc.scenarioRef
      });
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_PAPER_EXECUTION);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden execution fields on PaperExecution", {
      paperExecutionId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, paperExecutionId: id };
}

function validateFile(fileName, expectFail, tradeCardIndex) {
  const rel = `tests/fixtures/phase3/paper-execution/${fileName}`;
  const doc = loadJson(path.join(paperExecutionDir, fileName));
  const result = validatePaperExecution(doc, { expectFail, tradeCardIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;
  return {
    file: rel,
    expectFail,
    pass: validationPass,
    paperExecutionId: result.paperExecutionId,
    instrumentId: doc.instrumentId,
    tradeCardRef: doc.tradeCardRef,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(paperExecutionDir, "slice8-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-paper-execution-slice8.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const tradeCardIndex = loadTradeCardIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    fileResults.push(validateFile(f, false, tradeCardIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateFile(f, true, tradeCardIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);
  const report = {
    schema: "genesis.paper-execution-offline-slice8.v1",
    generatedAt: new Date().toISOString(),
    slice: 8,
    pass,
    summary: {
      paperExecutionCount: manifest.paperExecutionCount ?? (manifest.files ?? []).length,
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      paperExecutionId: golden?.paperExecutionId,
      instrumentId: golden?.instrumentId,
      tradeCardRef: golden?.tradeCardRef
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/paper-execution-offline-slice8.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
