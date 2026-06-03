export type TradeDecision = "BUY" | "SELL" | "HOLD";

export interface StrategyState {
  position: number;
  activeOrder: boolean;
  halted: boolean;
  minSellQuantity: number;
}

export class SimpleStrategy {
  decide(state: StrategyState): TradeDecision {
    if (state.halted || state.activeOrder) return "HOLD";
    if (state.position > state.minSellQuantity) return "SELL";
    return "BUY";
  }
}

export const simpleStrategy = new SimpleStrategy();
