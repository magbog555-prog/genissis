/**
 * RC4-D — final verification gate (read-only surface, docs, acceptance scripts).
 * Does not add execution, trading, or signed endpoints.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      cwd: root
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

async function waitFor(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function withReadonlyApi(fn) {
  const server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
    stdio: "ignore",
    shell: process.platform === "win32",
    cwd: root
  });
  try {
    await waitFor("http://127.0.0.1:3011/health");
    await fn();
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 400));
  }
}

const steps = [
  ["npm", ["run", "check:core"]],
  ["npm", ["run", "verify:rc4"]],
  ["npm", ["run", "verify:rc4-c"]],
  ["npm", ["run", "verify:frontend-language"]],
  ["npm", ["run", "verify:frontend-layout"]],
  ["npm", ["run", "verify:layout-normalization"]],
  ["npm", ["run", "verify:launchers"]],
  ["npm", ["run", "verify:semantic-labels"]],
  ["npm", ["run", "verify:ui-machine-guardrail"]]
];

for (const [cmd, args] of steps) {
  await run(cmd, args);
}

await withReadonlyApi(() => run("npm", ["run", "verify:readonly-surface"]));

await run("npm", ["run", "build:frontend"]);
await run("npm", ["run", "verify:docs"]);
await run("npm", ["run", "verify:final-acceptance"]);

console.log("verify:rc4-d PASS (RC4-D verification gate)");
