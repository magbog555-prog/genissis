#!/usr/bin/env node
/**
 * run-portability-ci-local — mirrors genesis-foundation-verify workflow; writes ci-run JSON.
 * Honest: LOCAL_CI_SIMULATION until GitHub Actions run URL is attached.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const genesisRoot = path.resolve(root, "../..");
const outPath = path.join(root, "reports/portability-baseline-ci-run.json");
const workflowRef = ".github/workflows/genesis-foundation-verify.yml";

function runStep(name, command, args) {
  const started = new Date().toISOString();
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "npm.cmd" : "npm", ["run", command, ...args], {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
    env: { ...process.env, GENESIS_ROOT: genesisRoot }
  });
  return {
    name,
    command: `npm run ${command}${args.length ? ` ${args.join(" ")}` : ""}`,
    startedAt: started,
    finishedAt: new Date().toISOString(),
    exitCode: r.status ?? 1,
    pass: r.status === 0,
    stdoutTail: (r.stdout || "").slice(-1200),
    stderrTail: (r.stderr || "").slice(-800)
  };
}

function main() {
  const steps = [
    runStep("verify:foundation", "verify:foundation", []),
    runStep("verify:portability-baseline", "verify:portability-baseline", [])
  ];
  const allPass = steps.every((s) => s.pass);
  const report = {
    schema: "genesis.portability-baseline-ci-run.v1",
    jobId: "genesis-foundation-verify",
    runId: `local-${Date.now()}`,
    runMode: "LOCAL_CI_SIMULATION",
    workflowRef,
    executedAt: new Date().toISOString(),
    platform: { os: os.platform(), arch: os.arch(), node: process.version },
    genesisRoot,
    workingDirectory: "04_CURSOR_WORKSPACES/01_C_UNIT_TEST_HELPER",
    pass: allPass,
    githubActionsUrl: null,
    honestyNote:
      "Workflow YAML exists in repo; this run is local simulation. Attach Actions run URL when pushed to GitHub.",
    steps,
    policy: {
      notaryGreen: "NO",
      archGreenApproved: false,
      b6Canonical: allPass ? "PARTIAL_CI_LOCAL_EXECUTED" : "FAIL"
    }
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: allPass, outPath, stepCount: steps.length }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main();
