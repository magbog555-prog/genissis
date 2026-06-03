#!/usr/bin/env node
/**
 * verify-portability-baseline.mjs — Genesis Track B, B6 (BASELINE_V1).
 * Minimal reproducibility proof: record platform + Node, run verify:foundation, write JSON.
 * Not ARCH_GREEN; not full CI — local/second-machine baseline only.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const reportPath = path.join(root, "reports/portability-baseline.json");

const packageLockPath = path.join(root, "package-lock.json");
const hasPackageLock = fs.existsSync(packageLockPath);

/** Documented prerequisites (operator runs before this script on a fresh clone). */
const prerequisites = {
  node: {
    required: "Node.js LTS (18+ or 20+ recommended); match version across machines when comparing reports",
    observed: process.version
  },
  install: hasPackageLock
    ? {
        command: "npm ci",
        note: "package-lock.json present — use npm ci for reproducible deps"
      }
    : {
        command: "none (no package-lock.json)",
        note: "Foundation workspace has no npm dependencies; verification uses Node built-ins only"
      },
  env: {
    GENESIS_ROOT: "optional — repo root if not default (see tools/verification/GENESIS_PATHS.md)",
    SOURCE_TARGET_ROOT: "optional — MBG source target if not under default GENESIS_ROOT"
  }
};

function runVerifyFoundation() {
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "npm.cmd" : "npm", ["run", "verify:foundation"], {
    cwd: root,
    encoding: "utf8",
    shell: isWin
  });
  return {
    script: "verify:foundation",
    pass: r.status === 0,
    exitCode: r.status ?? 1,
    stderrTail: (r.stderr || "").slice(-500)
  };
}

function main() {
  console.log("[verify:portability-baseline] B6 BASELINE_V1 — not ARCH_GREEN / not full CI");
  console.log("[verify:portability-baseline] Prerequisites:");
  console.log(`  Node: ${prerequisites.node.observed} (${prerequisites.node.required})`);
  console.log(`  Install: ${prerequisites.install.command}`);
  if (prerequisites.install.note) {
    console.log(`    ${prerequisites.install.note}`);
  }

  const foundation = runVerifyFoundation();
  console.log(
    `[verify:portability-baseline] verify:foundation: ${foundation.pass ? "PASS" : "FAIL"} (exit ${foundation.exitCode})`
  );

  const report = {
    schema: "genesis.portability-baseline.v1",
    track: "B6",
    tier: "BASELINE_V1",
    archGreen: false,
    fullCi: false,
    timestamp: new Date().toISOString(),
    platform: {
      os: os.platform(),
      arch: os.arch(),
      release: os.release()
    },
    nodeVersion: process.version,
    pass: foundation.pass,
    prerequisites,
    foundation
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`[verify:portability-baseline] wrote ${reportPath}`);
  console.log(JSON.stringify({ pass: report.pass, reportPath }, null, 2));

  process.exit(foundation.pass ? 0 : 1);
}

main();
