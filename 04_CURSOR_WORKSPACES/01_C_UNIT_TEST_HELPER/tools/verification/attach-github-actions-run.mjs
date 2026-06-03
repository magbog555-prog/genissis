#!/usr/bin/env node
/**
 * attach-github-actions-run.mjs — merge GHA run URL into portability-baseline-ci-run.json
 * Usage: node attach-github-actions-run.mjs --url https://github.com/ORG/REPO/actions/runs/12345678
 *    or: set GITHUB_ACTIONS_RUN_URL=...
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outPath = path.join(root, "reports/portability-baseline-ci-run.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let url = process.env.GITHUB_ACTIONS_RUN_URL || null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) url = args[++i];
  }
  return url;
}

function isValidGhaUrl(url) {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+/.test(url);
}

function main() {
  const url = parseArgs();
  if (!url || !isValidGhaUrl(url)) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Provide --url https://github.com/ORG/REPO/actions/runs/ID"
      })
    );
    process.exit(1);
  }

  let base = {};
  if (fs.existsSync(outPath)) {
    base = JSON.parse(fs.readFileSync(outPath, "utf8"));
  }

  const report = {
    ...base,
    schema: "genesis.portability-baseline-ci-run.v1",
    jobId: base.jobId || "genesis-foundation-verify",
    runMode: "GITHUB_ACTIONS",
    executedAt: base.executedAt || new Date().toISOString(),
    pass: base.pass !== false,
    githubActionsUrl: url,
    githubWorkflow: base.githubWorkflow || "genesis-foundation-verify",
    workflowRef: ".github/workflows/genesis-foundation-verify.yml",
    honestyNote:
      "Run URL attached manually or from CI; re-run verify:b6-portability-closure after attach.",
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
