#!/usr/bin/env node
/**
 * validate-perception-slice3.mjs — Slice 3 PerceptionSnapshot offline gate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import {
  validatePerceptionSnapshot,
  PERCEPTION_SCHEMA
} from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const perceptionDir = path.join(workspaceRoot, "tests/fixtures/phase3/perception");
const marketDir = path.join(workspaceRoot, "tests/fixtures/phase3/market-observation");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadObservationIndex() {
  const index = new Set();
  for (const name of fs.readdirSync(marketDir)) {
    if (!name.endsWith(".json") || name.startsWith("negative")) continue;
    const doc = loadJson(path.join(marketDir, name));
    if (Array.isArray(doc.observations)) {
      for (const o of doc.observations) index.add(o.observationId);
    }
  }
  return index;
}

function validateSnapshotFile(fileName, expectFail, obsIndex) {
  const rel = `tests/fixtures/phase3/perception/${fileName}`;
  const doc = loadJson(path.join(perceptionDir, fileName));
  const violations = [];

  if (doc.schema !== PERCEPTION_SCHEMA) {
    violations.push({
      ruleId: "RC-CONTRACT-SCHEMA-ID",
      severity: "RED",
      message: "not a PerceptionSnapshot root"
    });
  }

  const result = validatePerceptionSnapshot(doc, { slice2: true });
  violations.push(...result.violations);

  if (!expectFail && doc.sourceObservationRefs) {
    for (const ref of doc.sourceObservationRefs) {
      if (!obsIndex.has(ref)) {
        violations.push({
          ruleId: "RC-PERCEPTION-SOURCE-REF-MISSING",
          severity: "RED",
          message: `sourceObservationRef not found in golden market fixtures: ${ref}`,
          snapshotId: doc.snapshotId
        });
      }
    }
  }

  if (doc.provenance?.sourceKind === "LIVE_VENUE" || doc.provenance?.sourceKind === "TESTNET_VENUE") {
    violations.push({
      ruleId: "RC-SLICE3-OFFLINE-ONLY",
      severity: "RED",
      message: "live provenance forbidden in Slice 3 offline"
    });
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  const validationPass = expectFail ? redCount > 0 : redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    snapshotId: doc.snapshotId,
    redCount,
    violations
  };
}

function main() {
  const manifestPath = path.join(perceptionDir, "slice3-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-perception-slice3.mjs first" }));
    process.exit(1);
  }

  const manifest = loadJson(manifestPath);
  const obsIndex = loadObservationIndex();
  const fileResults = [];

  for (const f of manifest.files ?? []) {
    fileResults.push(validateSnapshotFile(f, false, obsIndex));
  }
  for (const f of manifest.negativeFiles ?? []) {
    fileResults.push(validateSnapshotFile(f, true, obsIndex));
  }

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const report = {
    schema: "genesis.perception-offline-slice3.v1",
    generatedAt: new Date().toISOString(),
    slice: 3,
    pass,
    summary: {
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false
  };

  const outPath = path.join(workspaceRoot, "reports/perception-offline-slice3.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
