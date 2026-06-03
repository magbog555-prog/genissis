#!/usr/bin/env node
/**
 * scan-safe-bundle.mjs — Scan staged safe artifact for forbidden patterns
 * Sprint 2 O-03. Writes reports/safe-bundle-scan.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getFoundationWorkspaceRoot, loadSafeArtifactManifest } from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const manifest = loadSafeArtifactManifest(
  path.join(__dirname, "genesis-safe-artifact.manifest.json")
);
const bundleRootArgIdx = process.argv.indexOf("--bundle-root");
const bundleRoot =
  bundleRootArgIdx >= 0
    ? path.resolve(workspaceRoot, process.argv[bundleRootArgIdx + 1])
    : path.join(workspaceRoot, manifest.output_dir);
const skipReportWrite = process.argv.includes("--no-write-report");
const reportsDir = path.join(workspaceRoot, "reports");
const tier = process.argv.includes("--strict") ? "STRICT" : manifest.tier_default;

const violations = [];

function walk(dir, base = bundleRoot) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (fs.statSync(full).isDirectory()) walk(full, base);
    else if (/\.(ts|js|mjs|json|env|md)$/i.test(name)) {
      const content = fs.readFileSync(full, "utf8");
      scanFile(rel, content);
    }
  }
}

function scanFile(rel, content) {
  const isDoc = /\.md$/i.test(rel);
  const isVerifyScript = /verify-readonly-surface|verify-.*\.mjs$/i.test(rel);
  const isConstitutionText = /kernel-constitution|CORE_CONSTITUTION|CORE_API_MAP/i.test(rel);

  const add = (v) => {
    if (isDoc || isVerifyScript) {
      violations.push({ ...v, severity: "WARN", reason: isDoc ? "DOC_REFERENCE" : "VERIFY_FIXTURE" });
    } else if (isConstitutionText && v.type !== "FORBIDDEN_PATH") {
      violations.push({ ...v, severity: "WARN", reason: "NORMATIVE_TEXT" });
    } else {
      violations.push({ ...v, severity: "RED" });
    }
  };

  for (const sub of manifest.forbidden_import_substrings) {
    if (!content.includes(sub)) continue;
    const moduleImportRe = new RegExp(
      `(?:from\\s+['"][^'"]*${sub}[^'"]*['"]|import\\s*\\(\\s*['"][^'"]*${sub}|require\\s*\\(\\s*['"][^'"]*${sub})`,
      "i"
    );
    const dtoLiteralRe = /providerFormat|binance-like|"binance"/i;
    if (sub === "binance" && dtoLiteralRe.test(content) && !moduleImportRe.test(content)) {
      violations.push({
        type: "FORBIDDEN_IMPORT",
        file: rel,
        match: sub,
        severity: "WARN",
        reason: "DTO_STRING_LITERAL"
      });
      continue;
    }
    if (moduleImportRe.test(content)) {
      add({ type: "FORBIDDEN_IMPORT", file: rel, match: sub });
    } else if (/\.(ts|js|mjs)$/i.test(rel)) {
      violations.push({
        type: "FORBIDDEN_IMPORT",
        file: rel,
        match: sub,
        severity: "WARN",
        reason: "SUBSTRING_NON_IMPORT"
      });
    }
  }
  for (const sub of manifest.forbidden_route_substrings) {
    if (content.includes(sub)) add({ type: "FORBIDDEN_ROUTE", file: rel, match: sub });
  }
  for (const env of manifest.forbidden_env_names) {
    if (content.includes(env)) add({ type: "FORBIDDEN_ENV", file: rel, match: env });
  }
  if (rel.includes("apps/runtime-api")) {
    add({ type: "FORBIDDEN_PATH", file: rel, match: "runtime-api" });
  }
}

if (!fs.existsSync(bundleRoot)) {
  console.error(JSON.stringify({ ok: false, error: "Bundle not found. Run build-safe-artifact.mjs first." }));
  process.exit(1);
}

walk(bundleRoot);

const redViolations = violations.filter((v) => v.severity === "RED");
const warnViolations = violations.filter((v) => v.severity === "WARN");

const result = {
  schema: "genesis.safe-bundle-scan.v1",
  artifact: manifest.artifact_name,
  tier,
  scannedAt: new Date().toISOString(),
  bundleRoot: manifest.output_dir,
  violationCount: violations.length,
  redCount: redViolations.length,
  warnCount: warnViolations.length,
  violations,
  pass: redViolations.length === 0
};

if (!skipReportWrite) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, "safe-bundle-scan.json"), JSON.stringify(result, null, 2));
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
