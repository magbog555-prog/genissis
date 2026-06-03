#!/usr/bin/env node
/**
 * verify-mbg-wire-self-contained.mjs — start MBG readonly API :3011, run verify-mbg-wire, stop core.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSourceTargetExists } from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const foundationRoot = path.resolve(__dirname, "../..");
const verifyScript = path.join(__dirname, "verify-mbg-wire.mjs");

async function waitFor(url, timeoutMs = 30000) {
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

function runVerify() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [verifyScript], {
      stdio: "inherit",
      cwd: foundationRoot
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error("verify-mbg-wire failed"), { exitCode: code ?? 1 }));
    });
  });
}

async function main() {
  const mbgRoot = assertSourceTargetExists();
  const server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
    stdio: "ignore",
    shell: process.platform === "win32",
    cwd: mbgRoot
  });

  let exitCode = 1;
  try {
    await waitFor("http://127.0.0.1:3011/health");
    await runVerify();
    exitCode = 0;
  } catch (err) {
    exitCode = err.exitCode ?? 1;
    if (!err.exitCode) console.error(err.message);
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 400));
  }
  process.exit(exitCode);
}

main();
