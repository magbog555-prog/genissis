#!/usr/bin/env node
/**
 * verify-b6-portability-closure — B6 gate: GHA URL OR second-host OR container proof.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const genesisRoot = path.resolve(root, "../..");
const ciRunPath = path.join(root, "reports/portability-baseline-ci-run.json");
const secondHostPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/portability-second-host-result.json");
const containerPath = path.join(root, "reports/container-audit-run.json");
const outPath = path.join(root, "reports/b6-portability-closure.verify.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isValidGhaUrl(url) {
  return typeof url === "string" && /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+/.test(url);
}

function main() {
  const violations = [];
  let tier = "PARTIAL_LOCAL_ONLY";
  let pass = false;
  let proofKind = null;
  let proofRef = null;

  if (fs.existsSync(ciRunPath)) {
    const ci = loadJson(ciRunPath);
    if (ci.pass === false) violations.push("CI_RUN_PASS_FALSE");
    if (isValidGhaUrl(ci.githubActionsUrl)) {
      tier = "CI_GITHUB_ACTIONS_EXECUTED";
      pass = ci.pass !== false;
      proofKind = "GITHUB_ACTIONS_URL";
      proofRef = ci.githubActionsUrl;
    } else if (ci.runMode === "LOCAL_CI_SIMULATION" && ci.pass) {
      tier = "PARTIAL_CI_LOCAL_EXECUTED";
      violations.push("MISSING_GITHUB_ACTIONS_URL_OR_SECOND_HOST");
    }
  } else {
    violations.push("MISSING_PORTABILITY_CI_RUN");
  }

  if (!pass && fs.existsSync(secondHostPath)) {
    const sh = loadJson(secondHostPath);
    if (sh.pass === true && sh.comparison?.matchesPrimary !== false) {
      tier = "SECOND_HOST_EXECUTED";
      pass = true;
      proofKind = "SECOND_HOST_RESULT";
      proofRef = "05_REPORTS_AND_MANIFESTS/portability-second-host-result.json";
      violations.length = 0;
    }
  }

  if (!pass && fs.existsSync(containerPath)) {
    const c = loadJson(containerPath);
    if (c.pass === true) {
      tier = "CONTAINER_EXECUTED";
      pass = true;
      proofKind = "CONTAINER_AUDIT_RUN";
      proofRef = "reports/container-audit-run.json";
      violations.length = 0;
    }
  }

  const workflowPath = path.join(genesisRoot, ".github/workflows/genesis-foundation-verify.yml");
  const workflowInRepo = fs.existsSync(workflowPath);

  const report = {
    schema: "genesis.b6-portability-closure.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    tier,
    proofKind,
    proofRef,
    workflowYamlInRepo: workflowInRepo,
    violations,
    artifacts: {
      ciRun: "reports/portability-baseline-ci-run.json",
      secondHost: "05_REPORTS_AND_MANIFESTS/portability-second-host-result.json",
      container: "reports/container-audit-run.json"
    },
    policy: {
      notaryGreen: "NO",
      archGreenApproved: false,
      auditorBundleB6Gate: pass
    },
    nextSteps: pass
      ? []
      : [
          "Push Genesis to GitHub and run workflow genesis-foundation-verify",
          "Download artifact portability-baseline-ci-run OR run: npm run attach:github-actions-run -- --url <run-url>",
          "Or produce portability-second-host-result.json per portability-second-host-instructions.md"
        ]
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: pass, tier, violationCount: violations.length, outPath }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
