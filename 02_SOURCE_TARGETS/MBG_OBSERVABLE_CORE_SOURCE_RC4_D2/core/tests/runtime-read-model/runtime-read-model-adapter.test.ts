import { strict as assert } from "node:assert";
import {
  createRuntimeReadModel,
  createStubRuntimeEngineState
} from "../../core/runtime-read-model/runtime-read-model-adapter.js";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";

function snapshotFrom(engine: unknown) {
  const readModel = createRuntimeReadModel(engine);
  return normalizeRuntimeSnapshot(readModel, {
    source: "runtime",
    deterministic: readModel.deterministic,
    readOnly: true
  });
}

{
  const snapshot = snapshotFrom(undefined);
  assert.equal(snapshot.meta.source, "runtime");
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("exchangeTruth"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ exchangeTruth: { status: "absent", reason: "no market truth" } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("exchangeTruth"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ marketInputIntegrity: { status: "unknown", message: "missing" } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("marketInputIntegrity"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ permissionLedger: { status: "unknown", message: "missing" } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("permissionLedger"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ kernelAuthority: { passed: 0, total: 1, failed: 1, status: "fail" } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("kernelAuthority"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ actionGate: { passed: 0, total: 1, failed: 1, status: "fail" } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("actionGate"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({ trust: { state: "UNCERTAIN", score: null, reasons: [] } }));
  assert.equal(snapshot.verdict.result, "prohibited");
  assert.ok(snapshot.verdict.blockedBy.includes("trustState"));
}

{
  const snapshot = snapshotFrom(createStubRuntimeEngineState({
    deterministic: false,
    runtimeSource: "runtime-engine",
    trust: { state: "TRUSTED", score: 1, reasons: [] },
    exchangeTruth: { status: "present", reason: "test proof" },
    marketInputIntegrity: { status: "ok", message: "market input valid" },
    permissionLedger: { status: "ok", message: "permission ok" },
    kernelAuthority: { passed: 2, total: 2, failed: 0, status: "pass" },
    actionGate: { passed: 2, total: 2, failed: 0, status: "pass" },
    tradingAllowed: true,
    verdict: { result: "allowed", action: "observe_only", reason: "full proof" }
  }));
  assert.equal(snapshot.trust.state, "TRUSTED");
  assert.equal(snapshot.verdict.result, "allowed");
}

{
  const engine = createStubRuntimeEngineState();
  const before = JSON.stringify(engine);
  createRuntimeReadModel(engine);
  const after = JSON.stringify(engine);
  assert.equal(after, before);
}

{
  const model = createRuntimeReadModel({ execution: { placeOrder() { return true; } } });
  assert.equal(Object.prototype.hasOwnProperty.call(model, "execution"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(model, "placeOrder"), false);
}

console.log("runtime-read-model-adapter: PASS");
