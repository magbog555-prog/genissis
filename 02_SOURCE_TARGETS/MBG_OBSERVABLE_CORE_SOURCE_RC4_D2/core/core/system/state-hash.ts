import crypto from "node:crypto";

export interface StateHashInput {
  position: number;
  fillsCount: number;
  openOrdersCount: number;
  lastOrderStatus: string;
}

export function computeStateHash(state: StateHashInput): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      position: Number(state.position.toFixed(12)),
      fillsCount: state.fillsCount,
      openOrdersCount: state.openOrdersCount,
      lastOrderStatus: state.lastOrderStatus
    }))
    .digest("hex")
    .slice(0, 16);
}
