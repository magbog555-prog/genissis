import type { RuntimeAuthoritySummary, RuntimePanelStatus, TrustState } from "../contracts/runtime-snapshot.js";

export type RuntimeExchangeTruthStatus = "present" | "absent" | "stale" | "unknown";
export type RuntimeSourceMode = "runtime-stub" | "runtime-engine" | "runtime-unavailable";

export interface RuntimeEngineReadState {
  source: "runtime-engine";
  generatedAt: string;
  readOnly: true;
  status: string;
  phase: string;
  trustState: TrustState;
  trustScore: number | null;
  trustReasons: string[];
  kernelAuthority?: RuntimeAuthoritySummary;
  actionGate?: RuntimeAuthoritySummary;
  exchangeTruth?: {
    status: RuntimeExchangeTruthStatus;
    reason: string;
  };
  marketInputIntegrity?: RuntimePanelStatus;
  permissionLedger?: RuntimePanelStatus;
  causalityTrace?: RuntimeReadModel["causalityTrace"];
  raw?: unknown;
}

export interface RuntimeReadModel {
  source: "runtime";
  generatedAt: string;
  readOnly: true;
  deterministic: boolean;
  runtimeSource: RuntimeSourceMode;

  runtime: {
    status: string;
    phase: string;
    mode: "RUNTIME_READONLY" | "UNKNOWN";
  };

  trust: {
    state: TrustState;
    score: number | null;
    reasons: string[];
  };

  kernelAuthority: RuntimeAuthoritySummary;
  actionGate: RuntimeAuthoritySummary;

  exchangeTruth: {
    status: RuntimeExchangeTruthStatus;
    reason: string;
  };

  marketInputIntegrity: RuntimePanelStatus;
  permissionLedger: RuntimePanelStatus;

  verdict?: {
    result: "allowed" | "prohibited" | "observe_only";
    action: string | null;
    reason: string;
  };

  causalityTrace: {
    status: RuntimePanelStatus["status"];
    message: string;
    steps: Array<{
      id: string;
      label: string;
      status: string;
      message: string;
    }>;
  };

  raw?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function trustState(value: unknown): TrustState {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (normalized === "TRUSTED") return "TRUSTED";
  if (normalized === "UNTRUSTED" || normalized === "COMPROMISED") return "UNTRUSTED";
  if (normalized === "BLOCKED" || normalized === "HALTED") return "BLOCKED";
  return "UNCERTAIN";
}

function authority(value: unknown): RuntimeAuthoritySummary {
  if (!isRecord(value)) return { passed: 0, total: 0, failed: 0, status: "unknown" };
  const passed = typeof value.passed === "number" ? value.passed : 0;
  const total = typeof value.total === "number" ? value.total : 0;
  const failed = typeof value.failed === "number" ? value.failed : Math.max(0, total - passed);
  const rawStatus = typeof value.status === "string" ? value.status.toLowerCase() : "";
  const status =
    rawStatus === "pass" || rawStatus === "fail" || rawStatus === "partial" || rawStatus === "unknown"
      ? rawStatus
      : total === 0
        ? "unknown"
        : failed > 0
          ? "fail"
          : passed === total
            ? "pass"
            : "partial";
  return { passed, total, failed, status };
}

function panel(value: unknown, fallbackMessage: string): RuntimePanelStatus {
  if (!isRecord(value)) return { status: "unknown", message: fallbackMessage };
  const rawStatus = typeof value.status === "string" ? value.status.toLowerCase() : "";
  const status =
    rawStatus === "ok" || rawStatus === "valid" || rawStatus === "ready"
      ? "ok"
      : rawStatus === "warning" || rawStatus === "degraded"
        ? "warning"
        : rawStatus === "blocked" || rawStatus === "invalid" || rawStatus === "failed" || rawStatus === "fail"
          ? "blocked"
          : rawStatus === "pending"
            ? "pending"
            : "unknown";
  return {
    status,
    message: stringValue(value.message ?? value.reason ?? value.status, fallbackMessage),
    data: { present: true, omittedForUiSafety: true, reason: "circular_or_large_runtime_object" }
  };
}


function runtimeSourceMode(value: unknown): RuntimeSourceMode {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "runtime-engine" || normalized === "runtime_engine") return "runtime-engine";
  if (normalized === "runtime-unavailable" || normalized === "runtime_unavailable" || normalized === "unavailable") return "runtime-unavailable";
  return "runtime-stub";
}


function exchangeTruthStatus(value: unknown): RuntimeExchangeTruthStatus {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "present" || normalized === "fresh" || normalized === "ok") return "present";
  if (normalized === "absent" || normalized === "missing") return "absent";
  if (normalized === "stale") return "stale";
  return "unknown";
}

function runtimeVerdict(value: unknown): RuntimeReadModel["verdict"] {
  if (!isRecord(value)) {
    return { result: "prohibited", action: null, reason: "runtime read-model has no action verdict" };
  }
  const raw = typeof value.result === "string" ? value.result.toLowerCase() : typeof value.action === "string" ? value.action.toLowerCase() : "";
  const result = raw === "allowed" || raw === "allow"
    ? "allowed"
    : raw === "observe_only" || raw === "observe-only" || raw === "observe"
      ? "observe_only"
      : "prohibited";
  return {
    result,
    action: typeof value.action === "string" ? value.action : null,
    reason: stringValue(value.reason, "runtime read-model verdict")
  };
}

function causalityTrace(value: unknown): RuntimeReadModel["causalityTrace"] {
  if (!isRecord(value)) {
    return { status: "unknown", message: "causality trace unavailable", steps: [] };
  }

  const rawSteps = Array.isArray(value.steps) ? value.steps : [];
  return {
    status: panel(value, "causality trace unavailable").status,
    message: stringValue(value.message ?? value.reason, "causality trace read"),
    steps: rawSteps.map((step, index) => {
      const record = isRecord(step) ? step : {};
      return {
        id: stringValue(record.id, `runtime-step-${index + 1}`),
        label: stringValue(record.label ?? record.name, `Runtime step ${index + 1}`),
        status: stringValue(record.status, "unknown"),
        message: stringValue(record.message ?? record.detail, "")
      };
    })
  };
}


export function createRuntimeEngineReadState(runtimeEngine: unknown): RuntimeEngineReadState {
  const unavailable = (reason: string): RuntimeEngineReadState => ({
    source: "runtime-engine",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    status: "unavailable",
    phase: "runtime_unavailable",
    trustState: "UNCERTAIN",
    trustScore: null,
    trustReasons: [reason],
    exchangeTruth: { status: "absent", reason },
    marketInputIntegrity: { status: "unknown", message: "runtime engine unavailable" },
    permissionLedger: { status: "unknown", message: "runtime engine unavailable" },
    causalityTrace: { status: "unknown", message: "runtime engine unavailable", steps: [] },
    raw: runtimeEngine
  });

  try {
    if (!isRecord(runtimeEngine)) return unavailable("runtime_engine_unavailable");

    const engine = runtimeEngine as Record<string, unknown>;
    const getSnapshot = typeof engine.getSnapshot === "function" ? engine.getSnapshot.bind(engine) : undefined;
    const getRuntimeView = typeof engine.getRuntimeView === "function" ? engine.getRuntimeView.bind(engine) : undefined;
    const getMarketInputIntegrityView = typeof engine.getMarketInputIntegrityView === "function" ? engine.getMarketInputIntegrityView.bind(engine) : undefined;
    const getPermissionLedgerView = typeof engine.getPermissionLedgerView === "function" ? engine.getPermissionLedgerView.bind(engine) : undefined;
    const getCausalityTraceView = typeof engine.getCausalityTraceView === "function" ? engine.getCausalityTraceView.bind(engine) : undefined;

    if (!getSnapshot && !getRuntimeView) return unavailable("runtime_engine_read_accessor_missing");

    const snapshot = getSnapshot ? getSnapshot() : undefined;
    const runtimeView = getRuntimeView ? getRuntimeView() : undefined;
    const snapshotRecord = isRecord(snapshot) ? snapshot : {};
    const runtimeViewRecord = isRecord(runtimeView) ? runtimeView : {};
    const stateDomains = isRecord(runtimeViewRecord.stateDomains) ? runtimeViewRecord.stateDomains : {};

    const system = isRecord(snapshotRecord.system) ? snapshotRecord.system : {};
    const exchange = isRecord(snapshotRecord.exchangeTruth) ? snapshotRecord.exchangeTruth : {};
    const risk = isRecord(snapshotRecord.risk) ? snapshotRecord.risk : {};
    const marketInput = isRecord(snapshotRecord.marketInput) ? snapshotRecord.marketInput : {};

    const exchangeStatus = exchangeTruthStatus(exchange.status);
    const marketInputIntegrity = panel(
      getMarketInputIntegrityView ? getMarketInputIntegrityView({ now: new Date() }) : marketInput,
      "market input integrity unavailable"
    );

    const ledgerView = getPermissionLedgerView ? getPermissionLedgerView(20) : undefined;
    const ledgerRecord = isRecord(ledgerView) ? ledgerView : {};
    const permissionLedger: RuntimePanelStatus = {
      status: Number(ledgerRecord.count ?? 0) > 0 ? "ok" : "unknown",
      message: Number(ledgerRecord.count ?? 0) > 0 ? "permission ledger records available" : "permission ledger has no records",
      data: { present: !!ledgerView, omittedForUiSafety: true, reason: "runtime_ledger_view_omitted_for_ui_safety" }
    };

    const causalityRecords = getCausalityTraceView ? getCausalityTraceView(20) : [];
    const causalityTraceReadModel = causalityTrace({
      status: Array.isArray(causalityRecords) && causalityRecords.length > 0 ? "ok" : "unknown",
      message: Array.isArray(causalityRecords) && causalityRecords.length > 0 ? "runtime causality trace available" : "runtime causality trace empty",
      steps: Array.isArray(causalityRecords) ? causalityRecords : []
    });

    const blockedReasons = [
      ...stringArray(system.reasons),
      ...stringArray(risk.reasons),
      exchangeStatus === "present" ? "" : "exchangeTruth_absent",
      marketInputIntegrity.status === "ok" ? "" : "marketInputIntegrity_not_ok",
      permissionLedger.status === "ok" ? "" : "permissionLedger_not_ok"
    ].filter(Boolean);

    return {
      source: "runtime-engine",
      generatedAt: stringValue(snapshotRecord.committedAt ?? runtimeViewRecord.committedAt, new Date().toISOString()),
      readOnly: true,
      status: stringValue(system.status ?? stateDomains.system ?? runtimeViewRecord.mode, "unknown"),
      phase: stringValue(runtimeViewRecord.mode ?? stateDomains.bootstrap, "runtime_readonly"),
      trustState: blockedReasons.length === 0 ? "TRUSTED" : "UNCERTAIN",
      trustScore: null,
      trustReasons: blockedReasons.length ? blockedReasons : [],
      kernelAuthority: { passed: 0, total: 0, failed: 0, status: "unknown" },
      actionGate: { passed: 0, total: 0, failed: 0, status: "unknown" },
      exchangeTruth: {
        status: exchangeStatus,
        reason: stringValue(exchange.reason, exchangeStatus === "present" ? "exchange truth present" : "exchange truth absent")
      },
      marketInputIntegrity,
      permissionLedger,
      causalityTrace: causalityTraceReadModel,
      raw: { runtimeView, snapshot }
    };
  } catch {
    return unavailable("runtime_engine_read_failed");
  }
}


export function createRuntimeReadModel(runtimeEngine: unknown): RuntimeReadModel {
  try {
    const engine = isRecord(runtimeEngine) ? runtimeEngine : {};
    const runtime = isRecord(engine.runtime) ? engine.runtime : isRecord(engine.machine) ? engine.machine : {};
    const trust = isRecord(engine.trust) ? engine.trust : {};
    const exchangeTruth = isRecord(engine.exchangeTruth) ? engine.exchangeTruth : {};
    const kernelAuthority = authority(engine.kernelAuthority);
    const actionGate = authority(engine.actionGate);

    return {
      source: "runtime",
      generatedAt: stringValue(engine.generatedAt, new Date().toISOString()),
      readOnly: true,
      deterministic: Boolean(engine.deterministic ?? false),
      runtimeSource: runtimeSourceMode(engine.runtimeSource ?? engine.sourceMode ?? engine.source),
      runtime: {
        status: stringValue(runtime.status, isRecord(runtimeEngine) ? "unknown" : "unavailable"),
        phase: stringValue(runtime.phase, isRecord(runtimeEngine) ? "unknown" : "runtime_unavailable"),
        mode: stringValue(runtime.mode, "UNKNOWN") === "RUNTIME_READONLY" ? "RUNTIME_READONLY" : "UNKNOWN"
      },
      trust: {
        state: trustState(trust.state ?? engine.trustState),
        score: numberOrNull(trust.score ?? engine.trustScore),
        reasons: stringArray(trust.reasons).length ? stringArray(trust.reasons) : ["runtime_read_model_observe_only"]
      },
      kernelAuthority,
      actionGate,
      exchangeTruth: {
        status: exchangeTruthStatus(exchangeTruth.status),
        reason: stringValue(exchangeTruth.reason, isRecord(runtimeEngine) ? "exchange truth not present in runtime read-model" : "runtime engine unavailable")
      },
      marketInputIntegrity: panel(engine.marketInputIntegrity, "market input integrity unavailable"),
      permissionLedger: panel(engine.permissionLedger, "permission ledger unavailable"),
      verdict: runtimeVerdict(engine.verdict),
      causalityTrace: causalityTrace(engine.causalityTrace),
      raw: runtimeEngine
    };
  } catch {
    return {
      source: "runtime",
      generatedAt: new Date().toISOString(),
      readOnly: true,
      deterministic: false,
      runtimeSource: "runtime-unavailable",
      runtime: { status: "unavailable", phase: "runtime_unavailable", mode: "UNKNOWN" },
      trust: { state: "UNCERTAIN", score: null, reasons: ["runtime_read_model_adapter_fallback"] },
      kernelAuthority: { passed: 0, total: 0, failed: 0, status: "unknown" },
      actionGate: { passed: 0, total: 0, failed: 0, status: "unknown" },
      exchangeTruth: { status: "absent", reason: "runtime read-model adapter fallback" },
      marketInputIntegrity: { status: "unknown", message: "market input integrity unavailable" },
      permissionLedger: { status: "unknown", message: "permission ledger unavailable" },
      verdict: { result: "prohibited", action: null, reason: "runtime read-model adapter fallback" },
      causalityTrace: { status: "unknown", message: "causality trace unavailable", steps: [] },
      raw: runtimeEngine
    };
  }
}

export function createStubRuntimeEngineState(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-05-10T00:00:00.000Z",
    deterministic: false,
    runtimeSource: "runtime-stub" as const,
    runtime: {
      status: "ready",
      phase: "observe_only",
      mode: "RUNTIME_READONLY"
    },
    trust: {
      state: "UNCERTAIN",
      score: null,
      reasons: ["exchange_truth_absent", "market_truth_absent"]
    },
    kernelAuthority: { passed: 1, total: 1, failed: 0, status: "pass" },
    actionGate: { passed: 0, total: 1, failed: 1, status: "fail" },
    exchangeTruth: { status: "absent", reason: "RC3 does not connect Binance or market ingest" },
    marketInputIntegrity: { status: "unknown", message: "No live market input in RC3" },
    permissionLedger: { status: "blocked", message: "No action permission without market truth" },
    causalityTrace: {
      status: "unknown",
      message: "Runtime read-model stub has no live causality events",
      steps: []
    },
    ...overrides
  };
}
