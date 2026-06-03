export const RUNTIME_SNAPSHOT_SCHEMA_VERSION = 'runtime-snapshot/v1';

function isRecord(value){
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value, fallback){
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function stringArray(value){
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asTrustState(value){
  const normalized = typeof value === 'string' ? value.toUpperCase() : '';
  if(normalized === 'TRUSTED') return 'TRUSTED';
  if(normalized === 'UNTRUSTED' || normalized === 'COMPROMISED') return 'UNTRUSTED';
  if(normalized === 'BLOCKED' || normalized === 'HALTED') return 'BLOCKED';
  return 'UNCERTAIN';
}

function asRuntimeMode(value){
  const normalized = typeof value === 'string' ? value.toUpperCase() : '';
  if(normalized === 'MOCK') return 'MOCK';
  if(normalized === 'RUNTIME_READONLY') return 'RUNTIME_READONLY';
  if(normalized === 'OBSERVE_ONLY' || normalized === 'READY' || normalized === 'REDUCE_ONLY') return 'OBSERVE_ONLY';
  return 'UNKNOWN';
}

function asVerdict(value){
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if(normalized === 'allowed' || normalized === 'allow') return 'allowed';
  if(normalized === 'observe_only' || normalized === 'observe-only' || normalized === 'observe') return 'observe_only';
  if(value === true) return 'allowed';
  return 'prohibited';
}

function passedFromStatus(value){
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if(normalized === 'pass' || normalized === 'passed' || normalized === 'ok' || normalized === 'allowed') return true;
  if(normalized === 'fail' || normalized === 'failed' || normalized === 'blocked' || normalized === 'denied' || normalized === 'error') return false;
  if(typeof value === 'boolean') return value;
  return null;
}

function summarizeRules(rules){
  if(!Array.isArray(rules) || !rules.length) return {passed:0,total:0,failed:0,status:'unknown'};
  const passed = rules.filter(rule=>passedFromStatus(rule?.status ?? rule?.passed) === true).length;
  const failed = rules.filter(rule=>passedFromStatus(rule?.status ?? rule?.passed) === false).length;
  const total = rules.length;
  return {passed,total,failed,status: failed>0 ? 'fail' : (passed===total ? 'pass' : 'partial')};
}

function normalizeRule(rule,index){
  const r = isRecord(rule) ? rule : {};
  const passed = passedFromStatus(r.status ?? r.passed);
  const severity = (() => {
    const normalized = typeof (r.severity ?? r.status) === 'string' ? String(r.severity ?? r.status).toLowerCase() : '';
    if(['info','warning','block','critical'].includes(normalized)) return normalized;
    if(['fail','failed','error','blocked'].includes(normalized)) return 'block';
    return 'unknown';
  })();
  return {
    id: stringValue(r.ruleId ?? r.id, `rule-${index+1}`),
    label: stringValue(r.label ?? r.labelRu ?? r.ruleId ?? r.id, `Rule ${index+1}`),
    condition: stringValue(r.condition, 'unknown'),
    fact: stringValue(r.actual ?? r.fact, 'unknown'),
    effect: stringValue(r.effect ?? r.effectRu, 'no effect reported'),
    severity,
    passed
  };
}

function statusFromStep(value){
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if(['passed','pass','ok'].includes(normalized)) return 'passed';
  if(['failed','fail','error'].includes(normalized)) return 'failed';
  if(['blocked','deny','denied'].includes(normalized)) return 'blocked';
  if(['pending','waiting'].includes(normalized)) return 'pending';
  return 'unknown';
}

function normalizeStep(step,index){
  const s = isRecord(step) ? step : {};
  return {
    id: stringValue(s.id ?? s.stepId, `step-${index+1}`),
    label: stringValue(s.label ?? s.labelRu ?? s.name, `Step ${index+1}`),
    status: statusFromStep(s.status ?? s.result),
    message: stringValue(s.message ?? s.detail ?? s.description, '')
  };
}

function panelStatus(value, fallbackMessage){
  if(!isRecord(value)) return {status:'unknown', message:fallbackMessage};
  const raw = typeof value.status === 'string' ? value.status.toLowerCase() : '';
  const status = ['ok','valid','ready'].includes(raw) ? 'ok'
    : ['warning','degraded'].includes(raw) ? 'warning'
    : ['blocked','invalid','failed'].includes(raw) ? 'blocked'
    : raw === 'pending' ? 'pending'
    : 'unknown';
  return {status, message:stringValue(value.message ?? value.reason ?? value.status, fallbackMessage), data:{present:true, omittedForUiSafety:true, reason:"circular_or_large_runtime_object"}};
}

function rawSummary(input){
  return {
    present: input !== undefined && input !== null,
    omittedForUiSafety: true,
    reason: "circular_or_large_runtime_object"
  };
}

function normalizeRevision(item,index){
  const r = isRecord(item) ? item : {};
  return {
    id: stringValue(r.id ?? r.revision ?? r.snapshotHash, `revision-${index+1}`),
    label: stringValue(r.label ?? r.status, `Revision ${index+1}`),
    status: stringValue(r.status ?? r.label, 'unknown'),
    timestamp: typeof r.timestamp === 'string' ? r.timestamp : null
  };
}


function booleanValue(value, fallback=false){
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeExchangeTruthStatus(value){
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if(['present','ok'].includes(normalized)) return 'present';
  if(['absent','missing'].includes(normalized)) return 'absent';
  if(normalized === 'stale') return 'stale';
  if(normalized === 'pending') return 'pending';
  if(normalized === 'unverified') return 'unverified';
  return 'unknown';
}

function semanticSummary(input={}, result='prohibited', blockingReasons=[]){
  const adapterMeta = isRecord(input.adapterMeta) ? input.adapterMeta : {};
  const event = isRecord(input.event) ? input.event : {};
  const scenario = isRecord(input.scenario) ? input.scenario : {};
  const provenance = isRecord(input.provenance) ? input.provenance : {};
  const exchangeTruth = isRecord(input.exchangeTruth) ? input.exchangeTruth : {};
  const marketInput = isRecord(input.marketInputIntegrity) ? input.marketInputIntegrity : (isRecord(input.marketInput) ? input.marketInput : {});
  const recovery = isRecord(input.recovery) ? input.recovery : (isRecord(input.recoveryPlan) ? input.recoveryPlan : {});
  const pulse = isRecord(input.pulse) ? input.pulse : {};
  const snapshotDiff = isRecord(input.snapshotDiff) ? input.snapshotDiff : {};
  const ledger = isRecord(input.ledger) ? input.ledger : (isRecord(input.permissionLedger) ? input.permissionLedger : {});
  const failure = isRecord(input.failureVisualization) ? input.failureVisualization : {};

  const exchangeStatus = normalizeExchangeTruthStatus(exchangeTruth.status ?? input.exchangeTruthStatus ?? marketInput.exchangeTruthStatus);
  const providerRaw = stringValue(input.providerFormat ?? event.providerFormat ?? provenance.providerFormat ?? event.provider ?? provenance.provider, 'unknown');
  const sourceText = String(input.source ?? adapterMeta.source ?? scenario.source ?? '');
  const declaredAdapterMode = input.adapterMode ?? provenance.adapterMode ?? event.adapterMode;
  const adapterMode = declaredAdapterMode === 'mock' || sourceText.includes('mock') || providerRaw === 'binance' || providerRaw === 'binance-like'
    ? 'mock'
    : declaredAdapterMode === 'runtime' || sourceText.includes('runtime') ? 'runtime' : declaredAdapterMode === 'api' || sourceText.includes('api') || Object.keys(adapterMeta).length ? 'api' : 'unknown';
  const declaredSourceMode = input.sourceMode ?? provenance.sourceMode ?? event.sourceMode;
  const sourceMode = declaredSourceMode === 'simulated' ? 'simulated'
    : declaredSourceMode === 'local-dto' ? 'local-dto'
    : declaredSourceMode === 'runtime-readonly' ? 'runtime-readonly'
    : declaredSourceMode === 'live' ? 'live'
    : adapterMode === 'mock' ? 'simulated' : adapterMode === 'runtime' ? 'runtime-readonly' : adapterMode === 'api' ? 'local-dto' : 'unknown';
  const localProvenanceValid = booleanValue(provenance.localProvenanceValid ?? provenance.chainValid, false);
  const exchangeProofValid = booleanValue(provenance.exchangeProofValid ?? exchangeTruth.proofValid, false);
  const operatorExchangeStatus = exchangeProofValid ? exchangeStatus : 'unknown';
  const payloadHash = typeof provenance.payloadHash === 'string' ? provenance.payloadHash : typeof provenance.hash === 'string' ? provenance.hash : typeof event.payloadHash === 'string' ? event.payloadHash : null;
  const freshnessStatus = marketInput.status === 'fresh' ? 'fresh' : marketInput.status === 'stale' ? 'stale' : 'unknown';
  const trustRecoverySuggested = result !== 'allowed' || blockingReasons.includes('exchangeTruth') || blockingReasons.includes('exchange_truth_absent');
  const after = stringArray(snapshotDiff.blockingReasonsAfter).length ? stringArray(snapshotDiff.blockingReasonsAfter) : blockingReasons;

  return {
    exchangeTruth: {
      present: Boolean(Object.keys(exchangeTruth).length || input.exchangeTruthPresent === true || marketInput.exchangeTruthPresent === true),
      status: operatorExchangeStatus,
      proof: exchangeProofValid ? 'valid' : 'missing'
    },
    adapter: {
      adapterMode,
      sourceMode,
      providerFormat: providerRaw === 'binance' ? 'binance-like' : providerRaw,
      liveExchangeConnected: false
    },
    provenance: {
      localProvenanceValid,
      exchangeProofValid,
      exchangeTruthStatus: operatorExchangeStatus,
      payloadHash,
      hashType: payloadHash ? 'demo' : 'unknown',
      hashStrength: payloadHash ? 'non_cryptographic_demo' : 'unknown'
    },
    marketFreshness: {
      status: freshnessStatus,
      ageMs: typeof marketInput.ageMs === 'number' ? marketInput.ageMs : null,
      thresholdMs: typeof marketInput.thresholdMs === 'number' ? marketInput.thresholdMs : null,
      note: 'Свежие рыночные данные не являются доказательством биржевой истины.'
    },
    recovery: {
      systemRecoveryRequired: booleanValue(recovery.systemRecoveryRequired ?? recovery.required, false),
      trustRecoverySuggested,
      trustRecoveryReason: trustRecoverySuggested ? 'exchange_truth_unknown' : 'none',
      autoRecoveryEnabled: false,
      mode: 'OBSERVE_ONLY',
      hints: trustRecoverySuggested ? ['Сверить биржевую истину', 'Проверить источник рыночных данных'] : []
    },
    counters: {
      eventCounter: typeof pulse.eventCounter === 'number' ? pulse.eventCounter : null,
      snapshotRevision: typeof pulse.snapshotRevision === 'number' ? pulse.snapshotRevision : null,
      ledgerCounter: typeof ledger.ledgerCounter === 'number' ? ledger.ledgerCounter : null,
      ledgerRevision: typeof ledger.ledgerRevision === 'number' ? ledger.ledgerRevision : null,
      currentDecisionId: typeof ledger.permissionId === 'string' ? ledger.permissionId : null
    },
    snapshotDiff: {
      blockingReasonsBefore: stringArray(snapshotDiff.blockingReasonsBefore),
      blockingReasonsAfter: after
    },
    failureMatrix: {
      renderGuardTriggered: booleanValue(failure.renderGuardTriggered ?? failure.renderGuard, false),
      renderFallbackActive: booleanValue(failure.renderFallbackActive ?? failure.fallback, false),
      adapterMode,
      dataMode: sourceMode,
      finalSafetyState: result,
      executionSurface: 'closed'
    }
  };
}

export function createFallbackRuntimeSnapshot(input, options={}){
  return {
    meta: {
      schemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
      source: options.source || 'core-readonly',
      scenarioId: options.scenarioId ?? null,
      generatedAt: options.generatedAt || new Date().toISOString(),
      deterministic: options.deterministic ?? true,
      readOnly: options.readOnly ?? true
    },
    machine: {status:'unknown', mode:'UNKNOWN', phase:'unknown'},
    trust: {state:'UNCERTAIN', score:null, reasons:['normalization_fallback']},
    verdict: {result:'prohibited', action:null, reason:'snapshot_normalization_fallback', blockedBy:['normalizer']},
    kernelAuthority: {passed:0,total:0,failed:0,status:'unknown'},
    actionGate: {passed:0,total:0,failed:0,status:'unknown'},
    panels: {
      rules: [],
      pipeline: [],
      decisionTrace: [],
      quarantine: {status:'unknown', message:'quarantine data missing'},
      recovery: {status:'unknown', message:'recovery data missing'},
      marketIntegrity: {status:'unknown', message:'market integrity data missing'},
      provenance: {status:'unknown', message:'provenance data missing'},
      revisionTimeline: []
    },
    semantic: semanticSummary({}, 'prohibited', ['normalizer']),
    ...(options.includeRaw === true ? {raw: input} : {rawSummary: rawSummary(input)})
  };
}


function normalizeExistingSnapshot(input, options={}){
  const fallback = createFallbackRuntimeSnapshot(input, {
    source: options.source || input?.meta?.source || 'core-readonly',
    scenarioId: options.scenarioId ?? input?.meta?.scenarioId ?? null,
    generatedAt: options.generatedAt || input?.meta?.generatedAt,
    deterministic: options.deterministic ?? input?.meta?.deterministic,
    readOnly: options.readOnly ?? input?.meta?.readOnly,
    includeRaw: false
  });

  return {
    ...fallback,
    meta: {
      ...fallback.meta,
      ...(isRecord(input.meta) ? input.meta : {}),
      schemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
      source: options.source || input?.meta?.source || fallback.meta.source,
      readOnly: options.readOnly ?? input?.meta?.readOnly ?? true
    },
    machine: {
      ...fallback.machine,
      ...(isRecord(input.machine) ? input.machine : {})
    },
    trust: {
      ...fallback.trust,
      ...(isRecord(input.trust) ? input.trust : {})
    },
    verdict: {
      ...fallback.verdict,
      ...(isRecord(input.verdict) ? input.verdict : {})
    },
    kernelAuthority: {
      ...fallback.kernelAuthority,
      ...(isRecord(input.kernelAuthority) ? input.kernelAuthority : {})
    },
    actionGate: {
      ...fallback.actionGate,
      ...(isRecord(input.actionGate) ? input.actionGate : {})
    },
    panels: {
      ...fallback.panels,
      ...(isRecord(input.panels) ? input.panels : {})
    },
    semantic: isRecord(input.semantic) ? input.semantic : semanticSummary(input, fallback.verdict.result, fallback.verdict.blockedBy),
    ...(options.includeRaw === true ? {raw: input.raw ?? input} : {rawSummary: rawSummary(input.raw ?? input)})
  };
}

export function normalizeRuntimeSnapshot(input, options={}){
  try{
    if(!isRecord(input)) return createFallbackRuntimeSnapshot(input, options);
    if(input?.meta?.schemaVersion === RUNTIME_SNAPSHOT_SCHEMA_VERSION) return normalizeExistingSnapshot(input, options);

    const adapterMeta = isRecord(input.adapterMeta) ? input.adapterMeta : {};
    const compatibility = isRecord(adapterMeta.adapterCompatibility) ? adapterMeta.adapterCompatibility : {};
    const pulse = isRecord(input.pulse) ? input.pulse : (isRecord(input.status) ? input.status : {});
    const machine = isRecord(input.machine) ? input.machine : {};
    const gateVerdict = isRecord(input.gateVerdict) ? input.gateVerdict : (isRecord(input.verdict) ? input.verdict : {});
    const scenarioObj = isRecord(input.scenario) ? input.scenario : {};
    const rules = isRecord(input.rules) ? input.rules : {};
    const kernelRules = Array.isArray(rules.kernelAuthority) ? rules.kernelAuthority : [];
    const gateRules = Array.isArray(rules.actionGate) ? rules.actionGate : [];
    const topRules = Array.isArray(input.rules) ? input.rules : [];
    const allRules = [...kernelRules, ...gateRules, ...topRules].map(normalizeRule);
    const blockingReasons = [
      ...stringArray(pulse.blockingReasons),
      ...stringArray(machine.blockingReasons),
      ...stringArray(gateVerdict.blockedBy),
      ...stringArray(input.blockingReasons)
    ];
    const trust = asTrustState(pulse.trustState ?? machine.trustState ?? input.trustState);
    const requestedResult = asVerdict(gateVerdict.result ?? gateVerdict.action ?? pulse.tradingAllowed);
    const kernelAuthority = summarizeRules(kernelRules);
    const actionGate = summarizeRules(gateRules);
    const result = requestedResult;
    const scenarioId = options.scenarioId ?? input.scenarioId ?? adapterMeta.scenarioId ?? scenarioObj.scenarioId ?? input.id ?? null;

    return {
      meta: {
        schemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
        source: options.source || 'core-readonly',
        scenarioId: typeof scenarioId === 'string' ? scenarioId : null,
        generatedAt: options.generatedAt || stringValue(input.generatedAt ?? input.createdAtFromEvent ?? adapterMeta.generatedAtFromEvent, new Date().toISOString()),
        deterministic: options.deterministic ?? Boolean(compatibility.deterministic ?? true),
        readOnly: options.readOnly ?? Boolean(compatibility.readOnly ?? true)
      },
      machine: {
        status: stringValue(machine.status ?? pulse.status, 'unknown'),
        mode: asRuntimeMode(machine.runtimeMode ?? pulse.runtimeMode ?? input.runtimeMode),
        phase: stringValue(machine.phase ?? input.phase ?? input.endpoint, 'unknown')
      },
      trust: {
        state: trust,
        score: typeof (pulse.trustScore ?? machine.trustScore ?? input.trustScore) === 'number' ? (pulse.trustScore ?? machine.trustScore ?? input.trustScore) : null,
        reasons: blockingReasons.length ? blockingReasons : (trust === 'TRUSTED' ? [] : ['missing_or_uncertain_data'])
      },
      verdict: {
        result,
        action: typeof gateVerdict.action === 'string' && gateVerdict.action !== 'deny' ? gateVerdict.action : null,
        reason: stringValue(gateVerdict.reason ?? pulse.summary ?? machine.mainReason, result === 'allowed' ? 'allowed_by_input' : 'missing_data_blocks_action'),
        blockedBy: result === 'allowed' ? [] : (blockingReasons.length ? blockingReasons : ['normalizer'])
      },
      kernelAuthority,
      actionGate,
      panels: {
        rules: allRules,
        pipeline: Array.isArray(input.pipeline) ? input.pipeline.map(normalizeStep) : [],
        decisionTrace: Array.isArray(input.decisionTrace) ? input.decisionTrace.map(normalizeStep) : (Array.isArray(input.verdictTrace) ? input.verdictTrace.map(normalizeStep) : []),
        quarantine: panelStatus(input.quarantine ?? input.quarantineRecords, 'quarantine data missing'),
        recovery: panelStatus(input.recovery ?? input.recoveryHints, 'recovery data missing'),
        marketIntegrity: panelStatus(input.marketInputIntegrity ?? input.marketInput, 'market integrity data missing'),
        provenance: panelStatus(input.provenance, 'provenance data missing'),
        revisionTimeline: Array.isArray(input.revisionTimeline) ? input.revisionTimeline.map(normalizeRevision) : (Array.isArray(input.revisions) ? input.revisions.map(normalizeRevision) : [])
      },
      semantic: semanticSummary(input, result, blockingReasons),
      ...(options.includeRaw === true ? {raw: input} : {rawSummary: rawSummary(input)})
    };
  }catch(_err){
    return createFallbackRuntimeSnapshot(input, options);
  }
}
