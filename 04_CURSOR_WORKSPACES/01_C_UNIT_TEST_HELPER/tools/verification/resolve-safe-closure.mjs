#!/usr/bin/env node
/**
 * resolve-safe-closure.mjs — Import closure from readonly-api entry (read-only on source target)
 * Sprint 2 O-02 v2. Does not modify source.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSourceTargetExists, loadSafeArtifactManifest } from "./genesis-paths.mjs";
import { extractImportSpecs, resolveRelativeImport } from "./import-resolve.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = loadSafeArtifactManifest(
  path.join(__dirname, "genesis-safe-artifact.manifest.json")
);
const sourceRoot = assertSourceTargetExists(manifest.source_target);
const entryRel = manifest.entrypoint.safe.replace(/\\/g, "/");

const forbiddenPathFragments = [
  "apps/runtime-api",
  "application/exchange",
  "application/market",
  "engine/execution",
  "trading-runtime"
];

function isForbidden(rel) {
  const n = rel.replace(/\\/g, "/");
  return forbiddenPathFragments.some((f) => n.includes(f));
}

function resolveImport(fromFile, spec) {
  const r = resolveRelativeImport(fromFile, spec);
  return r.kind === "resolved" ? r.abs : null;
}

function collectClosure(entryAbs) {
  const queue = [entryAbs];
  const seen = new Set();
  const files = [];

  while (queue.length) {
    const abs = queue.shift();
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (!fs.existsSync(abs)) continue;

    const rel = path.relative(sourceRoot, abs).replace(/\\/g, "/");
    if (isForbidden(rel)) continue;

    files.push(rel);

    const ext = path.extname(abs);
    if (!/\.(ts|tsx|js|mjs)$/i.test(ext)) continue;

    const content = fs.readFileSync(abs, "utf8");
    for (const spec of extractImportSpecs(content)) {
      const resolved = resolveImport(abs, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }

  return files.sort();
}

const entryAbs = path.join(sourceRoot, entryRel);
if (!fs.existsSync(entryAbs)) {
  console.error(JSON.stringify({ ok: false, error: `Entry not found: ${entryRel}` }));
  process.exit(1);
}

const closure = collectClosure(entryAbs);
const outPath = path.join(__dirname, "safe-closure-files.json");
const meta = {
  schema: "genesis.safe-closure.v1",
  entry: entryRel,
  generatedAt: new Date().toISOString(),
  fileCount: closure.length,
  files: closure
};
fs.writeFileSync(outPath, JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ ok: true, fileCount: closure.length, output: "tools/verification/safe-closure-files.json" }, null, 2));
