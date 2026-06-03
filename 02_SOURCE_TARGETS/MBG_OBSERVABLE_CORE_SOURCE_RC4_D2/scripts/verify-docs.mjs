import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "START_HERE.md",
  "RUNBOOK.md",
  "API_CONTRACT.md",
  "SAFETY_BOUNDARY.md",
  "BOOT_REPORT.md",
  "OPERATOR_ACCEPTANCE_REPORT.md",
  "RC4_FINAL_ACCEPTANCE_REPORT.md",
  "UX_DEBT.md"
];

for (const name of required) {
  const p = path.join(root, name);
  assert(fs.existsSync(p), `missing doc: ${name}`);
  const text = fs.readFileSync(p, "utf8");
  assert(text.trim().length > 80, `doc too empty: ${name}`);
}

const start = fs.readFileSync(path.join(root, "START_HERE.md"), "utf8");
for (const needle of [
  "npm run install:all",
  "npm run verify:rc4-d",
  "start-core.ps1",
  "start-frontend.ps1",
  "localhost:5173",
  "3011",
  "stop-all.ps1",
  "START_APP.cmd",
  "STOP_APP.cmd",
  "launcher"
]) {
  assert(start.includes(needle), `START_HERE.md must mention: ${needle}`);
}

console.log("verify:docs PASS");
