export enum OrderStatus {
  NEW = "NEW",
  ACK = "ACK",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  FILLED = "FILLED",
  CANCELED = "CANCELED",
  REJECTED = "REJECTED",
  UNCERTAIN = "UNCERTAIN",
  SETTLING = "SETTLING"
}

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.ACK, OrderStatus.REJECTED, OrderStatus.UNCERTAIN],
  [OrderStatus.ACK]: [OrderStatus.PARTIALLY_FILLED, OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.UNCERTAIN],
  [OrderStatus.PARTIALLY_FILLED]: [OrderStatus.SETTLING, OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.UNCERTAIN],
  [OrderStatus.FILLED]: [OrderStatus.UNCERTAIN],
  [OrderStatus.CANCELED]: [OrderStatus.UNCERTAIN, OrderStatus.SETTLING],
  [OrderStatus.REJECTED]: [OrderStatus.UNCERTAIN],
  [OrderStatus.UNCERTAIN]: [],
  [OrderStatus.SETTLING]: [OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.UNCERTAIN]
};

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus
) {
  const allowed = allowedTransitions[from] || [];

  if (!allowed.includes(to)) {
    throw new Error(`❌ INVALID FSM TRANSITION: ${from} → ${to}`);
  }
}

export function transitionOrder(
  order: { status: OrderStatus },
  next: OrderStatus
) {
  assertTransition(order.status, next);
  order.status = next;
}

export function forceUncertain(
  order: { status: OrderStatus }
) {
  transitionOrder(order, OrderStatus.UNCERTAIN);
}