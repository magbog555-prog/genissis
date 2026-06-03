import fs from "node:fs";
import path from "node:path";
import { UNKNOWN_METADATA, type TradeMetadata } from "../strategy/trade-metadata.js";

export type TradeStatus = "OPEN" | "CLOSED";
export type FillSide = "BUY" | "SELL";

export interface PnLFill {
  fillId: string;
  symbol: string;
  side: FillSide;
  price: number;
  qty: number;
  quoteQty: number;
  commission: number;
  commissionAsset?: string;
  commissionQuote: number;
  exchangeFeeQuote: number;
  estimatedFeeQuote: number;
  totalFeeQuote: number;
  orderId?: string;
  time: number;
  expectedPrice: number;
  actualFillPrice: number;
  slippageBps: number;
  slippageCost: number;
  raw?: unknown;
  metadata?: TradeMetadata;
}

export interface TradeTagContext {
  strategyId?: string;
  setupType?: string;
  sourceLogic?: string;
  metadata?: TradeMetadata;
}

export interface TradeObject extends TradeTagContext {
  tradeId: string;
  symbol: string;
  status: TradeStatus;
  metadata?: TradeMetadata;

  entryTime: number;
  exitTime: number;

  entryPrice: number;
  exitPrice: number;

  qty: number;

  entryNotional: number;
  exitNotional: number;

  fees: number;
  exchangeFees: number;
  estimatedFees: number;
  totalFees: number;

  grossPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  netPnl: number;

  durationMs: number;

  mae: number;
  mfe: number;

  expectedPrice: number;
  actualFillPrice: number;
  slippageBps: number;
  slippageCost: number;

  fills: PnLFill[];
}

export interface SymbolPnLState {
  symbol: string;
  activeTrade?: TradeObject;
  closedTrades: TradeObject[];
  processedFillIds: string[];
  duplicateFillIds: string[];
  lastPrice: number;
  position: number;
  grossPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  exchangeFees: number;
  estimatedFees: number;
  totalFees: number;
  netPnl: number;
}

export interface PnLSnapshot {
  symbols: Record<string, SymbolPnLState>;
  closedTrades: TradeObject[];
  activeTrades: TradeObject[];
  grossPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  exchangeFees: number;
  estimatedFees: number;
  totalFees: number;
  netPnl: number;
  duplicateFillIds: string[];
}

export interface PnLSummary {
  grossPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  exchangeFees: number;
  estimatedFees: number;
  totalFees: number;
  netPnl: number;
  closedTrades: number;
  activeTrades: number;
  symbols: Record<string, {
    grossPnl: number;
    realizedPnl: number;
    unrealizedPnl: number;
    exchangeFees: number;
    estimatedFees: number;
    totalFees: number;
    netPnl: number;
    closedTrades: number;
    activeTrades: number;
    position: number;
  }>;
}

export class PnLInvariantError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "PnLInvariantError";
  }
}

const runtimeJournalDir = path.resolve(process.cwd(), "data", "runtime");
const runtimeJournalPath = path.join(runtimeJournalDir, "trade-journal.jsonl");
const legacyJournalDir = path.resolve(process.cwd(), "data", "journal");
const legacyJournalPath = path.join(legacyJournalDir, "trade-journal.jsonl");

const POSITION_EPSILON = Number(process.env.PNL_POSITION_EPSILON ?? "0.00000001");
const SELL_OVERFLOW_TOLERANCE = Number(process.env.PNL_SELL_OVERFLOW_TOLERANCE ?? "0.0002");

const FEE_MODEL_ENABLED = process.env.FEE_MODEL_ENABLED !== "false";
const FEE_MODEL_MAKER_BPS = Number(process.env.FEE_MODEL_MAKER_BPS ?? "10");
const FEE_MODEL_TAKER_BPS = Number(process.env.FEE_MODEL_TAKER_BPS ?? "10");
const FEE_MODEL_FALLBACK_IF_EXCHANGE_FEE_ZERO = process.env.FEE_MODEL_FALLBACK_IF_EXCHANGE_FEE_ZERO !== "false";

function round(value: number, decimals = 12): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}


function cloneMetadata(metadata: TradeMetadata): TradeMetadata {
  return { ...metadata, tags: [...(metadata.tags ?? [])] };
}

function isUnknownMetadata(metadata: TradeMetadata | undefined): boolean {
  return !metadata || metadata.strategyId === "manual_unknown_v1" || metadata.setupType === "UNKNOWN";
}

function rawRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function fillSource(fill: PnLFill): string | undefined {
  const raw = rawRecord(fill.raw);
  const nestedRaw = rawRecord(raw?.raw);
  const source = raw?.source ?? raw?.eventSource ?? nestedRaw?.source ?? nestedRaw?.eventSource;
  return typeof source === "string" ? source : undefined;
}

function isReconcileFill(fill: PnLFill): boolean {
  const source = fillSource(fill);
  return source === "PNL_RECONCILE" || source === "PNL_RECONCILE_RECOVERY";
}

function metadataForReconcileWithoutEntry(metadata: TradeMetadata | undefined): TradeMetadata {
  const base = metadata ?? UNKNOWN_METADATA;
  return {
    ...base,
    tags: mergeTags(base.tags, ["reconcile_without_entry_metadata"])
  };
}

function mergeTags(...tagGroups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(tagGroups.flatMap((tags) => tags ?? [])));
}

function metadataWithExitReason(metadata: TradeMetadata, exitReason: string | null | undefined): TradeMetadata {
  return { ...metadata, tags: [...(metadata.tags ?? [])], exitReason: exitReason ?? metadata.exitReason ?? null };
}

function inheritSellMetadata(activeTrade: TradeObject, fill: PnLFill): PnLFill {
  if (!activeTrade.metadata) return fill;

  const exitReason = fill.metadata?.exitReason ?? activeTrade.metadata.exitReason ?? null;
  const inherited = metadataWithExitReason(activeTrade.metadata, exitReason);

  return {
    ...fill,
    metadata: {
      ...inherited,
      tags: mergeTags(inherited.tags, fill.metadata?.tags)
    }
  };
}

function shouldRequireEntryMetadata(): boolean {
  return process.env.PR35_REQUIRE_ENTRY_METADATA === "true";
}

function cloneFill(fill: PnLFill): PnLFill {
  return { ...fill, metadata: fill.metadata ? cloneMetadata(fill.metadata) : undefined };
}

function cloneTrade(trade: TradeObject): TradeObject {
  return {
    ...trade,
    metadata: trade.metadata ? cloneMetadata(trade.metadata) : undefined,
    fills: trade.fills.map(cloneFill)
  };
}

function cloneState(state: SymbolPnLState): SymbolPnLState {
  return {
    ...state,
    activeTrade: state.activeTrade ? cloneTrade(state.activeTrade) : undefined,
    closedTrades: state.closedTrades.map(cloneTrade),
    processedFillIds: [...state.processedFillIds],
    duplicateFillIds: [...state.duplicateFillIds]
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

function quoteAssetFromSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  const knownQuotes = ["USDT", "FDUSD", "USDC", "BUSD", "BTC", "ETH", "BNB", "USD"];
  return knownQuotes.find((quote) => normalized.endsWith(quote)) ?? "USDT";
}

function baseAssetFromSymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  const quote = quoteAssetFromSymbol(normalized);
  return normalized.slice(0, normalized.length - quote.length);
}

function commissionToQuote(input: {
  symbol: string;
  price: number;
  commission: number;
  commissionAsset?: string;
}): number {
  const asset = input.commissionAsset?.toUpperCase();
  if (!asset || input.commission <= 0) return 0;

  const quote = quoteAssetFromSymbol(input.symbol);
  const base = baseAssetFromSymbol(input.symbol);

  if (asset === quote) return input.commission;
  if (asset === base) return input.commission * input.price;

  return 0;
}

function manualFeeQuote(input: { notional: number; side: FillSide; isMaker?: boolean }): number {
  if (!FEE_MODEL_ENABLED) return 0;
  const bps = input.isMaker ? FEE_MODEL_MAKER_BPS : FEE_MODEL_TAKER_BPS;
  return round(input.notional * bps / 10000);
}

function calculateFee(input: {
  symbol: string;
  price: number;
  qty: number;
  side: FillSide;
  commission: number;
  commissionAsset?: string;
  isMaker?: boolean;
}): {
  exchangeFeeQuote: number;
  estimatedFeeQuote: number;
  totalFeeQuote: number;
} {
  const exchangeFeeQuote = round(commissionToQuote({
    symbol: input.symbol,
    price: input.price,
    commission: input.commission,
    commissionAsset: input.commissionAsset
  }));

  const notional = round(input.price * input.qty);
  const estimatedFeeQuote = exchangeFeeQuote > 0
    ? 0
    : (FEE_MODEL_FALLBACK_IF_EXCHANGE_FEE_ZERO ? manualFeeQuote({ notional, side: input.side, isMaker: input.isMaker }) : 0);

  return {
    exchangeFeeQuote,
    estimatedFeeQuote,
    totalFeeQuote: round(exchangeFeeQuote + estimatedFeeQuote)
  };
}

function calculateSlippage(input: {
  side: FillSide;
  expectedPrice: number;
  actualFillPrice: number;
  qty: number;
}): {
  slippageBps: number;
  slippageCost: number;
} {
  if (!Number.isFinite(input.expectedPrice) || input.expectedPrice <= 0) {
    return { slippageBps: 0, slippageCost: 0 };
  }

  const slippageBps = round((input.actualFillPrice - input.expectedPrice) / input.expectedPrice * 10000);
  const adversePerUnit = input.side === "BUY"
    ? Math.max(0, input.actualFillPrice - input.expectedPrice)
    : Math.max(0, input.expectedPrice - input.actualFillPrice);

  return {
    slippageBps,
    slippageCost: round(adversePerUnit * input.qty)
  };
}

function makeTrade(symbol: string, fill: PnLFill, tags?: TradeTagContext): TradeObject {
  return {
    tradeId: `trade-${symbol}-${fill.fillId}`,
    symbol,
    status: "OPEN",
    entryTime: fill.time,
    exitTime: 0,
    entryPrice: 0,
    exitPrice: 0,
    qty: 0,
    entryNotional: 0,
    exitNotional: 0,
    fees: 0,
    exchangeFees: 0,
    estimatedFees: 0,
    totalFees: 0,
    grossPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    netPnl: 0,
    durationMs: 0,
    mae: 0,
    mfe: 0,
    expectedPrice: fill.expectedPrice,
    actualFillPrice: fill.actualFillPrice,
    slippageBps: fill.slippageBps,
    slippageCost: 0,
    fills: [],
    metadata: tags?.metadata ? cloneMetadata(tags.metadata) : undefined,
    strategyId: tags?.metadata?.strategyId ?? tags?.strategyId,
    setupType: tags?.metadata?.setupType ?? tags?.setupType,
    sourceLogic: tags?.metadata?.sourceLogic ?? tags?.sourceLogic
  };
}

function refreshFeeTotals(trade: TradeObject): void {
  trade.exchangeFees = round(trade.fills.reduce((sum, fill) => sum + fill.exchangeFeeQuote, 0));
  trade.estimatedFees = round(trade.fills.reduce((sum, fill) => sum + fill.estimatedFeeQuote, 0));
  trade.totalFees = round(trade.exchangeFees + trade.estimatedFees);
  trade.fees = trade.totalFees;
  trade.slippageCost = round(trade.fills.reduce((sum, fill) => sum + fill.slippageCost, 0));
}

function finalizeDerived(trade: TradeObject, lastPrice: number): TradeObject {
  if (trade.entryNotional > 0 && trade.fills.some((fill) => fill.side === "BUY")) {
    const entryQty = trade.fills
      .filter((fill) => fill.side === "BUY")
      .reduce((sum, fill) => sum + fill.qty, 0);
    trade.entryPrice = entryQty > 0 ? round(trade.entryNotional / entryQty) : 0;
  }

  if (trade.exitNotional > 0 && trade.fills.some((fill) => fill.side === "SELL")) {
    const exitQty = trade.fills
      .filter((fill) => fill.side === "SELL")
      .reduce((sum, fill) => sum + fill.qty, 0);
    trade.exitPrice = exitQty > 0 ? round(trade.exitNotional / exitQty) : 0;
  }

  refreshFeeTotals(trade);

  if (trade.status === "OPEN") {
    const mark = lastPrice > 0 ? lastPrice : trade.entryPrice;
    trade.unrealizedPnl = round((mark - trade.entryPrice) * trade.qty);
  } else {
    trade.unrealizedPnl = 0;
  }

  // PR33.2 FIX:
// realizedPnl = gross realized PnL before fees
// netPnl = gross realized + unrealized - all fees
trade.realizedPnl = round(trade.grossPnl);
trade.netPnl = round(trade.grossPnl + trade.unrealizedPnl - trade.totalFees);
  trade.durationMs = trade.exitTime > 0 ? trade.exitTime - trade.entryTime : Date.now() - trade.entryTime;

  trade.mae = Math.min(trade.mae, trade.unrealizedPnl);
  trade.mfe = Math.max(trade.mfe, trade.unrealizedPnl);

  if (trade.fills.length > 0) {
    const weightedExpected = trade.fills.reduce((sum, fill) => sum + fill.expectedPrice * fill.qty, 0);
    const weightedActual = trade.fills.reduce((sum, fill) => sum + fill.actualFillPrice * fill.qty, 0);
    const qty = trade.fills.reduce((sum, fill) => sum + fill.qty, 0);
    trade.expectedPrice = qty > 0 ? round(weightedExpected / qty) : 0;
    trade.actualFillPrice = qty > 0 ? round(weightedActual / qty) : 0;
    trade.slippageBps = trade.expectedPrice > 0
      ? round((trade.actualFillPrice - trade.expectedPrice) / trade.expectedPrice * 10000)
      : 0;
  }

  return trade;
}


  function assertTradeInvariants(trade: TradeObject): void {
  if (trade.qty < -POSITION_EPSILON) {
    throw new PnLInvariantError("trade qty < 0", {
      tradeId: trade.tradeId,
      qty: trade.qty
    });
  }

  if (trade.entryPrice < 0) {
    throw new PnLInvariantError("entryPrice < 0", {
      tradeId: trade.tradeId,
      entryPrice: trade.entryPrice
    });
  }

  if (round(trade.realizedPnl) !== round(trade.grossPnl)) {
    throw new PnLInvariantError("realizedPnl != grossPnl", {
      tradeId: trade.tradeId,
      realizedPnl: trade.realizedPnl,
      grossPnl: trade.grossPnl
    });
  }

  if (round(trade.netPnl) !== round(trade.grossPnl + trade.unrealizedPnl - trade.totalFees)) {
    throw new PnLInvariantError("netPnl != grossPnl + unrealizedPnl - totalFees", {
      tradeId: trade.tradeId,
      netPnl: trade.netPnl,
      grossPnl: trade.grossPnl,
      unrealizedPnl: trade.unrealizedPnl,
      totalFees: trade.totalFees
    });
  }

  if (trade.netPnl > round(trade.grossPnl + trade.unrealizedPnl) + POSITION_EPSILON) {
    throw new PnLInvariantError("netPnl > grossPnl + unrealizedPnl", {
      tradeId: trade.tradeId,
      netPnl: trade.netPnl,
      grossPnl: trade.grossPnl,
      unrealizedPnl: trade.unrealizedPnl,
      totalFees: trade.totalFees
    });
  }

  if (trade.status === "CLOSED" && Math.abs(trade.qty) > POSITION_EPSILON) {
    throw new PnLInvariantError("CLOSED trade has non-zero qty", {
      tradeId: trade.tradeId,
      qty: trade.qty
    });
  }
}

const journaledTradeEvents = new Set<string>();
const closedJournaledTradeIds = new Set<string>();
let closedJournaledTradeIdsLoaded = false;

function loadClosedJournaledTradeIdsOnce(): void {
  if (closedJournaledTradeIdsLoaded) return;
  closedJournaledTradeIdsLoaded = true;

  try {
    if (!fs.existsSync("trade-journal.jsonl")) return;

    const lines = fs.readFileSync("trade-journal.jsonl", "utf8").split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const event = JSON.parse(line);
        if (event?.type === "trade_closed" && event?.tradeId) {
          closedJournaledTradeIds.add(String(event.tradeId));
        }
      } catch {
        // ignore broken historical line
      }
    }
  } catch {
    // journal may not exist yet
  }
}

export function resetTradeJournalDedupe(): void {
  journaledTradeEvents.clear();
  closedJournaledTradeIds.clear();
  closedJournaledTradeIdsLoaded = false;
}
function writeTradeJournal(type: string, trade: TradeObject, details?: any): void {
    loadClosedJournaledTradeIdsOnce();
  
    if (
    closedJournaledTradeIds.has(trade.tradeId) &&
    (type === "trade_created" || type === "trade_updated")
  ) {
    return;
  }

  if (type === "trade_closed") {
    closedJournaledTradeIds.add(trade.tradeId);
  }

  const key = JSON.stringify({
    type,
    tradeId: trade.tradeId,
    fillId: details?.fillId,
    status: trade.status,
    qty: round(trade.qty),
    netPnl: round(trade.netPnl),
    fillCount: trade.fills.length
  });
  if (journaledTradeEvents.has(key)) return;
  journaledTradeEvents.add(key);

  const event = {
    ts: Date.now(),
    type,
    symbol: trade.symbol,
    tradeId: trade.tradeId,
    status: trade.status,
    qty: trade.qty,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    grossPnl: trade.grossPnl,
    realizedPnl: trade.realizedPnl,
    unrealizedPnl: trade.unrealizedPnl,
    exchangeFees: trade.exchangeFees,
    estimatedFees: trade.estimatedFees,
    totalFees: trade.totalFees,
    netPnl: trade.netPnl,
    fees: trade.fees,
    mae: trade.mae,
    mfe: trade.mfe,
    expectedPrice: trade.expectedPrice,
    actualFillPrice: trade.actualFillPrice,
    slippageBps: trade.slippageBps,
    slippageCost: trade.slippageCost,
    trade: cloneTrade(trade),
    details
  };

  const line = `${JSON.stringify(event)}\n`;
  fs.mkdirSync(runtimeJournalDir, { recursive: true });
  fs.appendFileSync(runtimeJournalPath, line, "utf-8");

  fs.mkdirSync(legacyJournalDir, { recursive: true });
  fs.appendFileSync(legacyJournalPath, line, "utf-8");
}

function initialState(symbol: string): SymbolPnLState {
  return {
    symbol,
    closedTrades: [],
    processedFillIds: [],
    duplicateFillIds: [],
    lastPrice: 0,
    position: 0,
    grossPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    exchangeFees: 0,
    estimatedFees: 0,
    totalFees: 0,
    netPnl: 0
  };
}

export class PnLEngine {
  private states = new Map<string, SymbolPnLState>();
  private lastStateHash = "";

  clear(): void {
    this.states.clear();
    this.lastStateHash = "";
    resetTradeJournalDedupe();
  }

  normalizeFill(input: {
    id?: string | number;
    tradeId?: string | number;
    orderId?: string | number;
    symbol: string;
    side: FillSide | string;
    price: string | number;
    qty?: string | number;
    quantity?: string | number;
    quoteQty?: string | number;
    commission?: string | number;
    commissionAsset?: string;
    time?: string | number;
    expectedPrice?: string | number;
    isMaker?: boolean;
    raw?: unknown;
    metadata?: TradeMetadata;
  }): PnLFill {
    const symbol = normalizeSymbol(input.symbol);
    const price = Number(input.price);
    const qty = Number(input.qty ?? input.quantity ?? 0);
    const quoteQty = Number(input.quoteQty ?? price * qty);
    const commission = Number(input.commission ?? 0);
    const fillId = String(input.id ?? input.tradeId ?? `${input.orderId ?? "order"}-${input.time ?? "time"}-${input.side}-${price}-${qty}`);
    const side = String(input.side).toUpperCase() as FillSide;

    if (side !== "BUY" && side !== "SELL") {
      throw new PnLInvariantError("Invalid fill side", { fillId, side });
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new PnLInvariantError("Invalid fill price", { fillId, price });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new PnLInvariantError("Invalid fill quantity", { fillId, qty });
    }

    const expectedPrice = Number(input.expectedPrice ?? price);
    const fee = calculateFee({
      symbol,
      price,
      qty,
      side,
      commission,
      commissionAsset: input.commissionAsset,
      isMaker: input.isMaker
    });
    const slippage = calculateSlippage({
      side,
      expectedPrice,
      actualFillPrice: price,
      qty
    });

    return {
      fillId,
      symbol,
      side,
      price,
      qty,
      quoteQty,
      commission,
      commissionAsset: input.commissionAsset,
      commissionQuote: fee.totalFeeQuote,
      exchangeFeeQuote: fee.exchangeFeeQuote,
      estimatedFeeQuote: fee.estimatedFeeQuote,
      totalFeeQuote: fee.totalFeeQuote,
      orderId: input.orderId === undefined ? undefined : String(input.orderId),
      time: Number(input.time ?? Date.now()),
      expectedPrice,
      actualFillPrice: price,
      slippageBps: slippage.slippageBps,
      slippageCost: slippage.slippageCost,
      raw: input.raw,
      metadata: input.metadata ? cloneMetadata(input.metadata) : undefined
    };
  }

  onFill(fill: PnLFill, tags?: TradeTagContext): SymbolPnLState {
    const current = this.states.get(fill.symbol);
    const fills = current
      ? [...current.closedTrades.flatMap((trade) => trade.fills), ...(current.activeTrade?.fills ?? []), fill]
      : [fill];

    return this.rebuildSymbol(fill.symbol, fills, current?.lastPrice ?? fill.price, undefined, tags);
  }

  onPriceTick(symbol: string, price: number): SymbolPnLState {
    const normalized = normalizeSymbol(symbol);
    const state = this.ensureState(normalized);
    state.lastPrice = Number(price);

    if (state.activeTrade && state.lastPrice > 0) {
      finalizeDerived(state.activeTrade, state.lastPrice);
      assertTradeInvariants(state.activeTrade);
      this.recomputeStateTotals(state);
      this.states.set(normalized, cloneState(state));
    }

    return cloneState(state);
  }

  onReconcile(input: {
    symbol: string;
    fills: PnLFill[];
    position: number;
    lastPrice: number;
    tags?: TradeTagContext;
  }): PnLSnapshot {
    const symbol = normalizeSymbol(input.symbol);
    this.rebuildSymbol(symbol, input.fills, input.lastPrice, input.position, input.tags);
    return this.getPnL();
  }

  getActiveTrade(symbol: string): TradeObject | undefined {
    return this.states.get(normalizeSymbol(symbol))?.activeTrade;
  }

  getClosedTrades(): TradeObject[] {
    return [...this.states.values()].flatMap((state) => state.closedTrades).map(cloneTrade);
  }

  getPnL(): PnLSnapshot {
    const symbols: Record<string, SymbolPnLState> = {};
    for (const [symbol, state] of this.states.entries()) {
      symbols[symbol] = cloneState(state);
    }

    const activeTrades = Object.values(symbols)
      .flatMap((state) => state.activeTrade ? [state.activeTrade] : []);
    const closedTrades = Object.values(symbols).flatMap((state) => state.closedTrades);
    const grossPnl = round(Object.values(symbols).reduce((sum, state) => sum + state.grossPnl, 0));
    const realizedPnl = round(Object.values(symbols).reduce((sum, state) => sum + state.realizedPnl, 0));
    const unrealizedPnl = round(Object.values(symbols).reduce((sum, state) => sum + state.unrealizedPnl, 0));
    const exchangeFees = round(Object.values(symbols).reduce((sum, state) => sum + state.exchangeFees, 0));
    const estimatedFees = round(Object.values(symbols).reduce((sum, state) => sum + state.estimatedFees, 0));
    const totalFees = round(exchangeFees + estimatedFees);
    const duplicateFillIds = Object.values(symbols).flatMap((state) => state.duplicateFillIds);

    return {
      symbols,
      activeTrades,
      closedTrades,
      grossPnl,
      realizedPnl,
      unrealizedPnl,
      exchangeFees,
      estimatedFees,
      totalFees,
      netPnl: round(grossPnl + unrealizedPnl - totalFees),
      duplicateFillIds
    };
  }

  getSummary(): PnLSummary {
    const snapshot = this.getPnL();
    const symbols: PnLSummary["symbols"] = {};
    for (const [symbol, state] of Object.entries(snapshot.symbols)) {
      symbols[symbol] = {
        grossPnl: state.grossPnl,
        realizedPnl: state.realizedPnl,
        unrealizedPnl: state.unrealizedPnl,
        exchangeFees: state.exchangeFees,
        estimatedFees: state.estimatedFees,
        totalFees: state.totalFees,
        netPnl: state.netPnl,
        closedTrades: state.closedTrades.length,
        activeTrades: state.activeTrade ? 1 : 0,
        position: state.position
      };
    }

    return {
      grossPnl: snapshot.grossPnl,
      realizedPnl: snapshot.realizedPnl,
      unrealizedPnl: snapshot.unrealizedPnl,
      exchangeFees: snapshot.exchangeFees,
      estimatedFees: snapshot.estimatedFees,
      totalFees: snapshot.totalFees,
      netPnl: snapshot.netPnl,
      closedTrades: snapshot.closedTrades.length,
      activeTrades: snapshot.activeTrades.length,
      symbols
    };
  }

  replayJournalLines(lines: string[]): PnLSnapshot {
    this.clear();

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      const trade = event.trade as TradeObject | undefined;
      if (!trade?.symbol || !trade.tradeId) continue;

      const symbol = normalizeSymbol(trade.symbol);
      const state = this.ensureState(symbol);
      state.lastPrice = Math.max(state.lastPrice, trade.exitPrice, trade.entryPrice, event.details?.lastPrice ?? 0);

      if (trade.status === "CLOSED" || event.type === "trade_closed") {
        state.closedTrades = state.closedTrades.filter((existing) => existing.tradeId !== trade.tradeId);
        state.closedTrades.push(cloneTrade(trade));
        if (state.activeTrade?.tradeId === trade.tradeId) state.activeTrade = undefined;
      } else {
        state.activeTrade = cloneTrade(trade);
      }

      state.processedFillIds = Array.from(new Set([
        ...state.closedTrades.flatMap((closed) => closed.fills.map((fill) => fill.fillId)),
        ...(state.activeTrade?.fills.map((fill) => fill.fillId) ?? [])
      ]));

      this.recomputeStateTotals(state);
      this.states.set(symbol, cloneState(state));
    }

    return this.getPnL();
  }

  loadSnapshot(snapshot: PnLSnapshot): void {
    this.clear();
    for (const [symbol, state] of Object.entries(snapshot.symbols)) {
      this.states.set(symbol, cloneState(state));
    }
  }

  private ensureState(symbol: string): SymbolPnLState {
    const normalized = normalizeSymbol(symbol);
    const existing = this.states.get(normalized);
    if (existing) return cloneState(existing);

    return initialState(normalized);
  }

  private recomputeStateTotals(state: SymbolPnLState): void {
    const active = state.activeTrade;
    const closed = state.closedTrades;
    state.position = round(active?.qty ?? 0);
    state.grossPnl = round(closed.reduce((sum, trade) => sum + trade.grossPnl, 0) + (active?.grossPnl ?? 0));
state.realizedPnl = round(state.grossPnl);
state.unrealizedPnl = round(active?.unrealizedPnl ?? 0);
state.exchangeFees = round(closed.reduce((sum, trade) => sum + trade.exchangeFees, 0) + (active?.exchangeFees ?? 0));
state.estimatedFees = round(closed.reduce((sum, trade) => sum + trade.estimatedFees, 0) + (active?.estimatedFees ?? 0));
state.totalFees = round(state.exchangeFees + state.estimatedFees);
state.netPnl = round(state.grossPnl + state.unrealizedPnl - state.totalFees);
  }

  private rebuildSymbol(
    symbol: string,
    rawFills: PnLFill[],
    lastPrice: number,
    exchangePosition?: number,
    tags?: TradeTagContext
  ): SymbolPnLState {
    const normalizedFills = rawFills
      .filter((fill) => normalizeSymbol(fill.symbol) === symbol)
      .map((fill) => ({ ...fill, symbol }));

    const netFillPosition = round(normalizedFills.reduce((sum, fill) => {
      return sum + (fill.side === "BUY" ? fill.qty : -fill.qty);
    }, 0));

    const recoveredStartPosition = exchangePosition === undefined
      ? 0
      : round(exchangePosition - netFillPosition);

    if (recoveredStartPosition > POSITION_EPSILON) {
      const firstFill = normalizedFills
        .slice()
        .sort((a, b) => a.time - b.time || a.fillId.localeCompare(b.fillId))[0];

      const recoveryPrice = lastPrice > 0 ? lastPrice : (firstFill?.price ?? 1);
      const recoveryTime = firstFill ? Math.max(0, firstFill.time - 1) : Date.now();
      const recoveryFill = this.normalizeFill({
        id: `reconcile-recovered-${symbol}-${recoveryTime}-${recoveredStartPosition}`,
        symbol,
        side: "BUY",
        price: recoveryPrice,
        qty: recoveredStartPosition,
        quoteQty: round(recoveryPrice * recoveredStartPosition),
        commission: 0,
        commissionAsset: quoteAssetFromSymbol(symbol),
        time: recoveryTime,
        expectedPrice: recoveryPrice,
        raw: {
          source: "PNL_RECONCILE_RECOVERY",
          exchangePosition,
          netFillPosition,
          recoveredStartPosition
        }
      });
      normalizedFills.push(recoveryFill);
    }

    const sorted = normalizedFills
      .sort((a, b) => a.time - b.time || a.fillId.localeCompare(b.fillId));

    const seen = new Map<string, string>();
    const duplicateFillIds: string[] = [];

    for (const fill of sorted) {
      const fingerprint = JSON.stringify({
        symbol: fill.symbol,
        side: fill.side,
        price: round(fill.price),
        qty: round(fill.qty),
        orderId: fill.orderId,
        time: fill.time
      });

      const previous = seen.get(fill.fillId);
      if (previous && previous !== fingerprint) {
        throw new PnLInvariantError("duplicate fill id with conflicting payload", { fillId: fill.fillId });
      }
      if (previous) duplicateFillIds.push(fill.fillId);
      seen.set(fill.fillId, fingerprint);
    }

    const unique = sorted.filter((fill, index, arr) => arr.findIndex((candidate) => candidate.fillId === fill.fillId) === index);

    let activeTrade: TradeObject | undefined;
    const closedTrades: TradeObject[] = [];

    loadClosedJournaledTradeIdsOnce();

    for (const originalFill of unique) {
      let fill = originalFill;

      if (fill.side === "BUY") {
        if (!activeTrade) {
          const missingEntryMetadata = isUnknownMetadata(fill.metadata);
          const reconcileFill = isReconcileFill(fill);

          if (shouldRequireEntryMetadata() && missingEntryMetadata && !reconcileFill) {
            throw new PnLInvariantError("BUY fill missing required PR35 metadata", {
              fillId: fill.fillId,
              orderId: fill.orderId,
              symbol: fill.symbol,
              source: fillSource(fill) ?? null
            });
          }

          if (missingEntryMetadata && reconcileFill) {
            fill = {
              ...fill,
              metadata: metadataForReconcileWithoutEntry(fill.metadata)
            };
          }

          activeTrade = makeTrade(symbol, fill, fill.metadata ? { metadata: fill.metadata } : tags);
          writeTradeJournal("trade_created", activeTrade, { fillId: fill.fillId });
        }

        activeTrade.fills.push(fill);
        activeTrade.qty = round(activeTrade.qty + fill.qty);
        activeTrade.entryNotional = round(activeTrade.entryNotional + fill.price * fill.qty);
        finalizeDerived(activeTrade, lastPrice);
        writeTradeJournal("trade_updated", activeTrade, { fillId: fill.fillId, side: fill.side });
        assertTradeInvariants(activeTrade);
        continue;
      }

      if (!activeTrade) {
        throw new PnLInvariantError("SELL fill without OPEN trade", { fillId: fill.fillId, symbol });
      }

      const exitQty = fill.qty;
      const sellOverflow = exitQty - activeTrade.qty;

      if (sellOverflow > SELL_OVERFLOW_TOLERANCE) {
        throw new PnLInvariantError("SELL quantity exceeds active trade quantity", {
          fillId: fill.fillId,
          exitQty,
          activeQty: activeTrade.qty,
          sellOverflow
        });
      }

      fill = inheritSellMetadata(activeTrade, fill);

      const effectiveExitQty = Math.min(exitQty, activeTrade.qty);
      activeTrade.fills.push(fill);
      activeTrade.qty = round(activeTrade.qty - effectiveExitQty);
      activeTrade.exitNotional = round(activeTrade.exitNotional + fill.price * effectiveExitQty);
      activeTrade.grossPnl = round(activeTrade.grossPnl + (fill.price - activeTrade.entryPrice) * effectiveExitQty);

      if (activeTrade.qty <= POSITION_EPSILON) {
        activeTrade.qty = 0;
        activeTrade.status = "CLOSED";
        activeTrade.exitTime = fill.time;
        if (activeTrade.metadata) {
          activeTrade.metadata = metadataWithExitReason(activeTrade.metadata, fill.metadata?.exitReason);
        }
        finalizeDerived(activeTrade, lastPrice);
        assertTradeInvariants(activeTrade);
        writeTradeJournal("trade_closed", activeTrade, { fillId: fill.fillId });
        closedTrades.push(cloneTrade(activeTrade));
        activeTrade = undefined;
      } else {
        finalizeDerived(activeTrade, lastPrice);
        assertTradeInvariants(activeTrade);
        writeTradeJournal("trade_partial_exit", activeTrade, { fillId: fill.fillId, remainingQty: activeTrade.qty });
      }
    }

    if (activeTrade) {
      finalizeDerived(activeTrade, lastPrice);
      assertTradeInvariants(activeTrade);
    }

    const totalActiveQty = round(activeTrade?.qty ?? 0);
    if (exchangePosition !== undefined) {
      if (exchangePosition > POSITION_EPSILON && !activeTrade) {
        throw new PnLInvariantError("position > 0 but no OPEN trade", { exchangePosition, symbol });
      }
      if (Math.abs(exchangePosition) <= POSITION_EPSILON && activeTrade) {
        throw new PnLInvariantError("position = 0 but trade OPEN", { exchangePosition, activeQty: totalActiveQty, symbol });
      }
      if (Math.abs(exchangePosition - totalActiveQty) > Math.max(POSITION_EPSILON, 0.0000001)) {
        throw new PnLInvariantError("position drift between exchange and PnL trade", {
          exchangePosition,
          activeQty: totalActiveQty,
          symbol
        });
      }
    }

    const state: SymbolPnLState = {
      ...initialState(symbol),
      activeTrade: activeTrade ? cloneTrade(activeTrade) : undefined,
      closedTrades: closedTrades.map(cloneTrade),
      processedFillIds: unique.map((fill) => fill.fillId),
      duplicateFillIds,
      lastPrice
    };
    this.recomputeStateTotals(state);

    if (round(state.netPnl) !== round(state.grossPnl + state.unrealizedPnl - state.totalFees)) {
  throw new PnLInvariantError("symbol netPnl != grossPnl + unrealizedPnl - totalFees", state);
}
if (state.netPnl > round(state.grossPnl + state.unrealizedPnl) + POSITION_EPSILON) {
      throw new PnLInvariantError("symbol netPnl exceeds grossPnl + unrealizedPnl", state);
    }

    this.states.set(symbol, cloneState(state));

    const hash = JSON.stringify({
      symbol,
      activeTradeId: activeTrade?.tradeId,
      activeQty: activeTrade?.qty ?? 0,
      closedCount: closedTrades.length,
      fillCount: unique.length,
      netPnl: state.netPnl,
      totalFees: state.totalFees
    });

    if (hash !== this.lastStateHash) {
      this.lastStateHash = hash;
      const journalTrade = activeTrade ?? closedTrades.at(-1);
      if (journalTrade) writeTradeJournal("trade_reconciled", journalTrade, {
        position: exchangePosition,
        grossPnl: state.grossPnl,
        realizedPnl: state.realizedPnl,
        unrealizedPnl: state.unrealizedPnl,
        exchangeFees: state.exchangeFees,
        estimatedFees: state.estimatedFees,
        totalFees: state.totalFees,
        netPnl: state.netPnl,
        closedTrades: closedTrades.length,
        activeTrade: Boolean(activeTrade),
        lastPrice
      });
    }

    return cloneState(state);
  }
}

export const pnlEngine = new PnLEngine();
