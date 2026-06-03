import {
  MOCK_CORE_SCENARIO_IDS,
  MOCK_COMPUTATION_TRACE_DTOS,
  buildMockComputationTraceDTO,
  type MockCoreScenarioId
} from "./mock-scenarios.js";
import { canonicalDtoStringify } from "../contracts/ui/index.js";

export const OBSERVABLE_CORE_MACHINE_API_VERSION = "wave10a-observable-core-machine-v1" as const;

export interface ObservableCoreScenarioCatalogItem {
  id: MockCoreScenarioId;
  scenarioId: MockCoreScenarioId;
  name: string;
  title: string;
  description: string;
  dto: ReturnType<typeof buildMockComputationTraceDTO>;
  readOnly: true;
  coreAuthority: true;
  mockFirst: true;
}

function normalizeScenarioId(input?: unknown): MockCoreScenarioId {
  if (typeof input === "string" && (MOCK_CORE_SCENARIO_IDS as readonly string[]).includes(input)) {
    return input as MockCoreScenarioId;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const raw =
      record.scenarioId ??
      record.id ??
      record.key ??
      (record.scenario && typeof record.scenario === "object"
        ? (record.scenario as Record<string, unknown>).scenarioId ?? (record.scenario as Record<string, unknown>).id
        : undefined);
    if (typeof raw === "string" && (MOCK_CORE_SCENARIO_IDS as readonly string[]).includes(raw)) {
      return raw as MockCoreScenarioId;
    }
  }

  return "HEALTHY_TRUSTED_READY";
}

export function getObservableCoreMachineScenarios(): ObservableCoreScenarioCatalogItem[] {
  return MOCK_CORE_SCENARIO_IDS.map((id) => {
    const dto = buildMockComputationTraceDTO(id);
    return {
      id,
      scenarioId: id,
      name: id,
      title: dto.title,
      description: dto.description,
      dto,
      readOnly: true,
      coreAuthority: true,
      mockFirst: true
    };
  });
}

export function getMockScenarioCatalog(): ObservableCoreScenarioCatalogItem[] {
  return getObservableCoreMachineScenarios();
}

export function getCoreUiMockScenarios(): ObservableCoreScenarioCatalogItem[] {
  return getObservableCoreMachineScenarios();
}

export function renderObservableCoreScenario(input?: unknown) {
  const scenarioId = normalizeScenarioId(input);
  return buildMockComputationTraceDTO(scenarioId);
}

export function renderObservableMachineScenario(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getObservableScenario(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getMockScenario(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getObservableCoreMachineDto(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getObservableCoreMachineView(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getCoreUiDto(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getCoreUIDto(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getComputationTrace(input?: unknown) {
  return renderObservableCoreScenario(input);
}

export function getLatestComputationTrace() {
  return buildMockComputationTraceDTO("HEALTHY_TRUSTED_READY");
}

export function getRuntimeObservableView() {
  return getLatestComputationTrace();
}

export function getReplayProof() {
  const canonical = MOCK_COMPUTATION_TRACE_DTOS.map((dto) => canonicalDtoStringify(dto));
  return {
    replaySafe: true,
    deterministic: true,
    scenarioCount: canonical.length,
    stableScenarioHashes: canonical,
    rule: "same scenario -> same DTO output; UI reads only mock Core evidence"
  };
}

export function verifyReplay() {
  return getReplayProof();
}

export const observableCoreMachine = {
  version: OBSERVABLE_CORE_MACHINE_API_VERSION,
  getObservableCoreMachineScenarios,
  getMockScenarioCatalog,
  getCoreUiMockScenarios,
  renderObservableCoreScenario,
  renderObservableMachineScenario,
  getObservableScenario,
  getMockScenario,
  getObservableCoreMachineDto,
  getObservableCoreMachineView,
  getCoreUiDto,
  getCoreUIDto,
  getComputationTrace,
  getLatestComputationTrace,
  getRuntimeObservableView,
  getReplayProof,
  verifyReplay
};

export default observableCoreMachine;
