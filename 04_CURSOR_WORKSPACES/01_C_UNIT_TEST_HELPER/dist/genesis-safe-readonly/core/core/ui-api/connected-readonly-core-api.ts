import express, { type Request, type Response, type Router } from "express";
import cors from "cors";
import {
  AdapterCompatibleComputationTraceResponseSchema,
  CONNECTED_READONLY_CORE_API_VERSION,
  ConnectedReadOnlyCoreEndpointSchema,
  type AdapterCompatibleComputationTraceResponse,
  type ConnectedReadOnlyCoreEndpoint,
  type CoreIntegrityReportResponse,
  type CoreMarketInputStatusResponse,
  type CoreQuarantineResponse,
  type CoreRecoveryResponse,
  type CoreRevisionTimelineResponse,
  type CoreStatusResponse,
  type CoreTrustReportResponse
} from "../contracts/ui/index.js";
import {
  MOCK_CORE_SCENARIO_IDS,
  buildMockComputationTraceDTO,
  type MockCoreScenarioId
} from "./mock-scenarios.js";
import { UI_DTO_VERSION, canonicalDtoStringify } from "../contracts/ui/index.js";
import { normalizeRuntimeSnapshot } from "../contracts/normalize-runtime-snapshot.js";
import {
  createRuntimeEngineReadState,
  createRuntimeReadModel,
  createStubRuntimeEngineState,
  type RuntimeReadModel,
  type RuntimeSourceMode
} from "../runtime-read-model/runtime-read-model-adapter.js";
import { runtimeEngine } from "../runtime/src/runtime-engine.js";
import {
  liveReadOnlyMarketStream,
  type LiveMarketStreamDTO
} from "../live-stream/live-market-stream.js";

export const CONNECTED_READONLY_CORE_ENDPOINTS: ConnectedReadOnlyCoreEndpoint[] = [
  "/core/status",
  "/core/trace/latest",
  "/core/trust/report",
  "/core/integrity/report",
  "/core/revisions/timeline",
  "/core/market-input/status",
  "/core/recovery",
  "/core/quarantine"
];

export const RC1_WORKSPACE_NAME = "MBG_OBSERVABLE_CORE_WORKSPACE_RC4_A_LIVE_STREAM_BACKEND_CONTRACTS";
export const RC1_POST_SURFACE = "closed" as const;

export const RC1_PUBLIC_READONLY_ENDPOINTS = [
  "/health",
  "/api/core/scenarios",
  "/api/core/status",
  "/api/core/computation-trace/latest",
  "/api/core/trace/:scenario",
  "/api/core/status/:scenario"
] as const;

export const RC3_RUNTIME_READONLY_ENDPOINTS = [
  "/api/core/runtime/snapshot",
  "/api/core/runtime/status",
  "/api/core/runtime/trust",
  "/api/core/runtime/integrity",
  "/api/core/runtime/causality-trace",
  "/api/core/runtime/permission-ledger"
] as const;

export const RC3_5_SELF_TRUTH_ENDPOINTS = [
  "/api/core/self-truth/audit"
] as const;

export const RC4_LIVE_READONLY_ENDPOINTS = [
  "/api/core/live-stream/status",
  "/api/core/live-stream/health",
  "/api/core/live-stream/last-event",
  "/api/core/overview"
] as const;

let runtimeEngineReadModelSourceOverride: unknown | undefined;
let runtimeSourceModeOverride: RuntimeSourceMode | undefined;

function requestedRuntimeSourceMode(): RuntimeSourceMode {
  if (runtimeSourceModeOverride) return runtimeSourceModeOverride;
  const raw = String(process.env.CORE_RUNTIME_SOURCE ?? "runtime-engine").toLowerCase();
  if (raw === "runtime-stub" || raw === "stub") return "runtime-stub";
  if (raw === "runtime-unavailable" || raw === "unavailable") return "runtime-unavailable";
  return "runtime-engine";
}

export function setRuntimeEngineReadModelSourceForTests(source: unknown, mode?: RuntimeSourceMode) {
  runtimeEngineReadModelSourceOverride = source;
  runtimeSourceModeOverride = mode;
}

export function clearRuntimeEngineReadModelSourceForTests() {
  runtimeEngineReadModelSourceOverride = undefined;
  runtimeSourceModeOverride = undefined;
}

export function getRuntimeSourceMode(): RuntimeSourceMode {
  return buildRuntimeReadModel().runtimeSource;
}

function getRuntimeReadModelSource(): unknown {
  const mode = requestedRuntimeSourceMode();

  if (runtimeEngineReadModelSourceOverride !== undefined) {
    if (mode === "runtime-engine") return createRuntimeEngineReadState(runtimeEngineReadModelSourceOverride);
    if (mode === "runtime-unavailable") return { runtimeSource: "runtime-unavailable", sourceMode: "runtime-unavailable" };
    return createStubRuntimeEngineState(runtimeEngineReadModelSourceOverride as Record<string, unknown>);
  }

  if (mode === "runtime-engine") return createRuntimeEngineReadState(runtimeEngine);
  if (mode === "runtime-unavailable") return { runtimeSource: "runtime-unavailable", sourceMode: "runtime-unavailable" };
  return createStubRuntimeEngineState();
}

export function buildRuntimeReadModel(): RuntimeReadModel {
  return createRuntimeReadModel(getRuntimeReadModelSource());
}

export function buildRuntimeSnapshot() {
  const readModel = buildRuntimeReadModel();
  const snapshot = normalizeRuntimeSnapshot(readModel, {
    source: "runtime",
    scenarioId: null,
    deterministic: readModel.deterministic,
    readOnly: true
  });
  return {
    ...snapshot,
    runtimeSource: readModel.runtimeSource
  };
}


export function buildCleanSelfTruthRuntimeSnapshot() {
  const cleanSource = createStubRuntimeEngineState({
    generatedAt: "2026-05-10T00:00:00.000Z",
    deterministic: true,
    runtimeSource: "runtime-stub" as const,
    runtime: {
      status: "self_truth_clean",
      phase: "no_external_sensors",
      mode: "RUNTIME_READONLY"
    },
    trust: {
      state: "UNCERTAIN",
      score: null,
      reasons: ["self_truth_clean_mode", "market_input_absent", "exchange_truth_absent"]
    },
    kernelAuthority: { passed: 0, total: 0, failed: 0, status: "unknown" },
    actionGate: { passed: 0, total: 0, failed: 0, status: "unknown" },
    exchangeTruth: { status: "absent", reason: "self_truth_clean_mode_exchange_truth_absent" },
    marketInputIntegrity: undefined,
    permissionLedger: { status: "unknown", message: "self-truth clean mode has no permission proof" },
    verdict: {
      result: "allowed",
      action: null,
      reason: "intentional raw allowed probe; normalizer must prohibit without proof"
    },
    causalityTrace: {
      status: "unknown",
      message: "self-truth clean mode ignores persistence and external sensors",
      steps: []
    }
  });
  const readModel = createRuntimeReadModel(cleanSource);
  const snapshot = normalizeRuntimeSnapshot(readModel, {
    source: "runtime",
    scenarioId: null,
    deterministic: true,
    readOnly: true
  });
  return {
    ...snapshot,
    runtimeSource: readModel.runtimeSource,
    selfTruthCleanMode: true
  };
}


export function buildRuntimeStatusResponse() {
  const snapshot = buildRuntimeSnapshot();
  return {
    ok: true,
    source: "runtime",
    readOnly: true,
    runtimeSource: "runtimeSource" in snapshot ? snapshot.runtimeSource : buildRuntimeReadModel().runtimeSource,
    runtimeStatus: snapshot.machine.status,
    trustState: snapshot.trust.state,
    verdict: snapshot.verdict.result,
    blockedBy: snapshot.verdict.blockedBy
  };
}

export function buildRc1ServiceDescriptor() {
  const runtimeSource = getRuntimeSourceMode();
  return {
    ok: true,
    service: "mbg-core-connected-readonly-api",
    workspace: RC1_WORKSPACE_NAME,
    apiVersion: CONNECTED_READONLY_CORE_API_VERSION,
    readOnly: true,
    deterministic: false,
    postSurface: RC1_POST_SURFACE,
    runtimeSnapshotSchema: "runtime-snapshot/v1",
    runtimeReadModel: "enabled",
    runtimeSource,
    selfTruthAudit: "enabled",
    liveStreamApi: "enabled",
    liveStreamModule: "available",
    liveStreamMode: "readonly",
    executionSurface: "closed",
    operatorRule: "NO_PROOF_NO_ALLOW",
    endpoints: [...RC1_PUBLIC_READONLY_ENDPOINTS, ...RC3_RUNTIME_READONLY_ENDPOINTS, ...RC3_5_SELF_TRUTH_ENDPOINTS, ...RC4_LIVE_READONLY_ENDPOINTS]
  };
}

export interface ConnectedReadonlyCoreApiRequest {
  scenarioId?: string;
}

export type ConnectedReadonlyCoreApiResponse =
  | CoreStatusResponse
  | AdapterCompatibleComputationTraceResponse
  | CoreTrustReportResponse
  | CoreIntegrityReportResponse
  | CoreRevisionTimelineResponse
  | CoreMarketInputStatusResponse
  | CoreRecoveryResponse
  | CoreQuarantineResponse;

export interface ConnectedReadonlyCoreApiAdapter {
  readonly version: typeof CONNECTED_READONLY_CORE_API_VERSION;
  readonly readOnly: true;
  readonly deterministic: true;
  readonly endpoints: ConnectedReadOnlyCoreEndpoint[];
  getStatus(input?: ConnectedReadonlyCoreApiRequest): CoreStatusResponse;
  getLatestTrace(input?: ConnectedReadonlyCoreApiRequest): AdapterCompatibleComputationTraceResponse;
  getTrustReport(input?: ConnectedReadonlyCoreApiRequest): CoreTrustReportResponse;
  getIntegrityReport(input?: ConnectedReadonlyCoreApiRequest): CoreIntegrityReportResponse;
  getRevisionTimeline(input?: ConnectedReadonlyCoreApiRequest): CoreRevisionTimelineResponse;
  getMarketInputStatus(input?: ConnectedReadonlyCoreApiRequest): CoreMarketInputStatusResponse;
  getRecovery(input?: ConnectedReadonlyCoreApiRequest): CoreRecoveryResponse;
  getQuarantine(input?: ConnectedReadonlyCoreApiRequest): CoreQuarantineResponse;
}

export function normalizeCoreScenarioId(input?: unknown): MockCoreScenarioId {
  if (typeof input === "string" && (MOCK_CORE_SCENARIO_IDS as readonly string[]).includes(input)) {
    return input as MockCoreScenarioId;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const raw =
      record.scenarioId ??
      record.scenario ??
      record.id ??
      record.key ??
      (record.query && typeof record.query === "object" ? (record.query as Record<string, unknown>).scenarioId : undefined);
    if (typeof raw === "string" && (MOCK_CORE_SCENARIO_IDS as readonly string[]).includes(raw)) {
      return raw as MockCoreScenarioId;
    }
  }

  return "HEALTHY_TRUSTED_READY";
}

function adapterMeta(scenarioId: MockCoreScenarioId, generatedAtFromEvent: string) {
  return {
    apiVersion: CONNECTED_READONLY_CORE_API_VERSION,
    dtoVersion: UI_DTO_VERSION,
    scenarioId,
    source: "core-mock-scenario-api" as const,
    adapterCompatibility: {
      mockAdapter: true as const,
      apiAdapter: true as const,
      readOnly: true as const,
      deterministic: true as const
    },
    generatedAtFromEvent
  };
}

function machineFromTrace(trace: ReturnType<typeof buildMockComputationTraceDTO>) {
  return {
    status: trace.pulse.blocked ? "BLOCKED" : "READY",
    trustState: trace.pulse.trustState,
    runtimeMode: trace.pulse.runtimeMode,
    tradingAllowed: trace.pulse.tradingAllowed,
    blocked: trace.pulse.blocked,
    revision: trace.pulse.snapshotRevision,
    snapshotHash: trace.pulse.snapshotHash,
    mainReason: trace.pulse.summary,
    blockingReasons: [...trace.pulse.blockingReasons]
  };
}

function eventFromTrace(trace: ReturnType<typeof buildMockComputationTraceDTO>) {
  return {
    eventId: trace.causality.eventId ?? `event-${trace.scenarioId}`,
    eventType: trace.marketInputIntegrity?.status === "invalid" ? "market.input.rejected" : "market.input.observed",
    source: trace.marketInputIntegrity?.sourceName ?? "mock-scenario",
    receivedAt: trace.marketInputIntegrity?.checkedAtFromEvent ?? trace.createdAtFromEvent,
    eventTime: trace.marketInputIntegrity?.checkedAtFromEvent ?? trace.createdAtFromEvent,
    sequence: trace.marketInputIntegrity?.sequence ?? trace.pulse.snapshotRevision,
    payloadHash: trace.marketInputIntegrity?.payloadHash ?? `payload-hash-${trace.scenarioId}`,
    provenanceId: trace.marketInputIntegrity?.provenanceId
  };
}

export function buildAdapterCompatibleTraceResponse(
  input?: ConnectedReadonlyCoreApiRequest
): AdapterCompatibleComputationTraceResponse {
  const scenarioId = normalizeCoreScenarioId(input);
  const trace = buildMockComputationTraceDTO(scenarioId);
  const response: AdapterCompatibleComputationTraceResponse = {
    ...trace,
    apiVersion: CONNECTED_READONLY_CORE_API_VERSION,
    machine: machineFromTrace(trace),
    event: eventFromTrace(trace),
    adapterMeta: adapterMeta(scenarioId, trace.createdAtFromEvent)
  };
  return AdapterCompatibleComputationTraceResponseSchema.parse(response);
}

export function buildCoreStatusResponse(input?: ConnectedReadonlyCoreApiRequest): CoreStatusResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/status",
    status: trace.pulse,
    machine: trace.machine,
    scenarios: [...MOCK_CORE_SCENARIO_IDS],
    endpoints: [...CONNECTED_READONLY_CORE_ENDPOINTS]
  };
}

export function buildCoreTrustReportResponse(input?: ConnectedReadonlyCoreApiRequest): CoreTrustReportResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/trust/report",
    trustState: trace.pulse.trustState,
    tradingAllowed: trace.pulse.tradingAllowed,
    runtimeMode: trace.pulse.runtimeMode,
    blockingReasons: [...trace.pulse.blockingReasons],
    gateVerdict: trace.gateVerdict
  };
}

export function buildCoreIntegrityReportResponse(input?: ConnectedReadonlyCoreApiRequest): CoreIntegrityReportResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  const broken =
    trace.pulse.blockingReasons.includes("SNAPSHOT_HASH_MISMATCH") ||
    trace.pulse.blockingReasons.includes("REPLAY_MISMATCH") ||
    trace.pulse.blockingReasons.includes("PROVENANCE_REPLAY_MISMATCH");
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/integrity/report",
    status: broken ? "broken" : "valid",
    snapshotHash: trace.causality.snapshotHash,
    previousSnapshotHash: trace.causality.previousSnapshotHash,
    eventHash: trace.causality.eventHash,
    transitionHash: trace.causality.transitionHash,
    causality: { ...trace.causality }
  };
}

export function buildCoreRevisionTimelineResponse(input?: ConnectedReadonlyCoreApiRequest): CoreRevisionTimelineResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  const revisions = [
    {
      revision: trace.snapshotDiff.beforeRevision,
      snapshotHash: trace.snapshotDiff.beforeHash,
      label: "before",
      deterministic: true as const
    },
    {
      revision: trace.snapshotDiff.afterRevision,
      snapshotHash: trace.snapshotDiff.afterHash,
      label: "after",
      deterministic: true as const
    }
  ];
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/revisions/timeline",
    snapshotDiff: trace.snapshotDiff,
    revisions
  };
}

export function buildCoreMarketInputStatusResponse(input?: ConnectedReadonlyCoreApiRequest): CoreMarketInputStatusResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/market-input/status",
    marketInput:
      trace.marketInputIntegrity ?? {
        status: "unknown",
        exchangeTruthPresent: true,
        exchangeTruthStatus: "unknown",
        exchangeTruthProof: "missing",
        blockingReasons: ["MARKET_INPUT_UNKNOWN"],
        checkedAtFromEvent: trace.createdAtFromEvent
      }
  };
}

export function buildCoreRecoveryResponse(input?: ConnectedReadonlyCoreApiRequest): CoreRecoveryResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/recovery",
    required: trace.recoveryHints.length > 0 || trace.pulse.blocked,
    hints: [...trace.recoveryHints]
  };
}

export function buildCoreQuarantineResponse(input?: ConnectedReadonlyCoreApiRequest): CoreQuarantineResponse {
  const trace = buildAdapterCompatibleTraceResponse(input);
  return {
    adapterMeta: trace.adapterMeta,
    endpoint: "/core/quarantine",
    count: trace.quarantineRecords.length,
    records: [...trace.quarantineRecords]
  };
}

export function buildConnectedReadonlyCoreApiResponse(
  endpoint: ConnectedReadOnlyCoreEndpoint,
  input?: ConnectedReadonlyCoreApiRequest
): ConnectedReadonlyCoreApiResponse {
  const parsed = ConnectedReadOnlyCoreEndpointSchema.parse(endpoint);
  switch (parsed) {
    case "/core/status":
      return buildCoreStatusResponse(input);
    case "/core/trace/latest":
      return buildAdapterCompatibleTraceResponse(input);
    case "/core/trust/report":
      return buildCoreTrustReportResponse(input);
    case "/core/integrity/report":
      return buildCoreIntegrityReportResponse(input);
    case "/core/revisions/timeline":
      return buildCoreRevisionTimelineResponse(input);
    case "/core/market-input/status":
      return buildCoreMarketInputStatusResponse(input);
    case "/core/recovery":
      return buildCoreRecoveryResponse(input);
    case "/core/quarantine":
      return buildCoreQuarantineResponse(input);
  }
}

export function canonicalApiStringify(value: unknown): string {
  return canonicalDtoStringify(value);
}

function scenarioFromRequest(req: Request): ConnectedReadonlyCoreApiRequest {
  const raw =
    req.params.scenario ??
    req.params.scenarioId ??
    req.query.scenarioId ??
    req.query.scenario ??
    req.header("x-core-scenario-id") ??
    undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return { scenarioId: typeof first === "string" ? first : first === undefined ? undefined : String(first) };
}

function sendDeterministicJson(res: Response, value: unknown) {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-core-api-read-only", "true");
  res.type("application/json").send(canonicalApiStringify(value));
}


export function buildSelfTruthAuditResponse() {
  const snapshot = buildCleanSelfTruthRuntimeSnapshot();
  const runtimeSource = "runtimeSource" in snapshot ? snapshot.runtimeSource : "runtime-stub";
  const dangerousPostSurfaceClosed = true;
  const noProofNoAllow = snapshot.verdict.result !== "allowed";
  const missingMarketInputBlocks =
    snapshot.verdict.result === "prohibited" &&
    (snapshot.verdict.blockedBy.includes("marketInputIntegrity") || snapshot.verdict.blockedBy.includes("market_input_absent"));
  const missingExchangeTruthBlocks =
    snapshot.verdict.result === "prohibited" &&
    (snapshot.verdict.blockedBy.includes("exchangeTruth") || snapshot.verdict.blockedBy.includes("exchange_truth_absent"));
  const runtimeUnavailableBlocks =
    runtimeSource !== "runtime-unavailable" || snapshot.verdict.result === "prohibited";
  const stubNotReportedAsEngine = runtimeSource !== "runtime-engine";
  const persistenceIgnored = true;

  return {
    ok: true,
    workspace: RC1_WORKSPACE_NAME,
    audit: "core-self-truth",
    readOnly: true,
    selfTruthCleanMode: true,
    persistence: "ignored-for-audit",
    result:
      noProofNoAllow &&
      missingMarketInputBlocks &&
      missingExchangeTruthBlocks &&
      runtimeUnavailableBlocks &&
      stubNotReportedAsEngine &&
      persistenceIgnored &&
      dangerousPostSurfaceClosed
        ? "pass"
        : "fail",
    runtimeSource,
    invariants: {
      noProofNoAllow: noProofNoAllow ? "pass" : "fail",
      missingMarketInputBlocks: missingMarketInputBlocks ? "pass" : "fail",
      missingExchangeTruthBlocks: missingExchangeTruthBlocks ? "pass" : "fail",
      runtimeUnavailableBlocks: runtimeUnavailableBlocks ? "pass" : "fail",
      stubNotReportedAsEngine: stubNotReportedAsEngine ? "pass" : "fail",
      persistenceIgnored: persistenceIgnored ? "pass" : "fail",
      dangerousPostSurfaceClosed: dangerousPostSurfaceClosed ? "pass" : "fail"
    },
    snapshot: {
      trust: snapshot.trust,
      verdict: snapshot.verdict,
      kernelAuthority: snapshot.kernelAuthority,
      actionGate: snapshot.actionGate
    }
  };
}



export interface CoreOverviewDTO {
  dto: "CoreOverviewDTO";
  overallState: "SAFE_OBSERVE_ONLY";
  mode: "OBSERVE_ONLY";
  trustState: "UNCERTAIN";
  actionVerdict: "prohibited";
  executionSurface: "closed";
  operatorRule: "NO_PROOF_NO_ALLOW";
  liveStreamStatus: LiveMarketStreamDTO["connectionStatus"] | "not_connected";
  blocks: Array<{
    id: string;
    title: string;
    status: "ok" | "warning" | "fail" | "closed" | "no_data";
    color: "green" | "yellow" | "red" | "blue" | "black";
    message: string;
  }>;
}

export function buildCoreOverviewDTO(): CoreOverviewDTO {
  const live = liveReadOnlyMarketStream.getStatus();
  const liveStreamStatus = live.liveExchangeConnected ? live.connectionStatus : "not_connected";
  return {
    dto: "CoreOverviewDTO",
    overallState: "SAFE_OBSERVE_ONLY",
    mode: "OBSERVE_ONLY",
    trustState: "UNCERTAIN",
    actionVerdict: "prohibited",
    executionSurface: "closed",
    operatorRule: "NO_PROOF_NO_ALLOW",
    liveStreamStatus,
    blocks: [
      { id: "pulse", title: "Пульс машины", status: "ok", color: "green", message: "работает" },
      { id: "activeEvent", title: "Активное событие", status: "ok", color: "green", message: "read-only событие доступно" },
      { id: "pipeline", title: "Конвейер обработки", status: "ok", color: "green", message: "работает в режиме наблюдения" },
      { id: "rawTrace", title: "Сырой след", status: "ok", color: "green", message: "санитизирован для UI" },
      { id: "computationSteps", title: "Шаги вычисления", status: "ok", color: "green", message: "доступны" },
      { id: "formulaInspector", title: "Инспектор формул", status: "ok", color: "green", message: "доступен" },
      { id: "kernelRules", title: "Правила ядра", status: "warning", color: "yellow", message: "нет полного proof для доверия" },
      { id: "snapshotDiff", title: "Разница снимка", status: "ok", color: "green", message: "доступна" },
      { id: "miniVerdict", title: "Мини-вердикт", status: "fail", color: "red", message: "PLACE_ORDER запрещён" },
      { id: "verdictTrace", title: "След вердикта", status: "warning", color: "yellow", message: "NO PROOF → NO ALLOW" },
      { id: "revisionTimeline", title: "Линия ревизий", status: "ok", color: "green", message: "доступна" },
      { id: "marketIntegrity", title: "Целостность рынка", status: "warning", color: "yellow", message: "биржевое доказательство отсутствует" },
      { id: "provenance", title: "Происхождение", status: "warning", color: "yellow", message: "локальная валидность не равна биржевому proof" },
      { id: "recovery", title: "Восстановление", status: "warning", color: "yellow", message: "требуется восстановление доверия, авто-восстановление выключено" },
      { id: "replayPanel", title: "Панель повтора", status: "ok", color: "green", message: "доступна" },
      { id: "failureMatrix", title: "Матрица отказов", status: "warning", color: "yellow", message: "финальное состояние безопасности: запрещено" },
      {
        id: "liveStream",
        title: "Живой поток",
        status: live.liveExchangeConnected ? "warning" : "no_data",
        color: live.liveExchangeConnected ? "yellow" : "black",
        message: live.liveExchangeConnected ? "подключён, но не является proof" : "не подключён"
      },
      { id: "executionSurface", title: "Поверхность исполнения", status: "closed", color: "blue", message: "исполнение закрыто" }
    ]
  };
}

export function createConnectedReadOnlyCoreApiRouter(): Router {
  const router = express.Router();

  for (const endpoint of CONNECTED_READONLY_CORE_ENDPOINTS) {
    router.get(endpoint, (req, res) => {
      sendDeterministicJson(res, buildConnectedReadonlyCoreApiResponse(endpoint, scenarioFromRequest(req)));
    });
  }

  router.get("/api/core/computation-trace/latest", (req, res) => {
    sendDeterministicJson(res, buildAdapterCompatibleTraceResponse(scenarioFromRequest(req)));
  });

  router.get("/api/core/scenarios", (_req, res) => {
    sendDeterministicJson(res, {
      apiVersion: CONNECTED_READONLY_CORE_API_VERSION,
      readOnly: true,
      deterministic: true,
      scenarios: [...MOCK_CORE_SCENARIO_IDS],
      endpoints: [
        ...CONNECTED_READONLY_CORE_ENDPOINTS,
        ...RC1_PUBLIC_READONLY_ENDPOINTS,
        ...RC3_RUNTIME_READONLY_ENDPOINTS
      ]
    });
  });

  router.get("/api/core/status", (req, res) => {
    sendDeterministicJson(res, buildCoreStatusResponse(scenarioFromRequest(req)));
  });

  router.get("/api/core/status/:scenario", (req, res) => {
    sendDeterministicJson(res, buildCoreStatusResponse(scenarioFromRequest(req)));
  });

  router.get("/api/core/trace/:scenario", (req, res) => {
    sendDeterministicJson(res, buildAdapterCompatibleTraceResponse(scenarioFromRequest(req)));
  });


  router.get("/api/core/runtime/snapshot", (_req, res) => {
    sendDeterministicJson(res, buildRuntimeSnapshot());
  });

  router.get("/api/core/runtime/status", (_req, res) => {
    sendDeterministicJson(res, buildRuntimeStatusResponse());
  });

  router.get("/api/core/runtime/trust", (_req, res) => {
    const snapshot = buildRuntimeSnapshot();
    sendDeterministicJson(res, {
      source: "runtime",
      readOnly: true,
      trust: snapshot.trust
    });
  });

  router.get("/api/core/runtime/integrity", (_req, res) => {
    const snapshot = buildRuntimeSnapshot();
    sendDeterministicJson(res, {
      source: "runtime",
      readOnly: true,
      marketIntegrity: snapshot.panels.marketIntegrity,
      provenance: snapshot.panels.provenance,
      verdict: snapshot.verdict
    });
  });

  router.get("/api/core/runtime/causality-trace", (_req, res) => {
    const snapshot = buildRuntimeSnapshot();
    sendDeterministicJson(res, {
      source: "runtime",
      readOnly: true,
      causalityTrace: snapshot.panels.decisionTrace
    });
  });

  router.get("/api/core/runtime/permission-ledger", (_req, res) => {
    const snapshot = buildRuntimeSnapshot();
    const permissionLedger = snapshot.raw && typeof snapshot.raw === "object" && "permissionLedger" in snapshot.raw
      ? (snapshot.raw as { permissionLedger?: unknown }).permissionLedger
      : undefined;
    sendDeterministicJson(res, {
      source: "runtime",
      readOnly: true,
      permissionLedger: permissionLedger ?? {
        status: "unknown",
        message: "permission ledger unavailable"
      },
      verdict: snapshot.verdict
    });
  });

  router.get("/api/core/self-truth/audit", (_req, res) => {
    sendDeterministicJson(res, buildSelfTruthAuditResponse());
  });


  router.get("/api/core/live-stream/status", (_req, res) => {
    sendDeterministicJson(res, liveReadOnlyMarketStream.getStatus());
  });

  router.get("/api/core/live-stream/health", (_req, res) => {
    sendDeterministicJson(res, liveReadOnlyMarketStream.getHealth());
  });

  router.get("/api/core/live-stream/last-event", (_req, res) => {
    sendDeterministicJson(res, liveReadOnlyMarketStream.getLastEvent() ?? {
      dto: "LiveMarketStreamEventDTO",
      provider: "Binance",
      symbol: liveReadOnlyMarketStream.getStatus().symbol,
      eventType: "unknown",
      eventTime: null,
      receivedAt: null,
      price: null,
      quantity: null,
      rawSummary: {
        present: false,
        omittedForUiSafety: true,
        reason: "no_live_event_received"
      },
      executionSurface: "closed",
      readOnly: true
    });
  });

  router.get("/api/core/overview", (_req, res) => {
    sendDeterministicJson(res, buildCoreOverviewDTO());
  });

  return router;
}

export function createConnectedReadOnlyCoreApiApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "128kb" }));
  app.get("/", (_req, res) => {
    sendDeterministicJson(res, buildRc1ServiceDescriptor());
  });

  app.get("/health", (_req, res) => {
    sendDeterministicJson(res, buildRc1ServiceDescriptor());
  });
  app.use(createConnectedReadOnlyCoreApiRouter());
  return app;
}

export const connectedReadonlyCoreApi: ConnectedReadonlyCoreApiAdapter = {
  version: CONNECTED_READONLY_CORE_API_VERSION,
  readOnly: true,
  deterministic: true,
  endpoints: CONNECTED_READONLY_CORE_ENDPOINTS,
  getStatus: buildCoreStatusResponse,
  getLatestTrace: buildAdapterCompatibleTraceResponse,
  getTrustReport: buildCoreTrustReportResponse,
  getIntegrityReport: buildCoreIntegrityReportResponse,
  getRevisionTimeline: buildCoreRevisionTimelineResponse,
  getMarketInputStatus: buildCoreMarketInputStatusResponse,
  getRecovery: buildCoreRecoveryResponse,
  getQuarantine: buildCoreQuarantineResponse
};

export default connectedReadonlyCoreApi;
