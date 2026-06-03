#!/usr/bin/env node
/**
 * build-safe-artifact.mjs — Stage safe-readonly files into dist/genesis-safe-readonly
 * Sprint 2 O-02. Does NOT modify source target.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertSourceTargetExists,
  getFoundationWorkspaceRoot,
  loadSafeArtifactManifest,
  sourceTargetForReport
} from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "genesis-safe-artifact.manifest.json");
const manifest = loadSafeArtifactManifest(manifestPath);

const workspaceRoot = getFoundationWorkspaceRoot();
const sourceRoot = assertSourceTargetExists(manifest.source_target);
const outRoot = path.join(workspaceRoot, manifest.output_dir);
const tier = process.argv.includes("--strict") ? "STRICT" : manifest.tier_default;

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/\\\\]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(rel, patterns) {
  const norm = rel.replace(/\\/g, "/");
  return patterns.some((p) => globToRegex(p).test(norm));
}

function collectFiles(dir, base = sourceRoot) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (matchesAny(rel + "/**", manifest.exclude_roots)) continue;
      files.push(...collectFiles(full, base));
    } else {
      files.push({ full, rel });
    }
  }
  return files;
}

const includePatterns = [...manifest.include_roots];

// O-02 v2: merge import closure from readonly-api entry
const closurePath = path.join(__dirname, "safe-closure-files.json");
let closureFiles = [];
if (!fs.existsSync(closurePath) || process.argv.includes("--refresh-closure")) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "resolve-safe-closure.mjs")], {
    stdio: "inherit"
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (fs.existsSync(closurePath)) {
  const closureMeta = JSON.parse(fs.readFileSync(closurePath, "utf8"));
  closureFiles = closureMeta.files || [];
}

const allFiles = collectFiles(sourceRoot);
const strictExcludePrefixes = (manifest.tier_strict_extra_exclude || []).map((ex) =>
  ex.replace(/\/\*\*$/, "/")
);

function isStrictExcludedRel(rel) {
  return strictExcludePrefixes.some((prefix) => rel.startsWith(prefix));
}

const staged = allFiles.filter(({ rel }) => {
  if (matchesAny(rel, manifest.exclude_roots)) return false;
  if (tier === "STRICT") {
    if (isStrictExcludedRel(rel)) return false;
    return closureFiles.includes(rel);
  }
  const inClosure = closureFiles.includes(rel);
  const inInclude =
    matchesAny(rel, includePatterns) ||
    includePatterns.some((p) => {
      const exact = p.replace("/**", "");
      return rel === exact;
    });
  return inClosure || inInclude;
});

fs.rmSync(outRoot, { recursive: true, force: true });
for (const { full, rel } of staged) {
  const dest = path.join(outRoot, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(full, dest);
}

const buildMeta = {
  schema: "genesis.safe-artifact.build.v1",
  artifact: manifest.artifact_name,
  version: manifest.version,
  tier,
  generatedAt: new Date().toISOString(),
  genesis_root: process.env.GENESIS_ROOT || undefined,
  source_target: sourceTargetForReport(sourceRoot),
  fileCount: staged.length,
  closureFileCount: closureFiles.length,
  output_dir: manifest.output_dir
};

const metaPath = path.join(outRoot, "BUILD_MANIFEST.json");
fs.writeFileSync(metaPath, JSON.stringify(buildMeta, null, 2));

console.log(JSON.stringify({ ok: true, ...buildMeta }, null, 2));
