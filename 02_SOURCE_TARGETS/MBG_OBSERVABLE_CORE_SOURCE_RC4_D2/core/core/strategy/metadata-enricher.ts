import { resolveTradeMetadata, UNKNOWN_METADATA, type TradeMetadata } from "./trade-metadata.js";

type Trade = any;

function normalizeExistingMetadata(trade: Trade): TradeMetadata {
  if (trade.metadata?.strategyId) {
    return {
      ...UNKNOWN_METADATA,
      ...trade.metadata,
      tags: Array.isArray(trade.metadata.tags) ? trade.metadata.tags : []
    };
  }

  if (trade.strategyId || trade.setupType || trade.hypothesisId) {
    return resolveTradeMetadata({
      strategyId: trade.strategyId,
      hypothesisId: trade.hypothesisId,
      setupType: trade.setupType,
      sourceLogic: trade.sourceLogic,
      entryReason: trade.entryReason,
      exitReason: trade.exitReason,
      decisionZone: trade.decisionZone,
      liquidityTarget: trade.liquidityTarget,
      invalidationLogic: trade.invalidationLogic,
      tags: trade.tags
    });
  }

  return { ...UNKNOWN_METADATA, tags: [] };
}

export function enrichTrade(trade: Trade) {
  const metadata = normalizeExistingMetadata(trade);

  return {
    ...trade,
    metadata,
    strategyId: metadata.strategyId,
    strategyVersion: metadata.strategyVersion,
    hypothesisId: metadata.hypothesisId,
    setupType: metadata.setupType,
    sourceLogic: metadata.sourceLogic
  };
}
