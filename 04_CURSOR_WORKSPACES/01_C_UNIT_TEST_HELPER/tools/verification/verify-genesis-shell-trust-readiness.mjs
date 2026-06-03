#!/usr/bin/env node
/**
 * verify-genesis-shell-trust-readiness.mjs
 * Validate owner/operator trust read-model for Genesis shell readiness (EM-012 closure support).
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "./genesis-paths.mjs";
import { addViolation, checkNoFakePassFallback } from "./contracts-hardening-utils.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const genesisRoot = getGenesisRoot();
const reportsDir = path.join(workspaceRoot, "reports");
const ownerViewsPath = path.join(reportsDir, "owner-operating-views-slice11.json");
const verifyOutPath = path.join(reportsDir, "genesis-shell-trust-readiness.verify.json");
const boardPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS", "genesis-system-status-board.json");

function main() {
  const violations = [];
  if (!fs.existsSync(ownerViewsPath)) {
    addViolation(
      violations,
      "RC-SHELL-OWNER-MISSING",
      "RED",
      "owner-operating-views-slice11 report missing; run verify:owner-operating-views-slice11"
    );
  }
  if (!fs.existsSync(boardPath)) {
    addViolation(violations, "RC-SHELL-BOARD-MISSING", "RED", "genesis-system-status-board.json is missing");
  }

  const ownerViews = fs.existsSync(ownerViewsPath) ? JSON.parse(fs.readFileSync(ownerViewsPath, "utf8")) : {};
  const board = fs.existsSync(boardPath) ? JSON.parse(fs.readFileSync(boardPath, "utf8")) : {};
  const shellSummary = ownerViews?.ownerOperatingViews?.genesisShellReadiness ?? {};
  const boardOperatorTier = String(board?.program?.operatorArtifact ?? "");
  const boardNotaryStatus = String(
    board?.program?.trust ?? board?.layers?.find((layer) => layer.layer === "notary")?.status ?? ""
  ).toUpperCase();

  if (ownerViews.pass !== true) {
    addViolation(violations, "RC-SHELL-OWNER-PASS", "RED", "owner-operating-views-slice11 pass must be true");
  }
  if (shellSummary.summarySchema !== "genesis.owner-operator-trust-readmodel.v1") {
    addViolation(violations, "RC-SHELL-SCHEMA", "RED", "shell trust summary schema mismatch", {
      actual: shellSummary.summarySchema
    });
  }
  if (shellSummary.em012ClosureSupport !== true) {
    addViolation(violations, "RC-SHELL-EM012", "RED", "em012ClosureSupport must be true");
  }
  if (shellSummary.pairSignalDeclared !== "operatorTier + notaryStatus") {
    addViolation(
      violations,
      "RC-SHELL-PAIR-DECLARED",
      "RED",
      "pairSignalDeclared must be `operatorTier + notaryStatus`",
      { actual: shellSummary.pairSignalDeclared }
    );
  }
  const expectedPairSignal = `${shellSummary.operatorTier ?? ""} + ${shellSummary.notaryStatus ?? ""}`;
  if (shellSummary.pairSignal !== expectedPairSignal) {
    addViolation(violations, "RC-SHELL-PAIR-VALUE", "RED", "pairSignal must equal operatorTier + notaryStatus", {
      expected: expectedPairSignal,
      actual: shellSummary.pairSignal
    });
  }
  if (shellSummary.notaryGreenNo !== true) {
    addViolation(violations, "RC-SHELL-NOTARY-GREEN-NO", "RED", "notaryGreenNo must be true pre-closure");
  }
  if (shellSummary.note !== "NOTARY GREEN NO") {
    addViolation(violations, "RC-SHELL-NOTE", "RED", "note must be NOTARY GREEN NO", { actual: shellSummary.note });
  }
  if (ownerViews.constraints?.executionAllowed !== false) {
    addViolation(violations, "RC-SHELL-EXECUTION", "RED", "executionAllowed must remain false");
  }
  if (boardOperatorTier && shellSummary.operatorTier !== boardOperatorTier) {
    addViolation(violations, "RC-SHELL-OPERATOR-SYNC", "RED", "operatorTier mismatch with status board", {
      boardOperatorTier,
      summaryOperatorTier: shellSummary.operatorTier
    });
  }
  if (boardNotaryStatus && shellSummary.notaryStatus !== boardNotaryStatus) {
    addViolation(violations, "RC-SHELL-NOTARY-SYNC", "RED", "notaryStatus mismatch with status board", {
      boardNotaryStatus,
      summaryNotaryStatus: shellSummary.notaryStatus
    });
  }
  if (String(shellSummary.notaryStatus ?? "").toUpperCase() === "GREEN") {
    addViolation(violations, "RC-SHELL-NOTARY-GREEN", "RED", "notaryStatus GREEN is forbidden before closure");
  }

  checkNoFakePassFallback({
    violations,
    report: ownerViews,
    contextRulePrefix: "RC-SHELL",
    context: { viewId: ownerViews?.viewId ?? null }
  });

  const redCount = violations.filter((item) => item.severity === "RED").length;
  const pass = redCount === 0;
  const result = {
    schema: "genesis.shell-trust-readiness.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    readinessStatus: pass ? "READY" : "BLOCKED",
    ownerViewId: ownerViews?.viewId ?? null,
    pairSignal: shellSummary?.pairSignal ?? null,
    notaryGreenNo: shellSummary?.notaryGreenNo ?? null,
    violations
  };

  fs.writeFileSync(verifyOutPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: pass, outPath: verifyOutPath, redCount, readinessStatus: result.readinessStatus }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
