#!/usr/bin/env node
/**
 * build-visibility-runtime-slice10.mjs — consolidate Slice 6-9 reports
 * into owner-visible runtime summary (offline only, no execution unlock).
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";
import {
  FRESHNESS_MODE_ENUM,
  MAX_SOURCE_REPORT_AGE_MS,
  RUNTIME_ALIGNMENT_STATUS_ENUM,
  hashHex,
  parseIsoMs
} from "./contracts-hardening-utils.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const reportsDir = path.join(workspaceRoot, "reports");
const visibilityDir = path.join(workspaceRoot, "tests/fixtures/phase3/visibility");

const SOURCE_REPORTS = [
  { slice: 6, file: "admission-offline-slice6.json", key: "admission" },
  { slice: 7, file: "trade-card-offline-slice7.json", key: "tradeCard" },
  { slice: 8, file: "paper-execution-offline-slice8.json", key: "paperExecution" },
  { slice: 9, file: "trade-history-offline-slice9.json", key: "tradeHistory" }
];

function readJsonWithDigest(absPath) {
  const raw = fs.readFileSync(absPath, "utf8");
  return {
    doc: JSON.parse(raw),
    digest: `sha256:${hashHex(raw)}`
  };
}

function loadSources() {
  return SOURCE_REPORTS.map((src) => {
    const absPath = path.join(reportsDir, src.file);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Missing source report: reports/${src.file}`);
    }
    const stat = fs.statSync(absPath);
    const { doc, digest } = readJsonWithDigest(absPath);
    return {
      ...src,
      absPath,
      relativePath: `reports/${src.file}`,
      digest,
      mtimeIso: new Date(stat.mtimeMs).toISOString(),
      report: doc
    };
  });
}

function deriveStatus(allPass) {
  return allPass ? "ALIGNED_OFFLINE" : "MISALIGNED_OFFLINE";
}

function buildSummary(sourceRecords) {
  const generatedAt = new Date().toISOString();
  const coveredSlices = sourceRecords.map((s) => s.slice);
  const failedSlices = sourceRecords.filter((s) => s.report?.pass !== true).map((s) => s.slice);
  const pass = failedSlices.length === 0;
  const runtimeAlignmentStatus = deriveStatus(pass);

  const alignmentSeed = JSON.stringify({
    coveredSlices,
    reports: sourceRecords.map((s) => ({
      slice: s.slice,
      file: s.relativePath,
      digest: s.digest
    }))
  });
  const runtimeAlignmentId = `RA-S10-${hashHex(alignmentSeed).slice(0, 16).toUpperCase()}`;

  const sourceReportDigests = Object.fromEntries(sourceRecords.map((s) => [s.key, s.digest]));
  const sourceReportMeta = Object.fromEntries(
    sourceRecords.map((s) => [
      s.key,
      {
        slice: s.slice,
        path: s.relativePath,
        generatedAt: s.report?.generatedAt ?? null,
        pass: s.report?.pass === true,
        mtimeIso: s.mtimeIso
      }
    ])
  );

  const generatedAtMs = parseIsoMs(generatedAt);
  const sourceAgesMs = sourceRecords.map((s) => {
    const sourceGeneratedAtMs = parseIsoMs(s.report?.generatedAt);
    return Number.isFinite(sourceGeneratedAtMs) ? Math.max(0, generatedAtMs - sourceGeneratedAtMs) : NaN;
  });
  const maxSourceAgeMs = sourceAgesMs.reduce((acc, age) => (Number.isFinite(age) ? Math.max(acc, age) : acc), 0);
  const freshnessMode = maxSourceAgeMs <= MAX_SOURCE_REPORT_AGE_MS ? "TTL_OK" : "TTL_EXCEEDED";
  if (!RUNTIME_ALIGNMENT_STATUS_ENUM.has(runtimeAlignmentStatus)) {
    throw new Error(`Unexpected runtimeAlignmentStatus generated: ${runtimeAlignmentStatus}`);
  }
  if (!FRESHNESS_MODE_ENUM.has(freshnessMode)) {
    throw new Error(`Unexpected freshness mode generated: ${freshnessMode}`);
  }

  return {
    schema: "genesis.visibility-runtime-alignment-slice10.v1",
    generatedAt,
    slice: 10,
    pass,
    runtimeAlignmentId,
    runtimeAlignmentStatus,
    ownerVisibleRuntimeSummary: {
      status: runtimeAlignmentStatus,
      coveredSlices,
      allSourceReportsPass: pass,
      failedSlices
    },
    timestamps: {
      summaryGeneratedAt: generatedAt,
      sourceReports: Object.fromEntries(
        sourceRecords.map((s) => [
          s.key,
          {
            reportGeneratedAt: s.report?.generatedAt ?? null,
            reportMtimeIso: s.mtimeIso
          }
        ])
      )
    },
    freshness: {
      mode: freshnessMode,
      ttlMs: MAX_SOURCE_REPORT_AGE_MS,
      maxSourceAgeMs
    },
    sourceReportDigests,
    sourceReportMeta,
    constraints: {
      notaryGreenClaimed: false,
      executionAllowed: false,
      liveIngestion: false
    },
    risks: pass
      ? ["No live execution unlock; summary remains owner-visible and offline."]
      : ["One or more source slice reports failed; runtime summary flagged MISALIGNED_OFFLINE."]
  };
}

function writeOutputs(summary) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.mkdirSync(visibilityDir, { recursive: true });

  const reportPath = path.join(reportsDir, "visibility-runtime-alignment-slice10.json");
  const fixturePath = path.join(visibilityDir, "owner-visible-runtime-summary-slice10.json");
  const manifestPath = path.join(visibilityDir, "slice10-manifest.json");

  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(fixturePath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schema: "genesis.phase3.slice10-visibility-runtime-manifest.v1",
        slice: 10,
        mode: "OFFLINE_ONLY",
        files: ["owner-visible-runtime-summary-slice10.json"],
        reportFile: "reports/visibility-runtime-alignment-slice10.json",
        coveredSlices: [6, 7, 8, 9],
        notaryGreenClaimed: false,
        executionAllowed: false,
        liveIngestion: false
      },
      null,
      2
    )
  );

  return { reportPath, fixturePath, manifestPath };
}

function main() {
  const sourceRecords = loadSources();
  const summary = buildSummary(sourceRecords);
  const out = writeOutputs(summary);

  console.log(
    JSON.stringify(
      {
        ok: true,
        pass: summary.pass,
        runtimeAlignmentId: summary.runtimeAlignmentId,
        runtimeAlignmentStatus: summary.runtimeAlignmentStatus,
        coveredSlices: summary.ownerVisibleRuntimeSummary.coveredSlices,
        out
      },
      null,
      2
    )
  );
}

main();
