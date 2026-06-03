#!/usr/bin/env node
/**
 * verify-artifact-import-completeness.mjs — P0.2 (AA-2)
 * All relative imports in dist/genesis-safe-readonly must resolve.
 * STRICT: forbid imports targeting core/core/runtime/** or core/core/live-stream/**
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractImportSpecs, resolveRelativeImport } from "./import-resolve.mjs";
import { getFoundationWorkspaceRoot, loadSafeArtifactManifest } from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const manifest = loadSafeArtifactManifest(
  path.join(__dirname, "genesis-safe-artifact.manifest.json")
);
const bundleRoot = path.join(workspaceRoot, manifest.output_dir);
const strict =
  process.argv.includes("--strict") ||
  process.env.GENESIS_SAFE_TIER === "STRICT";

const STRICT_FORBIDDEN_PREFIXES = (manifest.tier_strict_extra_exclude || []).map((p) =>
  p.replace(/\/\*\*$/, "/").replace(/\\/g, "/")
);

function relInBundle(absPath) {
  return path.relative(bundleRoot, absPath).replace(/\\/g, "/");
}

function walkBundleFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "BUILD_MANIFEST.json") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkBundleFiles(full, out);
    else if (/\.(ts|tsx|js|mjs)$/i.test(name)) out.push(full);
  }
  return out;
}

function isStrictForbidden(relPosix) {
  return STRICT_FORBIDDEN_PREFIXES.some((prefix) => relPosix.includes(prefix));
}

function isStrictBoundaryImportSpec(spec) {
  const norm = spec.replace(/\\/g, "/");
  return STRICT_FORBIDDEN_PREFIXES.some((prefix) => {
    const needle = prefix.replace(/\/$/, "");
    return norm.includes(needle) || norm.includes("live-stream") || norm.includes("/runtime/");
  });
}

if (!fs.existsSync(bundleRoot)) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "Bundle not found. Run build-safe-artifact.mjs first.",
      bundleRoot: manifest.output_dir
    })
  );
  process.exit(1);
}

const buildMetaPath = path.join(bundleRoot, "BUILD_MANIFEST.json");
let tier = strict ? "STRICT" : "OPERATOR";
if (fs.existsSync(buildMetaPath)) {
  try {
    const meta = JSON.parse(fs.readFileSync(buildMetaPath, "utf8"));
    if (meta.tier) tier = meta.tier;
  } catch {
    /* ignore */
  }
}
const strictMode = tier === "STRICT" || strict;

const files = walkBundleFiles(bundleRoot);
const violations = [];

for (const abs of files) {
  const rel = relInBundle(abs);
  const content = fs.readFileSync(abs, "utf8");
  for (const spec of extractImportSpecs(content)) {
    const resolved = resolveRelativeImport(abs, spec);
    if (resolved.kind === "external") continue;

    if (resolved.kind === "missing") {
      if (strictMode && isStrictBoundaryImportSpec(spec)) {
        continue;
      }
      violations.push({
        type: "MISSING_IMPORT",
        severity: "RED",
        file: rel,
        spec,
        tried: resolved.tried?.map((t) => relInBundle(t))
      });
      continue;
    }

    const targetRel = relInBundle(resolved.abs);
    if (!targetRel.startsWith("..")) {
      if (strictMode && isStrictForbidden(targetRel)) {
        violations.push({
          type: "STRICT_FORBIDDEN_IMPORT",
          severity: "RED",
          file: rel,
          spec,
          target: targetRel,
          message: "STRICT tier must not import runtime/** or live-stream/**"
        });
      }
    }
  }
}

const red = violations.filter((v) => v.severity === "RED");
const result = {
  schema: "genesis.artifact-import-completeness.v1",
  generatedAt: new Date().toISOString(),
  bundleRoot: manifest.output_dir,
  tier,
  strictMode,
  filesScanned: files.length,
  violationCount: violations.length,
  redCount: red.length,
  violations,
  pass: red.length === 0
};

const reportsDir = path.join(workspaceRoot, "reports");
fs.mkdirSync(reportsDir, { recursive: true });
const outPath = path.join(reportsDir, "artifact-import-completeness.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(JSON.stringify({ ok: result.pass, outPath, tier, redCount: red.length }, null, 2));
process.exit(result.pass ? 0 : 1);
