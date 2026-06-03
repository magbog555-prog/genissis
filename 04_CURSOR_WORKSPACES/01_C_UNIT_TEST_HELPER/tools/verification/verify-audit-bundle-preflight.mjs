#!/usr/bin/env node
/**
 * verify-audit-bundle-preflight.mjs — fail closed before external audit zip.
 * Audit #5: closure sourceDigest must match bundled operator scan SHA256.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const genesisRoot = getGenesisRoot();

function sha256File(abs) {
  const raw = fs.readFileSync(abs);
  return `sha256:${createHash("sha256").update(raw).digest("hex")}`;
}

function readJson(abs) {
  const text = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function fail(violations, id, message, extra = {}) {
  violations.push({ ruleId: id, severity: "RED", message, ...extra });
}

const violations = [];

const scanPath = path.join(
  genesisRoot,
  "04_CURSOR_WORKSPACES/02_CODE_CLOAKER_NOTARY/reports/frontend-scan-genesis-operator-shell.json"
);
const closurePath = path.join(workspaceRoot, "reports/operator-shell-ui-scan-closure.verify.json");

if (!fs.existsSync(scanPath)) {
  fail(violations, "RC-PREFLIGHT-SCAN-MISSING", "operator shell scan report missing", { scanPath });
} else {
  const scanDigest = sha256File(scanPath);
  const scan = readJson(scanPath);
  if (scan.filesScanned === 0 || scan.zeroFilesScanned) {
    fail(violations, "RC-PREFLIGHT-SCAN-ZERO", "operator scan must not be zero-file pass", {
      filesScanned: scan.filesScanned
    });
  }
  if (scan.redCount > 0) {
    fail(violations, "RC-PREFLIGHT-SCAN-RED", "operator scan redCount must be 0", { redCount: scan.redCount });
  }

  if (!fs.existsSync(closurePath)) {
    fail(violations, "RC-PREFLIGHT-CLOSURE-MISSING", "closure verify report missing");
  } else {
    const closure = readJson(closurePath);
    if (!closure.pass || closure.closureStatus !== "COMPLETE") {
      fail(violations, "RC-PREFLIGHT-CLOSURE-INCOMPLETE", "closure must pass COMPLETE", {
        pass: closure.pass,
        closureStatus: closure.closureStatus
      });
    }
    if (closure.sourceDigest !== scanDigest) {
      fail(violations, "RC-PREFLIGHT-DIGEST-MISMATCH", "closure sourceDigest must match scan file SHA256", {
        expected: scanDigest,
        actual: closure.sourceDigest,
        auditRef: "audit5-section-3"
      });
    }
  }
}

const rerunPath = path.join(workspaceRoot, "reports/audit3-rerun-20260603.json");
if (fs.existsSync(rerunPath)) {
  const rerun = readJson(rerunPath);
  if (rerun.summary?.pass !== 7 || rerun.summary?.total !== 7) {
    fail(violations, "RC-PREFLIGHT-RERUN", "audit3-rerun must be 7/7", { summary: rerun.summary });
  }
}

const pass = violations.filter((v) => v.severity === "RED").length === 0;
const out = {
  schema: "genesis.audit-bundle-preflight.v1",
  generatedAt: new Date().toISOString(),
  pass,
  scanDigest: fs.existsSync(scanPath) ? sha256File(scanPath) : null,
  closureDigest: fs.existsSync(closurePath) ? readJson(closurePath).sourceDigest : null,
  digestMatch: pass || violations.every((v) => v.ruleId !== "RC-PREFLIGHT-DIGEST-MISMATCH"),
  violations
};

const outPath = path.join(workspaceRoot, "reports/audit-bundle-preflight.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: pass, outPath, violationCount: violations.length }, null, 2));
process.exit(pass ? 0 : 1);
