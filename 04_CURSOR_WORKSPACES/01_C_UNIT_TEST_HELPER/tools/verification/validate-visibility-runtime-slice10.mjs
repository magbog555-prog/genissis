#!/usr/bin/env node
/**
 * validate-visibility-runtime-slice10.mjs — machine verify for Slice 10
 * runtime summary consistency with latest Slice 6-9 reports.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import {
  FRESHNESS_MODE_ENUM,
  MAX_SOURCE_REPORT_AGE_MS,
  RUNTIME_ALIGNMENT_STATUS_ENUM,
  addViolation,
  checkNoFakePassFallback,
  hashHex,
  parseIsoMs
} from "./contracts-hardening-utils.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const reportsDir = path.join(workspaceRoot, "reports");
const summaryPath = path.join(reportsDir, "visibility-runtime-alignment-slice10.json");

const SOURCE_REPORTS = [
  { slice: 6, file: "admission-offline-slice6.json", key: "admission" },
  { slice: 7, file: "trade-card-offline-slice7.json", key: "tradeCard" },
  { slice: 8, file: "paper-execution-offline-slice8.json", key: "paperExecution" },
  { slice: 9, file: "trade-history-offline-slice9.json", key: "tradeHistory" }
];
const VERIFY_GUARD_RULE_ID = "RC-S10-VERIFY-GUARD";
const DIGEST_MISMATCH_THRESHOLD = 0;

function loadJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function asSet(arr) {
  return new Set(Array.isArray(arr) ? arr : []);
}

function main() {
  const violations = [];
  if (!fs.existsSync(summaryPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-visibility-runtime-slice10.mjs first" }, null, 2));
    process.exit(1);
  }

  const summary = loadJson(summaryPath);
  if (summary.schema !== "genesis.visibility-runtime-alignment-slice10.v1") {
    addViolation(violations, "RC-S10-SCHEMA", "RED", "schema mismatch for Slice 10 summary", {
      actual: summary.schema
    });
  }

  if (summary.pass !== true) {
    addViolation(violations, "RC-S10-PASS", "RED", "summary pass must be true");
  }
  if (!summary.runtimeAlignmentId || !String(summary.runtimeAlignmentId).startsWith("RA-S10-")) {
    addViolation(violations, "RC-S10-RUNTIME-ID", "RED", "runtimeAlignmentId must start with RA-S10-");
  }
  if (summary.runtimeAlignmentStatus !== "ALIGNED_OFFLINE") {
    addViolation(violations, "RC-S10-RUNTIME-STATUS", "RED", "runtimeAlignmentStatus must be ALIGNED_OFFLINE", {
      actual: summary.runtimeAlignmentStatus
    });
  }
  if (!RUNTIME_ALIGNMENT_STATUS_ENUM.has(summary.runtimeAlignmentStatus)) {
    addViolation(violations, "RC-S10-STATUS-ENUM", "RED", "runtimeAlignmentStatus must use strict enum vocabulary", {
      actual: summary.runtimeAlignmentStatus
    });
  }

  const constraints = summary.constraints ?? {};
  if (constraints.notaryGreenClaimed !== false) {
    addViolation(violations, "RC-S10-NOTARY", "RED", "constraints.notaryGreenClaimed must be false");
  }
  if (constraints.executionAllowed !== false) {
    addViolation(violations, "RC-S10-EXECUTION", "RED", "constraints.executionAllowed must be false");
  }
  if (constraints.liveIngestion !== false) {
    addViolation(violations, "RC-S10-LIVE-INGESTION", "RED", "constraints.liveIngestion must be false");
  }
  checkNoFakePassFallback({
    violations,
    report: summary,
    contextRulePrefix: "RC-S10",
    context: { runtimeAlignmentId: summary.runtimeAlignmentId ?? null }
  });

  const freshness = summary.freshness ?? {};
  if (!FRESHNESS_MODE_ENUM.has(freshness.mode)) {
    addViolation(violations, "RC-S10-FRESHNESS-ENUM", "RED", "freshness.mode must use strict enum vocabulary", {
      actual: freshness.mode
    });
  }
  if (freshness.ttlMs !== MAX_SOURCE_REPORT_AGE_MS) {
    addViolation(violations, "RC-S10-FRESHNESS-TTL", "RED", "freshness.ttlMs must match contract TTL", {
      actual: freshness.ttlMs,
      expected: MAX_SOURCE_REPORT_AGE_MS
    });
  }
  if (typeof freshness.maxSourceAgeMs !== "number" || freshness.maxSourceAgeMs < 0) {
    addViolation(violations, "RC-S10-FRESHNESS-AGE", "RED", "freshness.maxSourceAgeMs must be non-negative number", {
      actual: freshness.maxSourceAgeMs
    });
  }
  if (freshness.mode === "TTL_EXCEEDED") {
    addViolation(violations, "RC-S10-FRESHNESS-EXCEEDED", "RED", "freshness mode cannot be TTL_EXCEEDED for PASS summary", {
      maxSourceAgeMs: freshness.maxSourceAgeMs
    });
  }

  if (typeof summary.timestamps !== "object" || summary.timestamps === null) {
    addViolation(violations, "RC-S10-TIMESTAMPS", "RED", "timestamps object is required for temporal metadata separation");
  }

  const expectedRuntimeAlignmentId = `RA-S10-${hashHex(
    JSON.stringify({
      coveredSlices: SOURCE_REPORTS.map((src) => src.slice),
      reports: SOURCE_REPORTS.map((src) => ({
        slice: src.slice,
        file: `reports/${src.file}`,
        digest: summary.sourceReportDigests?.[src.key] ?? null
      }))
    })
  )
    .slice(0, 16)
    .toUpperCase()}`;
  if (summary.runtimeAlignmentId !== expectedRuntimeAlignmentId) {
    addViolation(
      violations,
      "RC-S10-RUNTIME-ID-STABILITY",
      "RED",
      "runtimeAlignmentId must be content-based and stable across generatedAt changes",
      {
        expectedRuntimeAlignmentId,
        actualRuntimeAlignmentId: summary.runtimeAlignmentId
      }
    );
  }

  const covered = asSet(summary.ownerVisibleRuntimeSummary?.coveredSlices);
  const expectedCovered = asSet([6, 7, 8, 9]);
  for (const slice of expectedCovered) {
    if (!covered.has(slice)) {
      addViolation(violations, "RC-S10-COVERAGE", "RED", `coveredSlices missing slice ${slice}`);
    }
  }
  if (covered.size !== expectedCovered.size) {
    addViolation(violations, "RC-S10-COVERAGE-EXTRA", "RED", "coveredSlices must contain exactly slices 6,7,8,9");
  }

  let digestMismatchCount = 0;
  let staleSourceCount = 0;
  for (const src of SOURCE_REPORTS) {
    const absPath = path.join(reportsDir, src.file);
    if (!fs.existsSync(absPath)) {
      addViolation(violations, "RC-S10-SOURCE-MISSING", "RED", `source report missing: reports/${src.file}`);
      continue;
    }

    const raw = fs.readFileSync(absPath, "utf8");
    const report = JSON.parse(raw);
    if (report.pass !== true) {
      addViolation(violations, "RC-S10-SOURCE-PASS", "RED", `source report must pass: reports/${src.file}`, {
        slice: src.slice,
        actualPass: report.pass
      });
    }

    const sourceGeneratedAtMs = parseIsoMs(report.generatedAt);
    if (!Number.isFinite(sourceGeneratedAtMs)) {
      addViolation(violations, "RC-S10-SOURCE-GENERATED-AT", "RED", "source report generatedAt must be valid ISO timestamp", {
        source: src.key,
        actual: report.generatedAt ?? null
      });
    } else {
      const ageMs = Math.max(0, Date.now() - sourceGeneratedAtMs);
      if (ageMs > MAX_SOURCE_REPORT_AGE_MS) {
        staleSourceCount += 1;
      }
    }

    const expectedDigest = `sha256:${hashHex(raw)}`;
    const actualDigest = summary.sourceReportDigests?.[src.key];
    if (actualDigest !== expectedDigest) {
      digestMismatchCount += 1;
      addViolation(violations, "RC-S10-DIGEST-MISMATCH", "RED", "summary digest differs from latest source report", {
        source: src.key,
        expectedDigest,
        actualDigest
      });
    }
  }

  const guardViolations = [];
  if (staleSourceCount > 0) {
    guardViolations.push(`stale sources: ${staleSourceCount}`);
  }
  if (digestMismatchCount > DIGEST_MISMATCH_THRESHOLD) {
    guardViolations.push(`digest mismatches: ${digestMismatchCount}`);
  }
  if (guardViolations.length > 0) {
    addViolation(
      violations,
      VERIFY_GUARD_RULE_ID,
      "RED",
      "verify guard failed: stale sources or mismatches exceeded threshold",
      {
        staleSourceCount,
        digestMismatchCount,
        digestMismatchThreshold: DIGEST_MISMATCH_THRESHOLD,
        guardViolations
      }
    );
  }

  const redCount = violations.filter((v) => v.severity === "RED").length;
  const pass = redCount === 0;
  const report = {
    schema: "genesis.visibility-runtime-alignment-slice10-verify.v1",
    generatedAt: new Date().toISOString(),
    slice: 10,
    pass,
    runtimeAlignmentId: summary.runtimeAlignmentId,
    runtimeAlignmentStatus: summary.runtimeAlignmentStatus,
    coveredSlices: summary.ownerVisibleRuntimeSummary?.coveredSlices ?? [],
    risks: summary.risks ?? [],
    guard: {
      staleSourceCount,
      digestMismatchCount,
      digestMismatchThreshold: DIGEST_MISMATCH_THRESHOLD,
      guardViolations
    },
    violations,
    constraints
  };

  const outPath = path.join(reportsDir, "visibility-runtime-alignment-slice10.verify.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({ ok: pass, outPath, redCount, runtimeAlignmentId: report.runtimeAlignmentId }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
