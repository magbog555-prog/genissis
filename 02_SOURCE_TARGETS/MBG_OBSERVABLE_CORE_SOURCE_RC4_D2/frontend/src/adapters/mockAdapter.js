
// v0.8.1 read-only mock adapter: scenario -> canonical ComputationTraceDTO.
// No Core mutation, no trust/gate/permission calculation. Values are fixture DTOs only.

export const scenarioOptions = [
  'HEALTHY_TRUSTED_READY',
  'EXCHANGE_TRUTH_UNKNOWN_DENY',
  'MARKET_INPUT_UNKNOWN_DENY',
  'MARKET_INPUT_STALE_DENY',
  'MARKET_INPUT_GAP_DENY',
  'DUPLICATE_EVENT_IDEMPOTENT',
  'INVALID_EVENT_QUARANTINE',
  'MISSING_PROVENANCE_DENY',
  'PROVENANCE_MISMATCH_COMPROMISE',
  'SNAPSHOT_HASH_MISMATCH',
  'REPLAY_MISMATCH_BLOCK',
  'RECOVERY_ONLY_MODE',
  'CANCEL_REDUCE_ONLY_ALLOWED',
  'VALID_OBSERVATION_NO_PERMISSION',
  'FULL_READY_GATE_DECIDES',
  'CORRUPTION_VISIBLE',
  'QUARANTINE_ESCALATION',
  'MALFORMED_TRACE_GUARD',
  'API_FAILURE_FALLBACK'
].map(id => ({id, label:id.replaceAll('_',' ').toLowerCase(), labelRu:id}));

import {normalizeRuntimeSnapshot} from '../contracts/runtimeSnapshot.js';

const now = '2026-05-09T12:00:00.000Z';
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function statusFor(id){
  if(id==='HEALTHY_TRUSTED_READY' || id==='FULL_READY_GATE_DECIDES') return ['TRUSTED','READY',true,'allow','healthy'];
  if(id==='CANCEL_REDUCE_ONLY_ALLOWED') return ['DEGRADED','REDUCE_ONLY',false,'cancel_reduce_only_allowed','reduce-only safety path'];
  if(id.includes('RECOVERY')) return ['UNCERTAIN','RECOVERY_ONLY',false,'deny','recovery only'];
  if(id.includes('COMPROMISE') || id.includes('CORRUPTION')) return ['COMPROMISED','HALTED',false,'deny','integrity failure'];
  return ['UNCERTAIN','OBSERVE_ONLY',false,'deny',id.toLowerCase()];
}
function ensureArray(v){ return Array.isArray(v) ? v : []; }

export function buildCanonicalTrace(baseTrace, scenarioId='HEALTHY_TRUSTED_READY'){
  const t = clone(baseTrace || {});
  const [trustState,runtimeMode,tradingAllowed,action,reason]=statusFor(scenarioId);
  t.traceId = `trace-v081-${scenarioId.toLowerCase()}`;
  t.apiVersion = 'core-computation-trace-dto-v0.8.1';
  t.generatedAt = now;
  t.scenario = {scenarioId, scenarioLabel:scenarioId, source:'mock-adapter', dtoVersion:'v0.8.1', generatedAt:now};
  t.adapter = {mode:'mock', readOnly:true, coreMutation:false};
  t.machine = {
    ...(t.machine||{}), status: scenarioId==='MALFORMED_TRACE_GUARD'?'GUARDED':'RUNNING',
    trustState, runtimeMode, tradingAllowed, revision: Number(t.machine?.revision||134)+scenarioOptions.findIndex(x=>x.id===scenarioId),
    lastEventType: scenarioId.toLowerCase(), mainReason: reason
  };
  t.event = {...(t.event||{}), eventId:`evt-${scenarioId.toLowerCase()}`, eventType: scenarioId, source:'mock', receivedAt:now};
  t.pipeline = ensureArray(t.pipeline).map((s,i)=>({...s,status:i<3?'pass':(action==='allow'?'applied':'blocked'),summary:`${s.label||s.stepId}: ${reason}`}));
  if(['INVALID_EVENT_QUARANTINE','QUARANTINE_ESCALATION','MALFORMED_TRACE_GUARD'].includes(scenarioId)){
    t.pipeline = t.pipeline.map(s=>s.stepId==='validation'?{...s,status:'fail',summary:'invalid or malformed DTO guarded'}:s);
  }
  if(['MARKET_INPUT_STALE_DENY','MARKET_INPUT_GAP_DENY','MARKET_INPUT_UNKNOWN_DENY'].includes(scenarioId)){
    t.pipeline = t.pipeline.map(s=>s.stepId==='market_integrity'?{...s,status:'fail',summary:'market input integrity denied'}:s);
  }
  t.gateVerdict = {...(t.gateVerdict||{}), action, allowed: action==='allow', reason, final: action};
  t.ledger = {...(t.ledger||{}), result: action==='allow'?'append':'read_only_record', reason};
  t.quarantine = {
    ...(t.quarantine||{}),
    result: scenarioId.includes('QUARANTINE') || scenarioId==='INVALID_EVENT_QUARANTINE' ? 'quarantined' : 'not_required',
    reason
  };
  t.marketIntegrity = {
    dto:'MarketInputIntegrityDTO',
    exchangeTruthPresent: true,
    exchangeTruthStatus: 'unknown',
    exchangeTruthProof: 'missing',
    inputStatus: scenarioId==='MARKET_INPUT_UNKNOWN_DENY'?'unknown':scenarioId==='MARKET_INPUT_STALE_DENY'?'stale':scenarioId==='MARKET_INPUT_GAP_DENY'?'gap':'fresh',
    symbol:'BTCUSDT',
    readOnly:true
  };
  t.provenance = {
    dto:'ProvenanceDTO',
    adapterMode:'mock',
    sourceMode:'simulated',
    providerFormat: scenarioId==='MISSING_PROVENANCE_DENY'?'missing field':'binance-like',
    liveExchangeConnected:false,
    localProvenanceValid: !['MISSING_PROVENANCE_DENY','PROVENANCE_MISMATCH_COMPROMISE'].includes(scenarioId),
    exchangeProofValid:false,
    exchangeTruthStatus:'unknown',
    hash: scenarioId==='PROVENANCE_MISMATCH_COMPROMISE'?'mismatch':'a12bc34d',
    hashType:'demo',
    hashStrength:'non_cryptographic_demo'
  };
  t.replayRevision = {
    dto:'ReplayRevisionDTO',
    replayStatus: scenarioId==='REPLAY_MISMATCH_BLOCK'?'mismatch_blocked':'matched',
    revisions:[132,133,134].map(r=>({revision:r,status:r===134?'current':'verified',hash:`hash-${scenarioId}-${r}`})),
    deterministic: scenarioId!=='REPLAY_MISMATCH_BLOCK'
  };
  t.recovery = {
    dto:'RecoveryHintDTO',
    mode: runtimeMode,
    systemRecoveryRequired: false,
    trustRecoverySuggested: action !== 'allow' || t.marketIntegrity.exchangeTruthStatus === 'unknown',
    trustRecoveryReason: action !== 'allow' || t.marketIntegrity.exchangeTruthStatus === 'unknown' ? 'exchange_truth_unknown' : 'none',
    autoRecoveryEnabled: false,
    hints: action !== 'allow' || t.marketIntegrity.exchangeTruthStatus === 'unknown'
      ? ['reconcile_exchange_truth','check_market_data_source']
      : []
  };
  t.failureVisualization = {
    dto:'FailureMatrixDTO',
    scenario: scenarioId,
    scenarioId,
    severity: trustState==='COMPROMISED'?'critical':action==='deny'?'warning':'normal',
    renderGuardTriggered: scenarioId==='MALFORMED_TRACE_GUARD',
    renderFallbackActive: scenarioId==='API_FAILURE_FALLBACK',
    adapterMode: 'mock',
    dataMode: 'simulated',
    finalSafetyState: action === 'allow' ? 'allowed' : 'prohibited',
    executionSurface: 'closed',
    blocks:[
      {block:'market',state:t.marketIntegrity.inputStatus},
      {block:'provenance',state:t.provenance.localProvenanceValid?'valid':'invalid'},
      {block:'replay',state:t.replayRevision.replayStatus},
      {block:'gate',state:action}
    ]
  };
  if(scenarioId==='SNAPSHOT_HASH_MISMATCH'){
    t.snapshotDiff = [...ensureArray(t.snapshotDiff), {path:'snapshot.hash', before:'hash-ok', after:'hash-mismatch', change:'blocked'}];
    t.failureVisualization.blocks.push({block:'snapshot',state:'hash_mismatch'});
  }
  if(scenarioId==='DUPLICATE_EVENT_IDEMPOTENT'){
    t.pipeline = t.pipeline.map(s=>s.stepId==='idempotency'?{...s,status:'pass',summary:'duplicate event ignored idempotently'}:s);
  }
  if(scenarioId==='MALFORMED_TRACE_GUARD'){
    delete t.formulas;
    t.failureVisualization.malformedFields=['formulas'];
  }
  t.runtimeSnapshot = normalizeRuntimeSnapshot(t, {source:'mock', scenarioId, readOnly:true, deterministic:true});
  return t;
}
