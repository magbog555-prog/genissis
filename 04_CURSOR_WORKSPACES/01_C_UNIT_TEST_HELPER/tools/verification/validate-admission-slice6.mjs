#!/usr/bin/env node
/**
 * validate-admission-slice6.mjs — Slice 6 AdmissionDecision offline gate.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { collectForbiddenKeys, FORBIDDEN_KEYS_GLOBAL } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const admissionDir = path.join(workspaceRoot, "tests/fixtures/phase3/admission");
const scenarioDir = path.join(workspaceRoot, "tests/fixtures/phase3/scenario");

const ADMISSION_SCHEMA = "genesis.admission-decision.v1";
const SCENARIO_SCHEMA = "genesis.scenario-candidate.v1";
const ALLOWED_STATUSES = new Set(["WATCH", "WAIT", "PREPARE", "ALLOW", "BLOCK", "EXPIRED", "INVALIDATED"]);
const FORBIDDEN_ADMISSION = new Set([...FORBIDDEN_KEYS_GLOBAL, "orderIntent", "signedOrder", "exchangeRoute"]);

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

function loadScenarioIndex() {
  const index = new Map();
  const manifestPath = path.join(scenarioDir, "slice5-manifest.json");
  if (!fs.existsSync(manifestPath)) return index;
  const manifest = loadJson(manifestPath);
  for (const file of manifest.files ?? []) {
    const doc = loadJson(path.join(scenarioDir, file));
    if (doc.schema === SCENARIO_SCHEMA && doc.scenarioId) index.set(doc.scenarioId, doc);
  }
  return index;
}

function validateDecision(doc, options = {}) {
  const violations = [];
  const id = doc.admissionId ?? "(no id)";
  const { expectFail = false, scenarioIndex = new Map() } = options;

  if (doc.schema !== ADMISSION_SCHEMA) {
    addViolation(violations, "RC-CONTRACT-SCHEMA-ID", "RED", `schema must be ${ADMISSION_SCHEMA}`, {
      admissionId: id,
      actual: doc.schema
    });
  }

  const required = [
    "schema",
    "admissionId",
    "admissionStatus",
    "instrumentId",
    "scenarioRef",
    "scenarioPhase",
    "confidence",
    "reasons",
    "guardrails",
    "decisionTimestamps",
    "provenance",
    "contractVersion",
    "schemaVersion",
    "ownerRole",
    "consumerRoles"
  ];
  for (const key of required) {
    if (!(key in doc)) {
      addViolation(violations, "RC-CONTRACT-REQUIRED", "RED", `missing required field: ${key}`, { admissionId: id });
    }
  }

  if (!ALLOWED_STATUSES.has(doc.admissionStatus)) {
    addViolation(violations, "RC-ADM-STATUS", "RED", "admissionStatus not in allowed vocabulary", {
      admissionId: id,
      actual: doc.admissionStatus
    });
  }

  if (typeof doc.confidence !== "number" || doc.confidence < 0 || doc.confidence > 1) {
    addViolation(violations, "RC-ADM-CONFIDENCE", "RED", "confidence must be number in [0, 1]", {
      admissionId: id,
      actual: doc.confidence
    });
  }

  if (!Array.isArray(doc.reasons) || doc.reasons.length === 0) {
    addViolation(violations, "RC-ADM-REASONS", "RED", "reasons must be non-empty array", { admissionId: id });
  }

  const guardrails = doc.guardrails ?? {};
  if (guardrails.executionAllowed !== false) {
    addViolation(violations, "RC-ADM-EXECUTION-BLOCK", "RED", "guardrails.executionAllowed must be false", {
      admissionId: id
    });
  }
  if (guardrails.mode !== "OFFLINE_ONLY") {
    addViolation(violations, "RC-ADM-MODE", "RED", "guardrails.mode must be OFFLINE_ONLY", { admissionId: id });
  }

  const ts = doc.decisionTimestamps ?? {};
  if (!isIsoString(ts.computedAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "decisionTimestamps.computedAt must be ISO-8601", {
      admissionId: id
    });
  }
  if (!isIsoString(ts.expiresAt)) {
    addViolation(violations, "RC-TIMESTAMPS-INVALID", "RED", "decisionTimestamps.expiresAt must be ISO-8601", {
      admissionId: id
    });
  }

  const prov = doc.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "derivation", "lineageHash"]) {
    if (!prov[f]) {
      addViolation(violations, "RC-PROVENANCE-INCOMPLETE", "RED", `provenance.${f} required`, { admissionId: id });
    }
  }
  if (!isSha256Prefixed(prov.lineageHash)) {
    addViolation(violations, "RC-PROVENANCE-LINEAGE", "RED", "provenance.lineageHash must be sha256:<hex>", {
      admissionId: id
    });
  }
  if (prov.sourceKind === "LIVE_VENUE" || prov.sourceKind === "TESTNET_VENUE") {
    addViolation(violations, "RC-SLICE6-OFFLINE-ONLY", "RED", "live provenance forbidden in Slice 6 offline", {
      admissionId: id
    });
  }

  if (!expectFail && doc.scenarioRef && !scenarioIndex.has(doc.scenarioRef)) {
    addViolation(violations, "RC-ADM-SCENARIO-REF-MISSING", "RED", "scenarioRef not found in scenario fixtures", {
      admissionId: id,
      scenarioRef: doc.scenarioRef
    });
  }

  if (!expectFail && doc.scenarioRef && scenarioIndex.has(doc.scenarioRef)) {
    const scenario = scenarioIndex.get(doc.scenarioRef);
    if (scenario.instrumentId !== doc.instrumentId) {
      addViolation(violations, "RC-ADM-INSTRUMENT-MISMATCH", "RED", "instrumentId must match scenario instrument", {
        admissionId: id,
        expected: scenario.instrumentId,
        actual: doc.instrumentId
      });
    }
    if (scenario.phase !== doc.scenarioPhase) {
      addViolation(violations, "RC-ADM-PHASE-MISMATCH", "RED", "scenarioPhase must match scenario phase", {
        admissionId: id,
        expected: scenario.phase,
        actual: doc.scenarioPhase
      });
    }
  }

  const forbiddenHits = collectForbiddenKeys(doc, FORBIDDEN_ADMISSION);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on AdmissionDecision", {
      admissionId: id,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  return { violations, redCount, admissionId: id };
}

function validateFile(fileName, expectFail, scenarioIndex) {
  const rel = `tests/fixtures/phase3/admission/${fileName}`;
  const doc = loadJson(path.join(admissionDir, fileName));
  const result = validateDecision(doc, { expectFail, scenarioIndex });
  const validationPass = expectFail ? result.redCount > 0 : result.redCount === 0;
  return {
    file: rel,
    expectFail,
    pass: validationPass,
    admissionId: result.admissionId,
    admissionStatus: doc.admissionStatus,
    instrumentId: doc.instrumentId,
    redCount: result.redCount,
    violations: result.violations
  };
}

function main() {
  const manifestPath = path.join(admissionDir, "slice6-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-admission-slice6.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const scenarioIndex = loadScenarioIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    fileResults.push(validateFile(f, false, scenarioIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateFile(f, true, scenarioIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);
  const report = {
    schema: "genesis.admission-offline-slice6.v1",
    generatedAt: new Date().toISOString(),
    slice: 6,
    pass,
    summary: {
      admissionCount: manifest.admissionCount ?? (manifest.files ?? []).length,
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      admissionId: golden?.admissionId,
      admissionStatus: golden?.admissionStatus,
      instrumentId: golden?.instrumentId
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/admission-offline-slice6.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
