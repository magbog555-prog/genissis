#!/usr/bin/env node
/**
 * validate-profitops-slice12.mjs — Slice 12 OwnerProfitOpsSummary offline gate (B7-minimal).
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import { validateOwnerProfitOpsSummary } from "../../../04_STREAMSETS_CONTRACTS/lib/contract-rules-v1.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const profitopsDir = path.join(workspaceRoot, "tests/fixtures/phase3/profitops");

const B7_MIN_PROFIT_FACTOR = 1.15;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function addViolation(violations, ruleId, severity, message, extra = {}) {
  violations.push({ ruleId, severity, message, ...extra });
}

function validateSummaryFile(fileName, expectFail, { minSampleCount, expansionId }) {
  const rel = `tests/fixtures/phase3/profitops/${fileName}`;
  const doc = loadJson(path.join(profitopsDir, fileName));
  const violations = [];

  const contract = validateOwnerProfitOpsSummary(doc);
  violations.push(...contract.violations);

  if (!expectFail) {
    const m = doc.metrics ?? {};
    if (doc.metricsScope !== "PAPER" && doc.metricsScope !== "SIMULATED") {
      addViolation(violations, "RC-SLICE12-OFFLINE-ONLY", "RED", "ProfitOps slice12 requires PAPER or SIMULATED scope", {
        summaryId: doc.summaryId
      });
    }
    if (typeof m.netExpectancyAfterFunding === "number" && m.netExpectancyAfterFunding <= 0) {
      addViolation(
        violations,
        "RC-PROFITOPS-B7-NET-EXPECTANCY",
        "RED",
        "golden paper-forward netExpectancyAfterFunding must be > 0",
        { summaryId: doc.summaryId, actual: m.netExpectancyAfterFunding }
      );
    }
    if (typeof m.profitFactor === "number" && m.profitFactor < B7_MIN_PROFIT_FACTOR) {
      addViolation(
        violations,
        "RC-PROFITOPS-B7-PROFIT-FACTOR",
        "RED",
        `golden profitFactor must be >= ${B7_MIN_PROFIT_FACTOR}`,
        { summaryId: doc.summaryId, actual: m.profitFactor }
      );
    }
    if (!("netExpectancyAfterFees" in m) || !("feeDrag" in m)) {
      addViolation(violations, "RC-PROFITOPS-B7-COST-FIELDS", "RED", "golden must include cost-adjusted metrics", {
        summaryId: doc.summaryId
      });
    }
    const sampleCount = m.sampleCount;
    if (typeof sampleCount !== "number" || sampleCount < minSampleCount) {
      addViolation(
        violations,
        "RC-PROFITOPS-B7-SAMPLE-COUNT",
        "RED",
        `golden paper batch sampleCount must be >= ${minSampleCount} (${expansionId})`,
        { summaryId: doc.summaryId, actual: sampleCount, expansionId, minSampleCount }
      );
    }
  } else if (expectFail) {
    const m = doc.metrics ?? {};
    if (typeof m.profitFactor === "number" && m.profitFactor < B7_MIN_PROFIT_FACTOR) {
      addViolation(
        violations,
        "RC-PROFITOPS-B7-NEGATIVE-FIXTURE",
        "RED",
        "expected B7 fail: profitFactor below promotion threshold",
        { summaryId: doc.summaryId, actual: m.profitFactor }
      );
    }
    if (typeof m.netExpectancyAfterFunding === "number" && m.netExpectancyAfterFunding <= 0) {
      addViolation(
        violations,
        "RC-PROFITOPS-B7-NEGATIVE-FIXTURE",
        "RED",
        "expected B7 fail: non-positive netExpectancyAfterFunding",
        { summaryId: doc.summaryId, actual: m.netExpectancyAfterFunding }
      );
    }
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  const validationPass = expectFail ? redCount > 0 : redCount === 0;

  return {
    file: rel,
    expectFail,
    pass: validationPass,
    summaryId: doc.summaryId,
    redCount,
    violations
  };
}

function resolveExpansionId() {
  const batchPath = path.join(profitopsDir, "slice12-trade-batch.json");
  if (fs.existsSync(batchPath)) {
    const batch = loadJson(batchPath);
    if (batch.expansion) return batch.expansion;
  }
  const manifestPath = path.join(profitopsDir, "slice12-manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = loadJson(manifestPath);
    if (manifest.expansion) return manifest.expansion;
  }
  return "profitops-expanded-sample-v2";
}

function main() {
  const manifestPath = path.join(profitopsDir, "slice12-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-profitops-slice12.mjs first" }));
    process.exit(1);
  }

  const expansionId = resolveExpansionId();
  const isV3 = expansionId === "profitops-expanded-sample-v3";
  const minSampleCount = isV3 ? 100 : 20;

  const manifest = loadJson(manifestPath);
  const fileResults = [];
  const gateCtx = { minSampleCount, expansionId };
  for (const f of manifest.files ?? []) fileResults.push(validateSummaryFile(f, false, gateCtx));
  for (const f of manifest.negativeFiles ?? []) fileResults.push(validateSummaryFile(f, true, gateCtx));

  const goldenFail = fileResults.filter((r) => !r.expectFail && !r.pass);
  const negativeFail = fileResults.filter((r) => r.expectFail && !r.pass);
  const pass = goldenFail.length === 0 && negativeFail.length === 0;

  const golden = fileResults.find((r) => !r.expectFail);
  const report = {
    schema: "genesis.profitops-offline-slice12.v1",
    generatedAt: new Date().toISOString(),
    slice: 12,
    pass,
    b7MinimalGate: {
      minProfitFactor: B7_MIN_PROFIT_FACTOR,
      requiresNetExpectancyAfterFundingPositive: true,
      costAdjustedMetricsRequired: true,
      minSampleCount,
      expansionId
    },
    summary: {
      goldenFiles: (manifest.files ?? []).length,
      goldenPass: (manifest.files ?? []).length - goldenFail.length,
      negativeFiles: (manifest.negativeFiles ?? []).length,
      negativePass: (manifest.negativeFiles ?? []).length - negativeFail.length,
      summaryId: golden?.summaryId,
      netExpectancyAfterFunding: golden
        ? loadJson(path.join(profitopsDir, manifest.files[0])).metrics?.netExpectancyAfterFunding
        : undefined,
      profitFactor: golden ? loadJson(path.join(profitopsDir, manifest.files[0])).metrics?.profitFactor : undefined,
      sampleCount: golden ? loadJson(path.join(profitopsDir, manifest.files[0])).metrics?.sampleCount : undefined,
      winrate: golden ? loadJson(path.join(profitopsDir, manifest.files[0])).metrics?.winrate : undefined
    },
    files: fileResults,
    notaryGreenClaimed: false,
    liveIngestion: false,
    executionAllowed: false
  };

  const outPath = path.join(workspaceRoot, "reports/profitops-offline-slice12.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, ...report.summary }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
