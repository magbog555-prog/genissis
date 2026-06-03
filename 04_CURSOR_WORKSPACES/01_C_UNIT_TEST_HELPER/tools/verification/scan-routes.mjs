#!/usr/bin/env node
/**
 * Genesis Foundation — Route Scanner (Stage 4)
 * Read-only scan of source target Express routes.
 * Does not modify source target.
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

const ROUTE_RE =
  /\b(?:app|router)\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]/gi;

const MUTATING = new Set(["post", "put", "patch", "delete", "all"]);

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

function isSuspiciousMutating(method, routePath, config) {
  const m = method.toUpperCase();
  const p = routePath.toLowerCase();
  if (!MUTATING.has(method.toLowerCase())) return false;
  for (const rule of config.forbidden_route_patterns_in_safe ?? []) {
    if (rule.method && rule.method !== m) continue;
    if (p.includes(rule.path_contains.toLowerCase())) return true;
  }
  if (MUTATING.has(method.toLowerCase())) {
    const keywords = ["/order", "/trade", "/execute", "/execution", "/place", "/cancel", "/dispatch", "/testnet", "/reconcile"];
    if (keywords.some((k) => p.includes(k))) return true;
  }
  return false;
}

function violationStatus(scope, method, routePath, config) {
  const mutating = MUTATING.has(method.toLowerCase());
  const suspicious = isSuspiciousMutating(method, routePath, config);

  if (scope === "SAFE") {
    if (mutating) {
      return { status: "RED", rule: "SAFE_NO_MUTATING_ROUTE", violation: true };
    }
    if (suspicious) {
      return { status: "RED", rule: "SAFE_NO_ORDER_ROUTE", violation: true };
    }
    return { status: "GREEN", rule: null, violation: false };
  }
  if (scope === "UNSAFE") {
    if (suspicious) {
      return { status: "FINDING", rule: "UNSAFE_EXECUTION_ROUTE", violation: true };
    }
    return { status: "OK", rule: null, violation: false };
  }
  if (scope === "DONOR") {
    if (suspicious) {
      return { status: "DONOR_FINDING", rule: "DONOR_EXECUTION_ROUTE", violation: true };
    }
    return { status: "OK", rule: null, violation: false };
  }
  if (suspicious) {
    return { status: "YELLOW", rule: "UNKNOWN_SUSPICIOUS_ROUTE", violation: true };
  }
  return { status: "YELLOW", rule: "UNKNOWN_ROUTE", violation: false };
}

function extractReadonlyEndpointConstants(source, fileRel) {
  const routes = [];
  const block = source.match(
    /export const CONNECTED_READONLY_CORE_ENDPOINTS[^=]*=\s*\[([\s\S]*?)\];/
  );
  if (block) {
    const paths = [...block[1].matchAll(/["'`](\/[^"'`]+)["'`]/g)].map((m) => m[1]);
    for (const routePath of paths) {
      routes.push({
        method: "GET",
        path: routePath,
        line: 0,
        source: "CONNECTED_READONLY_CORE_ENDPOINTS",
      });
    }
  }
  return routes;
}

function scanFile(fullPath, sourceRoot, config) {
  const rel = path.relative(sourceRoot, fullPath).replace(/\\/g, "/");
  const scope = classifyPath(rel, config);
  const source = fs.readFileSync(fullPath, "utf8");
  const routes = [];

  if (rel.includes("connected-readonly-core-api.ts")) {
    for (const r of extractReadonlyEndpointConstants(source, rel)) {
      routes.push({ ...r, file: rel, scope });
    }
  }

  let match;
  ROUTE_RE.lastIndex = 0;
  while ((match = ROUTE_RE.exec(source)) !== null) {
    const method = match[1].toLowerCase();
    const routePath = match[2];
    const line = source.slice(0, match.index).split("\n").length;
    routes.push({ method: method.toUpperCase(), path: routePath, line, file: rel, scope });
  }

  return routes.map((r) => {
    const fileScope = classifyPath(r.file, config);
    const scopeZone = r.scope ?? fileScope;
    const v = violationStatus(scopeZone, r.method, r.path, config);
    return {
      method: r.method,
      path: r.path,
      file: r.file,
      line: r.line ?? null,
      scope: scopeZone,
      scanStatus: v.status,
      violation: v.violation,
      rule: v.rule,
      source: r.source ?? "express-registration",
    };
  });
}

function summarize(entries) {
  const byScope = { SAFE: 0, UNSAFE: 0, DONOR: 0, UNKNOWN: 0 };
  const byStatus = { RED: 0, FINDING: 0, DONOR_FINDING: 0, YELLOW: 0, GREEN: 0, OK: 0 };
  for (const e of entries) {
    byScope[e.scope] = (byScope[e.scope] ?? 0) + 1;
    byStatus[e.scanStatus] = (byStatus[e.scanStatus] ?? 0) + 1;
  }
  return { byScope, byStatus };
}

function main() {
  const config = loadConfig();
  const sourceRoot = assertSourceTargetExists(config.source_target);
  const scanRoots = [
    path.join(sourceRoot, "core/apps"),
    path.join(sourceRoot, "core/core/ui-api"),
  ];

  const files = scanRoots.flatMap((d) => walkFiles(d));
  const entries = files.flatMap((f) => scanFile(f, sourceRoot, config));

  const unique = new Map();
  for (const e of entries) {
    const key = `${e.method}:${e.path}:${e.file}:${e.line}`;
    unique.set(key, e);
  }
  const routes = [...unique.values()].sort((a, b) =>
    a.file.localeCompare(b.file) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );

  const summary = summarize(routes);
  const redInSafe = routes.filter((r) => r.scope === "SAFE" && r.scanStatus === "RED");
  const safeMutating = routes.filter((r) => r.scope === "SAFE" && MUTATING.has(r.method.toLowerCase()));

  const report = {
    schema: "genesis.foundation.route-inventory.v1",
    generatedAt: new Date().toISOString(),
    scanner: "tools/verification/scan-routes.mjs",
    configVersion: config.version,
    sourceTarget: sourceTargetForReport(config.source_target),
    limitations: [
      "Static regex scan only; dynamic route registration may be missed.",
      "Patch files and frontend API calls are not scanned in Stage 4.",
      "Import and env scanners are out of scope for this stage.",
    ],
    summary: {
      totalRoutes: routes.length,
      ...summary,
      redInSafeCount: redInSafe.length,
      safeMutatingCount: safeMutating.length,
      foundationCheckFailed: redInSafe.length > 0,
    },
    redInSafe,
    routes,
  };

  const reportsDir = path.join(__dirname, "../../reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, "route-inventory.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ ok: redInSafe.length === 0, outPath, summary: report.summary }, null, 2));
  process.exit(redInSafe.length > 0 ? 1 : 0);
}

function sourceTargetPath(p) {
  return p.replace(/\\/g, "/");
}

main();
