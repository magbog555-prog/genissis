import crypto from "node:crypto";
import { runtimeEngine } from "./src/runtime-engine.js";
import { EVENT_TYPE, makeEvent } from "../contracts/src/events.js";
import { assertInvariants } from "../invariants/engine.invariants.js";
import { binanceSpotTestnet, buildPositionPayloadFromAccount } from "../../application/exchange/src/binance-spot-testnet.js";
import { liveMarketStatus } from "../../application/market/src/binance-live-market.js";
import { HaltReason, haltSystem, isHalted, markRuntimeError, resetErrorCounter, systemState, warnSystem, type SystemState } from "../system/state.js";
import { canTrade, sleep, withRetry } from "../utils/retry.js";
import { runtimeJournal, type RuntimeJournal } from "../system/journal.js";
import { computeStateHash } from "../system/state-hash.js";
import { simpleStrategy, type TradeDecision, type SimpleStrategy } from "../strategy/simple.strategy.js";
import { resolveTradeMetadata, withExitReason, UNKNOWN_METADATA, type TradeMetadata } from "../strategy/trade-metadata.js";
import { aliasOrderMetadata, deleteOrderMetadataMany, getOrderMetadata, setOrderMetadata } from "../strategy/order-metadata-store.js";
import { pnlEngine, PnLInvariantError, type PnLFill, type PnLSnapshot } from "../pnl/pnl-engine.js";

export interface RuntimeExchange {
  getAccount(): Promise<any>;
  getMyTrades(symbol?: string): Promise<any[]>;
  getOpenOrders(symbol?: string): Promise<any[]>;
  marketBuy(symbol?: string, quoteOrderQty?: number, clientOrderId?: string): Promise<any>;
  marketSell(symbol: string, quantity: number, clientOrderId?: string): Promise<any>;
  cancelOrder?(input: { symbol?: string; orderId?: string | number; clientOrderId?: string }): Promise<any>;
}

export interface RuntimeMarketStatus {
  connected: boolean;
  lastTickAt: number;
  lastError?: string;
}

export interface ReconciledFill {
  tradeId: string;
  orderId?: string;
  clientOrderId?: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: string;
  quantity: string;
  quoteQty: string;
  commission: string;
  commissionAsset?: string;
  time: number;
  raw?: unknown;
}

export interface ReconciledState {
  position: number;
  account: any;
  fills: ReconciledFill[];
  openOrders: any[];
  lastOrder: {
    id: string;
    status: string;
    quantity: string;
    filledQuantity: string;
  };
  stateHash: string;
  pnl?: PnLSnapshot;
}

const SYMBOL = (process.env.SYMBOL ?? "BTCUSDT").toUpperCase();
const ORDER_QUOTE_SIZE_USDT = Number(process.env.ORDER_QUOTE_SIZE_USDT ?? "10");
const MIN_SELL_QUANTITY = Number(process.env.MIN_SELL_QUANTITY ?? "0.00001");
const DRY_RUN = process.env.DRY_RUN === "true" || process.env.LIVE_TRADING !== "true";
const MAX_ORDERS_PER_HOUR = Number(process.env.MAX_ORDERS_PER_HOUR ?? "50");
const MIN_ORDER_INTERVAL_MS = Number(process.env.MIN_ORDER_INTERVAL_MS ?? "600000");

// ✅ FIX: Простой lock для защиты от race condition
let lastOrderAttemptAt = 0;
let orderAttemptInFlight = false; // Lock флаг

const MAX_CONSECUTIVE_ERRORS = Number(process.env.MAX_CONSECUTIVE_ERRORS ?? "5");
const WS_TIMEOUT_MS = Number(process.env.WS_TIMEOUT_MS ?? "5000");
const RECONCILE_WARN_LATENCY_MS = Number(process.env.RECONCILE_WARN_LATENCY_MS ?? "1000");
const RECONCILE_HALT_LATENCY_MS = Number(process.env.RECONCILE_HALT_LATENCY_MS ?? "3000");
const ORDER_NEW_TIMEOUT_MS = Number(process.env.ORDER_NEW_TIMEOUT_MS ?? "10000");
const MAX_POSITION_QTY_RUNTIME = Number(process.env.RUNTIME_MAX_POSITION_QTY ?? "0.001");
const MIN_POSITION_THRESHOLD = Number(process.env.MIN_POSITION_THRESHOLD ?? "0.0002");
const EVENT_RATE_WINDOW_MS = Number(process.env.EVENT_RATE_WINDOW_MS ?? "1000");
const MAX_EVENTS_PER_SECOND = Number(process.env.MAX_EVENTS_PER_SECOND ?? "50");
const PROCESS_START_TS = Date.now();
const EVENT_RATE_WARMUP_MS = Number(process.env.EVENT_RATE_WARMUP_MS ?? "30000");
let eventRateWindowStartedAt = Date.now();
let eventsInWindow = 0;
// ✅ FIX: Lock для защиты от race condition при обновлении event rate
let eventRateLocked = false;

export function forceUncertain(order: unknown): void {
  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.SYSTEM_HALTED, {
    status: "halted",
    reason: HaltReason.UNKNOWN,
    order
  } as any));
}

function normalizeStatus(status: unknown): string {
  return String(status ?? "").toUpperCase();
}

async function haltOnUnknownOrder(order: any, context: string): Promise<void> {
  const status = normalizeStatus(order?.status);
  if (status === "UNKNOWN") {
    forceUncertain(order);
    await reconcile();
    haltSystem(HaltReason.UNKNOWN, { context, order });
  }
}

function getCurrentOrder(openOrders: any[] = []) {
  const openOrder = openOrders[0];
  const snapshot = runtimeEngine.getSnapshot();
  const id = String(openOrder?.orderId ?? snapshot.order.orderId ?? "");
  const rawStatus = String(openOrder?.status ?? snapshot.order.status ?? "NONE").toUpperCase();

  // A persisted runtime snapshot may contain UNCERTAIN from a previous halted run.
  // If Binance reports no open order and the snapshot has no order id, treat it as no current order.
  const status = !id && rawStatus === "UNCERTAIN" ? "NONE" : rawStatus;

  return {
    id,
    status,
    quantity: String(openOrder?.origQty ?? snapshot.order.quantity ?? "0"),
    filledQuantity: String(openOrder?.executedQty ?? snapshot.order.filledQuantity ?? "0")
  };
}

function registerOrderAttempt(): boolean {
  // ✅ FIX: Защита от race condition - проверяем lock
  if (orderAttemptInFlight) {
    console.warn("[WARN] Order attempt already in flight - rejecting");
    return false;
  }

  const now = Date.now();

  if (now - lastOrderAttemptAt < MIN_ORDER_INTERVAL_MS) {
    return false;
  }

  // ✅ FIX: Устанавливаем lock ПЕРЕД изменением состояния
  orderAttemptInFlight = true;
  
  try {
    lastOrderAttemptAt = now;

    systemState.ordersLast5Min = systemState.ordersLast5Min.filter(
      (ts) => now - ts < 5 * 60 * 1000
    );

    if (systemState.ordersLast5Min.length >= 30) {
      haltSystem(HaltReason.ORDER_BURST);
      return false;
    }

    systemState.ordersLastHour = systemState.ordersLastHour.filter(
      (ts) => now - ts < 60 * 60 * 1000
    );

    if (systemState.ordersLastHour.length >= MAX_ORDERS_PER_HOUR) {
      haltSystem(HaltReason.MAX_ORDERS_PER_HOUR);
      return false;
    }

    systemState.ordersLast5Min.push(now);
    systemState.ordersLastHour.push(now);
    return true;
  } finally {
    // ✅ FIX: Гарантированно освобождаем lock в finally (даже при ошибке)
    orderAttemptInFlight = false;
  }
}

function recordRuntimeEvents(count = 1): void {
  // ✅ FIX: Защита от race condition
  if (eventRateLocked) {
    return; // Skip, уже обновляется
  }

  eventRateLocked = true;
  try {
    const now = Date.now();

    if (now - eventRateWindowStartedAt >= EVENT_RATE_WINDOW_MS) {
      eventRateWindowStartedAt = now;
      eventsInWindow = 0;
    }

    eventsInWindow += count;
    const eventRateWarmupActive = Date.now() - PROCESS_START_TS < EVENT_RATE_WARMUP_MS;

    if (!eventRateWarmupActive && eventsInWindow > MAX_EVENTS_PER_SECOND) {
      haltSystem(HaltReason.EVENT_STORM, {
        eventsInWindow,
        windowMs: EVENT_RATE_WINDOW_MS,
        maxEventsPerSecond: MAX_EVENTS_PER_SECOND
      });
    }
  } finally {
    eventRateLocked = false;
  }
}

async function reconcileWithLatency(exchange: RuntimeExchange = binanceSpotTestnet): Promise<{ state: ReconciledState; latency: number }> {
  const t0 = Date.now();
  const state = await reconcile(exchange);
  const latency = Date.now() - t0;

  systemState.lastReconcileLatencyMs = latency;

  if (latency > RECONCILE_HALT_LATENCY_MS) {
    haltSystem(HaltReason.RECONCILE_LATENCY, { latency, threshold: RECONCILE_HALT_LATENCY_MS });
  } else if (latency > RECONCILE_WARN_LATENCY_MS) {
    warnSystem(`RECONCILE LATENCY WARNING: ${latency}ms`);
  }

  return { state, latency };
}

async function guardNewOrderTimeout(order: any, exchange: RuntimeExchange = binanceSpotTestnet): Promise<void> {
  const status = normalizeStatus(order?.status);
  if (status !== "NEW") return;

  await sleep(ORDER_NEW_TIMEOUT_MS);

  const openOrders = await withRetry(() => exchange.getOpenOrders(SYMBOL), 3);
  const stillOpen = openOrders.find((openOrder: any) => {
    const orderIdMatches = order?.orderId !== undefined && String(openOrder?.orderId) === String(order.orderId);
    const clientOrderIdMatches = order?.clientOrderId && String(openOrder?.clientOrderId) === String(order.clientOrderId);
    return orderIdMatches || clientOrderIdMatches;
  });

  if (!stillOpen) return;

  if (typeof exchange.cancelOrder === "function") {
    await withRetry(() => exchange.cancelOrder!({
      symbol: SYMBOL,
      orderId: stillOpen.orderId,
      clientOrderId: stillOpen.clientOrderId
    }), 3);
  }

  await sleep(1500);
  await reconcile(exchange);
}


function orderIdFromResponse(response: any): string | undefined {
  const raw = response?.raw ?? response;
  const id = raw?.orderId ?? raw?.orderID ?? raw?.id ?? response?.orderId ?? response?.id;
  return id === undefined || id === null ? undefined : String(id);
}

function clientOrderIdFromResponse(response: any): string | undefined {
  const raw = response?.raw ?? response;
  const id = raw?.clientOrderId ?? raw?.clientOrderID ?? raw?.clientOrderID ?? raw?.origClientOrderId ?? response?.clientOrderId;
  return id === undefined || id === null ? undefined : String(id);
}

function buildEntryMetadata(): TradeMetadata {
  return resolveTradeMetadata({
    strategyId: process.env.PR35_STRATEGY_ID ?? "liquidity_sweep_v1",
    hypothesisId: process.env.PR35_HYPOTHESIS_ID ?? "H-ZAKOL-001",
    setupType: process.env.PR35_SETUP_TYPE ?? "LIQUIDITY_SWEEP",
    sourceLogic: process.env.PR35_SOURCE_LOGIC ?? "zakol",
    entryReason: process.env.PR35_ENTRY_REASON ?? "runtime_buy_decision",
    decisionZone: process.env.PR35_DECISION_ZONE ?? null,
    liquidityTarget: process.env.PR35_LIQUIDITY_TARGET ?? null,
    invalidationLogic: process.env.PR35_INVALIDATION_LOGIC ?? null,
    tags: ["pr35-runtime"]
  });
}

function buildExitMetadata(): TradeMetadata {
  const active = pnlEngine.getActiveTrade(SYMBOL);
  return withExitReason(active?.metadata ?? UNKNOWN_METADATA, process.env.PR35_EXIT_REASON ?? "runtime_sell_decision");
}

function persistOrderMetadata(clientOrderId: string, response: any, metadata: TradeMetadata): void {
  setOrderMetadata(clientOrderId, metadata);

  const responseClientOrderId = clientOrderIdFromResponse(response);
  if (responseClientOrderId) {
    setOrderMetadata(responseClientOrderId, metadata);
  }

  const exchangeOrderId = orderIdFromResponse(response);
  if (exchangeOrderId) {
    aliasOrderMetadata(clientOrderId, exchangeOrderId);
  } else {
    console.warn(`[PR35] exchange orderId missing for clientOrderId=${clientOrderId}`);
  }
}

function metadataForFill(fill: ReconciledFill): TradeMetadata | undefined {
  return getOrderMetadata(fill.orderId) ?? getOrderMetadata(fill.clientOrderId);
}


function cleanupClosedOrderMetadata(pnl: PnLSnapshot | undefined): void {
  if (!pnl) return;

  const keys = pnl.closedTrades.flatMap((trade) => trade.fills.flatMap((fill) => {
    const raw = fill.raw as ReconciledFill | undefined;
    return [
      fill.orderId,
      raw?.orderId,
      raw?.clientOrderId
    ];
  }));

  deleteOrderMetadataMany(keys);
}

async function fetchAllFills(exchange: RuntimeExchange = binanceSpotTestnet): Promise<ReconciledFill[]> {
  const trades = await withRetry(() => exchange.getMyTrades(SYMBOL), 3);
  const pnlStartTimeMs = Number(process.env.PNL_START_TIME_MS ?? "0");

  const filteredTrades = pnlStartTimeMs > 0
    ? trades.filter((trade: any) => Number(trade.time ?? trade.timestamp ?? 0) >= pnlStartTimeMs)
    : trades;

  return filteredTrades.map((trade: any) => ({
    tradeId: String(trade.id ?? trade.tradeId ?? `${trade.orderId}-${trade.time}`),
    orderId: trade.orderId === undefined ? undefined : String(trade.orderId),
    clientOrderId: trade.clientOrderId === undefined ? undefined : String(trade.clientOrderId),
    symbol: String(trade.symbol ?? SYMBOL).toUpperCase(),
    side: trade.isBuyer ? "BUY" : "SELL",
    price: String(trade.price ?? "0"),
    quantity: String(trade.qty ?? trade.quantity ?? "0"),
    quoteQty: String(trade.quoteQty ?? "0"),
    commission: String(trade.commission ?? "0"),
    commissionAsset: trade.commissionAsset === undefined ? undefined : String(trade.commissionAsset),
    time: Number(trade.time ?? Date.now()),
    raw: trade
  }));
}

export async function reconcile(exchange: RuntimeExchange = binanceSpotTestnet): Promise<ReconciledState> {
  const account = await withRetry(() => exchange.getAccount(), 3);
  const fills = await fetchAllFills(exchange);
  const openOrders = await withRetry(() => exchange.getOpenOrders(SYMBOL), 3);
  systemState.exchangeOpenOrdersCount = openOrders.length;
  systemState.activeOrder = openOrders.length > 0;
  

  const snapshot = runtimeEngine.getSnapshot();
  const payload = buildPositionPayloadFromAccount({
    account,
    symbol: SYMBOL,
    markPrice: snapshot.market.lastPrice ?? 0,
    source: "exchange"
  });
  
  const computedPosition = Number(payload.quantity ?? 0);
  const exchangePosition = computedPosition;
  const lastOrder = getCurrentOrder(openOrders);
  let pnl: PnLSnapshot | undefined;

  try {
    const pnlFills: PnLFill[] = fills.map((fill) => pnlEngine.normalizeFill({
      id: fill.tradeId,
      orderId: fill.orderId,
      symbol: fill.symbol,
      side: fill.side,
      price: fill.price,
      qty: fill.quantity,
      quoteQty: fill.quoteQty,
      commission: fill.commission,
      commissionAsset: fill.commissionAsset,
      time: fill.time,
      raw: fill,
      metadata: metadataForFill(fill)
    }));

    pnl = pnlEngine.onReconcile({
      symbol: SYMBOL,
      fills: pnlFills,
      position: exchangePosition,
      lastPrice: snapshot.market.lastPrice ?? 0
    });

    cleanupClosedOrderMetadata(pnl);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    haltSystem(e instanceof PnLInvariantError ? HaltReason.PNL_INVARIANT_BROKEN : HaltReason.SYSTEM_ERROR, {
      message,
      source: "PNL_RECONCILE"
    });
  }

  try {
    assertInvariants({
      fills,
      order: lastOrder,
      exchangePosition,
      openOrders
    });
  } catch (e) {
    haltSystem(HaltReason.INVARIANT_BROKEN, { message: e instanceof Error ? e.message : String(e) });
  }

  const stateHash = computeStateHash({
    position: exchangePosition,
    fillsCount: fills.length,
    openOrdersCount: openOrders.length,
    lastOrderStatus: lastOrder.status
  });

  runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, payload));
  runtimeJournal.log({
    ts: Date.now(),
    type: "RECONCILE",
    position: exchangePosition,
    activeOrder: systemState.activeOrder,
    halted: systemState.halted,
    stateHash,
    details: {
      fills: fills.length,
      openOrders: openOrders.length,
      lastOrderStatus: lastOrder.status,
      pnl: pnl ? {
        grossPnl: pnl.grossPnl,
        realizedPnl: pnl.realizedPnl,
        unrealizedPnl: pnl.unrealizedPnl,
        exchangeFees: pnl.exchangeFees,
        estimatedFees: pnl.estimatedFees,
        totalFees: pnl.totalFees,
        netPnl: pnl.netPnl,
        activeTrades: pnl.activeTrades.length,
        closedTrades: pnl.closedTrades.length
      } : undefined
    }
  });

  return {
    position: exchangePosition,
    account,
    fills,
    openOrders,
    lastOrder,
    stateHash,
    pnl
  };
}

async function settleAfterOrder(): Promise<void> {
  await sleep(1500);
  await reconcile();
}

async function simulateOrder(side: "BUY" | "SELL", quantityOrQuote: number, clientOrderId: string): Promise<{ status: "FILLED"; side: "BUY" | "SELL"; simulated: true; clientOrderId: string; orderId: string }> {
  return {
    status: "FILLED",
    side,
    simulated: true,
    clientOrderId,
    orderId: `sim-${clientOrderId}`
  };
}

async function placeBuy(exchange: RuntimeExchange = binanceSpotTestnet): Promise<void> {
  if (!registerOrderAttempt()) return;

  const clientOrderId = crypto.randomUUID();
  const metadata = buildEntryMetadata();
  setOrderMetadata(clientOrderId, metadata);

  const res = await withRetry(async () => {
    if (DRY_RUN) {
      return simulateOrder("BUY", ORDER_QUOTE_SIZE_USDT, clientOrderId);
    }

    return exchange.marketBuy(SYMBOL, ORDER_QUOTE_SIZE_USDT, clientOrderId);
  }, 3);

  persistOrderMetadata(clientOrderId, res, metadata);

  await haltOnUnknownOrder(res, "BUY");
  await guardNewOrderTimeout(res, exchange);

  runtimeJournal.log({
    ts: Date.now(),
    type: DRY_RUN ? "ORDER_SIMULATED" : "ORDER_PLACED",
    activeOrder: systemState.activeOrder,
    halted: systemState.halted,
    details: { side: "BUY", symbol: SYMBOL, quoteOrderQty: ORDER_QUOTE_SIZE_USDT, clientOrderId, metadata, response: res }
  });

  await settleAfterOrder();
}

async function placeSell(quantity: number, exchange: RuntimeExchange = binanceSpotTestnet): Promise<void> {
  if (!registerOrderAttempt()) return;

  const clientOrderId = crypto.randomUUID();
  const metadata = buildExitMetadata();
  setOrderMetadata(clientOrderId, metadata);

  const res = await withRetry(async () => {
    if (DRY_RUN) {
      return simulateOrder("SELL", quantity, clientOrderId);
    }

    return exchange.marketSell(SYMBOL, quantity, clientOrderId);
  }, 3);

  persistOrderMetadata(clientOrderId, res, metadata);

  await haltOnUnknownOrder(res, "SELL");
  await guardNewOrderTimeout(res, exchange);

  runtimeJournal.log({
    ts: Date.now(),
    type: DRY_RUN ? "ORDER_SIMULATED" : "ORDER_PLACED",
    activeOrder: systemState.activeOrder,
    halted: systemState.halted,
    details: { side: "SELL", symbol: SYMBOL, quantity, clientOrderId, metadata, response: res }
  });

  await settleAfterOrder();
}

export async function safeBuy(): Promise<void> {
  if (systemState.activeOrder) return;
  if (!canTrade()) return;

  systemState.activeOrder = true;

  try {
    await placeBuy();
  } finally {
    systemState.activeOrder = false;
  }
}

export async function safeSell(quantity: number): Promise<void> {
  if (systemState.activeOrder) return;
  if (!canTrade()) return;

  systemState.activeOrder = true;

  try {
    await placeSell(quantity);
  } finally {
    systemState.activeOrder = false;
  }
}

export class TradingRuntime {
  readonly state: SystemState;
  readonly exchange: RuntimeExchange;
  readonly market: RuntimeMarketStatus;
  readonly strategy: SimpleStrategy;
  readonly logger: RuntimeJournal;

  constructor(input: {
    state?: SystemState;
    exchange?: RuntimeExchange;
    market?: RuntimeMarketStatus;
    strategy?: SimpleStrategy;
    logger?: RuntimeJournal;
  } = {}) {
    this.state = input.state ?? systemState;
    this.exchange = input.exchange ?? binanceSpotTestnet;
    this.market = input.market ?? liveMarketStatus;
    this.strategy = input.strategy ?? simpleStrategy;
    this.logger = input.logger ?? runtimeJournal;
  }

  assertWsHealthy(): boolean {
    if (!this.market.connected) {
      haltSystem(HaltReason.WS_DISCONNECTED);
      return false;
    }

    if (Date.now() - this.state.lastWsTick > WS_TIMEOUT_MS) {
      haltSystem(HaltReason.WS_DEAD);
      return false;
    }

    return true;
  }

  async start(): Promise<void> {
    if ("startTimeSync" in this.exchange && typeof (this.exchange as any).startTimeSync === "function") {
      (this.exchange as any).startTimeSync();
    }

    this.logger.log({ ts: Date.now(), type: "RUNTIME_START", halted: this.state.halted });
    await this.startupSafetyCheck();

    while (true) {
      if (isHalted()) break;

      try {
        await this.cycle();
        resetErrorCounter();
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        markRuntimeError(reason, MAX_CONSECUTIVE_ERRORS);
        if (!isHalted()) {
          haltSystem(reason);
        }
      }

      await sleep(3000);
    }

    this.logger.log({
      ts: Date.now(),
      type: "RUNTIME_STOP",
      halted: this.state.halted,
      reason: this.state.haltReason
    });
  }

  async startupSafetyCheck(): Promise<void> {
    if ("syncTime" in this.exchange && typeof (this.exchange as any).syncTime === "function") {
      await (this.exchange as any).syncTime();
    }

    await reconcileWithLatency(this.exchange);

    if (isHalted()) {
      throw new Error("DIRTY START");
    }
  }

  async cycle(): Promise<void> {
    if (!this.assertWsHealthy()) return;

    recordRuntimeEvents(1);

    const { state, latency: reconcileLatency } = await reconcileWithLatency(this.exchange);

    if (Math.abs(state.position) > MAX_POSITION_QTY_RUNTIME) {
      haltSystem(HaltReason.POSITION_OVERFLOW, {
        position: state.position,
        maxPosition: MAX_POSITION_QTY_RUNTIME
      });
      return;
    }

    const wsAlive = this.market.connected && Date.now() - this.state.lastWsTick <= WS_TIMEOUT_MS;
    const metrics = runtimeEngine.getMetrics();

    const eventRateWarmupActive = Date.now() - PROCESS_START_TS < EVENT_RATE_WARMUP_MS;

    if (!eventRateWarmupActive && metrics.eventsPerSecond > MAX_EVENTS_PER_SECOND) {
      haltSystem(HaltReason.EVENT_STORM, {
        eventsPerSecond: metrics.eventsPerSecond,
        maxEventsPerSecond: MAX_EVENTS_PER_SECOND
      });
      return;
    }

    console.log({
      ts: Date.now(),
      position: state.position,
      activeOrder: this.state.activeOrder,
      halted: this.state.halted,
      wsAlive,
      lastOrderStatus: state.lastOrder.status,
      reconcileLatency,
      eventsPerSecond: metrics.eventsPerSecond,
      pnl: state.pnl ? {
        realized: state.pnl.realizedPnl,
        unrealized: state.pnl.unrealizedPnl,
        net: state.pnl.netPnl,
        fees: state.pnl.totalFees
      } : undefined
    });

    this.logger.log({
      ts: Date.now(),
      type: "CYCLE",
      position: state.position,
      activeOrder: this.state.activeOrder,
      halted: this.state.halted,
      stateHash: state.stateHash,
      details: {
        wsAlive,
        reconcileLatency,
        eventsPerSecond: metrics.eventsPerSecond,
        fills: state.fills.length,
        openOrders: state.openOrders.length,
        lastOrderStatus: state.lastOrder.status,
        pnl: state.pnl ? {
          realizedPnl: state.pnl.realizedPnl,
          unrealizedPnl: state.pnl.unrealizedPnl,
          netPnl: state.pnl.netPnl,
          totalFees: state.pnl.totalFees,
          activeTrades: state.pnl.activeTrades.length,
          closedTrades: state.pnl.closedTrades.length
        } : undefined
      }
    });

    if (isHalted()) return;
    if (this.state.activeOrder) return;

    if (Math.abs(state.position) > 0 && Math.abs(state.position) < MIN_POSITION_THRESHOLD) {
      await safeSell(Math.abs(state.position));
      return;
    }

    const decision: TradeDecision = this.strategy.decide({
      position: state.position,
      activeOrder: this.state.activeOrder,
      halted: this.state.halted,
      minSellQuantity: MIN_SELL_QUANTITY
    });

    if (decision === "BUY") {
      await safeBuy();
      return;
    }

    if (decision === "SELL") {
      await safeSell(state.position);
    }
  }
}

export const tradingRuntime = new TradingRuntime();

export async function mainCycle(): Promise<void> {
  await tradingRuntime.cycle();
}

export async function startLoop(): Promise<void> {
  await tradingRuntime.start();
}

export async function startupSafetyCheck(): Promise<void> {
  await tradingRuntime.startupSafetyCheck();
}
