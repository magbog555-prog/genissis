import type {
  RuntimeAuthoritySummary,
  RuntimeDecisionStep,
  RuntimeMode,
  RuntimePanelStatus,
  RuntimePipelineStep,
  RuntimeRevisionItem,
  RuntimeRule,
  RuntimeSnapshot,
  TrustState,
  Verdict
} from "./runtime-snapshot.js";

export interface NormalizeRuntimeSnapshotOptions {
  source?: RuntimeSnapshot["meta"]["source"];
  scenarioId?: string | null;
  generatedAt?: string;
  deterministic?: boolean;
  readOnly?: boolean;
  includeRaw?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function getArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) return [];
  const child = value[key];
  return Array.isArray(child) ? child : [];
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

function runtimeMode(value: unknown): RuntimeMode {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (normalized === "MOCK") return "MOCK";
  if (normalized === "RUNTIME_READONLY") return "RUNTIME_READONLY";
  if (normalized === "OBSERVE_ONLY" || normalized === "READY" || normalized === "REDUCE_ONLY") return "OBSERVE_ONLY";
  return "UNKNOWN";
}

function verdict(value: unknown): Verdict {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "allowed" || normalized === "allow" || normalized === "true") return "allowed";
  if (normalized === "observe_only" || normalized === "observe-only" || normalized === "observe") return "observe_only";
  if (value === true) return "allowed";
  return "prohibited";
}

function severity(value: unknown): RuntimeRule["severity"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "info" || normalized === "warning" || normalized === "block" || normalized === "critical") {
    return normalized;
  }
  if (normalized === "fail" || normalized === "failed" || normalized === "error" || normalized === "blocked") return "block";
  return "unknown";
}

function passedFromStatus(value: unknown): boolean | null {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "pass" || normalized === "passed" || normalized === "ok" || normalized === "allowed") return true;
  if (normalized === "fail" || normalized === "failed" || normalized === "blocked" || normalized === "denied" || normalized === "error") return false;
  if (typeof value === "boolean") return value;
  return null;
}

function authorityStatus(value: unknown): RuntimeAuthoritySummary["status"] | undefined {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "pass" || normalized === "fail" || normalized === "partial" || normalized === "unknown") return normalized;
  return undefined;
}

function summarizeAuthority(value: unknown): RuntimeAuthoritySummary | undefined {
  if (!isRecord(value)) return undefined;
  const passed = typeof value.passed === "number" ? value.passed : undefined;
  const total = typeof value.total === "number" ? value.total : undefined;
  const failed = typeof value.failed === "number" ? value.failed : undefined;
  if (passed === undefined && total === undefined && failed === undefined && authorityStatus(value.status) === undefined) return undefined;

  const safePassed = passed ?? 0;
  const safeTotal = total ?? Math.max(safePassed, failed ?? 0);
  const safeFailed = failed ?? Math.max(0, safeTotal - safePassed);
  const status =
    authorityStatus(value.status) ??
    (safeTotal === 0 ? "unknown" : safeFailed > 0 ? "fail" : safePassed === safeTotal ? "pass" : "partial");
  return { passed: safePassed, total: safeTotal, failed: safeFailed, status };
}

function summarizeRules(rules: unknown[]): RuntimeAuthoritySummary {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { passed: 0, total: 0, failed: 0, status: "unknown" };
  }

  const passed = rules.filter((rule) => passedFromStatus(isRecord(rule) ? rule.status ?? rule.passed : undefined) === true).length;
  const failed = rules.filter((rule) => passedFromStatus(isRecord(rule) ? rule.status ?? rule.passed : undefined) === false).length;
  const total = rules.length;
  const status = failed > 0 ? "fail" : passed === total ? "pass" : "partial";
  return { passed, total, failed, status };
}

function panelStatus(value: unknown, fallbackMessage: string): RuntimePanelStatus {
  if (!isRecord(value)) return { status: "unknown", message: fallbackMessage };
  const rawStatus = typeof value.status === "string" ? value.status.toLowerCase() : "";
  const status =
    rawStatus === "ok" || rawStatus === "valid" || rawStatus === "ready" || rawStatus === "present"
      ? "ok"
      : rawStatus === "warning" || rawStatus === "degraded" || rawStatus === "stale"
        ? "warning"
        : rawStatus === "blocked" || rawStatus === "invalid" || rawStatus === "failed" || rawStatus === "fail" || rawStatus === "absent"
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

function runtimeProofBlockedBy(params: {
  input: Record<string, unknown>;
  source: RuntimeSnapshot["meta"]["source"];
  trust: TrustState;
  kernelAuthority: RuntimeAuthoritySummary;
  actionGate: RuntimeAuthoritySummary;
}): string[] {
  const blocked: string[] = [];
  if (params.source !== "runtime") return blocked;

  const exchangeTruth = getRecord(params.input, "exchangeTruth");
  const marketInputIntegrity = getRecord(params.input, "marketInputIntegrity");
  const permissionLedger = getRecord(params.input, "permissionLedger");
  const runtimeSource = typeof params.input.runtimeSource === "string" ? params.input.runtimeSource : "runtime-unavailable";

  if (runtimeSource !== "runtime-engine") blocked.push("runtimeSource");

  const exchangeStatus = typeof exchangeTruth?.status === "string" ? exchangeTruth.status.toLowerCase() : "unknown";
  const marketStatus = panelStatus(marketInputIntegrity, "market input integrity unavailable").status;
  const permissionStatus = panelStatus(permissionLedger, "permission ledger unavailable").status;

  if (exchangeStatus !== "present" && exchangeStatus !== "fresh" && exchangeStatus !== "ok") blocked.push("exchangeTruth");
  if (marketStatus !== "ok") blocked.push("marketInputIntegrity");
  if (permissionStatus !== "ok") blocked.push("permissionLedger");
  if (params.kernelAuthority.status !== "pass" || params.kernelAuthority.failed !== 0 || params.kernelAuthority.total <= 0) blocked.push("kernelAuthority");
  if (params.actionGate.status !== "pass" || params.actionGate.failed !== 0 || params.actionGate.total <= 0) blocked.push("actionGate");
  if (params.trust !== "TRUSTED") blocked.push("trustState");

  return blocked;
}


function rawSummary(input: unknown) {
  return {
    present: input !== undefined && input !== null,
    omittedForUiSafety: true,
    reason: "circular_or_large_runtime_object"
  };
}

function hasAllowedProof(params: {
  source: RuntimeSnapshot["meta"]["source"];
  input: Record<string, unknown>;
  trust: TrustState;
  kernelAuthority: RuntimeAuthoritySummary;
  actionGate: RuntimeAuthoritySummary;
}): boolean {
  if (
    params.trust !== "TRUSTED" ||
    params.kernelAuthority.total <= 0 ||
    params.kernelAuthority.failed !== 0 ||
    params.kernelAuthority.status !== "pass" ||
    params.actionGate.total <= 0 ||
    params.actionGate.failed !== 0 ||
    params.actionGate.status !== "pass"
  ) {
    return false;
  }

  if (params.source !== "runtime") return true;

  return runtimeProofBlockedBy(params).length === 0;
}

function enforceAllowedProof(params: {
  input: Record<string, unknown>;
  source: RuntimeSnapshot["meta"]["source"];
  requestedResult: Verdict;
  trust: TrustState;
  kernelAuthority: RuntimeAuthoritySummary;
  actionGate: RuntimeAuthoritySummary;
  blockingReasons: string[];
}): { result: Verdict; reason: string | undefined; blockedBy: string[] | undefined } {
  const runtimeBlocked = runtimeProofBlockedBy(params);

  if (params.requestedResult !== "allowed") {
    if (params.source === "runtime" && runtimeBlocked.length > 0) {
      return {
        result: "prohibited",
        reason: "runtime_read_model_missing_required_proof",
        blockedBy: [...params.blockingReasons, ...runtimeBlocked].filter(Boolean)
      };
    }
    return { result: params.requestedResult, reason: undefined, blockedBy: undefined };
  }

  if (hasAllowedProof(params)) {
    return { result: "allowed", reason: undefined, blockedBy: [] };
  }

  return {
    result: "prohibited",
    reason: "allowed_input_without_required_trust_proof",
    blockedBy: [...params.blockingReasons, ...runtimeBlocked, "normalizer_missing_proof"].filter(Boolean)
  };
}

function normalizeRule(rule: unknown, index: number): RuntimeRule {
  const record = isRecord(rule) ? rule : {};
  return {
    id: stringValue(record.ruleId ?? record.id, `rule-${index + 1}`),
    label: stringValue(record.label ?? record.labelRu ?? record.ruleId ?? record.id, `Rule ${index + 1}`),
    condition: stringValue(record.condition, "unknown"),
    fact: stringValue(record.actual ?? record.fact, "unknown"),
    effect: stringValue(record.effect ?? record.effectRu, "no effect reported"),
    severity: severity(record.severity ?? record.status),
    passed: passedFromStatus(record.status ?? record.passed)
  };
}

function pipelineStatus(value: unknown): RuntimePipelineStep["status"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "passed" || normalized === "pass" || normalized === "ok") return "passed";
  if (normalized === "failed" || normalized === "fail" || normalized === "error") return "failed";
  if (normalized === "blocked" || normalized === "deny" || normalized === "denied") return "blocked";
  if (normalized === "pending" || normalized === "waiting") return "pending";
  return "unknown";
}

function normalizePipelineStep(step: unknown, index: number): RuntimePipelineStep {
  const record = isRecord(step) ? step : {};
  return {
    id: stringValue(record.id ?? record.stepId, `pipeline-${index + 1}`),
    label: stringValue(record.label ?? record.labelRu ?? record.name, `Pipeline step ${index + 1}`),
    status: pipelineStatus(record.status ?? record.result),
    message: stringValue(record.message ?? record.detail ?? record.description, "")
  };
}

function normalizeDecisionStep(step: unknown, index: number): RuntimeDecisionStep {
  const normalized = normalizePipelineStep(step, index);
  return {
    id: normalized.id,
    label: normalized.label,
    status: normalized.status,
    message: normalized.message
  };
}

function normalizeRevision(item: unknown, index: number): RuntimeRevisionItem {
  const record = isRecord(item) ? item : {};
  return {
    id: stringValue(record.id ?? record.revision ?? record.snapshotHash, `revision-${index + 1}`),
    label: stringValue(record.label ?? record.status, `Revision ${index + 1}`),
    status: stringValue(record.status ?? record.label, "unknown"),
    timestamp: typeof record.timestamp === "string" ? record.timestamp : null
  };
}

function pickScenarioId(input: unknown, options?: NormalizeRuntimeSnapshotOptions): string | null {
  if (options?.scenarioId !== undefined) return options.scenarioId;
  if (!isRecord(input)) return null;
  const adapterMeta = getRecord(input, "adapterMeta");
  const scenario = getRecord(input, "scenario");
  const candidates = [
    input.scenarioId,
    adapterMeta?.scenarioId,
    scenario?.scenarioId,
    input.id
  ];
  const found = candidates.find((item) => typeof item === "string" && item.trim());
  return typeof found === "string" ? found : null;
}

function collectRules(input: unknown): { kernelRules: unknown[]; gateRules: unknown[]; allRules: RuntimeRule[] } {
  const rulesRecord = getRecord(input, "rules");
  const kernelRules = Array.isArray(rulesRecord?.kernelAuthority) ? rulesRecord.kernelAuthority : [];
  const gateRules = Array.isArray(rulesRecord?.actionGate) ? rulesRecord.actionGate : [];
  const topLevelRules = Array.isArray((input as Record<string, unknown> | undefined)?.rules) ? ((input as Record<string, unknown>).rules as unknown[]) : [];
  const combined = [...kernelRules, ...gateRules, ...topLevelRules].map(normalizeRule);
  return { kernelRules, gateRules, allRules: combined };
}


function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeExchangeTruthStatus(value: unknown): "present" | "absent" | "stale" | "unknown" | "pending" | "unverified" {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "present" || normalized === "ok") return "present";
  if (normalized === "absent" || normalized === "missing") return "absent";
  if (normalized === "stale") return "stale";
  if (normalized === "pending") return "pending";
  if (normalized === "unverified") return "unverified";
  return "unknown";
}

function semanticSummary(input: Record<string, unknown>, result: Verdict, blockingReasons: string[]): import("./runtime-snapshot.js").RuntimeSemanticSummary {
  const adapterMeta = getRecord(input, "adapterMeta");
  const event = getRecord(input, "event");
  const scenario = getRecord(input, "scenario");
  const provenance = getRecord(input, "provenance");
  const exchangeTruth = getRecord(input, "exchangeTruth");
  const marketInput = getRecord(input, "marketInputIntegrity") ?? getRecord(input, "marketInput");
  const recovery = getRecord(input, "recovery") ?? getRecord(input, "recoveryPlan");
  const pulse = getRecord(input, "pulse");
  const snapshotDiff = getRecord(input, "snapshotDiff");
  const ledger = getRecord(input, "ledger") ?? getRecord(input, "permissionLedger");
  const failure = getRecord(input, "failureVisualization");

  const rawExchangeStatus = exchangeTruth?.status ?? input.exchangeTruthStatus ?? marketInput?.exchangeTruthStatus ?? "unknown";
  const exchangeStatus = normalizeExchangeTruthStatus(rawExchangeStatus);
  const exchangeTruthPresent = exchangeTruth !== undefined || input.exchangeTruthPresent === true || marketInput?.exchangeTruthPresent === true;
  const providerFormat = stringValue(input.providerFormat ?? event?.providerFormat ?? provenance?.providerFormat ?? event?.provider ?? provenance?.provider ?? "unknown", "unknown");
  const sourceText = String(input.source ?? adapterMeta?.source ?? scenario?.source ?? "");
  const declaredAdapterMode = input.adapterMode ?? provenance?.adapterMode ?? event?.adapterMode;
  const adapterMode: "api" | "mock" | "runtime" | "unknown" =
    declaredAdapterMode === "mock" || sourceText.includes("mock") || providerFormat === "binance" || providerFormat === "binance-like" ? "mock" :
    declaredAdapterMode === "runtime" || sourceText.includes("runtime") ? "runtime" :
    declaredAdapterMode === "api" || sourceText.includes("api") || adapterMeta ? "api" : "unknown";
  const declaredSourceMode = input.sourceMode ?? provenance?.sourceMode ?? event?.sourceMode;
  const sourceMode: "live" | "simulated" | "local-dto" | "runtime-readonly" | "unknown" =
    declaredSourceMode === "simulated" ? "simulated" :
    declaredSourceMode === "local-dto" ? "local-dto" :
    declaredSourceMode === "runtime-readonly" ? "runtime-readonly" :
    declaredSourceMode === "live" ? "live" :
    adapterMode === "mock" ? "simulated" :
    adapterMode === "runtime" ? "runtime-readonly" :
    adapterMode === "api" ? "local-dto" : "unknown";

  const localProvenanceValid = booleanValue(provenance?.localProvenanceValid ?? provenance?.chainValid, false);
  const exchangeProofValid = booleanValue(provenance?.exchangeProofValid ?? exchangeTruth?.proofValid, false);
  const operatorExchangeStatus = exchangeProofValid ? exchangeStatus : "unknown";
  const payloadHash = typeof provenance?.payloadHash === "string" ? provenance.payloadHash :
    typeof provenance?.hash === "string" ? provenance.hash :
    typeof event?.payloadHash === "string" ? event.payloadHash :
    typeof input.payloadHash === "string" ? input.payloadHash : null;

  const freshnessStatus: "fresh" | "stale" | "unknown" = normalizeExchangeTruthStatus(marketInput?.freshnessStatus ?? marketInput?.status) === "present" || marketInput?.status === "fresh"
    ? "fresh"
    : marketInput?.status === "stale" ? "stale" : "unknown";

  const systemRecoveryRequired = booleanValue(recovery?.systemRecoveryRequired ?? recovery?.required, false);
  const trustRecoverySuggested = result !== "allowed" || blockingReasons.includes("exchangeTruth") || blockingReasons.includes("exchange_truth_absent");
  const blockingBefore = stringArray(snapshotDiff?.blockingReasonsBefore);
  const blockingAfter = stringArray(snapshotDiff?.blockingReasonsAfter).length ? stringArray(snapshotDiff?.blockingReasonsAfter) : blockingReasons;

  return {
    exchangeTruth: {
      present: Boolean(exchangeTruthPresent),
      status: operatorExchangeStatus,
      proof: exchangeProofValid ? "valid" as const : "missing" as const
    },
    adapter: {
      adapterMode,
      sourceMode,
      providerFormat: providerFormat === "binance" ? "binance-like" : providerFormat,
      liveExchangeConnected: false
    },
    provenance: {
      localProvenanceValid,
      exchangeProofValid,
      exchangeTruthStatus: operatorExchangeStatus,
      payloadHash,
      hashType: payloadHash ? "demo" as const : "unknown" as const,
      hashStrength: payloadHash ? "non_cryptographic_demo" as const : "unknown" as const
    },
    marketFreshness: {
      status: freshnessStatus,
      ageMs: typeof marketInput?.ageMs === "number" ? marketInput.ageMs : null,
      thresholdMs: typeof marketInput?.thresholdMs === "number" ? marketInput.thresholdMs : null,
      note: "Свежие рыночные данные не являются доказательством биржевой истины."
    },
    recovery: {
      systemRecoveryRequired,
      trustRecoverySuggested,
      trustRecoveryReason: trustRecoverySuggested ? "exchange_truth_unknown" : "none",
      autoRecoveryEnabled: false,
      mode: "OBSERVE_ONLY" as const,
      hints: trustRecoverySuggested ? ["Сверить биржевую истину", "Проверить источник рыночных данных"] : []
    },
    counters: {
      eventCounter: typeof pulse?.eventCounter === "number" ? pulse.eventCounter : null,
      snapshotRevision: typeof pulse?.snapshotRevision === "number" ? pulse.snapshotRevision : null,
      ledgerCounter: typeof ledger?.ledgerCounter === "number" ? ledger.ledgerCounter : null,
      ledgerRevision: typeof ledger?.ledgerRevision === "number" ? ledger.ledgerRevision : null,
      currentDecisionId: typeof ledger?.permissionId === "string" ? ledger.permissionId : null
    },
    snapshotDiff: {
      blockingReasonsBefore: blockingBefore,
      blockingReasonsAfter: blockingAfter
    },
    failureMatrix: {
      renderGuardTriggered: booleanValue(failure?.renderGuardTriggered ?? failure?.renderGuard, false),
      renderFallbackActive: booleanValue(failure?.renderFallbackActive ?? failure?.fallback, false),
      adapterMode,
      dataMode: sourceMode,
      finalSafetyState: result,
      executionSurface: "closed" as const
    }
  };
}

export function createFallbackRuntimeSnapshot(input: unknown, options?: NormalizeRuntimeSnapshotOptions): RuntimeSnapshot {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const snapshot: RuntimeSnapshot = {
    meta: {
      schemaVersion: "runtime-snapshot/v1",
      source: options?.source ?? "core-readonly",
      scenarioId: options?.scenarioId ?? null,
      generatedAt,
      deterministic: options?.deterministic ?? true,
      readOnly: options?.readOnly ?? true
    },
    machine: {
      status: "unknown",
      mode: "UNKNOWN",
      phase: "unknown"
    },
    trust: {
      state: "UNCERTAIN",
      score: null,
      reasons: ["normalization_fallback"]
    },
    verdict: {
      result: "prohibited",
      action: null,
      reason: "snapshot_normalization_fallback",
      blockedBy: ["normalizer"]
    },
    kernelAuthority: { passed: 0, total: 0, failed: 0, status: "unknown" },
    actionGate: { passed: 0, total: 0, failed: 0, status: "unknown" },
    panels: {
      rules: [],
      pipeline: [],
      decisionTrace: [],
      quarantine: { status: "unknown", message: "quarantine data missing" },
      recovery: { status: "unknown", message: "recovery data missing" },
      marketIntegrity: { status: "unknown", message: "market integrity data missing" },
      provenance: { status: "unknown", message: "provenance data missing" },
      revisionTimeline: []
    },
    semantic: semanticSummary({}, "prohibited", ["normalizer"])
  };
  if (options?.includeRaw === true) {
    snapshot.raw = input;
  } else {
    snapshot.rawSummary = rawSummary(input);
  }
  return snapshot;
}

export function normalizeRuntimeSnapshot(input: unknown, options?: NormalizeRuntimeSnapshotOptions): RuntimeSnapshot {
  try {
    if (!isRecord(input)) {
      return createFallbackRuntimeSnapshot(input, options);
    }

    const adapterMeta = getRecord(input, "adapterMeta");
    const pulse = getRecord(input, "pulse") ?? getRecord(input, "status") ?? {};
    const runtime = getRecord(input, "runtime") ?? {};
    const trustRecord = getRecord(input, "trust") ?? {};
    const machine = getRecord(input, "machine") ?? runtime;
    const gateVerdict = getRecord(input, "gateVerdict") ?? getRecord(input, "verdict") ?? {};
    const scenarioId = pickScenarioId(input, options);
    const { kernelRules, gateRules, allRules } = collectRules(input);
    const source = options?.source ?? (input.source === "runtime" ? "runtime" : "core-readonly");

    const blockingReasons = [
      ...stringArray(pulse.blockingReasons),
      ...stringArray(machine.blockingReasons),
      ...stringArray(gateVerdict.blockedBy),
      ...stringArray(input.blockingReasons),
      ...stringArray(trustRecord.reasons)
    ];

    const requestedResult = verdict(gateVerdict.result ?? gateVerdict.action ?? pulse.tradingAllowed ?? input.tradingAllowed);
    const trust = trustState(trustRecord.state ?? pulse.trustState ?? machine.trustState ?? input.trustState);
    const kernelAuthority = summarizeAuthority(input.kernelAuthority) ?? summarizeRules(kernelRules);
    const actionGate = summarizeAuthority(input.actionGate) ?? summarizeRules(gateRules);
    const proofGatedVerdict = enforceAllowedProof({
      input,
      source,
      requestedResult,
      trust,
      kernelAuthority,
      actionGate,
      blockingReasons
    });
    const result = proofGatedVerdict.result;

    const compatibility = adapterMeta?.adapterCompatibility && isRecord(adapterMeta.adapterCompatibility) ? adapterMeta.adapterCompatibility : undefined;
    const causalityTrace = getRecord(input, "causalityTrace");
    const causalitySteps = Array.isArray(causalityTrace?.steps) ? causalityTrace.steps : [];

    const snapshot: RuntimeSnapshot = {
      meta: {
        schemaVersion: "runtime-snapshot/v1",
        source,
        scenarioId,
        generatedAt: options?.generatedAt ?? stringValue(input.generatedAt ?? input.createdAtFromEvent ?? adapterMeta?.generatedAtFromEvent, new Date().toISOString()),
        deterministic: options?.deterministic ?? Boolean(compatibility ? compatibility.deterministic : (typeof input.deterministic === "boolean" ? input.deterministic : true)),
        readOnly: options?.readOnly ?? Boolean(compatibility ? compatibility.readOnly : (typeof input.readOnly === "boolean" ? input.readOnly : true))
      },
      machine: {
        status: stringValue(machine.status ?? pulse.status ?? runtime.status, "unknown"),
        mode: runtimeMode(machine.runtimeMode ?? pulse.runtimeMode ?? runtime.mode ?? input.runtimeMode),
        phase: stringValue(machine.phase ?? runtime.phase ?? input.phase ?? input.endpoint, "unknown")
      },
      trust: {
        state: trust,
        score: numberOrNull(trustRecord.score ?? pulse.trustScore ?? machine.trustScore ?? input.trustScore),
        reasons: blockingReasons.length ? blockingReasons : trust === "TRUSTED" ? [] : ["missing_or_uncertain_data"]
      },
      verdict: {
        result,
        action: typeof gateVerdict.action === "string" && gateVerdict.action !== "deny" ? gateVerdict.action : null,
        reason: proofGatedVerdict.reason ?? stringValue(gateVerdict.reason ?? pulse.summary ?? machine.mainReason, result === "allowed" ? "allowed_by_input" : "missing_data_blocks_action"),
        blockedBy: proofGatedVerdict.blockedBy ?? (result === "allowed" ? [] : (blockingReasons.length ? blockingReasons : ["normalizer"]))
      },
      kernelAuthority,
      actionGate,
      panels: {
        rules: allRules,
        pipeline: getArray(input, "pipeline").map(normalizePipelineStep),
        decisionTrace: getArray(input, "decisionTrace").length
          ? getArray(input, "decisionTrace").map(normalizeDecisionStep)
          : (causalitySteps.length ? causalitySteps : getArray(input, "verdictTrace")).map(normalizeDecisionStep),
        quarantine: panelStatus(input.quarantine ?? input.quarantineRecords, "quarantine data missing"),
        recovery: panelStatus(input.recovery ?? input.recoveryHints, "recovery data missing"),
        marketIntegrity: panelStatus(input.marketInputIntegrity ?? input.marketInput, "market integrity data missing"),
        provenance: panelStatus(input.provenance ?? input.exchangeTruth, "provenance data missing"),
        revisionTimeline: getArray(input, "revisionTimeline").length
          ? getArray(input, "revisionTimeline").map(normalizeRevision)
          : getArray(input, "revisions").map(normalizeRevision)
      },
      semantic: semanticSummary(input, result, proofGatedVerdict.blockedBy ?? blockingReasons)
    };

    if (options?.includeRaw === true) {
      snapshot.raw = input;
    } else {
      snapshot.rawSummary = rawSummary(input);
    }
    return snapshot;
  } catch {
    return createFallbackRuntimeSnapshot(input, options);
  }
}
