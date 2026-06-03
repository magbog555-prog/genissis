import {buildCanonicalTrace, scenarioOptions} from './mockAdapter.js';
import baseTrace from '../mockComputationTrace.json';
import {normalizeRuntimeSnapshot} from '../contracts/runtimeSnapshot.js';

function isPlainObject(value){
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeDefaults(defaults, incoming){
  if(Array.isArray(defaults)){
    return Array.isArray(incoming) ? incoming : defaults;
  }
  if(isPlainObject(defaults)){
    const out = {...defaults};
    if(isPlainObject(incoming)){
      for(const [key,value] of Object.entries(incoming)){
        out[key] = deepMergeDefaults(defaults[key], value);
      }
    }
    return out;
  }
  return incoming === undefined || incoming === null ? defaults : incoming;
}

function normalizeScenarioId(input, fallback='EXCHANGE_TRUTH_UNKNOWN_DENY'){
  if(typeof input === 'string' && input.trim()) return input;
  if(typeof input?.id === 'string') return input.id;
  if(typeof input?.scenarioId === 'string') return input.scenarioId;
  if(typeof input?.scenario?.scenarioId === 'string') return input.scenario.scenarioId;
  return fallback;
}

function normalizeScenarios(dto){
  const list = Array.isArray(dto) ? dto : (Array.isArray(dto?.scenarios) ? dto.scenarios : scenarioOptions);
  return list.map(item=>{
    if(typeof item === 'string') return {id:item, label:item, labelRu:item};
    const id = normalizeScenarioId(item, item?.name || item?.label || 'UNKNOWN_SCENARIO');
    return {
      ...item,
      id,
      label: item?.label || item?.name || id,
      labelRu: item?.labelRu || item?.label || item?.name || id
    };
  });
}

export class ApiAdapter {
  constructor(baseUrl=(import.meta?.env?.VITE_CORE_API_BASE_URL || 'http://localhost:3011')){
    this.baseUrl = baseUrl.replace(/\/$/,'');
  }

  async getJson(path){
    const res = await fetch(`${this.baseUrl}${path}`, {method:'GET', headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  }

  async loadScenario(scenarioId){
    const selectedScenarioId = normalizeScenarioId(scenarioId);
    const calls = [
      this.getJson('/health').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/scenarios').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/status').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/computation-trace/latest').catch(error=>({error:String(error.message||error)})),
      this.getJson(`/api/core/computation-trace/latest?scenario=${encodeURIComponent(selectedScenarioId)}`).catch(error=>({error:String(error.message||error)})),
      this.getJson(`/api/core/trace/${encodeURIComponent(selectedScenarioId)}`).catch(error=>({error:String(error.message||error)})),
      this.getJson(`/api/core/status/${encodeURIComponent(selectedScenarioId)}`).catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/runtime/snapshot').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/overview').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/live-stream/status').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/live-stream/health').catch(error=>({error:String(error.message||error)})),
      this.getJson('/api/core/live-stream/last-event').catch(error=>({error:String(error.message||error)}))
    ];

    const [health, scenariosDto, status, latest, scenarioLatest, traceById, statusById, runtimeSnapshotDto, coreOverviewDto, liveStreamStatusDto, liveStreamHealthDto, liveStreamLastEventDto] = await Promise.all(calls);
    const apiTrace = [traceById, scenarioLatest, latest].find(x=>x && !x.error && (x.traceId || x.machine || x.pipeline || x.gateVerdict || x.scenario || x.rules));
    const canonicalScenarioId = normalizeScenarioId(apiTrace, selectedScenarioId);
    const canonical = buildCanonicalTrace(baseTrace, canonicalScenarioId);

    const trace = apiTrace
      ? deepMergeDefaults(canonical, apiTrace)
      : buildCanonicalTrace(baseTrace, 'API_FAILURE_FALLBACK');

    const runtimeSnapshot = runtimeSnapshotDto && !runtimeSnapshotDto.error
      ? normalizeRuntimeSnapshot(runtimeSnapshotDto, {
          source: 'runtime',
          scenarioId: null,
          readOnly: true,
          deterministic: runtimeSnapshotDto?.meta?.deterministic ?? false
        })
      : normalizeRuntimeSnapshot(apiTrace || trace, {
          source: apiTrace ? 'core-readonly' : 'mock',
          scenarioId: canonicalScenarioId,
          readOnly: true,
          deterministic: true
        });

    trace.runtimeSnapshot = runtimeSnapshot;
    trace.coreOverview = coreOverviewDto && !coreOverviewDto.error ? coreOverviewDto : null;
    trace.liveStream = {
      status: liveStreamStatusDto && !liveStreamStatusDto.error ? liveStreamStatusDto : null,
      health: liveStreamHealthDto && !liveStreamHealthDto.error ? liveStreamHealthDto : null,
      lastEvent: liveStreamLastEventDto && !liveStreamLastEventDto.error ? liveStreamLastEventDto : null
    };
    trace.adapter = {
      ...(trace.adapter || {}),
      mode:'api',
      health,
      status,
      statusById,
      readOnly:true,
      coreMutation:false,
      source: runtimeSnapshot.meta.source === 'runtime' ? 'runtime-readonly-api' : (apiTrace ? 'core-readonly-api' : 'fallback'),
      runtimeSnapshotSchema: runtimeSnapshot.meta.schemaVersion
    };

    const scenarioList = normalizeScenarios(scenariosDto);
    const errors = [health, scenariosDto, status, latest, scenarioLatest, traceById, statusById, runtimeSnapshotDto, coreOverviewDto, liveStreamStatusDto, liveStreamHealthDto, liveStreamLastEventDto].filter(x=>x?.error).map(x=>x.error);

    return {trace, runtimeSnapshot, scenarios:scenarioList, error: errors.length ? errors.join(' | ') : null};
  }
}
