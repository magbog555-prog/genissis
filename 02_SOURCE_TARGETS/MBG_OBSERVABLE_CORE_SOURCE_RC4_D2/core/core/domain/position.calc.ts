type Fill = {
  side: "BUY" | "SELL";
  quantity: string; // Decimal string
};

export const SETTLE_TIMEOUT_MS = 1500;

export function calculatePosition(fills: Fill[]): string {
  let position = 0;

  for (const fill of fills) {
    const qty = parseFloat(fill.quantity);

    if (fill.side === "BUY") {
      position += qty;
    } else {
      position -= qty;
    }
  }

  return position.toFixed(8);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}