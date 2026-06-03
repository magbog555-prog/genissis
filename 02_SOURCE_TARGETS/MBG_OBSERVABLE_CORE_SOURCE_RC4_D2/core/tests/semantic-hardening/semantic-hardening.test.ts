
import assert from "node:assert/strict";
import { normalizeRuntimeSnapshot } from "../../core/contracts/normalize-runtime-snapshot.js";

const baseProof = {
  source: "runtime",
  runtimeSource: "runtime-engine",
  trust: { state: "UNCERTAIN", reasons: ["exchange_truth_unknown"] },
  kernelAuthority: { passed: 0, total: 0, failed: 0, status: "unknown" },
  actionGate: { passed: 0, total: 0, failed: 0, status: "unknown" },
  verdict: { result: "allowed", action: "PLACE_ORDER", blockedBy: [] },
  exchangeTruth: { status: "unknown", reason: "missing proof" },
  permissionLedger: { status: "unknown", message: "missing permission" },
  marketInputIntegrity: {
    exchangeTruthPresent: true,
    exchangeTruthStatus: "unknown",
    exchangeTruthProof: "missing",
    status: "fresh",
    ageMs: 120,
    thresholdMs: 5000
  },
  provenance: {
    adapterMode: "mock",
    sourceMode: "simulated",
    providerFormat: "binance-like",
    localProvenanceValid: true,
    exchangeProofValid: false,
    exchangeTruthStatus: "unknown",
    payloadHash: "a12bc34d",
    hashType: "demo",
    hashStrength: "non_cryptographic_demo"
  },
  event: { providerFormat: "binance-like", payloadHash: "a12bc34d" },
  adapterMeta: { source: "core-mock-scenario-api" },
  failureVisualization: {
    dto: "FailureMatrixDTO",
    scenario: "MARKET_INPUT_STALE_DENY",
    renderGuardTriggered: false,
    renderFallbackActive: false,
    adapterMode: "mock",
    dataMode: "simulated",
    finalSafetyState: "prohibited",
    executionSurface: "closed",
    severity: "warning",
    blocks: [
      { block: "market", state: "stale" },
      { block: "provenance", state: "valid" },
      { block: "replay", state: "matched" },
      { block: "gate", state: "deny" }
    ]
  }
};

const snapshot = normalizeRuntimeSnapshot(baseProof, { source: "runtime", readOnly: true, deterministic: true });

assert.equal(snapshot.meta.schemaVersion, "runtime-snapshot/v1");
assert.equal(snapshot.verdict.result, "prohibited", "raw allowed must be prohibited without proof");
assert.equal(snapshot.semantic?.exchangeTruth.status, "unknown");
assert.equal(snapshot.semantic?.exchangeTruth.proof, "missing");
assert.equal(snapshot.semantic?.adapter.adapterMode, "mock");
assert.equal(snapshot.semantic?.adapter.sourceMode, "simulated");
assert.equal(snapshot.semantic?.adapter.providerFormat, "binance-like");
assert.equal(snapshot.semantic?.adapter.liveExchangeConnected, false);
assert.equal(snapshot.semantic?.provenance.localProvenanceValid, true);
assert.equal(snapshot.semantic?.provenance.exchangeProofValid, false);
assert.equal(snapshot.semantic?.provenance.hashType, "demo");
assert.equal(snapshot.semantic?.provenance.hashStrength, "non_cryptographic_demo");
assert.equal(snapshot.semantic?.marketFreshness.status, "fresh");
assert.equal(snapshot.semantic?.recovery.systemRecoveryRequired, false);
assert.equal(snapshot.semantic?.recovery.trustRecoverySuggested, true);
assert.equal(snapshot.semantic?.failureMatrix.executionSurface, "closed");
assert.equal(snapshot.semantic?.failureMatrix.renderGuardTriggered, false);
assert.equal(snapshot.semantic?.failureMatrix.renderFallbackActive, false);
assert.equal(snapshot.semantic?.failureMatrix.adapterMode, "mock");
assert.equal(snapshot.semantic?.failureMatrix.dataMode, "simulated");
assert.equal(snapshot.semantic?.failureMatrix.finalSafetyState, "prohibited");

const circular: any = { ok: true };
circular.self = circular;
const circularSnapshot = normalizeRuntimeSnapshot(circular, { source: "runtime", includeRaw: false });
assert.equal("raw" in circularSnapshot, false);
assert.equal(circularSnapshot.rawSummary?.omittedForUiSafety, true);

console.log("semantic hardening invariants: PASS");
