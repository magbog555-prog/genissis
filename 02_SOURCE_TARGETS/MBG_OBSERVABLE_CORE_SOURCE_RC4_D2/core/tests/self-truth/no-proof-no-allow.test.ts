import { strict as assert } from "node:assert";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";
import {
  createRuntimeReadModel,
  createStubRuntimeEngineState
} from "../../core/runtime-read-model/runtime-read-model-adapter.js";

function snapshotFrom(overrides: Record<string, unknown>) {
  const model = createRuntimeReadModel(createStubRuntimeEngineState({
    runtimeSource: "runtime-engine",
    trust: { state: "TRUSTED", score: 1, reasons: [] },
    kernelAuthority: { passed: 1, total: 1, failed: 0, status: "pass" },
    actionGate: { passed: 1, total: 1, failed: 0, status: "pass" },
    exchangeTruth: { status: "present", reason: "present" },
    marketInputIntegrity: { status: "ok", message: "ok" },
    permissionLedger: { status: "ok", message: "ok" },
    verdict: { result: "allowed", action: "observe_only", reason: "raw allowed" },
    ...overrides
  }));
  return normalizeRuntimeSnapshot(model, { source: "runtime", deterministic: model.deterministic, readOnly: true });
}

function expectProhibited(snapshot: ReturnType<typeof snapshotFrom>, label: string) {
  assert.equal(snapshot.verdict.result, "prohibited", label);
}

expectProhibited(snapshotFrom({ marketInputIntegrity: undefined }), "raw allowed but no marketInput must prohibit");
expectProhibited(snapshotFrom({ exchangeTruth: { status: "absent", reason: "missing" } }), "raw allowed but no exchangeTruth must prohibit");
expectProhibited(snapshotFrom({ permissionLedger: undefined }), "raw allowed but no permissionLedger must prohibit");
expectProhibited(snapshotFrom({ runtimeSource: "runtime-unavailable" }), "raw allowed but runtimeSource unknown/unavailable must prohibit");
expectProhibited(snapshotFrom({ kernelAuthority: undefined }), "raw allowed but kernelAuthority unknown must prohibit");
expectProhibited(snapshotFrom({ actionGate: undefined }), "raw allowed but actionGate unknown must prohibit");
expectProhibited(snapshotFrom({
  exchangeTruth: undefined,
  marketInputIntegrity: undefined,
  permissionLedger: undefined,
  verdict: { result: "allowed", action: "execute", reason: "raw allowed without execution proof" }
}), "raw allowed but readOnly/execution unavailable must prohibit");

const fullProof = snapshotFrom({});
assert.equal(fullProof.verdict.result, "allowed", "full proof may still be allowed as a normalized verdict only");

console.log("no-proof-no-allow: PASS");
