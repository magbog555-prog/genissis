/**
 * RC4-D2 — launcher / port-preflight artifacts present and documented.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "START_APP.cmd",
  "STOP_APP.cmd",
  "start-app.ps1",
  "stop-app.ps1",
  "stop-core-port.ps1",
  "rc4-d2-port-util.ps1",
  "launcher/START_CORE.cmd",
  "launcher/START_FRONTEND.cmd",
  "launcher/START_ALL.cmd",
  "launcher/STOP_ALL.cmd",
  "launcher/STOP_CORE_PORT.cmd",
  "launcher/VERIFY_ALL.cmd"
];

for (const rel of files) {
  const p = path.join(root, rel);
  assert(fs.existsSync(p), `missing launcher artifact: ${rel}`);
}

const startCore = fs.readFileSync(path.join(root, "start-core.ps1"), "utf8");
assert(startCore.includes("3011"), "start-core.ps1 must reference port 3011 preflight");
assert(
  startCore.includes("Порт 3011 занят") && startCore.includes("stop-core-port.ps1"),
  "start-core.ps1 must contain operator-facing port-3011 conflict copy and stop-core-port.ps1"
);

const runbook = fs.readFileSync(path.join(root, "RUNBOOK.md"), "utf8");
assert(runbook.includes("3011"), "RUNBOOK.md must mention port 3011");
assert(
  runbook.includes("EADDRINUSE") || runbook.includes("eaddrinuse"),
  "RUNBOOK.md must mention EADDRINUSE / port conflict"
);

const startHere = fs.readFileSync(path.join(root, "START_HERE.md"), "utf8");
assert(
  startHere.includes("START_APP.cmd"),
  "START_HERE.md must document double-click START_APP.cmd"
);
assert(
  startHere.includes("stop-core-port.ps1") || startHere.includes("STOP_CORE_PORT.cmd"),
  "START_HERE.md must mention stop-core-port or STOP_CORE_PORT.cmd"
);

console.log("verify:launchers PASS (RC4-D2 launch / port preflight artifacts)");
