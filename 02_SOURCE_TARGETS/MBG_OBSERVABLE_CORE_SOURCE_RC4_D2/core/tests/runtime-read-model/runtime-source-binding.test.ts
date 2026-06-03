import { strict as assert } from "node:assert";
import {
  buildRuntimeReadModel,
  buildRuntimeSnapshot,
  buildRc1ServiceDescriptor,
  clearRuntimeEngineReadModelSourceForTests,
  setRuntimeEngineReadModelSourceForTests
} from "../../core/ui-api/connected-readonly-core-api.js";
import {
  createRuntimeEngineReadState,
  createRuntimeReadModel,
  createStubRuntimeEngineState
} from "../../core/runtime-read-model/runtime-read-model-adapter.js";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";

function snapshotFrom(modelSource: unknown) {
  const model = createRuntimeReadModel(modelSource);
  return normalizeRuntimeSnapshot(model, { source: "runtime", deterministic: model.deterministic, readOnly: true });
}

try {
  setRuntimeEngineReadModelSourceForTests({}, "runtime-stub");
  assert.equal(buildRuntimeReadModel().runtimeSource, "runtime-stub");
  assert.equal(buildRc1ServiceDescriptor().runtimeSource, "runtime-stub");

  const stubModel = buildRuntimeReadModel();
  assert.notEqual(stubModel.runtimeSource, "runtime-engine", "stub must not be reported as runtime-engine");

  setRuntimeEngineReadModelSourceForTests(undefined, "runtime-unavailable");
  const unavailableSnapshot = buildRuntimeSnapshot();
  assert.equal((unavailableSnapshot as any).runtimeSource, "runtime-unavailable");
  assert.equal(unavailableSnapshot.trust.state, "UNCERTAIN");
  assert.equal(unavailableSnapshot.verdict.result, "prohibited");

  let mutated = false;
  const engine = {
    marker: "immutable",
    getSnapshot() {
      return {
        committedAt: "2026-05-10T00:00:00.000Z",
        system: { status: "healthy", reasons: [] },
        risk: { status: "clear", reasons: [] },
        exchangeTruth: { status: "fresh", reason: "test" },
        marketInput: { status: "validated", message: "ok" }
      };
    },
    getRuntimeView() {
      return { mode: "live-paper-readonly+persistent", stateDomains: { system: "healthy", bootstrap: "reconciled" } };
    },
    getMarketInputIntegrityView() {
      return { status: "ok", message: "market input valid" };
    },
    getPermissionLedgerView() {
      return { count: 1, records: [] };
    },
    getCausalityTraceView() {
      return [];
    },
    set dangerousMutation(_value: boolean) {
      mutated = true;
    }
  };
  const before = JSON.stringify(engine);
  const readState = createRuntimeEngineReadState(engine);
  const after = JSON.stringify(engine);
  assert.equal(after, before, "runtime read accessor must not mutate engine");
  assert.equal(mutated, false, "runtime read accessor must not set engine properties");
  assert.equal(readState.source, "runtime-engine");
  assert.equal(readState.readOnly, true);

  setRuntimeEngineReadModelSourceForTests(engine, "runtime-engine");
  const engineModel = buildRuntimeReadModel();
  assert.equal(engineModel.runtimeSource, "runtime-engine");
  assert.equal(buildRc1ServiceDescriptor().runtimeSource, "runtime-engine");

  const modelWithExecution = createRuntimeReadModel(createRuntimeEngineReadState({
    getSnapshot() {
      return {
        system: { status: "healthy", reasons: [] },
        exchangeTruth: { status: "unknown", reason: "unknown" },
        risk: { status: "clear", reasons: [] },
        marketInput: { status: "unknown" }
      };
    },
    getRuntimeView() { return {}; },
    execution: { placeOrder() { return true; } },
    placeOrder() { return true; }
  }));
  assert.equal(Object.prototype.hasOwnProperty.call(modelWithExecution, "execution"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(modelWithExecution, "placeOrder"), false);

  const allowedStubSnapshot = snapshotFrom(createStubRuntimeEngineState({
    runtimeSource: "runtime-stub",
    trust: { state: "TRUSTED", score: 1, reasons: [] },
    exchangeTruth: { status: "present", reason: "proof" },
    marketInputIntegrity: { status: "ok", message: "ok" },
    permissionLedger: { status: "ok", message: "ok" },
    kernelAuthority: { passed: 1, total: 1, failed: 0, status: "pass" },
    actionGate: { passed: 1, total: 1, failed: 0, status: "pass" },
    verdict: { result: "allowed", action: "observe_only", reason: "full proof" }
  }));
  assert.equal(allowedStubSnapshot.verdict.result, "prohibited", "runtime-stub must not be allowed in RC3.5 self-truth mode");

  console.log("runtime-source-binding: PASS");
} finally {
  clearRuntimeEngineReadModelSourceForTests();
}
