import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canonicalDtoStringify,
  validateComputationTraceDTO,
  type ComputationTraceDTO
} from "../../core/contracts/ui/index.js";
import {
  getObservableCoreMachineScenarios,
  renderObservableCoreScenario,
  getObservableCoreMachineDto,
  getReplayProof
} from "../../core/ui-api/observable-core-machine.js";
import {
  MOCK_CORE_SCENARIO_IDS,
  buildAdapterSafeCoreUiResponse,
  type MockCoreScenarioId
} from "../../core/ui-api/mock-scenarios.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

type ScenarioResult = {
  name: string;
  ok: boolean;
  details?: string;
};

type VisualVerdict = {
  scenarioId: string;
  trustState: string;
  runtimeMode: string;
  tradingAllowed: boolean;
  blocked: boolean;
  blockingReasons: string[];
  gateAllowed?: boolean;
  gateActionType?: string;
  gateReasons: string[];
  marketInputStatus?: string;
  snapshotBeforeRevision: number;
  snapshotAfterRevision: number;
  changedPaths: string[];
  quarantineCount: number;
  recoveryActions: string[];
  ledgerDecisions: string[];
  causality: {
    eventId?: string;
    transitionId?: string;
    eventHash?: string;
    transitionHash?: string;
    snapshotHash?: string;
  };
};

const REQUIRED_SCENARIO_COUNT = 15;
const REQUIRED_SCENARIOS = [...MOCK_CORE_SCENARIO_IDS].sort();

function asTrace(value: unknown): ComputationTraceDTO {
  return validateComputationTraceDTO(value);
}

function renderTrace(id: MockCoreScenarioId): ComputationTraceDTO {
  return asTrace(renderObservableCoreScenario(id));
}

function renderTraceViaDtoApi(id: MockCoreScenarioId): ComputationTraceDTO {
  return asTrace(getObservableCoreMachineDto({ scenarioId: id }));
}

function visualVerdict(trace: ComputationTraceDTO): VisualVerdict {
  return {
    scenarioId: trace.scenarioId,
    trustState: trace.pulse.trustState,
    runtimeMode: trace.pulse.runtimeMode,
    tradingAllowed: trace.pulse.tradingAllowed,
    blocked: trace.pulse.blocked,
    blockingReasons: [...trace.pulse.blockingReasons].sort(),
    gateAllowed: trace.gateVerdict?.allowed,
    gateActionType: trace.gateVerdict?.actionType,
    gateReasons: [...(trace.gateVerdict?.blockingReasons ?? [])].sort(),
    marketInputStatus: trace.marketInputIntegrity?.status,
    snapshotBeforeRevision: trace.snapshotDiff.beforeRevision,
    snapshotAfterRevision: trace.snapshotDiff.afterRevision,
    changedPaths: [...trace.snapshotDiff.changedPaths].sort(),
    quarantineCount: trace.quarantineRecords.length,
    recoveryActions: trace.recoveryHints.map((hint) => hint.actionType).sort(),
    ledgerDecisions: trace.ledgerRecords.map((record) => record.decision).sort(),
    causality: {
      eventId: trace.causality.eventId,
      transitionId: trace.causality.transitionId,
      eventHash: trace.causality.eventHash,
      transitionHash: trace.causality.transitionHash,
      snapshotHash: trace.causality.snapshotHash
    }
  };
}

function canonicalVisualVerdict(trace: ComputationTraceDTO): string {
  return canonicalDtoStringify(visualVerdict(trace));
}

function assertNoFunctions(value: unknown, pathLabel = "dto"): void {
  if (typeof value === "function") {
    throw new Error(`${pathLabel} contains a function`);
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFunctions(item, `${pathLabel}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertNoFunctions(child, `${pathLabel}.${key}`);
  }
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (!value || typeof value !== "object") return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.push(key);
    collectKeys(child, keys);
  }
  return keys;
}

function collectStringValues(value: unknown, strings: string[] = [], currentKey = ""): string[] {
  if (typeof value === "string") {
    if (!["title", "description", "summary", "notes", "reason"].includes(currentKey)) {
      strings.push(value);
    }
    return strings;
  }
  if (!value || typeof value !== "object") return strings;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, strings, currentKey));
    return strings;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    collectStringValues(child, strings, key);
  }
  return strings;
}

function assertNoAuthorityLeak(value: unknown): void {
  const keys = collectKeys(value).map((key) => key.toLowerCase());
  const suspiciousKeys = keys.filter((key) =>
    [
      "onclick",
      "onsubmit",
      "onbuy",
      "onsell",
      "execute",
      "executionendpoint",
      "websocket",
      "socket",
      "wsurl",
      "apikey",
      "apisecret",
      "secretkey",
      "privatekey",
      "livemode",
      "orderplacement"
    ].includes(key)
  );

  assert.deepEqual(suspiciousKeys, [], `DTO exposes UI/execution/websocket authority keys: ${suspiciousKeys.join(", ")}`);

  const strings = collectStringValues(value).map((text) => text.toLowerCase());
  const dangerousValues = strings.filter((text) =>
    text.includes("ws://") ||
    text.includes("wss://") ||
    text.includes("binance websocket") ||
    text.includes("api_secret") ||
    text.includes("api key") ||
    text.includes("private key") ||
    text === "buy" ||
    text === "sell" ||
    text === "submit_order" ||
    text === "execute_order" ||
    text === "live_trading"
  );

  assert.deepEqual(dangerousValues, [], `DTO exposes live/execution authority values: ${dangerousValues.join(", ")}`);
}

function snapshotStable(): string {
  const snapshot = runtimeEngine.getSnapshot();
  return canonicalDtoStringify({
    revision: snapshot.revision,
    market: snapshot.market,
    position: snapshot.position,
    order: snapshot.order,
    risk: snapshot.risk,
    system: snapshot.system,
    exchangeTruth: snapshot.exchangeTruth,
    marketInput: snapshot.marketInput
  });
}

function allRenderedTraces(): ComputationTraceDTO[] {
  return MOCK_CORE_SCENARIO_IDS.map((id) => renderTrace(id));
}

function scenarioIdsFromCatalog(): string[] {
  return getObservableCoreMachineScenarios().map((item) => item.scenarioId).sort();
}

function assertTraceHasUiVisibleCausality(trace: ComputationTraceDTO): void {
  assert.ok(trace.causality.eventId, `${trace.scenarioId} missing causality.eventId`);
  assert.ok(trace.causality.transitionId, `${trace.scenarioId} missing causality.transitionId`);
  assert.ok(trace.causality.eventHash, `${trace.scenarioId} missing causality.eventHash`);
  assert.ok(trace.causality.transitionHash, `${trace.scenarioId} missing causality.transitionHash`);
  assert.ok(trace.causality.snapshotHash, `${trace.scenarioId} missing causality.snapshotHash`);
}

function assertDeniedTraceHasReasoning(trace: ComputationTraceDTO): void {
  if (trace.gateVerdict?.allowed === false || trace.pulse.blocked) {
    const reasons = new Set([
      ...trace.pulse.blockingReasons,
      ...(trace.gateVerdict?.blockingReasons ?? []),
      ...trace.ledgerRecords.flatMap((record) => record.reasonCodes),
      ...trace.quarantineRecords.map((record) => record.reason)
    ]);
    assert.ok(reasons.size > 0, `${trace.scenarioId} is denied/blocked but has no machine-readable reasoning`);
  }
}

function assertAdapterResponseConnectsApiDtoToUi(id: MockCoreScenarioId): void {
  const response = buildAdapterSafeCoreUiResponse(id);
  assert.equal(response.dtoVersion, "core-ui-dto-v1");
  assert.equal(response.scenarioId, id);
  const trace = asTrace(response.trace);
  assert.deepEqual(response.machinePulse, trace.pulse, "adapter-safe response must expose the same machine pulse the UI renders");
  assert.equal(canonicalDtoStringify(response.trace), canonicalDtoStringify(renderTrace(id)));
}

async function runScenario(name: string, fn: () => void | Promise<void>): Promise<ScenarioResult> {
  try {
    await fn();
    return { name, ok: true };
  } catch (error) {
    return {
      name,
      ok: false,
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

const scenarios: Array<[string, () => void | Promise<void>]> = [
  [
    "all 15 mock scenarios render deterministically",
    () => {
      assert.equal(MOCK_CORE_SCENARIO_IDS.length, REQUIRED_SCENARIO_COUNT);
      assert.deepEqual(scenarioIdsFromCatalog(), REQUIRED_SCENARIOS);

      for (const id of MOCK_CORE_SCENARIO_IDS) {
        const first = renderTrace(id);
        const second = renderTrace(id);
        assert.equal(canonicalDtoStringify(second), canonicalDtoStringify(first), `${id} DTO drifted across renders`);
      }
    }
  ],
  [
    "UI DTO stable across replay",
    () => {
      const first = allRenderedTraces().map((trace) => canonicalDtoStringify(trace));
      const second = allRenderedTraces().map((trace) => canonicalDtoStringify(trace));
      assert.deepEqual(second, first, "same scenario catalog must produce stable DTOs across replay-like re-render");

      const proofA = getReplayProof();
      const proofB = getReplayProof();
      assert.deepEqual(proofB, proofA, "replay proof must be deterministic");
      assert.equal(proofA.deterministic, true);
      assert.equal(proofA.replaySafe, true);
      assert.equal(proofA.scenarioCount, REQUIRED_SCENARIO_COUNT);
    }
  ],
  [
    "same scenario -> same visual verdict",
    () => {
      for (const id of MOCK_CORE_SCENARIO_IDS) {
        const viaRender = renderTrace(id);
        const viaDtoApi = renderTraceViaDtoApi(id);
        const viaAdapter = asTrace(buildAdapterSafeCoreUiResponse(id).trace);

        assert.equal(canonicalVisualVerdict(viaDtoApi), canonicalVisualVerdict(viaRender), `${id} API DTO changed visual verdict`);
        assert.equal(canonicalVisualVerdict(viaAdapter), canonicalVisualVerdict(viaRender), `${id} adapter response changed visual verdict`);
      }
    }
  ],
  [
    "market input integrity visible",
    () => {
      for (const trace of allRenderedTraces()) {
        assert.ok(trace.marketInputIntegrity, `${trace.scenarioId} missing marketInputIntegrity`);
        assert.ok(trace.marketInputIntegrity?.status, `${trace.scenarioId} missing marketInputIntegrity.status`);
        assert.ok(trace.marketInputIntegrity?.checkedAtFromEvent, `${trace.scenarioId} missing event-derived checkedAtFromEvent`);
      }
    }
  ],
  [
    "provenance visible",
    () => {
      for (const trace of allRenderedTraces()) {
        assert.ok(Array.isArray(trace.provenance), `${trace.scenarioId} missing provenance array`);
        assert.ok(trace.provenance.length >= 1, `${trace.scenarioId} missing provenance rows`);
        assert.ok(trace.provenance.every((row) => row.createdAtFromEvent), `${trace.scenarioId} provenance is not event-time based`);
      }
    }
  ],
  [
    "gap/stale/duplicate visible",
    () => {
      assert.equal(renderTrace("MARKET_INPUT_GAP_DENY").marketInputIntegrity?.status, "gap_detected");
      assert.ok(renderTrace("MARKET_INPUT_GAP_DENY").pulse.blockingReasons.includes("MARKET_INPUT_GAP"));

      assert.equal(renderTrace("MARKET_INPUT_STALE_DENY").marketInputIntegrity?.status, "stale");
      assert.ok(renderTrace("MARKET_INPUT_STALE_DENY").pulse.blockingReasons.includes("MARKET_INPUT_STALE"));

      assert.equal(renderTrace("DUPLICATE_EVENT_IDEMPOTENT").marketInputIntegrity?.status, "duplicate");
      assert.ok(renderTrace("DUPLICATE_EVENT_IDEMPOTENT").pulse.blockingReasons.includes("DUPLICATE_EVENT"));
    }
  ],
  [
    "snapshot diff visible",
    () => {
      for (const trace of allRenderedTraces()) {
        assert.ok(Number.isInteger(trace.snapshotDiff.beforeRevision), `${trace.scenarioId} missing before revision`);
        assert.ok(Number.isInteger(trace.snapshotDiff.afterRevision), `${trace.scenarioId} missing after revision`);
        assert.ok(trace.snapshotDiff.beforeHash, `${trace.scenarioId} missing beforeHash`);
        assert.ok(trace.snapshotDiff.afterHash, `${trace.scenarioId} missing afterHash`);
      }

      const duplicate = renderTrace("DUPLICATE_EVENT_IDEMPOTENT");
      assert.equal(duplicate.snapshotDiff.beforeRevision, duplicate.snapshotDiff.afterRevision);
      assert.deepEqual(duplicate.snapshotDiff.changedPaths, []);
    }
  ],
  [
    "recovery visibility preserved",
    () => {
      const recoveryScenarios = allRenderedTraces().filter((trace) => trace.recoveryHints.length > 0);
      assert.ok(recoveryScenarios.length >= 6, "expected multiple recovery-visible scenarios");
      for (const trace of recoveryScenarios) {
        assert.ok(trace.recoveryHints.every((hint) => hint.actionType && hint.reason), `${trace.scenarioId} recovery hint incomplete`);
      }
    }
  ],
  [
    "quarantine visibility preserved",
    () => {
      const trace = renderTrace("INVALID_EVENT_QUARANTINE");
      assert.equal(trace.quarantineRecords.length, 1);
      assert.equal(trace.quarantineRecords[0]?.eventId, "event-INVALID_EVENT_QUARANTINE");
      assert.equal(trace.quarantineRecords[0]?.recoverable, true);
    }
  ],
  [
    "ActionGate deny reasoning visible",
    () => {
      for (const trace of allRenderedTraces()) {
        assertDeniedTraceHasReasoning(trace);
      }
    }
  ],
  [
    "valid observation does not imply permission",
    () => {
      const trace = renderTrace("VALID_OBSERVATION_NO_PERMISSION");
      assert.equal(trace.marketInputIntegrity?.status, "valid");
      assert.equal(trace.pulse.tradingAllowed, false);
      assert.equal(trace.gateVerdict?.allowed, false);
      assert.ok(trace.gateVerdict?.blockingReasons.includes("ACTION_GATE_DENY"));
    }
  ],
  [
    "UI DTO does not mutate Core state",
    () => {
      runtimeEngine.clearPersistenceAndReset();
      const before = snapshotStable();
      for (const id of MOCK_CORE_SCENARIO_IDS) {
        renderTrace(id);
        renderTraceViaDtoApi(id);
        buildAdapterSafeCoreUiResponse(id);
      }
      const after = snapshotStable();
      assert.equal(after, before, "rendering UI DTOs must not mutate runtime snapshot");
    }
  ],
  [
    "UI contracts remain read-only",
    () => {
      const catalog = getObservableCoreMachineScenarios();
      assert.ok(catalog.every((item) => item.readOnly === true), "catalog items must be read-only");
      assert.ok(catalog.every((item) => item.coreAuthority === true), "catalog must state Core authority");
      assert.ok(catalog.every((item) => item.mockFirst === true), "catalog must remain mock-first for Wave 10B");
      for (const trace of allRenderedTraces()) {
        assertNoFunctions(trace);
      }
    }
  ],
  [
    "no execution semantics leak",
    () => {
      for (const trace of allRenderedTraces()) {
        assertNoAuthorityLeak(trace);
      }
    }
  ],
  [
    "no trading controls leak",
    () => {
      for (const trace of allRenderedTraces()) {
        const keys = collectKeys(trace).map((key) => key.toLowerCase());
        assert.equal(keys.includes("buybutton"), false);
        assert.equal(keys.includes("sellbutton"), false);
        assert.equal(keys.includes("tradebutton"), false);
        assert.equal(keys.includes("submitorder"), false);
        assert.equal(keys.includes("orderform"), false);
      }
    }
  ],
  [
    "no websocket authority",
    () => {
      for (const trace of allRenderedTraces()) {
        const keys = collectKeys(trace).map((key) => key.toLowerCase());
        assert.equal(keys.some((key) => key.includes("websocket") || key === "ws" || key === "wsurl"), false);
      }
    }
  ],
  [
    "no V1/live integration",
    () => {
      const sourceFiles = [
        "core/ui-api/observable-core-machine.ts",
        "core/ui-api/mock-scenarios.ts",
        "core/contracts/ui/computation-trace-dto.ts"
      ];

      for (const relative of sourceFiles) {
        const text = fs.readFileSync(path.join(process.cwd(), relative), "utf8");
        assert.equal(text.includes("from \"../../v1"), false, `${relative} imports V1`);
        assert.equal(text.includes("from '../v1"), false, `${relative} imports V1`);
        assert.equal(text.includes("new WebSocket"), false, `${relative} creates websocket`);
        assert.equal(text.includes("fetch("), false, `${relative} performs live fetch`);
        assert.equal(text.includes("placeOrder("), false, `${relative} contains execution call`);
      }
    }
  ],
  [
    "deterministic replay preserved",
    () => {
      const firstProof = canonicalDtoStringify(getReplayProof());
      const secondProof = canonicalDtoStringify(getReplayProof());
      assert.equal(secondProof, firstProof, "getReplayProof must be deterministic");

      const firstCatalog = canonicalDtoStringify(getObservableCoreMachineScenarios());
      const secondCatalog = canonicalDtoStringify(getObservableCoreMachineScenarios());
      assert.equal(secondCatalog, firstCatalog, "catalog must be deterministic");

      for (const trace of allRenderedTraces()) {
        assertTraceHasUiVisibleCausality(trace);
      }
    }
  ]
];

const results: ScenarioResult[] = [];
for (const [name, fn] of scenarios) {
  results.push(await runScenario(name, fn));
}

const failed = results.filter((result) => !result.ok);
const summary = {
  name: "wave10b_connected_observable_machine_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
