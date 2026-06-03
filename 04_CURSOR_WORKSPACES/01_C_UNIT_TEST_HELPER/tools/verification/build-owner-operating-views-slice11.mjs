#!/usr/bin/env node
/**
 * build-owner-operating-views-slice11.mjs
 * Build owner-visible operating view summary from Slice 6-10 reports (read-only only).
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "./genesis-paths.mjs";
import {
  CLOSURE_STATUS_ENUM,
  MAX_SOURCE_REPORT_AGE_MS,
  OWNER_VIEW_STATUS_ENUM,
  hashHex,
  parseIsoMs
} from "./contracts-hardening-utils.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const genesisRoot = getGenesisRoot();
const reportsDir = path.join(workspaceRoot, "reports");
const outPath = path.join(reportsDir, "owner-operating-views-slice11.json");
const screenProofVerifyPath = path.join(reportsDir, "screen-proof-discipline.verify.json");
const operatorShellUiScanClosureVerifyPath = path.join(reportsDir, "operator-shell-ui-scan-closure.verify.json");
const boardPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS", "genesis-system-status-board.json");

const SOURCES = [
  { slice: 6, key: "admission", file: "admission-offline-slice6.json" },
  { slice: 7, key: "tradeCard", file: "trade-card-offline-slice7.json" },
  { slice: 8, key: "paperExecution", file: "paper-execution-offline-slice8.json" },
  { slice: 9, key: "tradeHistory", file: "trade-history-offline-slice9.json" },
  { slice: 10, key: "runtimeAlignment", file: "visibility-runtime-alignment-slice10.json" }
];

function readSource(src) {
  const absPath = path.join(reportsDir, src.file);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing source report: reports/${src.file}`);
  }
  const raw = fs.readFileSync(absPath, "utf8");
  const doc = JSON.parse(raw);
  return {
    ...src,
    path: `reports/${src.file}`,
    report: doc,
    digest: `sha256:${hashHex(raw)}`
  };
}

function buildOutput(records) {
  const generatedAt = new Date().toISOString();
  const pass = records.every((record) => record.report?.pass === true);
  const coveredSlices = records.map((record) => record.slice);

  const negativeGuardsPasses = records
    .filter((record) => record.slice >= 6 && record.slice <= 9)
    .reduce((acc, record) => {
      const summary = record.report?.summary ?? {};
      const negativeFiles = Number(summary.negativeFiles ?? 0);
      const negativePass = Number(summary.negativePass ?? 0);
      return acc + (negativePass >= negativeFiles ? 1 : 0);
    }, 0);

  const viewSeed = JSON.stringify({
    generatedAt,
    coveredSlices,
    digests: records.map((record) => ({ slice: record.slice, digest: record.digest }))
  });
  const viewId = `OWNER-S11-${hashHex(viewSeed).slice(0, 16).toUpperCase()}`;

  const sourceReportDigests = Object.fromEntries(records.map((record) => [record.key, record.digest]));
  const sourceReportPass = Object.fromEntries(records.map((record) => [record.key, record.report?.pass === true]));
  const failedSlices = records.filter((record) => record.report?.pass !== true).map((record) => record.slice);
  const status = failedSlices.length === 0 ? "OWNER_VIEW_OK" : "OWNER_VIEW_DEGRADED";
  if (!OWNER_VIEW_STATUS_ENUM.has(status)) {
    throw new Error(`Unexpected owner view status generated: ${status}`);
  }
  const generatedAtMs = parseIsoMs(generatedAt);
  const sourceAgesMs = records.map((record) => {
    const sourceGeneratedAtMs = parseIsoMs(record.report?.generatedAt);
    return Number.isFinite(sourceGeneratedAtMs) ? Math.max(0, generatedAtMs - sourceGeneratedAtMs) : NaN;
  });
  const maxSourceAgeMs = sourceAgesMs.reduce((acc, age) => (Number.isFinite(age) ? Math.max(acc, age) : acc), 0);

  const constraints = {
    notaryGreenClaimed: false,
    executionAllowed: false,
    liveIngestion: false
  };
  const screenProofDiscipline = fs.existsSync(screenProofVerifyPath)
    ? JSON.parse(fs.readFileSync(screenProofVerifyPath, "utf8"))
    : null;
  const provenScreens = Number(screenProofDiscipline?.totals?.proven ?? 0);
  const unprovenScreens = Number(screenProofDiscipline?.totals?.unproven ?? 0);
  const screenProofPass = screenProofDiscipline?.pass === true;
  const board = fs.existsSync(boardPath) ? JSON.parse(fs.readFileSync(boardPath, "utf8")) : null;
  const operatorTier = String(board?.program?.operatorArtifact ?? "MISSING");
  const notaryStatus = String(
    board?.program?.trust ?? board?.layers?.find((layer) => layer.layer === "notary")?.status ?? "UNKNOWN"
  ).toUpperCase();
  const notaryGreenNo = notaryStatus !== "GREEN";
  const pairSignal = `${operatorTier} + ${notaryStatus}`;
  const pairSignalDeclared = "operatorTier + notaryStatus";
  const operatorShellUiScanClosure = fs.existsSync(operatorShellUiScanClosureVerifyPath)
    ? JSON.parse(fs.readFileSync(operatorShellUiScanClosureVerifyPath, "utf8"))
    : null;
  let closureStatus = String(operatorShellUiScanClosure?.closureStatus ?? "FAIL").toUpperCase();
  if (!CLOSURE_STATUS_ENUM.has(closureStatus)) {
    closureStatus = "FAIL";
  }

  return {
    schema: "genesis.owner-operating-views-slice11.v1",
    generatedAt,
    slice: 11,
    pass,
    viewId,
    coveredSlices,
    sourceReportDigests,
    sourceReportPass,
    constraints,
    freshness: {
      ttlMs: MAX_SOURCE_REPORT_AGE_MS,
      maxSourceAgeMs
    },
    status,
    ownerOperatingViews: {
      genesisShellReadiness: {
        summarySchema: "genesis.owner-operator-trust-readmodel.v1",
        em012ClosureSupport: true,
        operatorShellUiScanClosureStatus: closureStatus,
        operatorShellUiScanClosureRef: "reports/operator-shell-ui-scan-closure.verify.json",
        pairSignalDeclared,
        pairSignal,
        operatorTier,
        notaryStatus,
        notaryGreenNo,
        note: notaryGreenNo ? "NOTARY GREEN NO" : "NOTARY GREEN YES FORBIDDEN"
      },
      kpis: {
        reportsPassRatio: `${records.filter((record) => record.report?.pass === true).length}/${records.length}`,
        negativeGuardsRatio: `${negativeGuardsPasses}/4`,
        readOnlyMode: true,
        executionAllowed: constraints.executionAllowed,
        provenScreens,
        unprovenScreens
      },
      riskSummary: [
        `Operator shell UI scan closure status: ${closureStatus}.`,
        `Pair signal snapshot: ${pairSignalDeclared} => ${pairSignal}.`,
        notaryGreenNo ? "NOTARY GREEN NO remains enforced until closure." : "NOTARY GREEN YES is forbidden before closure.",
        "Notary remains non-GREEN and cannot be interpreted as execution approval.",
        "All owner metrics are derived from offline reports only.",
        screenProofPass
          ? "Screen↔proof governance discipline verified for active owner/decision screens."
          : "Screen↔proof governance discipline report missing or failing."
      ],
      blockersSummary: [
        closureStatus === "COMPLETE"
          ? "Operator shell UI scan closure complete."
          : `Operator shell UI scan closure is ${closureStatus}; run npm run verify:operator-shell-ui-scan-closure.`,
        "Execution unlock is blocked: executionAllowed=false.",
        "Notary promotion is blocked: notaryGreenClaimed=false.",
        screenProofPass
          ? `Screen↔proof discipline: proven=${provenScreens}, unproven=${unprovenScreens}.`
          : "Screen↔proof discipline unresolved: run npm run verify:screen-proof-discipline.",
        failedSlices.length
          ? `Slice verification blockers present in slices: ${failedSlices.join(", ")}.`
          : "No slice-level blockers detected in source reports."
      ],
      screenProofDiscipline: {
        pass: screenProofPass,
        provenScreens,
        unprovenScreens,
        verifyReportRef: "reports/screen-proof-discipline.verify.json"
      }
    }
  };
}

function main() {
  const records = SOURCES.map(readSource);
  const report = buildOutput(records);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        pass: report.pass,
        viewId: report.viewId,
        coveredSlices: report.coveredSlices,
        outPath
      },
      null,
      2
    )
  );
}

main();
