import assert from "node:assert/strict";
import {
  ComputationTraceDTOSchema,
  MachinePulseDTOSchema,
  canonicalDtoStringify,
  validateComputationTraceDTO
} from "../../core/contracts/ui/index.js";
import {
  MOCK_COMPUTATION_TRACE_DTOS,
  MOCK_CORE_SCENARIO_ID,
  MOCK_CORE_SCENARIO_IDS,
  buildAdapterSafeCoreUiResponse,
  buildMockComputationTraceDTO
} from "../../core/ui-api/mock-scenarios.js";

function assertNoUiStateOrLayout(value: unknown): void {
  const serialized = JSON.stringify(value);
  const forbidden = ["theme", "layout", "component", "button", "modal", "css", "color"];
  for (const token of forbidden) {
    assert.equal(
      serialized.includes(`"${token}"`),
      false,
      `Core DTO must not encode UI layout/control token: ${token}`
    );
  }
}

for (const dto of MOCK_COMPUTATION_TRACE_DTOS) {
  assert.doesNotThrow(() => ComputationTraceDTOSchema.parse(dto), `scenario ${dto.scenarioId} must validate`);
  assert.doesNotThrow(() => MachinePulseDTOSchema.parse(dto.pulse), `pulse ${dto.scenarioId} must validate`);
  assert.equal(dto.dtoVersion, "core-ui-dto-v1");
  assert.equal(dto.pulse.dtoVersion, "core-ui-dto-v1");
  assertNoUiStateOrLayout(dto);
}

assert.deepEqual(
  MOCK_COMPUTATION_TRACE_DTOS.map((dto) => dto.scenarioId).sort(),
  [...MOCK_CORE_SCENARIO_IDS].sort(),
  "all required mock scenarios must have payloads"
);

const duplicate = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.DUPLICATE_EVENT_IDEMPOTENT);
assert.equal(duplicate.snapshotDiff.beforeRevision, duplicate.snapshotDiff.afterRevision);
assert.equal(duplicate.snapshotDiff.changedPaths.length, 0);
assert.equal(duplicate.gateVerdict?.blockingReasons.includes("DUPLICATE_EVENT"), true);

const healthy = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.HEALTHY_TRUSTED_READY);
assert.equal(healthy.pulse.trustState, "TRUSTED");
assert.equal(healthy.pulse.tradingAllowed, true);
assert.equal(healthy.gateVerdict?.allowed, true);

const validObservationNoPermission = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.VALID_OBSERVATION_NO_PERMISSION);
assert.equal(validObservationNoPermission.marketInputIntegrity?.status, "valid");
assert.equal(validObservationNoPermission.gateVerdict?.allowed, false);

const missingProvenance = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.MISSING_PROVENANCE_DENY);
assert.equal(missingProvenance.marketInputIntegrity?.status, "unverifiable");
assert.equal(missingProvenance.pulse.blockingReasons.includes("PROVENANCE_MISSING"), true);

const quarantine = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.INVALID_EVENT_QUARANTINE);
assert.equal(quarantine.quarantineRecords.length, 1);

const adapterResponse = buildAdapterSafeCoreUiResponse(MOCK_CORE_SCENARIO_ID.MARKET_INPUT_STALE_DENY);
assert.equal(adapterResponse.machinePulse.trustState, "RECOVERABLE");
assert.equal(adapterResponse.trace.marketInputIntegrity?.status, "stale");
assertNoUiStateOrLayout(adapterResponse);

const first = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.SNAPSHOT_HASH_MISMATCH);
const second = buildMockComputationTraceDTO(MOCK_CORE_SCENARIO_ID.SNAPSHOT_HASH_MISMATCH);
assert.equal(canonicalDtoStringify(first), canonicalDtoStringify(second), "mock DTO must be deterministic");
assert.equal(
  canonicalDtoStringify(validateComputationTraceDTO(JSON.parse(JSON.stringify(first)))),
  canonicalDtoStringify(first)
);

console.log("Wave 10A ComputationTrace DTO scenarios passed");
