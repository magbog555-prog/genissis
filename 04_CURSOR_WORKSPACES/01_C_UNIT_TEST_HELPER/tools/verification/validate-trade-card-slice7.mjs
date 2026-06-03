#!/usr/bin/env node
/**
 * validate-trade-card-slice7.mjs — Slice 7 TradeCardDraft offline gate.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { collectForbiddenKeys, FORBIDDEN_KEYS_GLOBAL } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeCardDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-card");
const admissionDir = path.join(workspaceRoot, "tests/fixtures/phase3/admission");

const TRADE_CARD_SCHEMA = "genesis.trade-card-draft.v1";
const ADMISSION_SCHEMA = "genesis.admission-decision.v1";
const ALLOWED_ADMISSION_STATUSES = new Set(["PREPARE", "ALLOW"]);
const FORBIDDEN_TRADE_CARD = new Set([...FORBIDDEN_KEYS_GLOBAL, "orderIntent", "signedOrder", "exchangeRoute"]);

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

function loadAdmissionIndex() {
  const index = new Map();
  const manifestPath = path.join(admissionDir, "slice6-manifest.json");
  if (!fs.existsSync(manifestPath)) return index;
  const manifest = loadJson(manifestPath);
  for (const file of manifest.files ?? []) {
    const doc = loadJson(path.join(admissionDir, file));
    if (doc.schema === ADMISSION_SCHEMA && doc.admissionId) index.set(doc.admissionId, doc);
  }
  return index;
}

function validateTradeCard(doc, options = {}) {
  const violations = [];
  const id = doc.tradeCardId ?? "(no id)";
  const { expectFail = false, admissionIndex = new Map() } = options;

  if (doc.schema !== TRADE_CARD_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${TRADE_CARD_SCHEMA}`, {
      tradeCardId: id,
      actual: doc.schema
    });
  }

  const required = [
    "schema",
    "tradeCardId",
    "instrumentId",
    "admissionRef",
    "scenarioRef",
    "side",
    "setupType",
    "draftStatus",
    "pricePlan",
    "riskPlan",
    "draftTimestamps",
    "provenance",
    "contractVersion",
    "schemaVersion",
    "ownerRole",
    "consumerRoles"
  ];
  for (const key of required) {
    if (!(key in doc)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, { tradeCardId: id });
    }
  }

  const riskPlan = doc.riskPlan ?? {};
  if (riskPlan.executionAllowed !== false) {
    addViolation(violations, "RC-TC-EXECUTION-BLOCK", "RED", "riskPlan.executionAllowed must be false", {
      tradeCardId: id
    });
  }
  if (riskPlan.mode !== "OFFLINE_ONLY") {
    addViolation(violations, "RC-TC-MODE", "RED", "riskPlan.mode must be OFFLINE_ONLY", { tradeCardId: id });
  }

  const ts = doc.draftTimestamps ?? {};
  if (!isIsoString(ts.computedAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "draftTimestamps.computedAt must be ISO-8601", {
      tradeCardId: id
    });
  }
  if (!isIsoString(ts.expiresAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "draftTimestamps.expiresAt must be ISO-8601", {
      tradeCardId: id
    });
  }

  const prov = doc.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { tradeCardId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      tradeCardId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE7-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 7 offline", {
      tradeCardId: id
    });
  }

  if (!expectFail && doc.admissionRef && !admissionIndex.has(doc.admissionRef)) {
    addViolation(violations, "RC-TC-ADMISSION-REF-MISSING", "RED", "admissionRef not found in admission fixtures", {
      tradeCardId: id,
      admissionRef: doc.admissionRef
    });
  }

  if (!expectFail && doc.admissionRef && admissionIndex.has(doc.admissionRef)) {
    const admission = admissionIndex.get(doc.admissionRef);
    if (admission.instrumentId !== doc.instrumentId) {
      addViolation(violations, "RC-TC-INSTRUMENT-MISMATCH", "RED", "instrumentId must match admission instrument", {
        tradeCardId: id,
        expected: admission.instrumentId,
        actual: doc.instrumentId
      });
    }
    if (admission.scenarioRef !== doc.scenarioRef) {
      addViolation(violations, "RC-TC-SCENARIO-MISMATCH", "RED", "scenarioRef must match admission scenarioRef", {
        tradeCardId: id,
        expected: admission.scenarioRef,
        actual: doc.scenarioRef
      });
    }
    if (!ALLOWED_ADMISSION_STATUSES.has(admission.admissionStatus)) {
      addViolation(violations, "RC-TC-ADMISSION-STATUS", "RED", "trade card requires PREPARE or ALLOW admission", {
        tradeCardId: id,
        actual: admission.admissionStatus
      });
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_TRADE_CARD);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on TradeCardDraft", {
      tradeCardId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, tradeCardId: id };
}

function validateFile(fileName, expectFail, admissionIndex) {
  const rel = `tests/fixtures/phase3/trade-card/${fileName}`;
  const doc = loadJson(path.join(tradeCardDir, fileName));
  const result = validateTradeCard(doc, { expectFail, admissionIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;
  return {
    file: rel,
    expectFail,
    pass: validationPass,
    tradeCardId: result.tradeCardId,
    instrumentId: doc.instrumentId,
    admissionRef: doc.admissionRef,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(tradeCardDir, "slice7-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-trade-card-slice7.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const admissionIndex = loadAdmissionIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    fileResults.push(validateFile(f, false, admissionIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateFile(f, true, admissionIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);
  const report = {
    schema: "genesis.trade-card-offline-slice7.v1",
    generatedAt: new Date().toISOString(),
    slice: 7,
    pass,
    summary: {
      tradeCardCount: manifest.tradeCardCount ?? (manifest.files ?? []).length,
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      tradeCardId: golden?.tradeCardId,
      instrumentId: golden?.instrumentId,
      admissionRef: golden?.admissionRef
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/trade-card-offline-slice7.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
