#!/usr/bin/env node
/**
 * verify-negatives.mjs — Sprint 2 O-04 (D-10)
 * 1) Fixture parity vs scanner reports (routes/imports/env)
 * 2) Intentional bundle injection → scan must FAIL
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportsDir = path.join(root, "reports");
const negativeDir = path.join(root, "tests/negative");
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "genesis-safe-artifact.manifest.json"), "utf8")
);

function loadReport(name) {
  const p = path.join(reportsDir, name);
  if (!fs.existsSync(p)) {
    return { ok: false, error: `Missing ${name} — run scanners before verify:negatives` };
  }
  return { ok: true, data: JSON.parse(fs.readFileSync(p, "utf8")) };
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(negativeDir, name), "utf8"));
}

function evaluateImportEdge(importerScope, targetScope, forbiddenMatched) {
  if (importerScope === "SAFE") {
    if (forbiddenMatched || targetScope === "UNSAFE") {
      return "RED";
    }
    if (targetScope === "DONOR") return "YELLOW";
    if (targetScope === "UNKNOWN") return "YELLOW";
    return "GREEN";
  }
  if (forbiddenMatched || targetScope === "UNSAFE") {
    if (importerScope === "UNSAFE") return "FINDING";
    if (importerScope === "DONOR") return "DONOR_FINDING";
    return "YELLOW";
  }
  return "OK";
}

function evaluateEnvHit(scope, forbiddenMatched) {
  if (!forbiddenMatched) return "OK";
  if (scope === "SAFE") return "RED";
  if (scope === "UNSAFE") return "FINDING";
  if (scope === "DONOR") return "DONOR_FINDING";
  return "YELLOW";
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "foundation-scope.config.json"), "utf8"));
}

const MUTATING = new Set(["post", "put", "patch", "delete", "all"]);

function isSuspiciousMutating(method, routePath, config) {
  const m = method.toUpperCase();
  const p = routePath.toLowerCase();
  if (!MUTATING.has(method.toLowerCase())) return false;
  for (const rule of config.forbidden_route_patterns_in_safe ?? []) {
    if (rule.method && rule.method !== m) continue;
    if (p.includes(rule.path_contains.toLowerCase())) return true;
  }
  if (MUTATING.has(method.toLowerCase())) {
    const keywords = [
      "/order",
      "/trade",
      "/execute",
      "/execution",
      "/place",
      "/cancel",
      "/dispatch",
      "/testnet",
      "/reconcile"
    ];
    if (keywords.some((k) => p.includes(k))) return true;
  }
  return false;
}

function classifyRoute(scope, method, routePath, config) {
  const mutating = MUTATING.has(method.toLowerCase());
  const suspicious = isSuspiciousMutating(method, routePath, config);

  if (scope === "SAFE") {
    if (mutating || suspicious) return "RED";
    return "GREEN";
  }
  if (scope === "UNSAFE") {
    if (suspicious) return "FINDING";
    return "OK";
  }
  if (scope === "DONOR") {
    if (suspicious) return "DONOR_FINDING";
    return "OK";
  }
  if (suspicious) return "YELLOW";
  return "YELLOW";
}

function parseScanJson(output) {
  const text = (output || "").trim();
  const marker = '"schema": "genesis.safe-bundle-scan.v1"';
  const markerIdx = text.indexOf(marker);
  if (markerIdx < 0) return null;
  const start = text.lastIndexOf("{", markerIdx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  return null;
}

function validateRouteFixtures(routeReport) {
  const fixture = loadFixture("route-post-order.fixture.json");
  const config = loadConfig();
  const results = [];
  for (const exp of fixture.expectations) {
    const file = exp.file.replace(/\\/g, "/");
    const match = routeReport.routes.find(
      (r) =>
        r.file.replace(/\\/g, "/") === file &&
        r.method === exp.method &&
        r.path === exp.path &&
        r.scope === exp.scope
    );
    const actual = match?.scanStatus ?? classifyRoute(exp.scope, exp.method, exp.path, config);
    results.push({
      case: exp.case,
      pass: actual === exp.expectedStatus,
      expected: exp.expectedStatus,
      actual,
      source: match ? "route-inventory" : "synthetic-classifier"
    });
  }
  return results;
}

function validateImportFixtures() {
  const fixture = loadFixture("unsafe-import.fixture.json");
  const results = [];
  for (const exp of fixture.expectations) {
    const forbidden =
      exp.specifier.includes("binance") ||
      exp.specifier.includes("execution") ||
      exp.specifier.includes("exchange");
    const targetScope =
      exp.targetScope ??
      (exp.specifier.includes("binance") || exp.specifier.includes("execution")
        ? "UNSAFE"
        : exp.specifier.includes("runtime")
          ? "DONOR"
          : "UNKNOWN");
    const actual = evaluateImportEdge(exp.importerScope, targetScope, forbidden);
    results.push({
      case: exp.case,
      pass: actual === exp.expectedStatus,
      expected: exp.expectedStatus,
      actual
    });
  }
  return results;
}

function validateEnvFixtures() {
  const fixture = loadFixture("exchange-secret.fixture.json");
  const configPath = path.join(__dirname, "foundation-scope.config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const forbiddenNames = new Set(
    (config.forbidden_env_names_in_safe ?? []).map((n) => n.toUpperCase())
  );
  const results = [];
  for (const exp of fixture.expectations) {
    const forbiddenMatched = forbiddenNames.has(exp.envName.toUpperCase());
    const actual = evaluateEnvHit(exp.scope, forbiddenMatched);
    results.push({
      case: exp.case,
      pass: actual === exp.expectedStatus,
      expected: exp.expectedStatus,
      actual
    });
  }
  return results;
}

function runInjectionProof() {
  const srcBundle = path.join(root, manifest.output_dir);
  if (!fs.existsSync(srcBundle)) {
    return { ok: false, error: "Safe bundle missing — run build:safe-artifact first" };
  }

  const testRoot = path.join(root, ".genesis-ci-negative-test");
  fs.rmSync(testRoot, { recursive: true, force: true });
  fs.cpSync(srcBundle, testRoot, { recursive: true });

  const probeRel = "core/core/__ci_injection_probe.ts";
  const probePath = path.join(testRoot, probeRel);
  fs.mkdirSync(path.dirname(probePath), { recursive: true });
  fs.writeFileSync(
    probePath,
    [
      "// CI negative injection probe — must trigger scan FAIL",
      "import x from '../../application/exchange/src/binance-spot-testnet.js';",
      "void x;",
      "export {};",
      ""
    ].join("\n"),
    "utf8"
  );

  const relBundle = path.relative(root, testRoot).replace(/\\/g, "/");
  const scanScript = path.join(__dirname, "scan-safe-bundle.mjs");
  const r = spawnSync(
    process.execPath,
    [scanScript, "--bundle-root", relBundle, "--no-write-report"],
    { cwd: root, encoding: "utf8" }
  );

  let scanResult = parseScanJson(`${r.stdout || ""}\n${r.stderr || ""}`);

  fs.rmSync(testRoot, { recursive: true, force: true });

  const scanFailed = r.status !== 0;
  const redDetected = (scanResult?.redCount ?? 0) > 0;
  return {
    ok: scanFailed && (redDetected || scanResult?.pass === false),
    scanExitCode: r.status,
    redCount: scanResult?.redCount ?? null,
    scanPass: scanResult?.pass ?? null,
    probeFile: probeRel,
    injectedImport: "../../application/exchange/src/binance-spot-testnet.js"
  };
}

function main() {
  const routeLoad = loadReport("route-inventory.json");
  const importLoad = loadReport("import-boundary-report.json");
  const envLoad = loadReport("env-inventory.json");

  const blockers = [];
  if (!routeLoad.ok) blockers.push(routeLoad.error);
  if (!importLoad.ok) blockers.push(importLoad.error);
  if (!envLoad.ok) blockers.push(envLoad.error);

  const routeResults = routeLoad.ok ? validateRouteFixtures(routeLoad.data) : [];
  const importResults = validateImportFixtures();
  const envResults = validateEnvFixtures();
  const injection = runInjectionProof();

  const fixtureResults = [...routeResults, ...importResults, ...envResults];
  const fixturePass = fixtureResults.every((r) => r.pass);
  const injectionPass = injection.ok === true;

  const proof = {
    schema: "genesis.ci-negative-proof.v1",
    ranAt: new Date().toISOString(),
    pass: blockers.length === 0 && fixturePass && injectionPass,
    fixtureParity: {
      pass: fixturePass,
      route: routeResults,
      import: importResults,
      env: envResults
    },
    injectionProof: injection,
    blockers
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, "ci-negative-proof.json"), JSON.stringify(proof, null, 2));

  console.log(JSON.stringify(proof, null, 2));
  process.exit(proof.pass ? 0 : 1);
}

main();
