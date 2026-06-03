#!/usr/bin/env node
/**
 * validate-owner-operating-views-slice11.mjs
 * Validate owner operating views summary for Slice 11.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import {
  CLOSURE_STATUS_ENUM,
  MAX_SOURCE_REPORT_AGE_MS,
  OWNER_VIEW_STATUS_ENUM,
  addViolation,
  checkNoFakePassFallback,
  hashHex
} from "./contracts-hardening-utils.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const reportsDir = path.join(workspaceRoot, "reports");
const reportPath = path.join(reportsDir, "owner-operating-views-slice11.json");
const verifyOutPath = path.join(reportsDir, "owner-operating-views-slice11.verify.json");
const screenProofVerifyPath = path.join(reportsDir, "screen-proof-discipline.verify.json");

const SOURCES = [
  { slice: 6, key: "admission", file: "admission-offline-slice6.json" },
  { slice: 7, key: "tradeCard", file: "trade-card-offline-slice7.json" },
  { slice: 8, key: "paperExecution", file: "paper-execution-offline-slice8.json" },
  { slice: 9, key: "tradeHistory", file: "trade-history-offline-slice9.json" },
  { slice: 10, key: "runtimeAlignment", file: "visibility-runtime-alignment-slice10.json" }
];

function asSet(arr) {
  return new Set(Array.isArray(arr) ? arr : []);
}

function main() {
  const violations = [];
  if (!fs.existsSync(reportPath)) {
    console.error(JSON.stringify({ ok: false, error: "Run build-owner-operating-views-slice11.mjs first" }, null, 2));
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (report.schema !== "genesis.owner-operating-views-slice11.v1") {
    addViolation(violations, "RC-S11-SCHEMA", "RED", "schema mismatch for Slice 11 report", { actual: report.schema });
  }
  if (report.pass !== true) {
    addViolation(violations, "RC-S11-PASS", "RED", "pass must be true");
  }
  if (!String(report.viewId ?? "").startsWith("OWNER-S11-")) {
    addViolation(violations, "RC-S11-VIEW-ID", "RED", "viewId must start with OWNER-S11-");
  }
  if (!OWNER_VIEW_STATUS_ENUM.has(report.status)) {
    addViolation(violations, "RC-S11-STATUS-ENUM", "RED", "status must use strict enum vocabulary", {
      actual: report.status
    });
  }

  const covered = asSet(report.coveredSlices);
  const expectedCovered = asSet([6, 7, 8, 9, 10]);
  for (const slice of expectedCovered) {
    if (!covered.has(slice)) {
      addViolation(violations, "RC-S11-COVERAGE", "RED", `coveredSlices missing slice ${slice}`);
    }
  }
  if (covered.size !== expectedCovered.size) {
    addViolation(violations, "RC-S11-COVERAGE-EXTRA", "RED", "coveredSlices must contain exactly slices 6,7,8,9,10");
  }

  const constraints = report.constraints ?? {};
  if (constraints.notaryGreenClaimed !== false) {
    addViolation(violations, "RC-S11-NOTARY", "RED", "constraints.notaryGreenClaimed must be false");
  }
  if (constraints.executionAllowed !== false) {
    addViolation(violations, "RC-S11-EXECUTION", "RED", "constraints.executionAllowed must be false");
  }
  if (constraints.liveIngestion !== false) {
    addViolation(violations, "RC-S11-LIVE-INGESTION", "RED", "constraints.liveIngestion must be false");
  }
  const screenProofDiscipline = report.ownerOperatingViews?.screenProofDiscipline ?? {};
  const shellReadiness = report.ownerOperatingViews?.genesisShellReadiness ?? {};
  if (screenProofDiscipline.pass !== true) {
    addViolation(violations, "RC-S11-SCREEN-PROOF-PASS", "RED", "screenProofDiscipline.pass must be true");
  }
  if (typeof screenProofDiscipline.provenScreens !== "number" || screenProofDiscipline.provenScreens < 0) {
    addViolation(
      violations,
      "RC-S11-SCREEN-PROOF-PROVEN",
      "RED",
      "screenProofDiscipline.provenScreens must be non-negative number"
    );
  }
  if (typeof screenProofDiscipline.unprovenScreens !== "number" || screenProofDiscipline.unprovenScreens < 0) {
    addViolation(
      violations,
      "RC-S11-SCREEN-PROOF-UNPROVEN",
      "RED",
      "screenProofDiscipline.unprovenScreens must be non-negative number"
    );
  }
  if (screenProofDiscipline.verifyReportRef !== "reports/screen-proof-discipline.verify.json") {
    addViolation(violations, "RC-S11-SCREEN-PROOF-REF", "RED", "screenProofDiscipline.verifyReportRef mismatch", {
      actual: screenProofDiscipline.verifyReportRef
    });
  }
  if (shellReadiness.summarySchema !== "genesis.owner-operator-trust-readmodel.v1") {
    addViolation(violations, "RC-S11-SHELL-SCHEMA", "RED", "genesisShellReadiness.summarySchema mismatch", {
      actual: shellReadiness.summarySchema
    });
  }
  if (shellReadiness.em012ClosureSupport !== true) {
    addViolation(violations, "RC-S11-SHELL-EM012", "RED", "genesisShellReadiness.em012ClosureSupport must be true");
  }
  if (!CLOSURE_STATUS_ENUM.has(shellReadiness.operatorShellUiScanClosureStatus)) {
    addViolation(
      violations,
      "RC-S11-SHELL-CLOSURE-STATUS",
      "RED",
      "genesisShellReadiness.operatorShellUiScanClosureStatus must be COMPLETE/PARTIAL/FAIL",
      { actual: shellReadiness.operatorShellUiScanClosureStatus }
    );
  }
  if (shellReadiness.operatorShellUiScanClosureRef !== "reports/operator-shell-ui-scan-closure.verify.json") {
    addViolation(
      violations,
      "RC-S11-SHELL-CLOSURE-REF",
      "RED",
      "genesisShellReadiness.operatorShellUiScanClosureRef mismatch",
      { actual: shellReadiness.operatorShellUiScanClosureRef }
    );
  }
  if (shellReadiness.pairSignalDeclared !== "operatorTier + notaryStatus") {
    addViolation(
      violations,
      "RC-S11-SHELL-PAIR-DECLARED",
      "RED",
      "genesisShellReadiness.pairSignalDeclared must be `operatorTier + notaryStatus`",
      { actual: shellReadiness.pairSignalDeclared }
    );
  }
  if (typeof shellReadiness.operatorTier !== "string" || shellReadiness.operatorTier.length === 0) {
    addViolation(violations, "RC-S11-SHELL-OPERATOR", "RED", "genesisShellReadiness.operatorTier must be non-empty string");
  }
  if (typeof shellReadiness.notaryStatus !== "string" || shellReadiness.notaryStatus.length === 0) {
    addViolation(violations, "RC-S11-SHELL-NOTARY", "RED", "genesisShellReadiness.notaryStatus must be non-empty string");
  }
  const expectedPairSignal = `${shellReadiness.operatorTier ?? ""} + ${shellReadiness.notaryStatus ?? ""}`;
  if (shellReadiness.pairSignal !== expectedPairSignal) {
    addViolation(violations, "RC-S11-SHELL-PAIR-VALUE", "RED", "genesisShellReadiness.pairSignal mismatch", {
      expected: expectedPairSignal,
      actual: shellReadiness.pairSignal
    });
  }
  if (shellReadiness.notaryGreenNo !== true) {
    addViolation(violations, "RC-S11-SHELL-NOTARY-GREEN-NO", "RED", "genesisShellReadiness.notaryGreenNo must be true");
  }
  if (shellReadiness.note !== "NOTARY GREEN NO") {
    addViolation(violations, "RC-S11-SHELL-NOTE", "RED", "genesisShellReadiness.note must be NOTARY GREEN NO", {
      actual: shellReadiness.note
    });
  }
  const kpis = report.ownerOperatingViews?.kpis ?? {};
  if (kpis.provenScreens !== screenProofDiscipline.provenScreens) {
    addViolation(violations, "RC-S11-KPI-PROVEN-MISMATCH", "RED", "kpi provenScreens must match screenProofDiscipline");
  }
  if (kpis.unprovenScreens !== screenProofDiscipline.unprovenScreens) {
    addViolation(violations, "RC-S11-KPI-UNPROVEN-MISMATCH", "RED", "kpi unprovenScreens must match screenProofDiscipline");
  }
  if (!fs.existsSync(screenProofVerifyPath)) {
    addViolation(
      violations,
      "RC-S11-SCREEN-PROOF-REPORT-MISSING",
      "RED",
      "screen proof verify report is missing; run verify:screen-proof-discipline"
    );
  }
  checkNoFakePassFallback({
    violations,
    report,
    contextRulePrefix: "RC-S11",
    context: { viewId: report.viewId ?? null }
  });
  const freshness = report.freshness ?? {};
  if (freshness.ttlMs !== MAX_SOURCE_REPORT_AGE_MS) {
    addViolation(violations, "RC-S11-FRESHNESS-TTL", "RED", "freshness.ttlMs must match contract TTL", {
      actual: freshness.ttlMs,
      expected: MAX_SOURCE_REPORT_AGE_MS
    });
  }
  if (typeof freshness.maxSourceAgeMs !== "number" || freshness.maxSourceAgeMs < 0) {
    addViolation(violations, "RC-S11-FRESHNESS-AGE", "RED", "freshness.maxSourceAgeMs must be non-negative number", {
      actual: freshness.maxSourceAgeMs
    });
  }
  if (typeof freshness.maxSourceAgeMs === "number" && freshness.maxSourceAgeMs > MAX_SOURCE_REPORT_AGE_MS) {
    addViolation(violations, "RC-S11-FRESHNESS-EXCEEDED", "RED", "freshness.maxSourceAgeMs exceeds TTL window", {
      maxSourceAgeMs: freshness.maxSourceAgeMs,
      ttlMs: MAX_SOURCE_REPORT_AGE_MS
    });
  }

  for (const src of SOURCES) {
    const absPath = path.join(reportsDir, src.file);
    if (!fs.existsSync(absPath)) {
      addViolation(violations, "RC-S11-SOURCE-MISSING", "RED", `source report missing: reports/${src.file}`);
      continue;
    }
    const raw = fs.readFileSync(absPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.pass !== true) {
      addViolation(violations, "RC-S11-SOURCE-PASS", "RED", `source report must pass: reports/${src.file}`, {
        slice: src.slice,
        actualPass: parsed.pass
      });
    }
    const expectedDigest = `sha256:${hashHex(raw)}`;
    const actualDigest = report.sourceReportDigests?.[src.key];
    if (expectedDigest !== actualDigest) {
      addViolation(violations, "RC-S11-DIGEST", "RED", "source digest mismatch", {
        source: src.key,
        expectedDigest,
        actualDigest
      });
    }
  }

  const redCount = violations.filter((item) => item.severity === "RED").length;
  const pass = redCount === 0;
  const verify = {
    schema: "genesis.owner-operating-views-slice11.verify.v1",
    generatedAt: new Date().toISOString(),
    slice: 11,
    pass,
    viewId: report.viewId ?? null,
    coveredSlices: report.coveredSlices ?? [],
    violations,
    constraints
  };

  fs.writeFileSync(verifyOutPath, JSON.stringify(verify, null, 2));
  console.log(JSON.stringify({ ok: pass, outPath: verifyOutPath, redCount, viewId: verify.viewId }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
