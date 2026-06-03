#!/usr/bin/env node
/**
 * verify-mbg-wire.mjs — GO-WIRE gate: MBG readonly → MarketObservation
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { wireMbgToObservation } from "../integration/mbg-readonly-to-observation.mjs";
import {
  validateMarketObservation,
  collectForbiddenKeys,
  FORBIDDEN_KEYS_GLOBAL
} from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();

function addViolation(violations, ruleId, severity, message, extra = {}) {
  violations.push({ ruleId, severity, message, ...extra });
}

function validateWireObservation(obs) {
  const violations = [];
  const result = validateMarketObservation(obs, { slice2: false });
  violations.push(...result.violations);

  if (obs.provenance?.sourceKind !== "MBG_READONLY_API") {
    addViolation(violations, "RC-WIRE-PROVENANCE", "RED", "wire observation requires sourceKind MBG_READONLY_API", {
      observationId: obs.observationId
    });
  }

  if (obs.instrument?.venue !== "MBG_READONLY_API") {
    addViolation(violations, "RC-WIRE-VENUE", "RED", "wire observation venue must be MBG_READONLY_API", {
      observationId: obs.observationId
    });
  }

  const forbiddenHits = collectForbiddenKeys(obs, FORBIDDEN_KEYS_GLOBAL);
  if (forbiddenHits.length) {
    addViolation(violations, "RC-LAYER-COLLAPSE", "RED", "forbidden fields on wire MarketObservation", {
      observationId: obs.observationId,
      paths: forbiddenHits.map((h) => h.path)
    });
  }

  const red = violations.filter((v) => v.severity === "RED");
  return { pass: red.length === 0, violations, redCount: red.length };
}

async function main() {
  const wire = await wireMbgToObservation({ writeSample: true });
  const reportPath = path.join(workspaceRoot, "reports/mbg-wire-market-observation.json");

  if (!wire.ok) {
    const report = {
      schema: "genesis.mbg-wire-market-observation.v1",
      generatedAt: new Date().toISOString(),
      pass: false,
      status: "YELLOW",
      coreReachable: false,
      baseUrl: wire.baseUrl,
      message: wire.message,
      notaryGreenClaimed: false,
      liveIngestion: false,
      executionAllowed: false
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: false, status: "YELLOW", outPath: reportPath, message: wire.message }, null, 2));
    process.exit(0);
  }

  const validation = validateWireObservation(wire.observation);
  const pass = validation.pass;

  const report = {
    schema: "genesis.mbg-wire-market-observation.v1",
    generatedAt: new Date().toISOString(),
    pass,
    status: pass ? "PASS" : "RED",
    coreReachable: true,
    baseUrl: wire.baseUrl,
    samplePath: wire.samplePath,
    observationId: wire.observationId,
    instrumentId: wire.instrumentId,
    eventType: wire.eventType,
    validation,
    mbgOverview: wire.batch?.mbgOverview,
    notaryGreenClaimed: false,
    liveIngestion: true,
    executionAllowed: false
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: pass,
        status: pass ? "PASS" : "RED",
        outPath: reportPath,
        observationId: wire.observationId,
        instrumentId: wire.instrumentId
      },
      null,
      2
    )
  );
  process.exit(pass ? 0 : 1);
}

main();
