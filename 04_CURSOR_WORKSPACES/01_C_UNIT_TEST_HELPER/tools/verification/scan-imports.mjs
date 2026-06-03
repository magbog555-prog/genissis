#!/usr/bin/env node
/**
 * Genesis Foundation — Import Scanner (Stage 5)
 * Read-only import boundary scan. Does not modify source target.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPath } from "./scope-match.mjs";
import {
  assertSourceTargetExists,
  loadFoundationScopeConfig,
  sourceTargetForReport
} from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "foundation-scope.config.json");

const IMPORT_FROM_RE =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?['"]([^'"]+)['"]/g;
const IMPORT_SIDE_RE = /\bimport\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const TS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function loadConfig() {
  return loadFoundationScopeConfig(CONFIG_PATH);
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else if (/\.(ts|js|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

function normalize(p) {
  return p.replace(/\\/g, "/");
}

function matchesForbidden(specifier, config) {
  const s = specifier.replace(/\\/g, "/").toLowerCase();
  for (const token of config.forbidden_imports_in_safe ?? []) {
    const t = token.toLowerCase();
    if (s.includes(t)) return { matched: true, token: t };
  }
  return { matched: false, token: null };
}

function classifyResolvedPath(resolvedRel, config) {
  if (!resolvedRel) return "UNKNOWN";
  const scopes = [
    classifyPath(resolvedRel, config),
    classifyPath(resolvedRel.replace(/\.(js|mjs|cjs)$/, ".ts"), config),
  ];
  for (const s of ["SAFE", "UNSAFE", "DONOR"]) {
    if (scopes.includes(s)) return s;
  }
  return scopes[0];
}

function resolveRelative(specifier, fromFile, sourceRoot) {
  if (!specifier.startsWith(".")) return null;
  const fromDir = path.dirname(fromFile);
  let base = path.resolve(fromDir, specifier);
  const tryPaths = [];
  if (path.extname(base)) tryPaths.push(base);
  else {
    for (const ext of TS_EXTS) {
      tryPaths.push(base + ext);
      tryPaths.push(path.join(base, "index" + ext));
    }
  }
  for (const candidate of tryPaths) {
    if (fs.existsSync(candidate)) return normalize(path.relative(sourceRoot, candidate));
  }
  return normalize(path.relative(sourceRoot, base));
}

function extractImports(source) {
  const specs = new Set();
  let m;
  IMPORT_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_FROM_RE.exec(source)) !== null) specs.add(m[1]);
  IMPORT_SIDE_RE.lastIndex = 0;
  while ((m = IMPORT_SIDE_RE.exec(source)) !== null) specs.add(m[1]);
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(source)) !== null) specs.add(m[1]);
  return [...specs];
}

function buildFileIndex(files, sourceRoot) {
  const index = new Map();
  for (const full of files) {
    const rel = normalize(path.relative(sourceRoot, full));
    index.set(rel, { full, rel, source: fs.readFileSync(full, "utf8") });
  }
  return index;
}

function evaluateEdge(importerScope, targetScope, forbidden, transitive = false) {
  const prefix = transitive ? "TRANSITIVE_" : "";

  if (importerScope === "SAFE") {
    if (forbidden.matched || targetScope === "UNSAFE") {
      return {
        scanStatus: "RED",
        violation: true,
        rule: `${prefix}SAFE_NO_UNSAFE_IMPORT`,
      };
    }
    if (targetScope === "DONOR") {
      return {
        scanStatus: "YELLOW",
        violation: true,
        rule: `${prefix}SAFE_IMPORTS_DONOR_COUPLING`,
      };
    }
    if (targetScope === "UNKNOWN") {
      return {
        scanStatus: "YELLOW",
        violation: true,
        rule: `${prefix}SAFE_IMPORTS_UNKNOWN`,
      };
    }
    if (targetScope === "EXTERNAL") {
      return { scanStatus: "GREEN", violation: false, rule: null };
    }
    return { scanStatus: "GREEN", violation: false, rule: null };
  }

  if (forbidden.matched || targetScope === "UNSAFE") {
    if (importerScope === "UNSAFE") {
      return { scanStatus: "FINDING", violation: true, rule: "UNSAFE_FORBIDDEN_IMPORT" };
    }
    if (importerScope === "DONOR") {
      return { scanStatus: "DONOR_FINDING", violation: true, rule: "DONOR_FORBIDDEN_IMPORT" };
    }
    return { scanStatus: "YELLOW", violation: true, rule: "UNKNOWN_FORBIDDEN_IMPORT" };
  }

  return { scanStatus: "OK", violation: false, rule: null };
}

function scanFileImports(fileEntry, fileIndex, sourceRoot, config) {
  const importerScope = classifyPath(fileEntry.rel, config);
  const edges = [];

  for (const specifier of extractImports(fileEntry.source)) {
    if (specifier.startsWith("node:")) continue;

    const forbidden = matchesForbidden(specifier, config);
    let targetScope = "UNKNOWN";
    let resolvedTarget = null;

    if (specifier.startsWith(".")) {
      resolvedTarget = resolveRelative(specifier, fileEntry.full, sourceRoot);
      if (resolvedTarget) targetScope = classifyResolvedPath(resolvedTarget, config);
      else targetScope = "UNKNOWN";
    } else {
      resolvedTarget = specifier;
      targetScope = forbidden.matched ? "UNSAFE" : "EXTERNAL";
    }

    const v = evaluateEdge(importerScope, targetScope, forbidden, false);
    edges.push({
      importerFile: fileEntry.rel,
      importerScope,
      specifier,
      resolvedTarget,
      targetScope,
      forbiddenToken: forbidden.token,
      scanStatus: v.scanStatus,
      violation: v.violation,
      rule: v.rule,
      transitive: false,
    });

    if (importerScope === "SAFE" && resolvedTarget && targetScope === "DONOR") {
      const targetEntry = fileIndex.get(resolvedTarget);
      if (targetEntry) {
        for (const inner of extractImports(targetEntry.source)) {
          const innerForbidden = matchesForbidden(inner, config);
          let innerScope = "UNKNOWN";
          let innerResolved = null;
          if (inner.startsWith(".")) {
            innerResolved = resolveRelative(inner, targetEntry.full, sourceRoot);
            if (innerResolved) innerScope = classifyResolvedPath(innerResolved, config);
            else innerScope = "UNKNOWN";
          } else {
            innerResolved = inner;
            innerScope = innerForbidden.matched ? "UNSAFE" : "EXTERNAL";
          }
          const tv = evaluateEdge("SAFE", innerScope, innerForbidden, true);
          if (tv.violation && tv.scanStatus === "RED") {
            edges.push({
              importerFile: fileEntry.rel,
              importerScope: "SAFE",
              specifier: `${specifier} → ${inner}`,
              resolvedTarget: innerResolved,
              targetScope: innerScope,
              forbiddenToken: innerForbidden.token,
              scanStatus: tv.scanStatus,
              violation: tv.violation,
              rule: tv.rule,
              transitive: true,
              viaFile: resolvedTarget,
            });
          }
        }
      }
    }
  }

  return edges;
}

function main() {
  const config = loadConfig();
  const sourceRoot = assertSourceTargetExists(config.source_target);
  const scanRoot = path.join(sourceRoot, "core");
  const files = walkFiles(scanRoot);
  const fileIndex = buildFileIndex(files, sourceRoot);

  const edges = [];
  for (const entry of fileIndex.values()) {
    edges.push(...scanFileImports(entry, fileIndex, sourceRoot, config));
  }

  const redInSafe = edges.filter((e) => e.importerScope === "SAFE" && e.scanStatus === "RED");
  const yellowInSafe = edges.filter(
    (e) => e.importerScope === "SAFE" && e.scanStatus === "YELLOW"
  );
  const safeForbidden = edges.filter(
    (e) => e.importerScope === "SAFE" && (e.forbiddenToken || e.targetScope === "UNSAFE")
  );

  const byStatus = {};
  for (const e of edges) {
    byStatus[e.scanStatus] = (byStatus[e.scanStatus] ?? 0) + 1;
  }

  const report = {
    schema: "genesis.foundation.import-boundary.v1",
    generatedAt: new Date().toISOString(),
    scanner: "tools/verification/scan-imports.mjs",
    configVersion: config.version,
    sourceTarget: sourceTargetForReport(sourceRoot),
    limitations: [
      "Static import scan; dynamic import() and require(variable) not detected.",
      "Transitive depth limited to 1 hop from SAFE into DONOR modules only.",
      "npm package internals are not expanded.",
      "Route and env scanners are out of scope for this stage.",
    ],
    summary: {
      filesScanned: fileIndex.size,
      totalEdges: edges.length,
      byStatus,
      redInSafeCount: redInSafe.length,
      yellowInSafeCount: yellowInSafe.length,
      foundationCheckFailed: redInSafe.length > 0,
    },
    redInSafe,
    yellowInSafeCoupling: yellowInSafe,
    safeDirectUnsafeOrForbidden: safeForbidden,
    edges,
  };

  const reportsDir = path.join(__dirname, "../../reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, "import-boundary-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(
    JSON.stringify(
      { ok: redInSafe.length === 0, outPath, summary: report.summary },
      null,
      2
    )
  );
  process.exit(redInSafe.length > 0 ? 1 : 0);
}

main();
