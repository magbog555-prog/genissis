
import assert from "node:assert/strict";
import { buildCoreOverviewDTO } from "../../core/ui-api/connected-readonly-core-api.js";

const overview = buildCoreOverviewDTO();

assert.equal(overview.dto, "CoreOverviewDTO");
assert.equal(overview.overallState, "SAFE_OBSERVE_ONLY");
assert.equal(overview.mode, "OBSERVE_ONLY");
assert.equal(overview.trustState, "UNCERTAIN");
assert.equal(overview.actionVerdict, "prohibited");
assert.equal(overview.executionSurface, "closed");
assert.equal(overview.operatorRule, "NO_PROOF_NO_ALLOW");

const required = [
  "pulse",
  "activeEvent",
  "pipeline",
  "rawTrace",
  "computationSteps",
  "formulaInspector",
  "kernelRules",
  "snapshotDiff",
  "miniVerdict",
  "verdictTrace",
  "revisionTimeline",
  "marketIntegrity",
  "provenance",
  "recovery",
  "replayPanel",
  "failureMatrix",
  "liveStream",
  "executionSurface"
];

for (const id of required) {
  assert(overview.blocks.some((block) => block.id === id), `missing overview block: ${id}`);
}

console.log("RC4 core overview contracts: PASS");
