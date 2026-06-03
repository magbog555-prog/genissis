#!/usr/bin/env node
/**
 * verify-screen-proof-discipline.mjs
 * Enforce owner-visible governance discipline for screen <-> proof mapping.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const screenMapPath = path.join(
  workspaceRoot,
  "tests/fixtures/phase3/visibility/owner-decision-screen-map.json"
);
const outPath = path.join(workspaceRoot, "reports/screen-proof-discipline.verify.json");
const ACTIVE_STATUSES = new Set(["WORKING", "PASS"]);

function normalizeStatus(value) {
  return String(value ?? "").trim().toUpperCase();
}

function main() {
  if (!fs.existsSync(screenMapPath)) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "missing screen map",
          screenMapPath
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const doc = JSON.parse(fs.readFileSync(screenMapPath, "utf8"));
  const screens = Array.isArray(doc.screens) ? doc.screens : [];
  const violations = [];

  if (doc.schema !== "genesis.owner-decision-screen-map.v1") {
    violations.push({
      ruleId: "RC-SPD-SCHEMA",
      severity: "RED",
      message: "screen map schema mismatch",
      context: { actual: doc.schema ?? null }
    });
  }

  screens.forEach((screen, idx) => {
    const status = normalizeStatus(screen.status);
    const proofValue = screen.proofArtifactRef;
    const proofText = typeof proofValue === "string" ? proofValue.trim() : "";
    const hasProofField = typeof proofValue === "string" && proofText.length > 0;
    const isNotProven = proofText === "NOT_PROVEN";
    const isActive = ACTIVE_STATUSES.has(status);
    const context = {
      index: idx,
      screenId: screen.screenId ?? null,
      status
    };

    if (!hasProofField) {
      violations.push({
        ruleId: "RC-SPD-PROOF-FIELD",
        severity: "RED",
        message: "screen must declare proofArtifactRef or NOT_PROVEN",
        context
      });
      return;
    }

    if (isActive && isNotProven) {
      violations.push({
        ruleId: "RC-SPD-ACTIVE-WITHOUT-PROOF",
        severity: "RED",
        message: "WORKING/PASS screen cannot use NOT_PROVEN",
        context: { ...context, proofArtifactRef: proofText }
      });
    }
  });

  const provenCount = screens.filter((screen) => {
    const proof = String(screen.proofArtifactRef ?? "").trim();
    return proof.length > 0 && proof !== "NOT_PROVEN";
  }).length;
  const unprovenCount = screens.length - provenCount;
  const pass = violations.length === 0;

  const report = {
    schema: "genesis.screen-proof-discipline.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    scope: doc.scope ?? "owner-visible-l2",
    screenMapRef: "tests/fixtures/phase3/visibility/owner-decision-screen-map.json",
    totals: {
      screens: screens.length,
      proven: provenCount,
      unproven: unprovenCount
    },
    violations
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: pass,
        outPath,
        totals: report.totals,
        violations: violations.length
      },
      null,
      2
    )
  );
  process.exit(pass ? 0 : 1);
}

main();
