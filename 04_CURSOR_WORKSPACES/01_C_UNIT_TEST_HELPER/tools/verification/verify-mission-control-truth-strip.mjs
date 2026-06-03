#!/usr/bin/env node
/**
 * verify-mission-control-truth-strip — Sprint 7 E1: strip matches canonical reports, no fake green.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMissionControlTruthStrip } from "../lab/build-mission-control-truth-strip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");
const outPath = path.join(workspaceRoot, "reports/mission-control-truth-strip.verify.json");

const violations = [];

function expectEqual(label, actual, expected) {
  if (actual !== expected) violations.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function main() {
  const { strip, missing, board, profitops } = buildMissionControlTruthStrip();

  if (missing.length) {
    for (const m of missing) violations.push(`MISSING_CANONICAL:${m}`);
  }

  const program = board?.program ?? {};
  const canonicalSampleCount = profitops?.metrics?.sampleCount;

  expectEqual("notaryGreen", strip.notaryGreen, program.notaryGreen);
  expectEqual("archGreenApproved", strip.archGreenApproved, program.archGreenApproved === true || program.archGreenApproved === "YES");
  expectEqual("executionAllowed", strip.executionAllowed, program.executionAllowed === true);
  expectEqual("profitops.sampleCount", strip.profitops?.sampleCount, canonicalSampleCount);
  expectEqual(
    "b5.status",
    strip.b5?.status,
    program.audit3BlockersB5V2 ?? program.audit3BlockersB5
  );
  expectEqual("b6.status", strip.b6?.status, program.audit3BlockersB6);

  if (strip.notaryGreen === true || strip.notaryGreen === "YES") {
    violations.push("FAKE_GREEN:notaryGreen");
  }
  if (strip.archGreenApproved === true) violations.push("FAKE_GREEN:archGreenApproved");
  if (strip.executionAllowed === true) violations.push("FAKE_GREEN:executionAllowed");
  if (profitops?.notaryGreenClaimed === true) violations.push("FAKE_GREEN:profitops.notaryGreenClaimed");
  if (profitops?.executionAllowed === true) violations.push("FAKE_GREEN:profitops.executionAllowed");

  const pass = violations.length === 0;
  const report = {
    schema: "genesis.mission-control-truth-strip.verify.v1",
    generatedAt: new Date().toISOString(),
    pass,
    violations,
    expected: {
      notaryGreen: program.notaryGreen,
      archGreenApproved: program.archGreenApproved === true || program.archGreenApproved === "YES",
      executionAllowed: program.executionAllowed === true,
      profitopsSampleCount: canonicalSampleCount,
      b5Status: program.audit3BlockersB5V2 ?? program.audit3BlockersB5,
      b6Status: program.audit3BlockersB6
    },
    actual: strip
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: pass, outPath, violationCount: violations.length, violations }, null, 2));
  process.exit(pass ? 0 : 1);
}

main();
