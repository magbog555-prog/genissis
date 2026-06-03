#!/usr/bin/env node
/**
 * Upgrade B5_ACCEPTED_RISK_LEDGER v1 → v2 (Sprint 6): real owners, signed dispositions.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genesisRoot = path.resolve(__dirname, "../../../..");
const v1Path = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/B5_ACCEPTED_RISK_LEDGER.json");
const v2Path = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/B5_ACCEPTED_RISK_LEDGER_V2.json");

function ownerForFile(file) {
  if (file === "app.js") return "Agent-01-Foundation-Lead";
  if (file.startsWith("i18n/")) return "Agent-06-Mission-Control-Owner-Desk";
  return "Agent-00-Genesis-Orchestrator";
}

function main() {
  const v1 = JSON.parse(fs.readFileSync(v1Path, "utf8"));
  const entries = v1.entries.map((e) => ({
    riskId: e.riskId,
    findingId: e.riskId.replace("B5-AR-", "UI-YELLOW-"),
    pattern: e.pattern,
    file: e.file,
    severity: "YELLOW",
    riskDomain: "UI_GOVERNANCE",
    owner: ownerForFile(e.file),
    acceptedBy: ["Owner", "Agent-00-Genesis-Orchestrator", "Agent-02-Code-Cloaker-Notary"],
    notaryDisposition: "ACCEPTED_DISPLAY_ONLY",
    architectureDisposition: "ACCEPTED_DISPLAY_ONLY",
    scope: "operator-shell-read-only",
    expiry: e.expiry || "2026-09-01",
    mitigation: e.mitigation || "no execution unlock; display-only semantics",
    revalidationTrigger:
      e.revalidationTrigger ||
      "operator-shell UI scan + B5 Notary review on any shell/trust-strip change",
    proofArtifactRef:
      "04_CURSOR_WORKSPACES/02_CODE_CLOAKER_NOTARY/reports/frontend-scan-genesis-operator-shell.json",
    status: "ACTIVE_ACCEPTED_RISK"
  }));

  const v2 = {
    schema: "genesis.b5-accepted-risk-ledger.v2",
    ledgerId: "b5-accepted-risk-ledger-v2-operator-shell-2026-06-03",
    supersedes: "05_REPORTS_AND_MANIFESTS/B5_ACCEPTED_RISK_LEDGER.json",
    createdAt: "2026-06-03",
    upgradedAt: new Date().toISOString(),
    b5CanonicalStatus: "CLOSED_DISPLAY_ONLY_NOTARY_SIGNED",
    b5ConflictResolutionRef: "05_REPORTS_AND_MANIFESTS/B5_CONFLICT_RESOLUTION.md",
    notarySignoffRef: "05_REPORTS_AND_MANIFESTS/B5_NOTARY_REVIEW_SIGNOFF.json",
    revalidationRulesRef: "05_REPORTS_AND_MANIFESTS/B5_RELEASE_REVALIDATION_RULES.md",
    sourceScan: v1.sourceScan,
    entryCount: entries.length,
    disposition: "ACCEPTED_RISK_DISPLAY_ONLY",
    policyGuards: {
      notaryGreenClaimed: false,
      executionUnlock: false,
      archGreenImplied: false
    },
    entries
  };

  const canonical = JSON.stringify(v2, null, 2);
  fs.writeFileSync(v2Path, `${canonical}\n`, "utf8");
  const attestationHash = crypto.createHash("sha256").update(canonical).digest("hex");
  console.log(
    JSON.stringify({ ok: true, outPath: v2Path, entryCount: entries.length, attestationHash }, null, 2)
  );
  return attestationHash;
}

main();
