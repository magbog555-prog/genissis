import assert from "node:assert/strict";
import http from "node:http";
import {
  AdapterCompatibleComputationTraceResponseSchema,
  CoreIntegrityReportResponseSchema,
  CoreMarketInputStatusResponseSchema,
  CoreQuarantineResponseSchema,
  CoreRecoveryResponseSchema,
  CoreRevisionTimelineResponseSchema,
  CoreStatusResponseSchema,
  CoreTrustReportResponseSchema
} from "../../core/contracts/ui/index.js";
import {
  CONNECTED_READONLY_CORE_ENDPOINTS,
  buildConnectedReadonlyCoreApiResponse,
  canonicalApiStringify,
  connectedReadonlyCoreApi,
  createConnectedReadOnlyCoreApiApp
} from "../../core/ui-api/connected-readonly-core-api.js";
import { MOCK_CORE_SCENARIO_IDS } from "../../core/ui-api/mock-scenarios.js";

function assertDeterministic(endpoint: (typeof CONNECTED_READONLY_CORE_ENDPOINTS)[number], scenarioId: string) {
  const first = buildConnectedReadonlyCoreApiResponse(endpoint, { scenarioId });
  const second = buildConnectedReadonlyCoreApiResponse(endpoint, { scenarioId });
  assert.equal(canonicalApiStringify(first), canonicalApiStringify(second), `${endpoint} output must be deterministic`);
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = createConnectedReadOnlyCoreApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

const scenarioId = "MARKET_INPUT_GAP_DENY";

const status = connectedReadonlyCoreApi.getStatus({ scenarioId });
CoreStatusResponseSchema.parse(status);
assert.equal(status.endpoint, "/core/status");
assert.equal(status.machine.trustState, "RECOVERABLE");
assert.equal(status.scenarios.length, MOCK_CORE_SCENARIO_IDS.length);
assert.deepEqual(status.endpoints, CONNECTED_READONLY_CORE_ENDPOINTS);

const trace = connectedReadonlyCoreApi.getLatestTrace({ scenarioId });
AdapterCompatibleComputationTraceResponseSchema.parse(trace);
assert.equal(trace.scenarioId, scenarioId);
assert.equal(trace.machine.trustState, trace.pulse.trustState);
assert.equal(trace.event.eventId, trace.causality.eventId);
assert.equal(trace.adapterMeta.adapterCompatibility.apiAdapter, true);
assert.equal(trace.adapterMeta.adapterCompatibility.mockAdapter, true);
assert.equal(trace.adapterMeta.adapterCompatibility.readOnly, true);

const trust = connectedReadonlyCoreApi.getTrustReport({ scenarioId });
CoreTrustReportResponseSchema.parse(trust);
assert.equal(trust.trustState, "RECOVERABLE");
assert(trust.blockingReasons.includes("MARKET_INPUT_GAP"));

const integrity = connectedReadonlyCoreApi.getIntegrityReport({ scenarioId });
CoreIntegrityReportResponseSchema.parse(integrity);
assert.equal(integrity.status, "valid");
assert.equal(integrity.causality.transitionHash, trace.causality.transitionHash);

const timeline = connectedReadonlyCoreApi.getRevisionTimeline({ scenarioId: "DUPLICATE_EVENT_IDEMPOTENT" });
CoreRevisionTimelineResponseSchema.parse(timeline);
assert.equal(timeline.snapshotDiff.beforeRevision, timeline.snapshotDiff.afterRevision);
assert.equal(timeline.revisions.length, 2);

const market = connectedReadonlyCoreApi.getMarketInputStatus({ scenarioId });
CoreMarketInputStatusResponseSchema.parse(market);
assert.equal(market.marketInput.status, "gap_detected");

const recovery = connectedReadonlyCoreApi.getRecovery({ scenarioId });
CoreRecoveryResponseSchema.parse(recovery);
assert.equal(recovery.required, true);

const quarantine = connectedReadonlyCoreApi.getQuarantine({ scenarioId: "INVALID_EVENT_QUARANTINE" });
CoreQuarantineResponseSchema.parse(quarantine);
assert.equal(quarantine.count, 1);
assert.equal(quarantine.records[0]?.eventType, "market.input.rejected");

for (const endpoint of CONNECTED_READONLY_CORE_ENDPOINTS) {
  assertDeterministic(endpoint, scenarioId);
}

const healthyTrace = connectedReadonlyCoreApi.getLatestTrace({ scenarioId: "HEALTHY_TRUSTED_READY" });
assert.equal(healthyTrace.pulse.tradingAllowed, true);
assert.equal(healthyTrace.adapterMeta.generatedAtFromEvent, healthyTrace.createdAtFromEvent);

await withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/core/trace/latest?scenarioId=MARKET_INPUT_STALE_DENY`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-core-api-read-only"), "true");
  const dto = await response.json();
  AdapterCompatibleComputationTraceResponseSchema.parse(dto);
  assert.equal(dto.scenarioId, "MARKET_INPUT_STALE_DENY");
  assert.equal(dto.machine.trustState, dto.pulse.trustState);

  const adapterResponse = await fetch(`${baseUrl}/api/core/computation-trace/latest?scenarioId=FULL_READY_GATE_DECIDES`);
  assert.equal(adapterResponse.status, 200);
  const adapterDto = await adapterResponse.json();
  AdapterCompatibleComputationTraceResponseSchema.parse(adapterDto);
  assert.equal(adapterDto.machine.tradingAllowed, true);
  assert(Array.isArray(adapterDto.pipeline));
  assert(adapterDto.event);
});

console.log("Wave 10B connected read-only Core API scenarios passed");
