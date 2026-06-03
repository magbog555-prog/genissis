import { strict as assert } from "node:assert";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";

const validRc1Dto = {
  adapterMeta: {
    scenarioId: "MARKET_INPUT_GAP_DENY",
    adapterCompatibility: {
      readOnly: true,
      deterministic: true
    }
  },
  generatedAt: "2026-05-09T12:00:00.000Z",
  pulse: {
    status: "BLOCKED",
    trustState: "UNCERTAIN",
    runtimeMode: "OBSERVE_ONLY",
    tradingAllowed: false,
    blockingReasons: ["MARKET_INPUT_GAP"]
  },
  machine: {
    status: "BLOCKED",
    runtimeMode: "OBSERVE_ONLY"
  },
  gateVerdict: {
    result: "deny",
    action: "deny",
    reason: "market input gap"
  },
  rules: {
    kernelAuthority: [
      { ruleId: "KA-01", status: "pass", condition: "bootstrap.reconciled == true", actual: "true", effect: "continue" },
      { ruleId: "KA-07", status: "fail", condition: "exchangeTruth.status == fresh", actual: "unknown", effect: "block" }
    ],
    actionGate: [
      { ruleId: "AG-01", status: "pass", condition: "request.received == true", actual: "true", effect: "continue" },
      { ruleId: "AG-03", status: "fail", condition: "trustState == TRUSTED", actual: "UNCERTAIN", effect: "deny" }
    ]
  },
  pipeline: [{ id: "01", label: "Event validation", status: "passed", message: "ok" }],
  decisionTrace: [{ id: "01", label: "ActionGate verdict", status: "blocked", message: "denied" }]
};

function checkSnapshotShape(snapshot: ReturnType<typeof normalizeRuntimeSnapshot>) {
  assert.equal(snapshot.meta.schemaVersion, "runtime-snapshot/v1");
  assert.equal(typeof snapshot.meta.generatedAt, "string");
  assert.equal(typeof snapshot.machine.status, "string");
  assert.ok(snapshot.trust);
  assert.ok(snapshot.verdict);
  assert.ok(snapshot.kernelAuthority);
  assert.ok(snapshot.actionGate);
  assert.ok(snapshot.panels);
  assert.ok(Array.isArray(snapshot.panels.rules));
  assert.ok(Array.isArray(snapshot.panels.pipeline));
  assert.ok(Array.isArray(snapshot.panels.decisionTrace));
}

{
  const snapshot = normalizeRuntimeSnapshot(validRc1Dto, { source: "core-readonly" });
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.meta.readOnly, true);
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.equal(snapshot.kernelAuthority.total, 2);
  assert.equal(snapshot.kernelAuthority.failed, 1);
  assert.equal(snapshot.actionGate.total, 2);
}

{
  const dto = { ...validRc1Dto, rules: { actionGate: validRc1Dto.rules.actionGate } };
  const snapshot = normalizeRuntimeSnapshot(dto);
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.kernelAuthority.status, "unknown");
  assert.equal(snapshot.kernelAuthority.total, 0);
}

{
  const dto = { ...validRc1Dto, rules: { kernelAuthority: validRc1Dto.rules.kernelAuthority } };
  const snapshot = normalizeRuntimeSnapshot(dto);
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.actionGate.status, "unknown");
  assert.equal(snapshot.actionGate.total, 0);
}

{
  const snapshot = normalizeRuntimeSnapshot({});
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.trust.state, "UNCERTAIN");
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer"));
}

{
  const snapshot = normalizeRuntimeSnapshot(null);
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.trust.state, "UNCERTAIN");
  assert.equal(snapshot.verdict.result, "prohibited");
}

{
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const snapshot = normalizeRuntimeSnapshot(circular);
  checkSnapshotShape(snapshot);
  assert.equal(snapshot.verdict.result, "prohibited");
}

{
  const snapshot = normalizeRuntimeSnapshot(validRc1Dto, { scenarioId: "SCENARIO_FROM_OPTIONS" });
  assert.equal(snapshot.meta.scenarioId, "SCENARIO_FROM_OPTIONS");
}

{
  const snapshot = normalizeRuntimeSnapshot(validRc1Dto, { source: "scenario" });
  assert.equal(snapshot.meta.source, "scenario");
}


const allowedBaseDto = {
  adapterMeta: {
    scenarioId: "HEALTHY_TRUSTED_READY",
    adapterCompatibility: {
      readOnly: true,
      deterministic: true
    }
  },
  pulse: {
    status: "READY",
    trustState: "TRUSTED",
    runtimeMode: "OBSERVE_ONLY",
    tradingAllowed: true
  },
  machine: {
    status: "READY",
    runtimeMode: "OBSERVE_ONLY"
  },
  gateVerdict: {
    result: "allowed",
    action: "place_order",
    reason: "all proof present"
  },
  rules: {
    kernelAuthority: [
      { ruleId: "KA-01", status: "pass", condition: "bootstrap.reconciled == true", actual: "true", effect: "continue" },
      { ruleId: "KA-02", status: "pass", condition: "healthTruth.complete == true", actual: "true", effect: "continue" }
    ],
    actionGate: [
      { ruleId: "AG-01", status: "pass", condition: "request.received == true", actual: "true", effect: "continue" },
      { ruleId: "AG-03", status: "pass", condition: "trustState == TRUSTED", actual: "TRUSTED", effect: "allow" }
    ]
  }
};

{
  const dto = { ...allowedBaseDto, rules: { actionGate: allowedBaseDto.rules.actionGate } };
  const snapshot = normalizeRuntimeSnapshot(dto);
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.equal(snapshot.verdict.reason, "allowed_input_without_required_trust_proof");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer_missing_proof"));
  assert.equal(snapshot.kernelAuthority.status, "unknown");
}

{
  const dto = { ...allowedBaseDto, rules: { kernelAuthority: allowedBaseDto.rules.kernelAuthority } };
  const snapshot = normalizeRuntimeSnapshot(dto);
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.equal(snapshot.verdict.reason, "allowed_input_without_required_trust_proof");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer_missing_proof"));
  assert.equal(snapshot.actionGate.status, "unknown");
}

{
  const dto = {
    ...allowedBaseDto,
    pulse: { ...allowedBaseDto.pulse, trustState: "UNCERTAIN" }
  };
  const snapshot = normalizeRuntimeSnapshot(dto);
  assert.equal(snapshot.trust.state, "UNCERTAIN");
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer_missing_proof"));
}

{
  const dto = {
    ...allowedBaseDto,
    rules: {
      ...allowedBaseDto.rules,
      kernelAuthority: [
        ...allowedBaseDto.rules.kernelAuthority,
        { ruleId: "KA-07", status: "fail", condition: "exchangeTruth.status == fresh", actual: "unknown", effect: "block" }
      ]
    }
  };
  const snapshot = normalizeRuntimeSnapshot(dto);
  assert.equal(snapshot.kernelAuthority.failed, 1);
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer_missing_proof"));
}

{
  const dto = {
    ...allowedBaseDto,
    rules: {
      ...allowedBaseDto.rules,
      actionGate: [
        ...allowedBaseDto.rules.actionGate,
        { ruleId: "AG-03", status: "fail", condition: "trustState == TRUSTED", actual: "UNCERTAIN", effect: "deny" }
      ]
    }
  };
  const snapshot = normalizeRuntimeSnapshot(dto);
  assert.equal(snapshot.actionGate.failed, 1);
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("normalizer_missing_proof"));
}

{
  const snapshot = normalizeRuntimeSnapshot(allowedBaseDto);
  assert.equal(snapshot.trust.state, "TRUSTED");
  assert.equal(snapshot.kernelAuthority.status, "pass");
  assert.equal(snapshot.actionGate.status, "pass");
  assert.equal(snapshot.verdict.result, "allowed");
  assert.deepEqual(snapshot.verdict.blockedBy, []);
}

console.log("normalize-runtime-snapshot: PASS");
