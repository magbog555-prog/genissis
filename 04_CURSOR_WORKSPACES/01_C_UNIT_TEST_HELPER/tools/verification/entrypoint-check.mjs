#!/usr/bin/env node
/**
 * entrypoint-check.mjs — O-05 gate: documents MBG dual entry; fails if policy missing.
 * Does not modify MBG package.json (requires Owner GO for rename).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSourceTargetExists,
  getFoundationWorkspaceRoot,
  loadSafeArtifactManifest
} from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const manifest = loadSafeArtifactManifest(
  path.join(__dirname, "genesis-safe-artifact.manifest.json")
);
const corePkgPath = path.join(assertSourceTargetExists(manifest.source_target), "core", "package.json");
const policyPath = path.join(
  workspaceRoot,
  "docs/reports/ENTRYPOINT_POLICY_V1.md"
);

const findings = [];

if (!fs.existsSync(policyPath)) {
  findings.push({ severity: "RED", code: "POLICY_MISSING", message: "ENTRYPOINT_POLICY_V1.md missing" });
}

if (!fs.existsSync(corePkgPath)) {
  findings.push({ severity: "RED", code: "MBG_PKG_MISSING", message: corePkgPath });
} else {
  const pkg = JSON.parse(fs.readFileSync(corePkgPath, "utf8"));
  const dev = pkg.scripts?.dev ?? "";
  const labUnsafe = pkg.scripts?.["dev:runtime-lab-unsafe"] ?? "";
  const readonly = pkg.scripts?.["dev:readonly-api"] ?? "";

  if (dev) {
    findings.push({
      severity: "RED",
      code: "AMBIGUOUS_DEV_SCRIPT",
      message: 'Bare "dev" script must not exist after D-03 rename — use dev:runtime-lab-unsafe or dev:readonly-api',
      actual: dev
    });
  }
  if (!labUnsafe.includes("runtime-api")) {
    findings.push({
      severity: "RED",
      code: "LAB_UNSAFE_SCRIPT_MISSING",
      message: "dev:runtime-lab-unsafe must point to runtime-api (D-03)"
    });
  }
  if (!readonly.includes("readonly-api")) {
    findings.push({
      severity: "RED",
      code: "READONLY_SCRIPT_MISSING",
      message: "dev:readonly-api script missing or wrong in MBG core package.json"
    });
  }
}

const wrapperSafe = path.join(workspaceRoot, "scripts/dev-readonly-safe.ps1");
const wrapperLab = path.join(workspaceRoot, "scripts/dev-runtime-lab-unsafe.ps1");
if (!fs.existsSync(wrapperSafe)) findings.push({ severity: "RED", code: "WRAPPER_SAFE_MISSING" });
if (!fs.existsSync(wrapperLab)) findings.push({ severity: "RED", code: "WRAPPER_LAB_MISSING" });

const red = findings.filter((f) => f.severity === "RED");
const result = {
  schema: "genesis.entrypoint-check.v1",
  checkedAt: new Date().toISOString(),
  findings,
  pass: red.length === 0
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
