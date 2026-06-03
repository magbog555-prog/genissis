import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";
import {
  createRuntimeReadModel,
  createStubRuntimeEngineState
} from "../../core/runtime-read-model/runtime-read-model-adapter.js";
import {
  createConnectedReadOnlyCoreApiApp,
  clearRuntimeEngineReadModelSourceForTests
} from "../../core/ui-api/connected-readonly-core-api.js";

function runtimeSnapshotFrom(input: unknown) {
  const model = createRuntimeReadModel(input);
  return normalizeRuntimeSnapshot(model, {
    source: "runtime",
    deterministic: model.deterministic,
    readOnly: true
  });
}

function assertProhibited(snapshot: ReturnType<typeof runtimeSnapshotFrom>, reason: string) {
  assert.equal(snapshot.verdict.result, "prohibited", reason);
}

{
  const snapshot = runtimeSnapshotFrom(createStubRuntimeEngineState({ marketInputIntegrity: undefined }));
  assertProhibited(snapshot, "no marketInput must prohibit");
  assert.ok(snapshot.verdict.blockedBy.includes("marketInputIntegrity"));
}

{
  const snapshot = runtimeSnapshotFrom(createStubRuntimeEngineState({ exchangeTruth: { status: "absent", reason: "no exchange truth" } }));
  assertProhibited(snapshot, "no exchangeTruth must prohibit");
  assert.ok(snapshot.verdict.blockedBy.includes("exchangeTruth"));
}

{
  const snapshot = runtimeSnapshotFrom(undefined);
  assertProhibited(snapshot, "runtime unavailable must prohibit");
  assert.equal(snapshot.trust.state, "UNCERTAIN");
}

{
  const model = createRuntimeReadModel(createStubRuntimeEngineState());
  assert.equal(model.runtimeSource, "runtime-stub");
  assert.notEqual(model.runtimeSource, "runtime-engine");
  const snapshot = normalizeRuntimeSnapshot(model, { source: "runtime", deterministic: model.deterministic, readOnly: true });
  assertProhibited(snapshot, "runtime stub without full proof must prohibit");
}

{
  const snapshot = runtimeSnapshotFrom(createStubRuntimeEngineState({ kernelAuthority: undefined }));
  assertProhibited(snapshot, "missing kernelAuthority must prohibit");
  assert.equal(snapshot.kernelAuthority.status, "unknown");
  assert.ok(snapshot.verdict.blockedBy.includes("kernelAuthority"));
}

{
  const snapshot = runtimeSnapshotFrom(createStubRuntimeEngineState({ actionGate: undefined }));
  assertProhibited(snapshot, "missing actionGate must prohibit");
  assert.equal(snapshot.actionGate.status, "unknown");
  assert.ok(snapshot.verdict.blockedBy.includes("actionGate"));
}

{
  const snapshot = runtimeSnapshotFrom(createStubRuntimeEngineState({ permissionLedger: undefined }));
  assertProhibited(snapshot, "missing permissionLedger must prohibit");
  assert.ok(snapshot.verdict.blockedBy.includes("permissionLedger"));
}

for (const malformed of [null, {}, { verdict: { result: "allowed" } }, { trust: "bad-shape" }]) {
  const snapshot = normalizeRuntimeSnapshot(malformed, { source: "runtime", readOnly: true, deterministic: false });
  assertProhibited(snapshot, "malformed/null/empty snapshot must prohibit");
}

{
  const app = createConnectedReadOnlyCoreApiApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No server address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function postClosed(path: string) {
    const res = await fetch(`${baseUrl}${path}`, { method: "POST" });
    assert.notEqual(res.status, 200, `${path} must not return 200`);
    assert.ok([404, 405].includes(res.status), `${path} should be 404/405, got ${res.status}`);
  }

  try {
    const auditRes = await fetch(`${baseUrl}/api/core/self-truth/audit`);
    assert.equal(auditRes.status, 200);
    const audit = await auditRes.json() as any;
    assert.equal(audit.ok, true);
    assert.equal(audit.audit, "core-self-truth");
    assert.equal(audit.readOnly, true);
    assert.equal(audit.result, "pass");
    assert.equal(audit.selfTruthCleanMode, true);
    assert.equal(audit.persistence, "ignored-for-audit");
    assert.equal(audit.invariants.missingExchangeTruthBlocks, "pass");
    assert.equal(audit.invariants.stubNotReportedAsEngine, "pass");

    await postClosed("/order");
    await postClosed("/market/tick");
    await postClosed("/trade/place");
    await postClosed("/execution/testnet/place-guarded");
    await postClosed("/execution/foo");
    await postClosed("/api/core/runtime/snapshot");
    await postClosed("/api/core/self-truth/audit");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

clearRuntimeEngineReadModelSourceForTests();
console.log("core-self-truth: PASS");
