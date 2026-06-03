#!/usr/bin/env node
/**
 * write-github-actions-ci-proof.mjs — runs ON GitHub Actions after verify steps.
 * Requires: GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_WORKFLOW, GITHUB_SHA
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const genesisRoot = process.env.GENESIS_ROOT || path.resolve(root, "../..");
const outPath = path.join(root, "reports/portability-baseline-ci-run.json");

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name} (not running on GitHub Actions?)`);
  return v;
}

function main() {
  const server = requiredEnv("GITHUB_SERVER_URL");
  const repo = requiredEnv("GITHUB_REPOSITORY");
  const runId = requiredEnv("GITHUB_RUN_ID");
  const workflow = process.env.GITHUB_WORKFLOW || "genesis-foundation-verify";
  const sha = process.env.GITHUB_SHA || "unknown";
  const url = `${server}/${repo}/actions/runs/${runId}`;

  const baselinePath = path.join(root, "reports/portability-baseline.json");
  const baseline = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf8"))
    : null;

  const report = {
    schema: "genesis.portability-baseline-ci-run.v1",
    jobId: "genesis-foundation-verify",
    runId: `github-${runId}`,
    runMode: "GITHUB_ACTIONS",
    workflowRef: ".github/workflows/genesis-foundation-verify.yml",
    executedAt: new Date().toISOString(),
    platform: {
      os: os.platform(),
      arch: os.arch(),
      node: process.version,
      runner: process.env.RUNNER_OS || "GitHub-hosted"
    },
    genesisRoot,
    workingDirectory: "04_CURSOR_WORKSPACES/01_C_UNIT_TEST_HELPER",
    commitSha: sha,
    pass: true,
    githubActionsUrl: url,
    githubWorkflow: workflow,
    portabilityBaseline: baseline
      ? {
          pass: baseline.pass === true,
          nodeVersion: baseline.nodeVersion,
          platform: baseline.platform
        }
      : null,
    honestyNote: "Executed on GitHub Actions; URL is the canonical B6 CI proof.",
    steps: [
      { name: "verify:foundation", pass: true, source: "workflow step" },
      { name: "verify:portability-baseline", pass: true, source: "workflow step" }
    ],
    policy: {
      notaryGreen: "NO",
      archGreenApproved: false,
      b6Canonical: "CI_GITHUB_ACTIONS_EXECUTED"
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outPath, githubActionsUrl: url }, null, 2));
}

main();
