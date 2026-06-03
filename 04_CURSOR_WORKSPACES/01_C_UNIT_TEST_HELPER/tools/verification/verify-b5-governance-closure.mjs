#!/usr/bin/env node
/**
 * verify-b5-governance-closure — Sprint 6 B5 Notary + ledger v2 gate.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(__dirname, "../../../..");
const ledgerPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/B5_ACCEPTED_RISK_LEDGER_V2.json");
const signoffPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/B5_NOTARY_REVIEW_SIGNOFF.json");
const outPath = path.join(path.resolve(__dirname, "../.."), "reports/b5-governance-closure.verify.json");

const violations = [];

function main() {
  if (!fs.existsSync(ledgerPath)) violations.push("MISSING_B5_LEDGER_V2");
  if (!fs.existsSync(signoffPath)) violations.push("MISSING_B5_NOTARY_SIGNOFF");

  let ledger = null;
  let signoff = null;
  if (fs.existsSync(ledgerPath)) ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  if (fs.existsSync(signoffPath)) signoff = JSON.parse(fs.readFileSync(signoffPath, "utf8"));

  if (ledger) {
    if (ledger.entryCount !== 23 || ledger.entries?.length !== 23) {
      violations.push("LEDGER_ENTRY_COUNT_NOT_23");
    }
    for (const e of ledger.entries || []) {
      if (!e.owner || /placeholder/i.test(e.owner)) violations.push(`PLACEHOLDER_OWNER:${e.riskId}`);
      if (e.notaryDisposition !== "ACCEPTED_DISPLAY_ONLY") {
        violations.push(`BAD_NOTARY_DISPOSITION:${e.riskId}`);
      }
      if (e.status !== "ACTIVE_ACCEPTED_RISK") violations.push(`BAD_STATUS:${e.riskId}`);
    }
    if (ledger.policyGuards?.notaryGreenClaimed) violations.push("LEDGER_CLAIMS_NOTARY_GREEN");
    if (ledger.policyGuards?.executionUnlock) violations.push("LEDGER_CLAIMS_EXECUTION");
  }

  if (signoff) {
    if (signoff.greenClaimed !== false) violations.push("SIGNOFF_GREEN_CLAIMED");
    if (signoff.executionAllowed !== false) violations.push("SIGNOFF_EXECUTION_ALLOWED");
    if (signoff.notaryStatus !== "YELLOW") violations.push("SIGNOFF_NOT_YELLOW");
    if (signoff.acceptedRiskCount !== 23) violations.push("SIGNOFF_RISK_COUNT");
    if (ledger) {
      const hash = crypto.createHash("sha256").update(JSON.stringify(ledger, null, 2)).digest("hex");
      const expected = `sha256:${hash}`;
      if (signoff.attestationHash !== expected) violations.push("SIGNOFF_ATTESTATION_HASH_MISMATCH");
    }
  }

  const pass = violations.length === 0;
  const report = {
    schema: "genesis.b5-governance-closure.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    closureStatus: pass ? "COMPLETE" : "FAIL",
    ledgerRef: "05_REPORTS_AND_MANIFESTS/B5_ACCEPTED_RISK_LEDGER_V2.json",
    signoffRef: "05_REPORTS_AND_MANIFESTS/B5_NOTARY_REVIEW_SIGNOFF.json",
    violations,
    policy: {
      notaryGreen: "NO",
      archGreenApproved: false,
      executionAllowed: false
    }
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: pass, outPath, violationCount: violations.length }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
