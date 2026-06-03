#!/usr/bin/env node
/**
 * verify-operator-shell-ui-scan-closure.mjs
 * Bridge verify for consuming CHK-UI-SCAN operator shell notary report.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const genesisRoot = getGenesisRoot();
const reportsDir = path.join(workspaceRoot, "reports");

const reportArgIdx = process.argv.findIndex((arg) => arg === "--report");
const outArgIdx = process.argv.findIndex((arg) => arg === "--out");

function resolveCandidateReports() {
  if (reportArgIdx >= 0 && process.argv[reportArgIdx + 1]) {
    return [path.resolve(workspaceRoot, process.argv[reportArgIdx + 1])];
  }

  return [
    path.join(
      genesisRoot,
      "04_CURSOR_WORKSPACES",
      "02_CODE_CLOAKER_NOTARY",
      "reports",
      "frontend-scan-genesis-operator-shell.json"
    ),
    path.join(reportsDir, "operator-shell-ui-scan-report.json"),
    path.join(reportsDir, "operator-shell-frontend-scan-report.json"),
    path.join(reportsDir, "genesis-shell-trust-readiness.verify.json"),
    path.join(genesisRoot, "04_CURSOR_WORKSPACES", "02_CODE_CLOAKER_NOTARY", "reports", "frontend-scan-mbg-donor.json")
  ];
}

const reportCandidates = resolveCandidateReports();
const notaryReportPath = reportCandidates.find((candidate) => fs.existsSync(candidate)) ?? reportCandidates[0];
const outPath =
  outArgIdx >= 0 && process.argv[outArgIdx + 1]
    ? path.resolve(workspaceRoot, process.argv[outArgIdx + 1])
    : path.join(reportsDir, "operator-shell-ui-scan-closure.verify.json");

function buildResult({ closureStatus, sourceReportRef, sourceExists, reasons, pass, sourceDigest, sourceOfTruthReport }) {
  return {
    schema: "genesis.operator-shell-ui-scan-closure.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    closureStatus,
    sourceOfTruthReport,
    sourceReportRef,
    sourceExists,
    sourceDigest,
    reasons
  };
}

function toFiniteOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeScanTruth(report) {
  const schema = String(report?.schema ?? "");
  const violations = Array.isArray(report?.violations) ? report.violations : [];
  const redFromViolations = violations.filter((violation) => {
    const explicitSeverity = String(violation?.severity ?? "").toUpperCase();
    const uiSeverity = String(violation?.wouldBeSeverityInOperatorUi ?? "").toUpperCase();
    return explicitSeverity === "RED" || uiSeverity === "RED";
  }).length;
  const redCountField = toFiniteOrNull(report?.redCount);
  const redCount = Math.max(redCountField ?? 0, redFromViolations);
  const passField = report?.pass;
  const hasExplicitFail = passField === false;
  const hasRed = redCount > 0;

  if (schema === "genesis.frontend-scan-report.v1") {
    return {
      supported: true,
      isCanonicalScan: true,
      hasRed,
      hasExplicitFail,
      redCount,
      reasonHint: hasRed ? `Canonical scan RED findings present: ${redCount}` : null
    };
  }

  if (schema === "genesis.shell-trust-readiness.verify.v1") {
    return {
      supported: true,
      isCanonicalScan: false,
      hasRed,
      hasExplicitFail,
      redCount,
      reasonHint: hasRed ? `Readiness report RED violations present: ${redCount}` : null
    };
  }

  return {
    supported: false,
    isCanonicalScan: false,
    hasRed: false,
    hasExplicitFail: false,
    redCount: null,
    reasonHint: null
  };
}

function main() {
  const sourceReportRef = path.relative(workspaceRoot, notaryReportPath).replace(/\\/g, "/");
  const sourceOfTruthReport = sourceReportRef;
  const reasons = [];
  let closureStatus = "FAIL";
  let pass = false;
  let sourceExists = false;
  let sourceDigest = null;

  if (!fs.existsSync(notaryReportPath)) {
    reasons.push(`Missing notary report: ${sourceReportRef}`);
  } else {
    sourceExists = true;
    const raw = fs.readFileSync(notaryReportPath, "utf8");
    sourceDigest = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    try {
      const report = JSON.parse(raw);
      const scanTruth = summarizeScanTruth(report);
      const schemaName = String(report?.schema ?? "UNKNOWN");
      const passOk = report?.pass === true;
      const filesScanned = toFiniteOrNull(report?.filesScanned) ?? 0;
      const zeroFilesScanned = scanTruth.isCanonicalScan && filesScanned === 0;

      if (!scanTruth.supported) {
        reasons.push(`Unexpected source schema: ${schemaName}`);
      }

      if (!scanTruth.isCanonicalScan) {
        reasons.push(
          "Source report is not canonical frontend scan; using fallback report (operator-shell/readiness)"
        );
      }

      if (zeroFilesScanned) {
        reasons.push("Canonical frontend scan has filesScanned=0 — false pass blocked");
      }

      if (scanTruth.supported && passOk && !scanTruth.hasRed && !zeroFilesScanned) {
        closureStatus = "COMPLETE";
        pass = true;
      } else if (scanTruth.supported) {
        closureStatus = "PARTIAL";
        if (!passOk) reasons.push("Source pass=false");
        if (scanTruth.hasExplicitFail) reasons.push("Canonical scan explicitly reports FAIL (pass=false)");
        if (scanTruth.hasRed) reasons.push(`RED/fail findings present in source-of-truth scan: ${scanTruth.redCount}`);
        if (scanTruth.reasonHint) reasons.push(scanTruth.reasonHint);
      } else {
        closureStatus = "FAIL";
      }
    } catch (error) {
      closureStatus = "FAIL";
      reasons.push(`Invalid JSON in source report: ${error.message}`);
    }
  }

  const result = buildResult({
    closureStatus,
    sourceReportRef,
    sourceOfTruthReport,
    sourceExists,
    sourceDigest,
    reasons,
    pass
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: pass, closureStatus, outPath }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
