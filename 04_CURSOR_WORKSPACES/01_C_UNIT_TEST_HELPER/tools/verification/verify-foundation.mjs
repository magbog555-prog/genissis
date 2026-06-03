#!/usr/bin/env node
/**
 * verify-foundation.mjs — Sprint 2 aggregate (D-10). No long-running servers.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const strict = process.argv.includes("--strict");
const buildArgs = ["build-safe-artifact.mjs", "--refresh-closure"];
const scanArgs = ["scan-safe-bundle.mjs"];
const importCompletenessArgs = ["verify-artifact-import-completeness.mjs"];
if (strict) {
  buildArgs.push("--strict");
  scanArgs.push("--strict");
  importCompletenessArgs.push("--strict");
}

const steps = [
  { name: "entrypoint:check", cmd: ["entrypoint-check.mjs"] },
  { name: "verify:routes", cmd: ["scan-routes.mjs"] },
  { name: "verify:imports", cmd: ["scan-imports.mjs"] },
  { name: "verify:env", cmd: ["scan-env.mjs"] },
  { name: "verify:closure", cmd: ["resolve-safe-closure.mjs"] },
  { name: "build:safe-artifact", cmd: buildArgs },
  { name: "verify:artifact-import-completeness", cmd: importCompletenessArgs },
  { name: "scan:safe-bundle", cmd: scanArgs },
  { name: "verify:negatives", cmd: ["verify-negatives.mjs"] }
];

const results = [];
let failed = false;

for (const step of steps) {
  const script = path.join(__dirname, step.cmd[0]);
  const args = step.cmd.slice(1);
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
  const ok = r.status === 0;
  if (!ok) failed = true;
  results.push({
    step: step.name,
    ok,
    status: r.status,
    stderr: r.stderr?.slice(0, 500) || ""
  });
  console.log(`[verify:foundation] ${step.name}: ${ok ? "PASS" : "FAIL"}`);
}

const summary = {
  schema: "genesis.verify-foundation.v1",
  ranAt: new Date().toISOString(),
  tier: strict ? "STRICT" : "OPERATOR",
  pass: !failed,
  results
};

console.log(JSON.stringify(summary, null, 2));
process.exit(failed ? 1 : 0);
