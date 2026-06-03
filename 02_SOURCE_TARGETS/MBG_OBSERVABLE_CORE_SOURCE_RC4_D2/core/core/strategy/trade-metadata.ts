import { resolveStrategy, type Strategy } from "./strategy-registry.js";
import { resolveHypothesis } from "./hypothesis-registry.js";

export type TradeMetadata = {
  strategyId: string;
  strategyVersion: string;
  hypothesisId: string | null;
  setupType: string;
  sourceLogic: string;
  entryReason: string;
  exitReason: string | null;
  decisionZone: string | null;
  liquidityTarget: string | null;
  invalidationLogic: string | null;
  tags: string[];
};

export type TradeMetadataInput = {
  strategyId?: string | null;
  hypothesisId?: string | null;
  setupType?: string | null;
  sourceLogic?: string | null;
  entryReason?: string | null;
  exitReason?: string | null;
  decisionZone?: string | null;
  liquidityTarget?: string | null;
  invalidationLogic?: string | null;
  tags?: string[];
};

export const UNKNOWN_METADATA: TradeMetadata = {
  strategyId: "manual_unknown_v1",
  strategyVersion: "v1",
  hypothesisId: null,
  setupType: "UNKNOWN",
  sourceLogic: "unknown",
  entryReason: "unknown",
  exitReason: null,
  decisionZone: null,
  liquidityTarget: null,
  invalidationLogic: null,
  tags: []
};

const VALID_SETUP_TYPES = new Set([
  "UNKNOWN",
  "LIQUIDITY_SWEEP",
  "BREAKOUT_IMPULSE",
  "BREAKOUT_PULL",
  "DENSITY_REACTION",
  "RANGE_EDGE",
  "TREND_PULLBACK",
  "MICROSTRUCTURE",
  "TIME_BASED"
]);

function normalizeSetupType(value?: string | null): string {
  const normalized = String(value ?? "UNKNOWN").trim().toUpperCase();
  return VALID_SETUP_TYPES.has(normalized) ? normalized : "UNKNOWN";
}

function buildMetadata(strategy: Strategy, input: TradeMetadataInput = {}): TradeMetadata {
  const setupType = normalizeSetupType(input.setupType ?? strategy.setupType);
  return {
    strategyId: strategy.strategyId,
    strategyVersion: strategy.strategyVersion,
    hypothesisId: input.hypothesisId ?? null,
    setupType,
    sourceLogic: input.sourceLogic ?? strategy.sourceLogic ?? "unknown",
    entryReason: input.entryReason ?? "unknown",
    exitReason: input.exitReason ?? null,
    decisionZone: input.decisionZone ?? null,
    liquidityTarget: input.liquidityTarget ?? null,
    invalidationLogic: input.invalidationLogic ?? null,
    tags: Array.isArray(input.tags) ? input.tags : []
  };
}

export function resolveTradeMetadata(input: TradeMetadataInput = {}): TradeMetadata {
  const strategy = resolveStrategy(input.strategyId ?? undefined);

  if (!input.strategyId || strategy.strategyId === "manual_unknown_v1") {
    return { ...UNKNOWN_METADATA, tags: [...UNKNOWN_METADATA.tags] };
  }

  if (input.hypothesisId) {
    const hypothesis = resolveHypothesis(input.hypothesisId, strategy.strategyId);
    if (!hypothesis) {
      return { ...UNKNOWN_METADATA, tags: [...UNKNOWN_METADATA.tags] };
    }
    if (["DISABLED", "KILLED"].includes(String(hypothesis.status).toUpperCase())) {
      console.warn(`[PR35] hypothesis ${input.hypothesisId} status=${hypothesis.status} → fallback`);
      return { ...UNKNOWN_METADATA, tags: [...UNKNOWN_METADATA.tags] };
    }
  }

  return buildMetadata(strategy, input);
}

export function withExitReason(metadata: TradeMetadata | undefined, exitReason: string | null): TradeMetadata {
  const base = metadata ?? UNKNOWN_METADATA;
  return {
    ...base,
    tags: [...(base.tags ?? [])],
    exitReason
  };
}
