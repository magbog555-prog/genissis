#!/usr/bin/env node
/**
 * validate-phase3-fixtures.mjs — Phase 3 P4 offline fixture gate
 * No network. No MBG edits. No Notary GREEN.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const fixtureDir = path.join(workspaceRoot, "tests/fixtures/phase3/market-observation");

const OBS_SCHEMA = "genesis.market-observation.v1";
const BATCH_SCHEMA = "genesis.market-observation.batch.v1";
const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT"]);
const ALLOWED_VENUE = "SYNTHETIC_OFFLINE";
const ALLOWED_CLASSES = new Set(["FACT", "NOISE"]);
const FORBIDDEN_CLASSES = new Set(["OPINION", "FORECAST", "SIGNAL"]);
const FORBIDDEN_KEYS = new Set([
  "admissionState",
  "scenarioDecision",
  "orderPayload",
  "executionIntentId",
  "exchangeEndpoint",
  "signedPayload",
  "rawOrderPayload",
  "canExecute",
  "apiKey",
  "listenKey"
]);
const LIVE_SOURCE_KINDS = new Set(["LIVE_VENUE", "TESTNET_VENUE"]);
const LIVE_INGEST_MODES = new Set(["LIVE_WS", "LIVE_REST"]);
const REQUIRED_OBS_KEYS = [
  "schema",
  "observationId",
  "instrument",
  "eventType",
  "observationClass",
  "timestamps",
  "provenance",
  "freshness",
  "quality",
  "payload"
];

function parseIso(ms) {
  const t = Date.parse(ms);
  return Number.isFinite(t) ? t : NaN;
}

function collectForbiddenKeys(obj, pathPrefix = "", hits = []) {
  if (obj === null || typeof obj !== "object") return hits;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => collectForbiddenKeys(v, `${pathPrefix}[${i}]`, hits));
    return hits;
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (FORBIDDEN_KEYS.has(k)) hits.push(p);
    collectForbiddenKeys(v, p, hits);
  }
  return hits;
}

function addViolation(violations, gate, severity, message, extra = {}) {
  violations.push({ gate, severity, message, ...extra });
}

function validateObservation(obs, ctx) {
  const violations = [];
  const id = obs.observationId ?? "(no id)";

  if (obs.schema !== OBS_SCHEMA) {
    addViolation(violations, "QG-P3-01", "RED", `schema must be ${OBS_SCHEMA}`, { observationId: id });
  }

  for (const key of REQUIRED_OBS_KEYS) {
    if (!(key in obs)) {
      addViolation(violations, "QG-P3-01", "RED", `missing required field: ${key}`, { observationId: id });
    }
  }

  const prov = obs.provenance ?? {};
  for (const f of ["sourceId", "sourceKind", "ingestMode", "lineageHash", "fixtureVersion"]) {
    if (!prov[f]) {
      addViolation(violations, "QG-P3-02", "RED", `provenance.${f} required`, { observationId: id });
    }
  }
  if (prov.sourceKind && prov.sourceKind !== "OFFLINE_FIXTURE") {
    addViolation(violations, "QG-P3-02", "RED", "Slice 2 requires sourceKind OFFLINE_FIXTURE", {
      observationId: id,
      actual: prov.sourceKind
    });
  }

  if (LIVE_SOURCE_KINDS.has(prov.sourceKind)) {
    addViolation(violations, "QG-P3-08", "RED", "live sourceKind forbidden", { observationId: id });
  }
  if (LIVE_INGEST_MODES.has(prov.ingestMode)) {
    addViolation(violations, "QG-P3-08", "RED", "live ingestMode forbidden", { observationId: id });
  }

  const ts = obs.timestamps ?? {};
  const sourceT = parseIso(ts.sourceEventTime);
  const observedT = parseIso(ts.observedAt);
  const fresh = obs.freshness ?? {};

  if (!Number.isFinite(sourceT) || !Number.isFinite(observedT)) {
    addViolation(violations, "QG-P3-03", "RED", "timestamps must be valid ISO-8601", { observationId: id });
  } else {
    const expectedAge = observedT - sourceT;
    if (typeof fresh.computedAgeMs !== "number") {
      addViolation(violations, "QG-P3-03", "RED", "freshness.computedAgeMs required", { observationId: id });
    } else if (Math.abs(fresh.computedAgeMs - expectedAge) > 5) {
      addViolation(
        violations,
        "QG-P3-03",
        "RED",
        "computedAgeMs must match observedAt - sourceEventTime",
        { observationId: id, expectedAge, actual: fresh.computedAgeMs }
      );
    }

    const maxAge = fresh.maxAgeMs ?? 0;
    const status = fresh.status;
    if (expectedAge <= maxAge && status !== "FRESH") {
      addViolation(violations, "QG-P3-04", "YELLOW", "status should be FRESH when within maxAgeMs", {
        observationId: id
      });
    }
    if (expectedAge > maxAge && status === "FRESH") {
      addViolation(violations, "QG-P3-04", "RED", "status FRESH but age exceeds maxAgeMs", { observationId: id });
    }
  }

  const forbiddenHits = collectForbiddenKeys(obs);
  if (forbiddenHits.length) {
    addViolation(violations, "QG-P3-05", "RED", "forbidden fields present", {
      observationId: id,
      paths: forbiddenHits
    });
  }

  const inst = obs.instrument ?? {};
  if (!ALLOWED_SYMBOLS.has(inst.symbol)) {
    addViolation(violations, "QG-P3-06", "RED", "instrument not in Slice 2 whitelist", {
      observationId: id,
      symbol: inst.symbol
    });
  }
  if (inst.venue !== ALLOWED_VENUE) {
    addViolation(violations, "QG-P3-06", "RED", `venue must be ${ALLOWED_VENUE}`, {
      observationId: id,
      venue: inst.venue
    });
  }

  const cls = obs.observationClass;
  if (FORBIDDEN_CLASSES.has(cls)) {
    addViolation(violations, "QG-P3-07", "RED", `observationClass ${cls} forbidden in Slice 2`, {
      observationId: id
    });
  } else if (!ALLOWED_CLASSES.has(cls)) {
    addViolation(violations, "QG-P3-07", "RED", `unknown observationClass: ${cls}`, { observationId: id });
  }

  if (obs.liveExchangeConnected === true) {
    addViolation(violations, "QG-P3-08", "RED", "liveExchangeConnected must not be true offline", {
      observationId: id
    });
  }

  const raw = JSON.stringify(obs);
  if (/BINANCE_API|api\.binance|testnet\.binance/i.test(raw)) {
    addViolation(violations, "QG-P3-08", "RED", "live venue URL/key pattern in fixture", { observationId: id });
  }

  ctx.ohlcBars.push({ observationId: id, barIndex: obs.payload?.barIndex, eventType: obs.eventType });

  const red = violations.filter((v) => v.severity === "RED");
  return { observationId: id, pass: red.length === 0, violations };
}

function validateOhlcGaps(ohlcBars, file) {
  const violations = [];
  const bars = ohlcBars
    .filter((b) => b.eventType === "OHLC_1M" && typeof b.barIndex === "number")
    .sort((a, b) => a.barIndex - b.barIndex);
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].barIndex !== bars[i - 1].barIndex + 1) {
      addViolation(violations, "QG-P3-10", "YELLOW", "OHLC barIndex gap", {
        file,
        prev: bars[i - 1].barIndex,
        curr: bars[i].barIndex
      });
    }
  }
  const red = violations.filter((v) => v.severity === "RED");
  return { pass: red.length === 0, violations };
}

function loadManifest() {
  const manifestPath = path.join(fixtureDir, "slice2-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const golden = manifest.files ?? [];
  const negative = manifest.negativeFiles ?? [];
  return { manifest, golden, negative };
}

function extractObservations(doc) {
  if (doc.schema === BATCH_SCHEMA && Array.isArray(doc.observations)) {
    return doc.observations;
  }
  if (doc.schema === OBS_SCHEMA) return [doc];
  return [];
}

function validateFile(fileName, expectFail) {
  const filePath = path.join(fixtureDir, fileName);
  const rel = path.relative(workspaceRoot, filePath).replace(/\\/g, "/");
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const observations = extractObservations(doc);
  const fileViolations = [];

  if (!observations.length) {
    addViolation(fileViolations, "QG-P3-01", "RED", "no observations found in fixture");
  }

  const ctx = { ohlcBars: [] };
  const results = observations.map((obs) => validateObservation(obs, ctx));
  const gap = validateOhlcGaps(ctx.ohlcBars, fileName);

  const allViolations = [
    ...fileViolations,
    ...results.flatMap((r) => r.violations),
    ...gap.violations
  ];
  const redCount = allViolations.filter((v) => v.severity === "RED").length;
  const validationPass = expectFail ? redCount > 0 : redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    observationCount: observations.length,
    redCount,
    yellowCount: allViolations.filter((v) => v.severity === "YELLOW").length,
    violations: allViolations,
    observations: results
  };
}

function main() {
  const { manifest, golden, negative } = loadManifest();
  const fileResults = [];

  for (const f of golden) {
    fileResults.push(validateFile(f, false));
  }
  for (const f of negative) {
    fileResults.push(validateFile(f, true));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);

  const pass =
    goldenFail.length === 0 &&
    (negative.length === 0 || negativeFail.length === 0);

  const report = {
    schema: "genesis.phase3-fixture-validation.v1",
    generatedAt: new Date().toISOString(),
    slice: manifest.slice ?? 2,
    fixtureDir: "tests/fixtures/phase3/market-observation",
    pass,
    summary: {
      goldenFiles: golden.length,
      goldenPass: golden.length - goldenFail.length,
      negativeFiles: negative.length,
      negativePass: negative.length - negativeFail.length,
      negativeFail: negativeFail.length
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const reportsDir = path.join(workspaceRoot, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, "phase3-fixture-validation.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
