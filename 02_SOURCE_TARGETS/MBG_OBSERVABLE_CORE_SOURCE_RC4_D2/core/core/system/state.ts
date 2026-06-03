export enum HaltReason {
  TIME_SYNC = "TIME_SYNC",
  WS_DEAD = "WS_DEAD",
  WS_DISCONNECTED = "WS_DISCONNECTED",
  WS_STALE = "WS_STALE",
  INVARIANT_BROKEN = "INVARIANT_BROKEN",
  RETRY_EXHAUSTED = "RETRY_EXHAUSTED",
  UNKNOWN = "UNKNOWN",
  ORDER_BURST = "ORDER_BURST",
  MAX_ORDERS_PER_HOUR = "MAX_ORDERS_PER_HOUR",
  POSITION_OVERFLOW = "POSITION_OVERFLOW",
  PNL_INVARIANT_BROKEN = "PNL_INVARIANT_BROKEN",
  EVENT_STORM = "EVENT_STORM",
  RECONCILE_LATENCY = "RECONCILE_LATENCY",
  DIRTY_START = "DIRTY_START",
  MAX_CONSECUTIVE_ERRORS = "MAX_CONSECUTIVE_ERRORS",
  SYSTEM_ERROR = "SYSTEM_ERROR"
}

export interface SystemState {
  halted: boolean;
  haltReason?: string;
  haltCode?: HaltReason;
  activeOrder: boolean;
  lastWsTick: number;
  ordersLast5Min: number[];
  ordersLastHour: number[];
  exchangeOpenOrdersCount: number;
  consecutiveErrors: number;
  lastReconcileLatencyMs: number;
  warnings: string[];
}

export const systemState: SystemState = {
  halted: false,
  activeOrder: false,
  lastWsTick: Date.now(),
  ordersLast5Min: [],
  ordersLastHour: [],
  exchangeOpenOrdersCount: 0,
  consecutiveErrors: 0,
  lastReconcileLatencyMs: 0,
  warnings: []
};

function normalizeHaltInput(reason: HaltReason | string): { code: HaltReason; message: string } {
  if (Object.values(HaltReason).includes(reason as HaltReason)) {
    return { code: reason as HaltReason, message: reason as string };
  }

  const raw = String(reason);
  const upper = raw.toUpperCase();

  if (upper.includes("TIMESTAMP") || upper.includes("RECVWINDOW") || upper.includes("TIME SYNC")) {
    return { code: HaltReason.TIME_SYNC, message: raw };
  }
  if (upper.includes("WS DISCONNECTED")) {
    return { code: HaltReason.WS_DISCONNECTED, message: raw };
  }
  if (upper.includes("WS STALE") || upper.includes("WS DEAD")) {
    return { code: HaltReason.WS_DEAD, message: raw };
  }
  if (upper.includes("PNL")) {
    return { code: HaltReason.PNL_INVARIANT_BROKEN, message: raw };
  }
  if (upper.includes("INVARIANT")) {
    return { code: HaltReason.INVARIANT_BROKEN, message: raw };
  }
  if (upper.includes("RETRY EXHAUSTED")) {
    return { code: HaltReason.RETRY_EXHAUSTED, message: raw };
  }
  if (upper.includes("UNKNOWN")) {
    return { code: HaltReason.UNKNOWN, message: raw };
  }
  if (upper.includes("ORDER BURST")) {
    return { code: HaltReason.ORDER_BURST, message: raw };
  }
  if (upper.includes("MAX ORDERS PER HOUR")) {
    return { code: HaltReason.MAX_ORDERS_PER_HOUR, message: raw };
  }
  if (upper.includes("POSITION_OVERFLOW") || upper.includes("POSITION OVERFLOW")) {
    return { code: HaltReason.POSITION_OVERFLOW, message: raw };
  }
  if (upper.includes("EVENT_STORM") || upper.includes("EVENT STORM")) {
    return { code: HaltReason.EVENT_STORM, message: raw };
  }
  if (upper.includes("RECONCILE LATENCY")) {
    return { code: HaltReason.RECONCILE_LATENCY, message: raw };
  }

  return { code: HaltReason.SYSTEM_ERROR, message: raw };
}

export function haltSystem(reason: HaltReason | string, details?: unknown): void {
  if (!systemState.halted) {
    const normalized = normalizeHaltInput(reason);
    systemState.halted = true;
    systemState.haltReason = normalized.message;
    systemState.haltCode = normalized.code;

    const payload = {
      reason: normalized.code,
      message: normalized.message,
      details
    };

    console.error("🚨 HALT:", payload);
  }
}

export function warnSystem(message: string): void {
  systemState.warnings.push(message);
  if (systemState.warnings.length > 100) {
    systemState.warnings.shift();
  }
  console.warn("⚠️ WARN:", message);
}

export function isHalted(): boolean {
  return systemState.halted;
}

export function markWsTick(): void {
  systemState.lastWsTick = Date.now();
}

export function resetErrorCounter(): void {
  systemState.consecutiveErrors = 0;
}

export function markRuntimeError(reason: string, maxConsecutiveErrors = 5): void {
  systemState.consecutiveErrors += 1;

  if (systemState.consecutiveErrors >= maxConsecutiveErrors) {
    haltSystem(HaltReason.MAX_CONSECUTIVE_ERRORS, { reason });
  }
}
