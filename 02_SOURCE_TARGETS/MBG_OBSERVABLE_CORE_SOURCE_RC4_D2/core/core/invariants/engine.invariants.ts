type Fill = {
  tradeId: string;
  orderId?: string;
  side: "BUY" | "SELL";
  quantity: string;
};

type Order = {
  id: string;
  status: string;
  quantity: string;
  filledQuantity: string;
};

function nearlyEqual(a: number, b: number, tolerance = 0.00000001): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function assertInvariants(params: {
  fills: Fill[];
  order: Order;
  exchangePosition: string | number;
  openOrders?: unknown[];
}) {
  const { fills, order, exchangePosition, openOrders = [] } = params;

  // 1. EXCHANGE POSITION MUST BE NUMERIC AND NON-NEGATIVE.
  // Do not compare current spot balance to the sum of all historical fills.
  // Historical fills may contain many completed BUY/SELL round trips while the current
  // position is correctly zero. Reconcile truth is the exchange account balance.
  const exchange = Number(exchangePosition);

  if (!Number.isFinite(exchange) || exchange < 0) {
    throw new Error("💀 INVARIANT FAIL: invalid exchange position");
  }

  // 2. FILLED QUANTITY CHECK only for the current order, not the whole trade history.
  const orderId = String(order.id ?? "");
  if (orderId && orderId !== "0" && order.status !== "NONE") {
    const orderFills = fills.filter((f) => String(f.orderId ?? "") === orderId);

    if (orderFills.length > 0) {
      const sumFills = orderFills.reduce((acc, f) => acc + Number(f.quantity), 0);
      const filledQty = Number(order.filledQuantity);

      if (!nearlyEqual(sumFills, filledQty)) {
        throw new Error("💀 INVARIANT FAIL: filledQuantity mismatch");
      }
    }
  }

  // 3. NO DUPLICATE FILLS
  const ids = new Set<string>();

  for (const f of fills) {
    if (ids.has(f.tradeId)) {
      throw new Error("💀 INVARIANT FAIL: duplicate fill detected");
    }
    ids.add(f.tradeId);
  }

  // 4. STATUS CONSISTENCY
  const filledQty = Number(order.filledQuantity);
  if (order.status === "FILLED" && filledQty === 0) {
    throw new Error("💀 INVARIANT FAIL: FILLED but qty = 0");
  }

  if (order.status === "CANCELED" && filledQty > Number(order.quantity)) {
    throw new Error("💀 INVARIANT FAIL: canceled but overfilled");
  }

  // 5. OPEN ORDERS SHAPE CHECK
  if (!Array.isArray(openOrders)) {
    throw new Error("💀 INVARIANT FAIL: openOrders is not an array");
  }

  return true;
}
