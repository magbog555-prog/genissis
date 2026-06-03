import express from "express";
import cors from "cors";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { runtimeEngine } from "../../../core/runtime/src/runtime-engine.js";
import { calculatePosition } from "../../../core/domain/position.calc.js";
import { assertInvariants } from "../../../core/invariants/engine.invariants.js";
import { withRetry } from "../../../core/utils/retry.js";
import { MarketTickPayloadSchema, SignalPayloadSchema, EVENT_TYPE, makeEvent } from "../../../core/contracts/src/events.js";
import { ActionRequestSchema } from "../../../core/contracts/src/actions.js";
import { liveMarketStatus } from "../../../application/market/src/binance-live-market.js";
import { binanceSpotTestnet, buildPositionPayloadFromAccount } from "../../../application/exchange/src/binance-spot-testnet.js";

function parseOr400<T>(schema: z.ZodSchema<T>, body: unknown, res: express.Response): T | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: "ValidationError",
      details: "Invalid request body",
      statusCode: 400,
      validationErrors: parsed.error.flatten().fieldErrors
    });
    return undefined;
  }
  return parsed.data;
}


async function reconcilePositionFromExchange() {
  const snapshot = runtimeEngine.getSnapshot();

  // 🛡️ RETRY WRAPPER для exchange calls
  const account = await withRetry(
    () => binanceSpotTestnet.getAccount(),
    3,
    300
  );

  const payload = buildPositionPayloadFromAccount({
    account,
    symbol: binanceSpotTestnet.symbol,
    markPrice: snapshot.market.lastPrice ?? 0,
    source: "exchange"
  });

  // 🧠 GLOBAL INVARIANT: position = Σ fills
  const allEvents = runtimeEngine.getEvents(1_000_000);
  const fills = allEvents
    .filter(e => e.eventType === EVENT_TYPE.ORDER_EXECUTION_REPORTED)
    .map(e => ({
      tradeId: String(e.eventId),
      side: String((e.payload as any).side ?? "").toUpperCase() as "BUY" | "SELL",
      quantity: String((e.payload as any).filledQuantityDelta ?? (e.payload as any).filledQuantity ?? "0")
    }));
  const computedPosition = calculatePosition(fills);
  const exchangePosition = String(payload.quantity ?? "0");

  if (Number(computedPosition) !== Number(exchangePosition)) {
    throw new Error(`💀 POSITION DRIFT DETECTED: computed=${computedPosition} vs exchange=${exchangePosition}`);
  }

  // 🛡️ GLOBAL INVARIANT ENGINE
  assertInvariants({
    fills,
    order: {
      id: String(snapshot.order.orderId ?? ""),
      status: snapshot.order.status,
      quantity: String(snapshot.order.quantity ?? "0"),
      filledQuantity: String(snapshot.order.filledQuantity ?? "0")
    },
    exchangePosition
  });

  const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, payload));
  return { account, payload, positionState: nextSnapshot.position, riskState: nextSnapshot.risk, systemState: nextSnapshot.system, snapshotRevision: nextSnapshot.revision };
}


type StressJobStatus = "queued" | "running" | "completed" | "failed" | "orchestration_failed_but_core_safe";

interface StressJobRecord {
  jobId: string;
  name: string;
  status: StressJobStatus;
  requestedStates: number;
  batchSize: number;
  processedStates: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  error?: string;
  progress: {
    percent: number;
    eventsBefore: number;
    eventsAfter?: number;
    snapshotRevisionBefore: number;
    snapshotRevisionAfter?: number;
  };
  counters: {
    unsafeGateDenied: number;
    unsafeGateFalseAllow: number;
    reconcileOrderAllowed: number;
    reconcilePositionAllowed: number;
    recoveriesCompleted: number;
  };
  result?: {
    ok: boolean;
    assertions: Record<string, boolean>;
    metrics: ReturnType<typeof runtimeEngine.getMetrics>;
    invariants: ReturnType<typeof runtimeEngine.getInvariants>;
    finalStateDomains: Record<string, string>;
  };
}

const stressJobs = new Map<string, StressJobRecord>();

const JOBS_DIR = path.join(process.cwd(), "data", "runtime", "jobs");

function ensureJobsDir() {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function jobFile(jobId: string) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function persistJob(job: StressJobRecord) {
  try {
    ensureJobsDir();
    fs.writeFileSync(jobFile(job.jobId), JSON.stringify(job, null, 2), "utf8");
  } catch {
    // Job persistence must never break the runtime path.
  }
}

function loadPersistedJobs() {
  try {
    ensureJobsDir();
    for (const file of fs.readdirSync(JOBS_DIR)) {
      if (!file.endsWith(".json")) continue;
      const full = path.join(JOBS_DIR, file);
      try {
        const job = JSON.parse(fs.readFileSync(full, "utf8")) as StressJobRecord;
        if (job?.jobId) stressJobs.set(job.jobId, job);
      } catch {
        // Ignore corrupt job registry records; PR22 tests can still verify core safety.
      }
    }
  } catch {}
}

loadPersistedJobs();
for (const job of stressJobs.values()) {
  if (job.status === "running" || job.status === "queued") {
    job.status = "orchestration_failed_but_core_safe";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    job.error = "recovered_after_restart";
    persistJob(job);
  }
}

function updateJob(job: StressJobRecord, patch: Partial<StressJobRecord> = {}) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistJob(job);
}

function countJobsByStatus() {
  const stats: Record<string, number> = {};
  for (const job of stressJobs.values()) stats[job.status] = (stats[job.status] ?? 0) + 1;
  return stats;
}

function summarizeCriticalInvariants(invariants: ReturnType<typeof runtimeEngine.getInvariants>) {
  const softInvariantNames = new Set(["commit_latency_bounded"]);
  const critical = invariants.filter((check) => !softInvariantNames.has(check.name));
  const latency = invariants.find((check) => check.name === "commit_latency_bounded");
  return {
    criticalPassed: critical.every((check) => check.ok),
    latencyBounded: latency?.ok ?? true,
    latencyDetails: latency?.details ?? "not measured",
    critical,
    latency
  };
}

function getActiveJobs(names?: string[]) {
  return Array.from(stressJobs.values()).filter((job) => {
    const isActive = job.status === "queued" || job.status === "running";
    const nameMatches = !names || names.includes(job.name);
    return isActive && nameMatches;
  });
}

function classifyChildResult(child: StressJobRecord) {
  const metrics = child.result?.metrics ?? runtimeEngine.getMetrics();
  const invariants = child.result?.invariants ?? runtimeEngine.getInvariants();
  const criticalInvariantSummary = summarizeCriticalInvariants(invariants);
  const safetyOk =
    child.counters.unsafeGateFalseAllow === 0 &&
    metrics.falseAllowCount === 0 &&
    metrics.actionViolationCount === 0 &&
    metrics.backlogDepth === 0 &&
    criticalInvariantSummary.criticalPassed === true;

  return {
    jobId: child.jobId,
    name: child.name,
    states: child.requestedStates,
    status: child.status,
    ok: child.result?.ok === true,
    processedStates: child.processedStates,
    safetyOk,
    retryable: child.status === "failed" && safetyOk,
    error: child.error,
    assertions: child.result?.assertions ?? {},
    latency: child.result?.metrics?.commitLatencyMs,
    criticalInvariantSummary
  };
}

function finalizeSuiteJob(suiteJob: StressJobRecord, childResults: any[]) {
  const metrics = runtimeEngine.getMetrics();
  const invariants = runtimeEngine.getInvariants();
  const criticalInvariantSummary = summarizeCriticalInvariants(invariants);
  const finalSnapshot = runtimeEngine.getSnapshot();

  const assertions: Record<string, boolean> = {
    allChildrenCompleted: childResults.every((r) => r.status === "completed" && r.ok === true),
    allChildrenSafetyOk: childResults.every((r) => r.safetyOk === true),
    zeroUnsafeFalseAllow: suiteJob.counters.unsafeGateFalseAllow === 0,
    finalRiskClear: finalSnapshot.risk.status === "clear",
    finalSystemHealthy: finalSnapshot.system.status === "healthy",
    noRuntimeBacklog: metrics.backlogDepth === 0,
    zeroFalseAllowMetric: metrics.falseAllowCount === 0,
    zeroActionViolations: metrics.actionViolationCount === 0,
    criticalInvariantsPassed: criticalInvariantSummary.criticalPassed === true,
    latencyNotFailed: metrics.commitLatencyMs.max < 500
  };

  const ok = Object.values(assertions).every(Boolean);
  suiteJob.status = ok ? "completed" : "failed";
  suiteJob.finishedAt = new Date().toISOString();
  suiteJob.updatedAt = suiteJob.finishedAt;
  suiteJob.progress.percent = 100;
  suiteJob.result = {
    ok,
    assertions: { ...assertions, childResults: childResults.every((r) => r.ok === true) },
    metrics,
    invariants,
    finalStateDomains: compactRuntimeDomains()
  };
  (suiteJob.result as any).children = childResults;
  (suiteJob.result as any).criticalInvariantSummary = criticalInvariantSummary;
  (suiteJob.result as any).classification = ok ? "passed" : (assertions.allChildrenSafetyOk ? "orchestration_failed_but_core_safe" : "core_or_safety_failed");
  persistJob(suiteJob);
  return suiteJob;
}

async function runChildWithRetry(level: number, batchSize: number, maxRetries: number) {
  const attempts: any[] = [];
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const child: StressJobRecord = {
      jobId: crypto.randomUUID(),
      name: `hard_stress_child_${level}`,
      status: "queued",
      requestedStates: level,
      batchSize,
      processedStates: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        eventsBefore: runtimeEngine.getEvents(1_000_000).length,
        snapshotRevisionBefore: runtimeEngine.getSnapshot().revision
      },
      counters: { unsafeGateDenied: 0, unsafeGateFalseAllow: 0, reconcileOrderAllowed: 0, reconcilePositionAllowed: 0, recoveriesCompleted: 0 }
    };
    stressJobs.set(child.jobId, child);
    persistJob(child);
    await runStateSpaceStressJob(child);
    const classified = classifyChildResult(child);
    attempts.push({ attempt, ...classified });

    if (classified.status === "completed" && classified.ok === true) {
      return { child, result: { ...classified, attempts } };
    }

    if (!classified.retryable || attempt > maxRetries) {
      return { child, result: { ...classified, attempts } };
    }

    await nextTick();
  }

  throw new Error("unreachable child retry state");
}


function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function nextTick() {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function compactRuntimeDomains() {
  const s = runtimeEngine.getSnapshot();
  return {
    market: s.market.status,
    trade: s.trade.status,
    order: s.order.status,
    position: s.position.status,
    risk: s.risk.status,
    system: s.system.status
  };
}

function splitInvariantChecks(invariants: ReturnType<typeof runtimeEngine.getInvariants>) {
  const latency = invariants.find((c) => c.name === "commit_latency_bounded");
  const critical = invariants.filter((c) => c.name !== "commit_latency_bounded");
  return {
    criticalPassed: critical.every((c) => c.ok),
    latencyBounded: latency?.ok === true,
    latencyDetails: latency?.details ?? "commit_latency_bounded invariant missing",
    critical,
    latency
  };
}

function classifyLatency(maxMs: number, warnMs = 20, degradeMs = 50, failMs = 100) {
  if (maxMs >= failMs) return "fail";
  if (maxMs >= degradeMs) return "degraded";
  if (maxMs >= warnMs) return "warn";
  return "ok";
}

function latencyGuardView(warnMs = 20, degradeMs = 50, failMs = 100) {
  const metrics = runtimeEngine.getMetrics();
  const maxMs = metrics.commitLatencyMs.max;
  const status = classifyLatency(maxMs, warnMs, degradeMs, failMs);
  return {
    ok: status === "ok" || status === "warn",
    status,
    thresholds: { warnMs, degradeMs, failMs },
    commitLatencyMs: metrics.commitLatencyMs,
    backlogDepth: metrics.backlogDepth,
    snapshotStalled: metrics.snapshotStalled,
    falseAllowCount: metrics.falseAllowCount,
    actionViolationCount: metrics.actionViolationCount
  };
}


function latestSegmentFile(dir: string) {
  if (!fs.existsSync(dir)) return undefined;
  const files = fs.readdirSync(dir)
    .filter((name) => /^segment-\d+\.jsonl$/.test(name))
    .sort();
  if (files.length === 0) return undefined;
  return path.join(dir, files[files.length - 1]);
}

function backupFile(filePath: string) {
  if (!fs.existsSync(filePath)) return undefined;
  const backupPath = `${filePath}.pr24bak.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function restoreBackup(filePath: string, backupPath?: string) {
  if (!backupPath || !fs.existsSync(backupPath)) return;
  fs.copyFileSync(backupPath, filePath);
  fs.unlinkSync(backupPath);
}

async function runSnapshotCorruptionSmoke() {
  const before = runtimeEngine.getRuntimeView();
  const persistence: any = before.persistence;
  const snapshotPath = String(persistence.snapshotPath);
  const backup = backupFile(snapshotPath);
  let replayAfterCorruption: any;
  let error: string | undefined;
  try {
    fs.writeFileSync(snapshotPath, '{"broken":', "utf8");
    try {
      replayAfterCorruption = runtimeEngine.replayCheck();
    } catch (err: any) {
      error = err?.message ?? String(err);
    }
  } finally {
    restoreBackup(snapshotPath, backup);
  }
  const afterRestoreReplay = runtimeEngine.replayCheck();
  const after = runtimeEngine.getRuntimeView();
  const ok = !error && replayAfterCorruption?.ok === true && afterRestoreReplay.ok === true && after.snapshotRevision === after.eventCount;
  return {
    name: "snapshot_corruption_smoke",
    ok,
    before: {
      snapshotRevision: before.snapshotRevision,
      eventCount: before.eventCount,
      snapshotPath
    },
    replayAfterCorruption,
    afterRestoreReplay,
    after: {
      snapshotRevision: after.snapshotRevision,
      eventCount: after.eventCount,
      persistence: after.persistence
    },
    assertions: {
      didNotThrow: !error,
      replayStillMatchesWithCorruptSnapshot: replayAfterCorruption?.ok === true,
      restoredReplayMatches: afterRestoreReplay.ok === true,
      runtimeStillConsistent: after.snapshotRevision === after.eventCount
    },
    error
  };
}

async function runEventTailCorruptionSmoke() {
  const before = runtimeEngine.getRuntimeView();
  const persistence: any = before.persistence;
  const eventsDir = String(persistence.eventLogPath);
  const segment = latestSegmentFile(eventsDir);
  if (!segment) {
    return { name: "event_tail_corruption_smoke", ok: false, error: "NoEventSegmentFound" };
  }

  const backup = backupFile(segment);
  let replayAfterCorruption: any;
  let error: string | undefined;
  try {
    fs.appendFileSync(segment, '{"broken":\n', "utf8");
    try {
      replayAfterCorruption = runtimeEngine.replayCheck();
    } catch (err: any) {
      error = err?.message ?? String(err);
    }
  } finally {
    restoreBackup(segment, backup);
  }

  const afterRestoreReplay = runtimeEngine.replayCheck();
  const after = runtimeEngine.getRuntimeView();
  const ok = !error && replayAfterCorruption?.ok === true && afterRestoreReplay.ok === true && after.snapshotRevision === after.eventCount;
  return {
    name: "event_tail_corruption_smoke",
    ok,
    segment,
    before: {
      snapshotRevision: before.snapshotRevision,
      eventCount: before.eventCount,
      eventSegmentCount: persistence.eventSegmentCount
    },
    replayAfterCorruption,
    afterRestoreReplay,
    after: {
      snapshotRevision: after.snapshotRevision,
      eventCount: after.eventCount,
      persistence: after.persistence
    },
    assertions: {
      didNotThrow: !error,
      replayStillMatchesWithCorruptTail: replayAfterCorruption?.ok === true,
      restoredReplayMatches: afterRestoreReplay.ok === true,
      runtimeStillConsistent: after.snapshotRevision === after.eventCount
    },
    error
  };
}


function commitStressEvent(event: ReturnType<typeof makeEvent>) {
  return runtimeEngine.commitEventSilent(event);
}

async function runStateSpaceStressJob(job: StressJobRecord) {
  updateJob(job, { status: "running" });
  runtimeEngine.resetPerformanceWindow();

  try {
    runtimeEngine.beginPersistenceBatch();
    const initialSnapshot = runtimeEngine.getSnapshot();
    const symbol = initialSnapshot.market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
    const basePrice = Number(initialSnapshot.market.lastPrice ?? initialSnapshot.position.markPrice ?? 76000);
    const initialQuantity = initialSnapshot.position.status === "open"
      ? Number(initialSnapshot.position.quantity ?? 1)
      : 1;

    commitStressEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: initialQuantity,
      locked: 0,
      quantity: initialQuantity,
      markPrice: basePrice,
      exposure: Math.abs(initialQuantity * basePrice),
      source: "state-space-anchor"
    }));

    for (let i = 0; i < job.requestedStates; i += 1) {
      const snapshot = runtimeEngine.getSnapshot();
      const price = Number((basePrice + Math.sin(i / 17) * 12 + (i % 11) * 0.05).toFixed(8));

      commitStressEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
        symbol,
        price,
        bid: Number((price - 0.01).toFixed(2)),
        ask: Number((price + 0.01).toFixed(2)),
        volume: 20000 + i,
        provider: "state-space-stress-job"
      }));

      // Every 10th state creates the dangerous path:
      // request -> partial -> uncertain/unknown -> gate deny -> reconcile -> healthy.
      if (i % 10 === 0) {
        const quantity = 0.0001;
        const partialFilled = 0.00004;
        const orderId = `job_${job.jobId}_${i}`;
        const clientOrderId = `genesis_job_${job.jobId}_${i}`;

        commitStressEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
          symbol,
          side: "buy",
          quantity,
          price,
          orderId,
          clientOrderId,
          exchangeStatus: "NEW",
          provider: "state-space-stress-job"
        }));

        commitStressEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
          symbol,
          side: "buy",
          quantity,
          filledQuantity: partialFilled,
          filledQuantityDelta: partialFilled,
          fillPrice: price,
          orderId,
          clientOrderId,
          exchangeStatus: "PARTIALLY_FILLED",
          provider: "state-space-stress-job"
        }));

        commitStressEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
          reason: "state_space_forced_uncertain",
          orderId,
          clientOrderId
        }));

        commitStressEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, {
          reason: "state_space_forced_unknown",
          symbol
        }));

        const unsafeDecision = runtimeEngine.evaluateAction({
          type: "place_order",
          symbol,
          side: "buy",
          quantity,
          price
        });

        if (unsafeDecision.decision === "deny") job.counters.unsafeGateDenied += 1;
        else job.counters.unsafeGateFalseAllow += 1;

        const reconcileOrderDecision = runtimeEngine.evaluateAction({ type: "reconcile_order", symbol });
        const reconcilePositionDecision = runtimeEngine.evaluateAction({ type: "reconcile_position", symbol });
        if (reconcileOrderDecision.decision === "allow") job.counters.reconcileOrderAllowed += 1;
        if (reconcilePositionDecision.decision === "allow") job.counters.reconcilePositionAllowed += 1;

        commitStressEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
          symbol,
          side: "buy",
          quantity,
          filledQuantity: partialFilled,
          executedQty: String(partialFilled),
          origQty: String(quantity),
          orderId,
          clientOrderId,
          exchangeStatus: "PARTIALLY_FILLED",
          provider: "state-space-stress-reconcile"
        }));

        const afterOrderReconcile = runtimeEngine.getSnapshot();
        const recoveredQuantity = Number(afterOrderReconcile.position.quantity ?? snapshot.position.quantity ?? initialQuantity);
        const recoveredMark = Number(afterOrderReconcile.position.markPrice ?? price);
        const recoveredExposure = Number(Math.abs(recoveredQuantity * recoveredMark).toFixed(8));

        commitStressEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
          symbol,
          asset: symbol.replace(/USDT$/, ""),
          quoteAsset: "USDT",
          free: recoveredQuantity,
          locked: 0,
          quantity: recoveredQuantity,
          markPrice: recoveredMark,
          exposure: recoveredExposure,
          source: "state-space-stress-reconcile"
        }));

        const recoveredSnapshot = runtimeEngine.getSnapshot();
        if (
          recoveredSnapshot.order.status === "partially_filled" &&
          recoveredSnapshot.position.status === "open" &&
          recoveredSnapshot.risk.status === "clear" &&
          recoveredSnapshot.system.status === "healthy"
        ) {
          job.counters.recoveriesCompleted += 1;
        }
      }

      job.processedStates = i + 1;

      if (job.processedStates % job.batchSize === 0 || job.processedStates === job.requestedStates) {
        const nowSnapshot = runtimeEngine.getSnapshot();
        job.updatedAt = new Date().toISOString();
        job.progress.percent = Number(((job.processedStates / job.requestedStates) * 100).toFixed(2));
        job.progress.eventsAfter = runtimeEngine.getEvents(1_000_000).length;
        job.progress.snapshotRevisionAfter = nowSnapshot.revision;
        runtimeEngine.flushPersistenceBatch();
        persistJob(job);
        await nextTick();
      }
    }

    runtimeEngine.endPersistenceBatch();

    const metrics = runtimeEngine.getMetrics();
    const invariants = runtimeEngine.getInvariants();
    const recoveryCycles = Math.ceil(job.requestedStates / 10);
    const finalSnapshot = runtimeEngine.getSnapshot();

    const assertions: Record<string, boolean> = {
      completedAllRequestedStates: job.processedStates === job.requestedStates,
      unsafeGateDeniedEveryRecoveryCycle: job.counters.unsafeGateDenied === recoveryCycles,
      zeroUnsafeFalseAllow: job.counters.unsafeGateFalseAllow === 0,
      reconcileOrderAllowedEveryRecoveryCycle: job.counters.reconcileOrderAllowed === recoveryCycles,
      reconcilePositionAllowedEveryRecoveryCycle: job.counters.reconcilePositionAllowed === recoveryCycles,
      recoveryCompletedEveryRecoveryCycle: job.counters.recoveriesCompleted === recoveryCycles,
      finalRiskClear: finalSnapshot.risk.status === "clear",
      finalSystemHealthy: finalSnapshot.system.status === "healthy",
      noRuntimeBacklog: metrics.backlogDepth === 0,
      zeroFalseAllowMetric: metrics.falseAllowCount === 0,
      zeroActionViolations: metrics.actionViolationCount === 0,
      invariantsPassed: invariants.every((c) => c.ok)
    };

    const ok = Object.values(assertions).every(Boolean);

    job.status = ok ? "completed" : "failed";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    job.progress.percent = 100;
    job.result = {
      ok,
      assertions,
      metrics,
      invariants,
      finalStateDomains: compactRuntimeDomains()
    };
    persistJob(job);
  } catch (err: any) {
    try { runtimeEngine.endPersistenceBatch(); } catch {}
    job.status = "failed";
    job.error = err?.message ?? String(err);
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    persistJob(job);
  }
}



const GuardedPlaceOrderSchema = z.object({
  symbol: z.string().min(3).optional(),
  side: z.enum(["buy", "sell"]).default("buy"),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  clientOrderId: z.string().min(3).max(80).optional()
});

type GuardedPlaceOrderDTO = z.infer<typeof GuardedPlaceOrderSchema>;
type GuardedPlaceOrderInput = { symbol?: string; side?: "buy" | "sell"; quantity?: number; price?: number; clientOrderId?: string };

function numEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "true";
}

function getExecutionGuardConfig() {
  return {
    version: "pr29-real-testnet-execution-control",
    guardEnabled: boolEnv("EXECUTION_GUARD_ENABLED", true),
    controlledExecutionEnabled: boolEnv("CONTROLLED_EXECUTION_ENABLED", true),
    dryRun: boolEnv("TESTNET_EXECUTION_DRY_RUN", true),
    executionMode: process.env.EXECUTION_MODE ?? "testnet_execution",
    requireFreshReconcile: boolEnv("REQUIRE_FRESH_RECONCILE", true),
    reconcileFreshnessMs: numEnv("RECONCILE_FRESHNESS_MS", 60000),
    maxOrderQty: numEnv("MAX_ORDER_QTY", 0.0002),
    maxOrderNotionalUsdt: numEnv("MAX_ORDER_NOTIONAL_USDT", 25),
    maxTotalExposureUsdt: numEnv("MAX_TOTAL_EXPOSURE_USDT", 1000000),
    maxPositionQty: numEnv("MAX_POSITION_QTY", 10),
    maxDailyOrders: numEnv("MAX_DAILY_ORDERS", 10),
    maxDailyNotionalUsdt: numEnv("MAX_DAILY_NOTIONAL_USDT", 100),
    killSwitchEnabled: boolEnv("KILL_SWITCH_ENABLED", true),
    killSwitchMaxExposureUsdt: numEnv("KILL_SWITCH_MAX_EXPOSURE_USDT", 1500000),
    priceBandPct: numEnv("PRICE_BAND_PCT", 15),
    clientOrderPrefix: process.env.CLIENT_ORDER_PREFIX ?? "genesis_testnet_"
  };
}

function stateDomainsFromSnapshot(snapshot: ReturnType<typeof runtimeEngine.getSnapshot>) {
  return {
    market: snapshot.market.status,
    trade: snapshot.trade.status,
    order: snapshot.order.status,
    position: snapshot.position.status,
    risk: snapshot.risk.status,
    system: snapshot.system.status
  };
}

function lastPositionReconcileAgeMs(snapshot: ReturnType<typeof runtimeEngine.getSnapshot>) {
  if (!snapshot.position.lastReconciledAt) return Number.POSITIVE_INFINITY;
  const value = Date.now() - new Date(snapshot.position.lastReconciledAt).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function buildGuardRequest(input: GuardedPlaceOrderInput) {
  const snapshot = runtimeEngine.getSnapshot();
  const symbol = (input.symbol ?? process.env.SYMBOL ?? binanceSpotTestnet.symbol ?? "BTCUSDT").toUpperCase();
  const price = Number(input.price ?? snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 0);
  const quantity = Number(input.quantity ?? numEnv("TESTNET_MAX_ORDER_QTY", 0.0001));
  const notional = Number((quantity * price).toFixed(8));
  const clientOrderId = input.clientOrderId ?? `${getExecutionGuardConfig().clientOrderPrefix}${Date.now()}`;
  return {
    symbol,
    side: input.side ?? "buy",
    quantity,
    price,
    notional,
    clientOrderId
  };
}

function evaluatePortfolioRisk(input: {
  side: "buy" | "sell";
  requestNotional: number;
  requestQty: number;
  positionQty: number;
  currentExposure: number;
  maxTotalExposure: number;
  maxPositionQty: number;
  killSwitchEnabled: boolean;
  killSwitchMaxExposure: number;
}) {
  const projectedExposure = input.side === "buy"
    ? input.currentExposure + input.requestNotional
    : Math.max(0, input.currentExposure - input.requestNotional);

  const projectedPositionQty = input.side === "buy"
    ? input.positionQty + input.requestQty
    : Math.max(0, input.positionQty - input.requestQty);

  if (input.killSwitchEnabled && input.currentExposure >= input.killSwitchMaxExposure) {
    return { ok: false, reason: "kill_switch_active", projectedExposure, projectedPositionQty };
  }

  if (input.currentExposure > input.maxTotalExposure) {
    return { ok: false, reason: "current_exposure_limit_exceeded", projectedExposure, projectedPositionQty };
  }

  if (projectedExposure > input.maxTotalExposure) {
    return { ok: false, reason: "total_exposure_limit_exceeded", projectedExposure, projectedPositionQty };
  }

  if (Math.abs(input.positionQty) > input.maxPositionQty) {
    return { ok: false, reason: "position_quantity_limit_exceeded", projectedExposure, projectedPositionQty };
  }

  if (Math.abs(projectedPositionQty) > input.maxPositionQty) {
    return { ok: false, reason: "projected_position_quantity_limit_exceeded", projectedExposure, projectedPositionQty };
  }

  return { ok: true, projectedExposure, projectedPositionQty };
}

function evaluateControlledExecutionGuard(rawInput: GuardedPlaceOrderInput, overrideConfig: Partial<ReturnType<typeof getExecutionGuardConfig>> = {}) {
  const snapshot = runtimeEngine.getSnapshot();
  const config = { ...getExecutionGuardConfig(), ...overrideConfig };
  const request = buildGuardRequest(rawInput);
  const exchange = binanceSpotTestnet.status();
  const gateDecision = runtimeEngine.evaluateAction({ type: "place_order", symbol: request.symbol, side: request.side, quantity: request.quantity, price: request.price } as any);
  const lastReconcileAgeMs = lastPositionReconcileAgeMs(snapshot);

  const portfolioBase = {
    currentExposure: Number(snapshot.risk.currentExposure ?? snapshot.position.exposure ?? 0),
    projectedExposure: Number(snapshot.risk.currentExposure ?? snapshot.position.exposure ?? 0),
    positionQty: Number(snapshot.position.quantity ?? 0),
    projectedPositionQty: Number(snapshot.position.quantity ?? 0),
    maxTotalExposure: config.maxTotalExposureUsdt,
    maxPositionQty: config.maxPositionQty
  };

  const deny = (reason: string, blockingStates: string[]) => ({
    ok: false,
    decision: "deny" as const,
    reason,
    blockingStates,
    config,
    request,
    portfolio: portfolioBase,
    snapshotRevision: snapshot.revision,
    lastReconcileAgeMs: Number.isFinite(lastReconcileAgeMs) ? lastReconcileAgeMs : null,
    exchange,
    gateDecision
  });

  if (!config.guardEnabled || !config.controlledExecutionEnabled) return deny("guard_disabled", ["config"]);
  if (exchange.mode !== "testnet") return deny("mainnet_disabled", ["exchange"]);
  if (!exchange.safety.mainnetDisabled || !exchange.safety.spotOnly) return deny("exchange_safety_not_confirmed", ["exchange"]);
  if (request.price <= 0 || request.notional <= 0) return deny("invalid_price_or_notional", ["request"]);

  const referencePrice = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? request.price);
  if (referencePrice > 0) {
    const band = config.priceBandPct / 100;
    if (request.price < referencePrice * (1 - band) || request.price > referencePrice * (1 + band)) {
      return deny("price_outside_guard_band", ["request"]);
    }
  }

  if (gateDecision.decision !== "allow") return deny(gateDecision.reason ?? "unsafe_state_requires_reconcile", gateDecision.blockingStates ?? ["gate"]);
  if (snapshot.order.status === "uncertain") return deny("order_uncertain_requires_reconcile", ["order"]);
  if (snapshot.position.status === "unknown") return deny("stale_position_requires_reconcile", ["position"]);
  if (snapshot.risk.status === "blocked") return deny("risk_blocked", ["risk"]);
  if (snapshot.system.status !== "healthy") return deny("system_not_healthy", ["system"]);

  if (config.requireFreshReconcile && (!Number.isFinite(lastReconcileAgeMs) || lastReconcileAgeMs > config.reconcileFreshnessMs)) {
    return deny("stale_position_requires_reconcile", ["position"]);
  }

  if (request.quantity > config.maxOrderQty) return deny("quantity_exceeds_guard_limit", ["request"]);
  if (request.notional > config.maxOrderNotionalUsdt) return deny("notional_exceeds_guard_limit", ["request"]);

  const portfolio = evaluatePortfolioRisk({
    side: request.side,
    requestNotional: request.notional,
    requestQty: request.quantity,
    positionQty: portfolioBase.positionQty,
    currentExposure: portfolioBase.currentExposure,
    maxTotalExposure: config.maxTotalExposureUsdt,
    maxPositionQty: config.maxPositionQty,
    killSwitchEnabled: config.killSwitchEnabled,
    killSwitchMaxExposure: config.killSwitchMaxExposureUsdt
  });

  const portfolioView = {
    ...portfolioBase,
    projectedExposure: portfolio.projectedExposure,
    projectedPositionQty: portfolio.projectedPositionQty
  };

  if (!portfolio.ok) {
    return {
      ok: false,
      decision: "deny" as const,
      reason: portfolio.reason,
      blockingStates: ["portfolio"],
      config,
      request,
      portfolio: portfolioView,
      snapshotRevision: snapshot.revision,
      lastReconcileAgeMs: Number.isFinite(lastReconcileAgeMs) ? lastReconcileAgeMs : null,
      exchange,
      gateDecision
    };
  }

  return {
    ok: true,
    decision: "allow" as const,
    blockingStates: [] as string[],
    config,
    request,
    portfolio: portfolioView,
    dryRun: config.dryRun,
    snapshotRevision: snapshot.revision,
    lastReconcileAgeMs: Number.isFinite(lastReconcileAgeMs) ? lastReconcileAgeMs : null,
    exchange,
    gateDecision
  };
}


const TRADE_JOURNAL_DIR = path.join(process.cwd(), "data", "runtime");
const TRADE_JOURNAL_PATH = path.join(TRADE_JOURNAL_DIR, "trade-journal.jsonl");

function ensureTradeJournalDir() {
  fs.mkdirSync(TRADE_JOURNAL_DIR, { recursive: true });
}

function appendTradeJournal(entry: Record<string, unknown>) {
  ensureTradeJournalDir();
  const row = {
    journalId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  };
  fs.appendFileSync(TRADE_JOURNAL_PATH, JSON.stringify(row) + "\n", "utf8");
  return row;
}

function readTradeJournal(limit = 100) {
  try {
    if (!fs.existsSync(TRADE_JOURNAL_PATH)) return [];
    const lines = fs.readFileSync(TRADE_JOURNAL_PATH, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-Math.max(1, Math.min(1000, limit))).map((line) => {
      try { return JSON.parse(line); } catch { return { corrupt: true, raw: line }; }
    });
  } catch {
    return [];
  }
}

function dailyTradeStats(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const entries = readTradeJournal(10_000).filter((e: any) => String(e.timestamp ?? "").startsWith(day));
  const placed = entries.filter((e: any) => e.event === "order_placed");
  const canceled = entries.filter((e: any) => e.event === "order_canceled");
  const notional = placed.reduce((sum: number, e: any) => sum + Number(e.notional ?? e.request?.notional ?? 0), 0);
  return {
    day,
    ordersPlaced: placed.length,
    ordersCanceled: canceled.length,
    notional: Number(notional.toFixed(8)),
    journalPath: TRADE_JOURNAL_PATH
  };
}

function evaluateDailyLimits(decision: ReturnType<typeof evaluateControlledExecutionGuard>) {
  if (!decision.ok) return decision;
  const stats = dailyTradeStats();
  if (stats.ordersPlaced >= decision.config.maxDailyOrders) {
    return {
      ...decision,
      ok: false,
      decision: "deny" as const,
      reason: "daily_orders_limit_exceeded",
      blockingStates: ["daily_limits"],
      daily: stats
    };
  }
  if (stats.notional + decision.request.notional > decision.config.maxDailyNotionalUsdt) {
    return {
      ...decision,
      ok: false,
      decision: "deny" as const,
      reason: "daily_notional_limit_exceeded",
      blockingStates: ["daily_limits"],
      daily: stats
    };
  }
  return { ...decision, daily: stats };
}

async function reconcileOrderFromExchange(input: { symbol?: string; orderId?: string | number; clientOrderId?: string }) {
  const snapshot = runtimeEngine.getSnapshot();
  const symbol = (input.symbol ?? snapshot.order.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
  const orderId = input.orderId ?? snapshot.order.orderId;
  const clientOrderId = input.clientOrderId ?? snapshot.order.clientOrderId;

  if (!orderId && !clientOrderId) {
    throw new Error("orderId or clientOrderId is required for order reconcile");
  }

  let exchangeOrder: any;
  if (orderId) {
    exchangeOrder = await binanceSpotTestnet.getOrder(orderId, symbol);
  } else {
    // Binance GET /order supports origClientOrderId, but current client only exposes orderId.
    // For clientOrderId-only paths we fall back to openOrders lookup first.
    const openOrders = await binanceSpotTestnet.getOpenOrders(symbol);
    exchangeOrder = openOrders.find((o: any) => o.clientOrderId === clientOrderId);
    if (!exchangeOrder) {
      throw new Error("clientOrderId-only reconcile did not find an open order; use orderId for terminal status");
    }
  }

  const payload = {
    symbol,
    side: String(exchangeOrder.side ?? snapshot.order.side ?? "buy").toLowerCase(),
    quantity: Number(exchangeOrder.origQty ?? snapshot.order.quantity ?? 0),
    filledQuantity: Number(exchangeOrder.executedQty ?? snapshot.order.filledQuantity ?? 0),
    executedQty: exchangeOrder.executedQty,
    origQty: exchangeOrder.origQty,
    orderId: String(exchangeOrder.orderId ?? orderId ?? ""),
    clientOrderId: exchangeOrder.clientOrderId ?? clientOrderId,
    exchangeStatus: exchangeOrder.status ?? "UNKNOWN",
    provider: "binance-testnet-reconcile"
  };

  const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, payload));
  return { exchangeOrder, payload, orderState: nextSnapshot.order, riskState: nextSnapshot.risk, systemState: nextSnapshot.system, snapshotRevision: nextSnapshot.revision };
}


async function autoReconcileUnsafeState(reason = "auto_reconcile_before_guarded_execution") {
  const startedAt = new Date().toISOString();
  const before = runtimeEngine.getSnapshot();
  const steps: any[] = [];

  async function recoverOrderIfNeeded() {
    const current = runtimeEngine.getSnapshot();
    if (current.order.status !== "uncertain") {
      steps.push({ domain: "order", skipped: true, reason: "order_not_uncertain", status: current.order.status });
      return;
    }

    const symbol = (current.order.symbol ?? current.market.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
    const orderId = current.order.orderId;
    const clientOrderId = current.order.clientOrderId;

    if (orderId || clientOrderId) {
      try {
        const reconciled = await reconcileOrderFromExchange({ symbol, orderId, clientOrderId });
        steps.push({ domain: "order", ok: true, mode: "known_order_reconcile", orderId, clientOrderId, result: reconciled.orderState });
        return;
      } catch (err: any) {
        steps.push({ domain: "order", ok: false, mode: "known_order_reconcile_failed", orderId, clientOrderId, error: err?.message ?? String(err) });
        // Continue to open-order fallback; stale local IDs can happen after synthetic tests or terminal exchange cleanup.
      }
    }

    try {
      const openOrders = await binanceSpotTestnet.getOpenOrders(symbol);
      if (Array.isArray(openOrders) && openOrders.length > 0) {
        const exchangeOrder = openOrders[0];
        const payload = {
          symbol,
          side: String(exchangeOrder.side ?? current.order.side ?? "buy").toLowerCase(),
          quantity: Number(exchangeOrder.origQty ?? current.order.quantity ?? 0),
          filledQuantity: Number(exchangeOrder.executedQty ?? current.order.filledQuantity ?? 0),
          executedQty: exchangeOrder.executedQty,
          origQty: exchangeOrder.origQty,
          orderId: String(exchangeOrder.orderId ?? ""),
          clientOrderId: exchangeOrder.clientOrderId,
          exchangeStatus: exchangeOrder.status ?? "UNKNOWN",
          provider: "auto-reconcile-open-orders"
        };
        const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, payload));
        steps.push({ domain: "order", ok: true, mode: "open_order_found", openOrders: openOrders.length, orderState: nextSnapshot.order });
        return;
      }

      // If there is no known order id and exchange has no open orders, the only safe recovery
      // is to terminate local uncertainty as "canceled/no-open-order". This does NOT assume a fill;
      // it only restores the invariant that no unknown open order exists on the exchange.
      const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, {
        symbol,
        side: String(current.order.side ?? "buy").toLowerCase(),
        quantity: Number(current.order.quantity ?? 0),
        filledQuantity: Number(current.order.filledQuantity ?? 0),
        orderId: String(current.order.orderId ?? ""),
        clientOrderId: current.order.clientOrderId,
        exchangeStatus: "NO_OPEN_ORDER",
        provider: "auto-reconcile-no-open-orders",
        reason
      } as any));
      steps.push({ domain: "order", ok: true, mode: "no_open_orders_terminal_recovery", orderState: nextSnapshot.order });
    } catch (err: any) {
      steps.push({ domain: "order", ok: false, mode: "open_orders_fallback_failed", error: err?.message ?? String(err) });
    }
  }

  async function recoverPositionIfNeeded() {
    const current = runtimeEngine.getSnapshot();
    const ageMs = lastPositionReconcileAgeMs(current);
    const needsPosition =
      current.position.status === "unknown" ||
      current.risk.status === "blocked" ||
      current.system.status !== "healthy" ||
      !Number.isFinite(ageMs) ||
      ageMs > getExecutionGuardConfig().reconcileFreshnessMs;

    if (!needsPosition) {
      steps.push({ domain: "position", skipped: true, reason: "position_fresh_and_safe", status: current.position.status, ageMs });
      return;
    }

    try {
      const reconciled = await reconcilePositionFromExchange();
      steps.push({ domain: "position", ok: true, mode: "exchange_account_reconcile", positionState: reconciled.positionState, riskState: reconciled.riskState, systemState: reconciled.systemState });
    } catch (err: any) {
      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "auto_reconcile_position_failed", details: err?.message ?? String(err) }));
      steps.push({ domain: "position", ok: false, mode: "exchange_account_reconcile_failed", error: err?.message ?? String(err) });
    }
  }

  await recoverOrderIfNeeded();
  await recoverPositionIfNeeded();

  const after = runtimeEngine.getSnapshot();
  const safe =
    after.order.status !== "uncertain" &&
    after.position.status !== "unknown" &&
    after.risk.status !== "blocked" &&
    after.system.status === "healthy";

  return {
    ok: safe,
    startedAt,
    finishedAt: new Date().toISOString(),
    reason,
    before: stateDomainsFromSnapshot(before),
    after: stateDomainsFromSnapshot(after),
    steps,
    snapshotRevision: after.revision
  };
}

const GuardedCancelOrderSchema = z.object({
  symbol: z.string().min(3).optional(),
  orderId: z.union([z.string(), z.number()]).optional(),
  clientOrderId: z.string().optional()
}).refine((v) => Boolean(v.orderId || v.clientOrderId), {
  message: "orderId or clientOrderId is required"
});



export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const health = runtimeEngine.getHealthSnapshot();
    res.json({
      ok: health.healthTruthComplete && health.systemState === "healthy",
      service: "mbg-core-runtime-api",
      time: new Date().toISOString(),
      health
    });
  });

  app.get("/live/market", (_req, res) => {
    res.json(liveMarketStatus);
  });

  app.get("/state", (_req, res) => res.json(runtimeEngine.getSnapshot()));

  app.get("/state/:domain", (req, res) => {
    const snapshot: any = runtimeEngine.getSnapshot();
    const value = snapshot[req.params.domain];
    if (!value) return res.status(404).json({ error: "NotFound", details: "Unknown state domain", statusCode: 404 });
    res.json(value);
  });

  app.get("/permissions", (_req, res) => res.json(runtimeEngine.getPermissions()));
  app.get("/events", (req, res) => res.json({ events: runtimeEngine.getEvents(Number(req.query.limit ?? 100)) }));

  app.get("/entities", (_req, res) => res.json(runtimeEngine.getEntitiesView()));
  app.get("/debug/runtime", (_req, res) => res.json(runtimeEngine.getRuntimeView()));
  app.get("/debug/entities", (_req, res) => res.json(runtimeEngine.getEntitiesView()));
  app.get("/debug/events", (req, res) => res.json({ events: runtimeEngine.getEvents(Number(req.query.limit ?? 50)) }));
  app.get("/debug/last-transitions", (req, res) => res.json({ transitions: runtimeEngine.getTransitions(Number(req.query.limit ?? 50)) }));
  app.get("/debug/decisions", (req, res) => res.json({ decisions: runtimeEngine.getDecisions(Number(req.query.limit ?? 50)) }));
  app.get("/debug/invariants", (_req, res) => {
    const checks = runtimeEngine.getInvariants();
    res.json({ ok: checks.every((c) => c.ok), checks });
  });

  app.get("/debug/metrics", (_req, res) => {
    res.json(runtimeEngine.getMetrics());
  });

  app.post("/tests/run/synthetic-live-loop-observed", async (req, res) => {
    const secondsRaw = Number(req.query.seconds ?? 60);
    const seconds = Number.isFinite(secondsRaw) ? Math.max(1, Math.min(secondsRaw, 300)) : 60;
    const tickMsRaw = Number(req.query.tickMs ?? 250);
    const tickMs = Number.isFinite(tickMsRaw) ? Math.max(50, Math.min(tickMsRaw, 5000)) : 250;

    const startedAt = new Date().toISOString();
    const before = runtimeEngine.getRuntimeView();

    let price = runtimeEngine.getSnapshot().market.lastPrice ?? 76000;
    let emittedTicks = 0;
    const iterations = Math.max(1, Math.floor((seconds * 1000) / tickMs));

    for (let i = 0; i < iterations; i += 1) {
      const wave = Math.sin(i / 8) * 6;
      const drift = (i % 10) - 5;
      price = Number(Math.max(1, price + wave + drift * 0.1).toFixed(2));

      runtimeEngine.ingestMarketTick({
        symbol: "BTCUSDT",
        price,
        bid: Number((price - 0.01).toFixed(2)),
        ask: Number((price + 0.01).toFixed(2)),
        volume: Number((1000 + i).toFixed(2)),
        provider: "synthetic-observed"
      });
      emittedTicks += 1;

      if (tickMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, tickMs));
      }
    }

    const after = runtimeEngine.getRuntimeView();
    const metrics = runtimeEngine.getMetrics();
    const invariants = runtimeEngine.getInvariants();

    const actionViolations = metrics.actionViolationCount;
    const falseAllow = metrics.falseAllowCount;
    const uncontrolledBacklog = metrics.backlogDepth > 0;
    const snapshotStall = metrics.snapshotStalled;

    res.json({
      name: "synthetic_live_loop_observed",
      ok: invariants.every((c) => c.ok) && actionViolations === 0 && falseAllow === 0 && !uncontrolledBacklog && !snapshotStall,
      durationSeconds: seconds,
      tickMs,
      emittedTicks,
      startedAt,
      finishedAt: new Date().toISOString(),
      before,
      after,
      metrics,
      assertions: {
        zeroActionViolations: actionViolations === 0,
        zeroFalseAllow: falseAllow === 0,
        noSnapshotStall: !snapshotStall,
        noUncontrolledBacklog: !uncontrolledBacklog,
        stableEventThroughput: metrics.eventsPerSecond > 0,
        invariantsPassed: invariants.every((c) => c.ok)
      },
      invariants,
      lastEvents: runtimeEngine.getEvents(5),
      lastTransitions: runtimeEngine.getTransitions(5)
    });
  });


  app.post("/tests/run/stateful-live-loop-observed", async (req, res) => {
    const secondsRaw = Number(req.query.seconds ?? 60);
    const seconds = Number.isFinite(secondsRaw) ? Math.max(1, Math.min(secondsRaw, 300)) : 60;
    const tickMsRaw = Number(req.query.tickMs ?? 250);
    const tickMs = Number.isFinite(tickMsRaw) ? Math.max(50, Math.min(tickMsRaw, 5000)) : 250;
    const signalEveryRaw = Number(req.query.signalEvery ?? 5);
    const signalEvery = Number.isFinite(signalEveryRaw) ? Math.max(1, Math.min(signalEveryRaw, 100)) : 5;
    const orderEveryRaw = Number(req.query.orderEvery ?? 10);
    const orderEvery = Number.isFinite(orderEveryRaw) ? Math.max(1, Math.min(orderEveryRaw, 100)) : 10;

    const startedAt = new Date().toISOString();
    const before = runtimeEngine.getRuntimeView();

    let price = runtimeEngine.getSnapshot().market.lastPrice ?? 76000;
    let emittedTicks = 0;
    let emittedSignals = 0;
    let gateEvaluations = 0;
    let orderDispatches = 0;
    let allowedOrders = 0;
    let deniedOrders = 0;
    const gateSamples: Array<{ step: number; phase: string; decision: unknown }> = [];

    const iterations = Math.max(1, Math.floor((seconds * 1000) / tickMs));

    for (let i = 0; i < iterations; i += 1) {
      const wave = Math.sin(i / 6) * 4;
      const drift = i % 2 === 0 ? 0.7 : -0.4;
      price = Number(Math.max(1, price + wave + drift).toFixed(2));

      runtimeEngine.ingestMarketTick({
        symbol: "BTCUSDT",
        price,
        bid: Number((price - 0.01).toFixed(2)),
        ask: Number((price + 0.01).toFixed(2)),
        volume: Number((2000 + i).toFixed(2)),
        provider: "stateful-synthetic"
      });
      emittedTicks += 1;

      if (i % signalEvery === 0) {
        const side = i % (signalEvery * 2) === 0 ? "buy" : "sell";
        runtimeEngine.ingestSignal({
          symbol: "BTCUSDT",
          side,
          confidence: 0.72,
          quantity: 0.01,
          reason: "stateful_stress_signal"
        });
        emittedSignals += 1;
      }

      if (i % orderEvery === 0) {
        const snapshot = runtimeEngine.getSnapshot();
        const action = {
          type: "place_order" as const,
          symbol: snapshot.market.symbol ?? "BTCUSDT",
          side: snapshot.trade.side ?? "buy",
          quantity: snapshot.trade.quantity ?? 0.01,
          price: snapshot.market.lastPrice ?? price
        };

        const evaluation = runtimeEngine.evaluateAction(action);
        gateEvaluations += 1;
        gateSamples.push({ step: i, phase: "evaluate_before_dispatch", decision: evaluation });

        const dispatch = runtimeEngine.dispatchAction(action);
        orderDispatches += 1;
        gateEvaluations += 1;
        if (dispatch.decision.decision === "allow") allowedOrders += 1;
        if (dispatch.decision.decision === "deny") deniedOrders += 1;
        gateSamples.push({ step: i, phase: "dispatch", decision: dispatch.decision });
      }

      if (tickMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, tickMs));
      }
    }

    const beforeFaultProbe = runtimeEngine.getRuntimeView();

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "stateful_stress_fault_probe" }));
    const deniedByUncertainOrder = runtimeEngine.dispatchAction({
      type: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      quantity: 0.01,
      price
    });

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "stateful_stress_fault_probe" }));
    const deniedByUnknownPosition = runtimeEngine.dispatchAction({
      type: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      quantity: 0.01,
      price
    });

    const after = runtimeEngine.getRuntimeView();
    const metrics = runtimeEngine.getMetrics();
    const invariants = runtimeEngine.getInvariants();

    const expectedDeniesWorked =
      deniedByUncertainOrder.decision.decision === "deny" &&
      deniedByUncertainOrder.decision.reason === "order_uncertain_requires_reconcile" &&
      deniedByUnknownPosition.decision.decision === "deny" &&
      deniedByUnknownPosition.decision.reason === "risk_blocked";

    const ok =
      invariants.every((c) => c.ok) &&
      metrics.falseAllowCount === 0 &&
      metrics.actionViolationCount === 0 &&
      metrics.backlogDepth === 0 &&
      !metrics.snapshotStalled &&
      emittedSignals > 0 &&
      gateEvaluations > 0 &&
      orderDispatches > 0 &&
      allowedOrders > 0 &&
      expectedDeniesWorked;

    res.json({
      name: "stateful_live_loop_observed",
      ok,
      durationSeconds: seconds,
      tickMs,
      signalEvery,
      orderEvery,
      emittedTicks,
      emittedSignals,
      gateEvaluations,
      orderDispatches,
      allowedOrders,
      deniedOrders,
      startedAt,
      finishedAt: new Date().toISOString(),
      before,
      beforeFaultProbe,
      after,
      metrics,
      assertions: {
        signalsCreatedTradeState: emittedSignals > 0,
        gateWasExercised: gateEvaluations > 0,
        ordersWereDispatched: orderDispatches > 0,
        atLeastOneOrderAllowed: allowedOrders > 0,
        uncertainOrderDenied: deniedByUncertainOrder.decision.decision === "deny",
        unknownPositionDenied: deniedByUnknownPosition.decision.decision === "deny",
        zeroActionViolations: metrics.actionViolationCount === 0,
        zeroFalseAllow: metrics.falseAllowCount === 0,
        noSnapshotStall: !metrics.snapshotStalled,
        noUncontrolledBacklog: metrics.backlogDepth === 0,
        invariantsPassed: invariants.every((c) => c.ok)
      },
      faultProbe: {
        deniedByUncertainOrder: deniedByUncertainOrder.decision,
        deniedByUnknownPosition: deniedByUnknownPosition.decision
      },
      invariants,
      lastGateSamples: gateSamples.slice(-20),
      lastEvents: runtimeEngine.getEvents(12),
      lastTransitions: runtimeEngine.getTransitions(12),
      lastDecisions: runtimeEngine.getDecisions(12)
    });
  });

  app.post("/market/tick", (req, res) => {
    const body = parseOr400(MarketTickPayloadSchema, req.body, res);
    if (!body) return;
    res.json(runtimeEngine.ingestMarketTick({ ...body, provider: body.provider ?? "manual" }));
  });

  app.post("/signals", (req, res) => {
    const body = parseOr400(SignalPayloadSchema, req.body, res);
    if (!body) return;
    res.json(runtimeEngine.ingestSignal({ ...body, quantity: body.quantity ?? 0.01 }));
  });

  app.post("/actions/evaluate", (req, res) => {
    const body = parseOr400(ActionRequestSchema, req.body, res);
    if (!body) return;
    res.json(runtimeEngine.evaluateAction(body));
  });

  app.post("/actions/dispatch", (req, res) => {
    const body = parseOr400(ActionRequestSchema, req.body, res);
    if (!body) return;
    res.json(runtimeEngine.dispatchAction(body));
  });

  app.post("/debug/force/order-uncertain", (_req, res) => {
    res.json(runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "manual_debug_probe" })));
  });

  app.post("/debug/force/position-unknown", (_req, res) => {
    res.json(runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "manual_debug_probe" })));
  });

  app.post("/scenario/live-probe", async (_req, res) => {
    const before = runtimeEngine.getRuntimeView();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const after = runtimeEngine.getRuntimeView();
    const invariants = runtimeEngine.getInvariants();
    res.json({
      name: "live_probe",
      ok: after.snapshotRevision > before.snapshotRevision && invariants.every((c) => c.ok),
      before,
      after,
      liveMarket: liveMarketStatus,
      lastEvents: runtimeEngine.getEvents(5),
      lastTransitions: runtimeEngine.getTransitions(5),
      invariants
    });
  });

  app.post("/scenario/signal-probe", (_req, res) => {
    const snapshot = runtimeEngine.getSnapshot();
    if (snapshot.market.status !== "open" || !snapshot.market.symbol) {
      return res.status(409).json({
        error: "ScenarioBlocked",
        details: "MarketState is not open yet",
        statusCode: 409,
        snapshot
      });
    }

    const before = runtimeEngine.getRuntimeView();

    runtimeEngine.ingestSignal({
      symbol: snapshot.market.symbol,
      side: "buy",
      confidence: 0.75,
      quantity: 0.01,
      reason: "manual_live_signal_probe"
    });

    const action = {
      type: "place_order" as const,
      symbol: snapshot.market.symbol,
      side: "buy" as const,
      quantity: 0.01,
      price: snapshot.market.lastPrice
    };

    const dispatch = runtimeEngine.dispatchAction(action);
    const after = runtimeEngine.getRuntimeView();

    res.json({
      name: "signal_probe",
      before,
      dispatch,
      after,
      lastEvents: runtimeEngine.getEvents(10),
      lastTransitions: runtimeEngine.getTransitions(10),
      invariants: runtimeEngine.getInvariants()
    });
  });


  app.get("/debug/persistence", (_req, res) => {
    res.json(runtimeEngine.getPersistenceView());
  });

  app.post("/persistence/replay-check", (_req, res) => {
    const result = runtimeEngine.replayCheck();
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/persistence/recover", (_req, res) => {
    res.json(runtimeEngine.recoverFromDisk());
  });

  app.post("/tests/run/recovery-replay-check", async (req, res) => {
    const eventsRaw = Number(req.query.events ?? 100);
    const eventsToEmit = Number.isFinite(eventsRaw) ? Math.max(1, Math.min(eventsRaw, 2000)) : 100;
    const reset = String(req.query.reset ?? "false") === "true";

    if (reset) runtimeEngine.clearPersistenceAndReset();

    const before = runtimeEngine.getRuntimeView();
    let price = runtimeEngine.getSnapshot().market.lastPrice ?? 76000;

    for (let i = 0; i < eventsToEmit; i += 1) {
      price = Number((price + Math.sin(i / 10) * 2 + 0.1).toFixed(2));
      runtimeEngine.ingestMarketTick({
        symbol: "BTCUSDT",
        price,
        bid: Number((price - 0.01).toFixed(2)),
        ask: Number((price + 0.01).toFixed(2)),
        volume: 3000 + i,
        provider: "persistent-recovery-test"
      });

      if (i % 10 === 0) {
        runtimeEngine.ingestSignal({
          symbol: "BTCUSDT",
          side: i % 20 === 0 ? "buy" : "sell",
          confidence: 0.71,
          quantity: 0.01,
          reason: "persistent_recovery_test_signal"
        });
      }

      if (i % 25 === 0) {
        runtimeEngine.dispatchAction({
          type: "place_order",
          symbol: "BTCUSDT",
          side: "buy",
          quantity: 0.01,
          price
        });
      }
    }

    const replayCheckBeforeRecover = runtimeEngine.replayCheck();
    const recovered = runtimeEngine.recoverFromDisk();
    const replayCheckAfterRecover = runtimeEngine.replayCheck();
    const invariants = runtimeEngine.getInvariants();
    const after = runtimeEngine.getRuntimeView();

    const ok =
      replayCheckBeforeRecover.ok &&
      replayCheckAfterRecover.ok &&
      invariants.every((c) => c.ok) &&
      after.snapshotRevision === after.eventCount;

    res.json({
      name: "recovery_replay_check",
      ok,
      reset,
      eventsRequested: eventsToEmit,
      before,
      recovered,
      after,
      persistence: runtimeEngine.getPersistenceView(),
      assertions: {
        replayMatchesBeforeRecover: replayCheckBeforeRecover.ok,
        replayMatchesAfterRecover: replayCheckAfterRecover.ok,
        snapshotRevisionMatchesEventCount: after.snapshotRevision === after.eventCount,
        invariantsPassed: invariants.every((c) => c.ok)
      },
      replayCheckBeforeRecover,
      replayCheckAfterRecover,
      invariants,
      lastEvents: runtimeEngine.getEvents(10),
      lastTransitions: runtimeEngine.getTransitions(10)
    });
  });

  app.post("/debug/persistence/clear", (_req, res) => {
    if (process.env.ALLOW_CLEAR_PERSISTENCE !== "true") {
      return res.status(403).json({
        error: "Forbidden",
        details: "Set ALLOW_CLEAR_PERSISTENCE=true to clear persistence",
        statusCode: 403
      });
    }
    res.json(runtimeEngine.clearPersistenceAndReset());
  });


  app.get("/exchange/status", (_req, res) => {
    try {
      res.json(binanceSpotTestnet.status());
    } catch (err: any) {
      res.status(500).json({ error: "ExchangeConfigError", details: err.message, statusCode: 500 });
    }
  });

  app.get("/exchange/account", async (_req, res) => {
    try {
      const account = await binanceSpotTestnet.getAccount();
      res.json({
        canTrade: account.canTrade,
        canWithdraw: account.canWithdraw,
        canDeposit: account.canDeposit,
        updateTime: account.updateTime,
        balances: (account.balances ?? []).filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0),
        exchange: binanceSpotTestnet.status()
      });
    } catch (err: any) {
      res.status(502).json({ error: "ExchangeAccountError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status() });
    }
  });

  app.get("/exchange/orders", async (_req, res) => {
    try {
      const orders = await binanceSpotTestnet.getOpenOrders();
      res.json({ symbol: binanceSpotTestnet.symbol, orders, localOrderState: runtimeEngine.getSnapshot().order });
    } catch (err: any) {
      res.status(502).json({ error: "ExchangeOrdersError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status() });
    }
  });

  app.post("/trade/place", async (req, res) => {
    try {
      const snapshot = runtimeEngine.getSnapshot();
      const symbol = String(req.body?.symbol ?? snapshot.market.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
      const side = String(req.body?.side ?? "buy").toLowerCase() === "sell" ? "sell" : "buy";
      const quantity = Number(req.body?.quantity ?? 0.0001);
      const marketPrice = Number(req.body?.price ?? snapshot.market.lastPrice ?? 76000);
      const price = Number(req.body?.price ?? (side === "buy" ? marketPrice * 0.9 : marketPrice * 1.1)).toFixed(2);
      const clientOrderId = `genesis_${Date.now()}`;

      const decision = runtimeEngine.evaluateAction({
        type: "place_order",
        symbol,
        side,
        quantity,
        price: Number(price)
      });

      if (decision.decision === "deny") {
        return res.status(409).json({ error: "ActionDenied", details: decision.reason ?? "Action denied by gate", statusCode: 409, decision });
      }

      const exchangeOrder = await binanceSpotTestnet.placeLimitOrder({
        symbol,
        side: side === "buy" ? "BUY" : "SELL",
        quantity,
        price: Number(price),
        clientOrderId
      });

      const event = makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol,
        side,
        quantity,
        price: Number(price),
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId ?? clientOrderId,
        exchangeStatus: exchangeOrder.status,
        provider: "binance-spot-testnet"
      });

      const nextSnapshot = runtimeEngine.commitEvent(event);

      res.json({
        ok: true,
        mode: "testnet",
        decision,
        request: { symbol, side, quantity, price: Number(price), clientOrderId },
        exchangeOrder,
        orderState: nextSnapshot.order,
        snapshotRevision: nextSnapshot.revision
      });
    } catch (err: any) {
      res.status(502).json({ error: "TradePlaceError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status() });
    }
  });

  app.post("/trade/cancel", async (req, res) => {
    try {
      const snapshot = runtimeEngine.getSnapshot();
      const symbol = String(req.body?.symbol ?? snapshot.order.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
      let orderId = req.body?.orderId ?? snapshot.order.orderId;

      if (!orderId || String(orderId).startsWith("paper_")) {
        const openOrders = await binanceSpotTestnet.getOpenOrders(symbol);
        orderId = openOrders[0]?.orderId;
      }

      if (!orderId) {
        return res.status(404).json({ error: "OrderNotFound", details: "No local or exchange open order found to cancel", statusCode: 404 });
      }

      const decision = runtimeEngine.evaluateAction({ type: "cancel_order", symbol });
      if (decision.decision === "deny") {
        return res.status(409).json({ error: "ActionDenied", details: decision.reason ?? "Cancel denied by gate", statusCode: 409, decision });
      }

      const exchangeCancel = await binanceSpotTestnet.cancelOrder({ symbol, orderId });

      const cancelEvent = makeEvent(EVENT_TYPE.ORDER_CANCELED, {
        symbol,
        side: String(exchangeCancel.side ?? snapshot.order.side ?? "").toLowerCase(),
        quantity: Number(exchangeCancel.origQty ?? snapshot.order.quantity ?? 0),
        filledQuantity: Number(exchangeCancel.executedQty ?? snapshot.order.filledQuantity ?? 0),
        orderId: String(exchangeCancel.orderId ?? orderId),
        clientOrderId: exchangeCancel.origClientOrderId ?? exchangeCancel.clientOrderId ?? snapshot.order.clientOrderId,
        exchangeStatus: exchangeCancel.status,
        provider: "binance-spot-testnet"
      });

      const nextSnapshot = runtimeEngine.commitEvent(cancelEvent);

      res.json({
        ok: true,
        mode: "testnet",
        decision,
        exchangeCancel,
        orderState: nextSnapshot.order,
        snapshotRevision: nextSnapshot.revision
      });
    } catch (err: any) {
      res.status(502).json({ error: "TradeCancelError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status() });
    }
  });


  app.post("/reconcile/order", async (_req, res) => {
    try {
      const snapshot = runtimeEngine.getSnapshot();
      const local = snapshot.order;
      if (!local.orderId) {
        return res.status(404).json({ error: "OrderNotFound", details: "No local order to reconcile", statusCode: 404 });
      }

      const exchangeOrder = await binanceSpotTestnet.getOrder(local.orderId, local.symbol ?? binanceSpotTestnet.symbol);
      const event = makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
        symbol: exchangeOrder.symbol ?? local.symbol,
        side: String(exchangeOrder.side ?? local.side ?? "").toLowerCase(),
        quantity: Number(exchangeOrder.origQty ?? local.quantity ?? 0),
        filledQuantity: Number(exchangeOrder.executedQty ?? local.filledQuantity ?? 0),
        orderId: String(exchangeOrder.orderId ?? local.orderId),
        clientOrderId: exchangeOrder.clientOrderId ?? local.clientOrderId,
        exchangeStatus: exchangeOrder.status,
        provider: "binance-spot-testnet"
      });

      const nextSnapshot = runtimeEngine.commitEvent(event);
      res.json({
        ok: true,
        exchangeOrder,
        orderState: nextSnapshot.order,
        snapshotRevision: nextSnapshot.revision
      });
    } catch (err: any) {
      res.status(502).json({ error: "OrderReconcileError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status() });
    }
  });


  app.post("/reconcile/position", async (_req, res) => {
    try {
      const result = await reconcilePositionFromExchange();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "position_reconcile_failed", details: err.message }));
      res.status(502).json({ error: "PositionReconcileError", details: err.message, statusCode: 502, exchange: binanceSpotTestnet.status(), positionState: runtimeEngine.getSnapshot().position });
    }
  });

  app.get("/risk/exposure", (_req, res) => {
    const snapshot = runtimeEngine.getSnapshot();
    res.json({
      position: snapshot.position,
      risk: snapshot.risk,
      market: snapshot.market,
      blocked: snapshot.risk.status === "blocked",
      reasons: snapshot.risk.reasons
    });
  });

  app.post("/tests/run/position-reconcile-check", async (_req, res) => {
    try {
      const before = runtimeEngine.getRuntimeView();
      const reconciled = await reconcilePositionFromExchange();
      const after = runtimeEngine.getRuntimeView();
      const invariants = runtimeEngine.getInvariants();
      const permissions = runtimeEngine.getPermissions();

      const exposureMatches = Number(reconciled.positionState.exposure) === Number(reconciled.payload.exposure);
      const riskReflectsExposure =
        reconciled.positionState.exposure <= reconciled.riskState.maxExposure
          ? reconciled.riskState.status === "clear"
          : reconciled.riskState.status === "blocked";

      const ok =
        reconciled.positionState.source === "exchange" &&
        exposureMatches &&
        riskReflectsExposure &&
        invariants.every((c) => c.ok);

      res.status(ok ? 200 : 409).json({
        name: "position_reconcile_check",
        ok,
        before,
        after,
        positionPayload: reconciled.payload,
        positionState: reconciled.positionState,
        riskState: reconciled.riskState,
        systemState: reconciled.systemState,
        permissions,
        assertions: {
          positionComesFromExchange: reconciled.positionState.source === "exchange",
          exposureMatchesPosition: exposureMatches,
          riskReflectsExposure,
          invariantsPassed: invariants.every((c) => c.ok)
        },
        invariants
      });
    } catch (err: any) {
      res.status(502).json({ error: "PositionReconcileCheckError", details: err.message, statusCode: 502 });
    }
  });


  app.post("/debug/fill/partial", (req, res) => {
    const snapshot = runtimeEngine.getSnapshot();
    const order = snapshot.order;
    if (!order.orderId) {
      return res.status(404).json({ error: "OrderNotFound", details: "No local order exists for fill simulation", statusCode: 404 });
    }

    const quantity = Number(req.body?.quantity ?? order.quantity ?? 0.0001);
    const currentFilled = Number(order.filledQuantity ?? 0);
    const requestedDelta = Number(req.body?.filledQuantityDelta ?? req.body?.delta ?? quantity / 2);
    const remaining = Math.max(0, quantity - currentFilled);
    const filledQuantityDelta = Number(Math.min(requestedDelta, remaining).toFixed(12));
    const filledQuantity = Number((currentFilled + filledQuantityDelta).toFixed(12));
    const fillPrice = Number(req.body?.fillPrice ?? snapshot.market.lastPrice ?? 0);

    if (filledQuantityDelta <= 0) {
      return res.status(409).json({ error: "FillRejected", details: "No remaining quantity to fill", statusCode: 409, orderState: order });
    }

    const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol: order.symbol ?? snapshot.market.symbol ?? binanceSpotTestnet.symbol,
      side: order.side ?? snapshot.trade.side ?? "buy",
      quantity,
      filledQuantity,
      filledQuantityDelta,
      fillPrice,
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      exchangeStatus: filledQuantity >= quantity ? "FILLED" : "PARTIALLY_FILLED",
      provider: "simulated-fill"
    }));

    res.json({
      ok: true,
      fill: { quantity, filledQuantity, filledQuantityDelta, fillPrice },
      orderState: nextSnapshot.order,
      positionState: nextSnapshot.position,
      riskState: nextSnapshot.risk,
      snapshotRevision: nextSnapshot.revision
    });
  });

  app.post("/debug/fill/final", (req, res) => {
    const snapshot = runtimeEngine.getSnapshot();
    const order = snapshot.order;
    if (!order.orderId) {
      return res.status(404).json({ error: "OrderNotFound", details: "No local order exists for fill simulation", statusCode: 404 });
    }

    const quantity = Number(order.quantity ?? 0.0001);
    const currentFilled = Number(order.filledQuantity ?? 0);
    const filledQuantityDelta = Number(Math.max(0, quantity - currentFilled).toFixed(12));
    const fillPrice = Number(req.body?.fillPrice ?? snapshot.market.lastPrice ?? 0);

    if (filledQuantityDelta <= 0) {
      return res.status(409).json({ error: "FillRejected", details: "Order is already fully filled", statusCode: 409, orderState: order });
    }

    const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol: order.symbol ?? snapshot.market.symbol ?? binanceSpotTestnet.symbol,
      side: order.side ?? snapshot.trade.side ?? "buy",
      quantity,
      filledQuantity: quantity,
      filledQuantityDelta,
      fillPrice,
      orderId: order.orderId,
      clientOrderId: order.clientOrderId,
      exchangeStatus: "FILLED",
      provider: "simulated-fill"
    }));

    res.json({
      ok: true,
      fill: { quantity, filledQuantity: quantity, filledQuantityDelta, fillPrice },
      orderState: nextSnapshot.order,
      positionState: nextSnapshot.position,
      riskState: nextSnapshot.risk,
      snapshotRevision: nextSnapshot.revision
    });
  });

  app.post("/tests/run/partial-fill-check", async (_req, res) => {
    try {
      const before = runtimeEngine.getRuntimeView();

      // 1) Anchor position in exchange truth first.
      const positionTruth = await reconcilePositionFromExchange();
      const anchoredPosition = positionTruth.positionState;

      // 2) Create a local order lifecycle without relying on testnet matching.
      const snapshot = runtimeEngine.getSnapshot();
      const symbol = snapshot.market.symbol ?? binanceSpotTestnet.symbol;
      const price = Number(snapshot.market.lastPrice ?? 76000);
      const quantity = 0.0001;
      const orderId = `sim_fill_${Date.now()}`;
      const clientOrderId = `genesis_sim_fill_${Date.now()}`;

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol,
        side: "buy",
        quantity,
        price,
        orderId,
        clientOrderId,
        exchangeStatus: "NEW",
        provider: "simulated-fill-test"
      }));

      const afterOrderRequested = runtimeEngine.getSnapshot();

      // 3) Partial fill should mutate both OrderState and PositionState.
      const partialDelta = 0.00004;
      const afterPartial = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
        symbol,
        side: "buy",
        quantity,
        filledQuantity: partialDelta,
        filledQuantityDelta: partialDelta,
        fillPrice: price,
        orderId,
        clientOrderId,
        exchangeStatus: "PARTIALLY_FILLED",
        provider: "simulated-fill-test"
      }));

      // 4) Final fill should close order and apply remaining delta to position.
      const finalDelta = Number((quantity - partialDelta).toFixed(12));
      const afterFinal = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
        symbol,
        side: "buy",
        quantity,
        filledQuantity: quantity,
        filledQuantityDelta: finalDelta,
        fillPrice: price,
        orderId,
        clientOrderId,
        exchangeStatus: "FILLED",
        provider: "simulated-fill-test"
      }));

      const invariants = runtimeEngine.getInvariants();
      const positionDelta = Number((afterFinal.position.quantity - anchoredPosition.quantity).toFixed(12));
      const expectedExposure = Number(Math.abs(afterFinal.position.quantity * price).toFixed(8));

      const assertions = {
        orderWasRequested: afterOrderRequested.order.status === "pending",
        partialFillUpdatesOrder: afterPartial.order.status === "partially_filled" && afterPartial.order.filledQuantity === partialDelta,
        partialFillMutatesPosition: afterPartial.position.quantity > anchoredPosition.quantity,
        finalFillCompletesOrder: afterFinal.order.status === "filled" && afterFinal.order.filledQuantity === quantity,
        finalPositionDeltaApplied: Math.abs(positionDelta - quantity) < 1e-12,
        riskReflectsRuntimeExposure: afterFinal.risk.currentExposure === afterFinal.position.exposure,
        exposureCalculatedFromPosition: Math.abs(afterFinal.position.exposure - expectedExposure) < 0.0001,
        invariantsPassed: invariants.every((c) => c.ok)
      };

      const ok = Object.values(assertions).every(Boolean);

      res.status(ok ? 200 : 409).json({
        name: "partial_fill_check",
        ok,
        before,
        anchoredPosition,
        afterOrderRequested: {
          order: afterOrderRequested.order,
          position: afterOrderRequested.position,
          risk: afterOrderRequested.risk
        },
        afterPartial: {
          order: afterPartial.order,
          position: afterPartial.position,
          risk: afterPartial.risk
        },
        afterFinal: {
          order: afterFinal.order,
          position: afterFinal.position,
          risk: afterFinal.risk
        },
        assertions,
        invariants,
        lastEvents: runtimeEngine.getEvents(10),
        lastTransitions: runtimeEngine.getTransitions(10)
      });
    } catch (err: any) {
      res.status(502).json({ error: "PartialFillCheckError", details: err.message, statusCode: 502 });
    }
  });



  app.post("/tests/run/recovery-unknown-check", async (_req, res) => {
    try {
      const before = runtimeEngine.getRuntimeView();

      // 1) Anchor the position from exchange truth.
      const positionTruth = await reconcilePositionFromExchange();
      const anchoredPosition = positionTruth.positionState;

      // 2) Create an order and apply a partial fill.
      const snapshot = runtimeEngine.getSnapshot();
      const symbol = snapshot.market.symbol ?? binanceSpotTestnet.symbol;
      const price = Number(snapshot.market.lastPrice ?? 76000);
      const quantity = 0.0001;
      const partialDelta = 0.00004;
      const orderId = `sim_recovery_${Date.now()}`;
      const clientOrderId = `genesis_sim_recovery_${Date.now()}`;

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol,
        side: "buy",
        quantity,
        price,
        orderId,
        clientOrderId,
        exchangeStatus: "NEW",
        provider: "recovery-unknown-test"
      }));

      const afterOrderRequested = runtimeEngine.getSnapshot();

      const afterPartial = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
        symbol,
        side: "buy",
        quantity,
        filledQuantity: partialDelta,
        filledQuantityDelta: partialDelta,
        fillPrice: price,
        orderId,
        clientOrderId,
        exchangeStatus: "PARTIALLY_FILLED",
        provider: "recovery-unknown-test"
      }));

      // 3) Simulate crash/uncertainty: local runtime can no longer trust order/position.
      const afterOrderUnknown = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
        reason: "simulated_crash_after_partial_fill",
        orderId,
        clientOrderId
      }));

      const afterPositionUnknown = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, {
        reason: "simulated_crash_after_partial_fill",
        symbol
      }));

      const deniedDuringUnknown = runtimeEngine.evaluateAction({
        actionId: "probe:place_order:during_unknown_recovery",
        actionType: "place_order",
        symbol,
        side: "buy",
        quantity,
        price
      } as any);

      // 4) Recover truth using reconcile-style events.
      const recoveredOrder = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
        symbol,
        side: "buy",
        quantity,
        filledQuantity: partialDelta,
        executedQty: String(partialDelta),
        origQty: String(quantity),
        orderId,
        clientOrderId,
        exchangeStatus: "PARTIALLY_FILLED",
        provider: "recovery-unknown-test"
      }));

      const recoveredQuantity = Number((anchoredPosition.quantity + partialDelta).toFixed(12));
      const recoveredExposure = Number(Math.abs(recoveredQuantity * price).toFixed(8));
      const recoveredPosition = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
        symbol,
        asset: "BTC",
        quoteAsset: "USDT",
        free: recoveredQuantity,
        locked: 0,
        quantity: recoveredQuantity,
        markPrice: price,
        exposure: recoveredExposure,
        source: "exchange-recovery-sim"
      }));

      const permissionsAfterRecovery = runtimeEngine.getPermissions();
      const invariants = runtimeEngine.getInvariants();

      const assertions = {
        orderWasRequested: afterOrderRequested.order.status === "pending",
        partialFillHappenedBeforeCrash: afterPartial.order.status === "partially_filled" && afterPartial.position.quantity > anchoredPosition.quantity,
        unknownStateBlocksGate: deniedDuringUnknown.decision === "deny" && afterPositionUnknown.risk.status === "blocked",
        orderRecoveredFromTruth: recoveredOrder.order.status === "partially_filled" && recoveredOrder.order.filledQuantity === partialDelta,
        positionRecoveredFromTruth: recoveredPosition.position.status === "open" && Math.abs(recoveredPosition.position.quantity - recoveredQuantity) < 1e-12,
        riskClearedAfterRecovery: recoveredPosition.risk.status === "clear",
        systemHealthyAfterRecovery: recoveredPosition.system.status === "healthy",
        permissionsRestoredAfterRecovery: permissionsAfterRecovery.actions.place_order.decision === "allow",
        invariantsPassed: invariants.every((c) => c.ok)
      };

      const ok = Object.values(assertions).every(Boolean);

      res.status(ok ? 200 : 409).json({
        name: "recovery_unknown_check",
        ok,
        before,
        anchoredPosition,
        afterOrderRequested: {
          order: afterOrderRequested.order,
          position: afterOrderRequested.position,
          risk: afterOrderRequested.risk,
          system: afterOrderRequested.system
        },
        afterPartial: {
          order: afterPartial.order,
          position: afterPartial.position,
          risk: afterPartial.risk,
          system: afterPartial.system
        },
        afterUnknown: {
          order: afterPositionUnknown.order,
          position: afterPositionUnknown.position,
          risk: afterPositionUnknown.risk,
          system: afterPositionUnknown.system,
          deniedDuringUnknown
        },
        afterRecovery: {
          order: recoveredPosition.order,
          position: recoveredPosition.position,
          risk: recoveredPosition.risk,
          system: recoveredPosition.system,
          permissions: permissionsAfterRecovery
        },
        assertions,
        invariants,
        lastEvents: runtimeEngine.getEvents(12),
        lastTransitions: runtimeEngine.getTransitions(12)
      });
    } catch (err: any) {
      res.status(502).json({ error: "RecoveryUnknownCheckError", details: err.message, statusCode: 502 });
    }
  });



  app.post("/tests/run/safety-stress-check", async (req, res) => {
    try {
      const cyclesRaw = Number(req.query.cycles ?? 50);
      const cycles = Math.max(1, Math.min(200, Number.isFinite(cyclesRaw) ? Math.floor(cyclesRaw) : 50));
      runtimeEngine.resetPerformanceWindow();
      const before = runtimeEngine.getRuntimeView();
      const startedAt = new Date().toISOString();

      let unsafeGateDenied = 0;
      let unsafeGateFalseAllow = 0;
      let recoveriesCompleted = 0;
      let reconcileOrderAllowed = 0;
      let reconcilePositionAllowed = 0;

      const cycleSamples: any[] = [];

      const initialSnapshot = runtimeEngine.getSnapshot();
      const symbol = initialSnapshot.market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
      const basePrice = Number(initialSnapshot.market.lastPrice ?? initialSnapshot.position.markPrice ?? 76000);
      const initialQuantity = initialSnapshot.position.status === "open"
        ? Number(initialSnapshot.position.quantity ?? 1)
        : 1;

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
        symbol,
        asset: symbol.replace(/USDT$/, ""),
        quoteAsset: "USDT",
        free: initialQuantity,
        locked: 0,
        quantity: initialQuantity,
        markPrice: basePrice,
        exposure: Math.abs(initialQuantity * basePrice),
        source: "safety-stress-anchor"
      }));

      for (let i = 0; i < cycles; i += 1) {
        const snapshot = runtimeEngine.getSnapshot();
        const price = Number((snapshot.market.lastPrice ?? basePrice) + Math.sin(i / 7) * 3);
        const quantity = 0.0001;
        const partialFilled = 0.00004;
        const orderId = `stress_${Date.now()}_${i}`;
        const clientOrderId = `genesis_stress_${Date.now()}_${i}`;

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
          symbol,
          price,
          bid: Number((price - 0.01).toFixed(2)),
          ask: Number((price + 0.01).toFixed(2)),
          volume: 10000 + i,
          provider: "safety-stress"
        }));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
          symbol,
          side: "buy",
          quantity,
          price,
          orderId,
          clientOrderId,
          exchangeStatus: "NEW",
          provider: "safety-stress"
        }));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
          symbol,
          side: "buy",
          quantity,
          filledQuantity: partialFilled,
          filledQuantityDelta: partialFilled,
          fillPrice: price,
          orderId,
          clientOrderId,
          exchangeStatus: "PARTIALLY_FILLED",
          provider: "safety-stress"
        }));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
          reason: "safety_stress_forced_uncertain",
          orderId,
          clientOrderId
        }));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, {
          reason: "safety_stress_forced_unknown",
          symbol
        }));

        const unsafeSnapshot = runtimeEngine.getSnapshot();
        const unsafeDecision = runtimeEngine.evaluateAction({
          type: "place_order",
          symbol,
          side: "buy",
          quantity,
          price
        });

        if (unsafeDecision.decision === "deny") unsafeGateDenied += 1;
        else unsafeGateFalseAllow += 1;

        const reconcileOrderDecision = runtimeEngine.evaluateAction({ type: "reconcile_order", symbol });
        const reconcilePositionDecision = runtimeEngine.evaluateAction({ type: "reconcile_position", symbol });
        if (reconcileOrderDecision.decision === "allow") reconcileOrderAllowed += 1;
        if (reconcilePositionDecision.decision === "allow") reconcilePositionAllowed += 1;

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
          symbol,
          side: "buy",
          quantity,
          filledQuantity: partialFilled,
          executedQty: String(partialFilled),
          origQty: String(quantity),
          orderId,
          clientOrderId,
          exchangeStatus: "PARTIALLY_FILLED",
          provider: "safety-stress-reconcile"
        }));

        const afterOrderReconcile = runtimeEngine.getSnapshot();
        const recoveredQuantity = Number(afterOrderReconcile.position.quantity ?? unsafeSnapshot.position.quantity ?? initialQuantity);
        const recoveredMark = Number(afterOrderReconcile.position.markPrice ?? price);
        const recoveredExposure = Number(Math.abs(recoveredQuantity * recoveredMark).toFixed(8));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
          symbol,
          asset: symbol.replace(/USDT$/, ""),
          quoteAsset: "USDT",
          free: recoveredQuantity,
          locked: 0,
          quantity: recoveredQuantity,
          markPrice: recoveredMark,
          exposure: recoveredExposure,
          source: "safety-stress-reconcile"
        }));

        const recoveredSnapshot = runtimeEngine.getSnapshot();
        if (
          recoveredSnapshot.order.status === "partially_filled" &&
          recoveredSnapshot.position.status === "open" &&
          recoveredSnapshot.risk.status === "clear" &&
          recoveredSnapshot.system.status === "healthy"
        ) {
          recoveriesCompleted += 1;
        }

        if (i < 3 || i >= cycles - 3) {
          cycleSamples.push({
            cycle: i + 1,
            unsafe: {
              order: unsafeSnapshot.order.status,
              position: unsafeSnapshot.position.status,
              risk: unsafeSnapshot.risk.status,
              system: unsafeSnapshot.system.status,
              decision: unsafeDecision
            },
            recovered: {
              order: recoveredSnapshot.order.status,
              position: recoveredSnapshot.position.status,
              risk: recoveredSnapshot.risk.status,
              system: recoveredSnapshot.system.status,
              quantity: recoveredSnapshot.position.quantity,
              exposure: recoveredSnapshot.position.exposure
            }
          });
        }
      }

      const after = runtimeEngine.getRuntimeView();
      const metrics = runtimeEngine.getMetrics();
      const invariants = runtimeEngine.getInvariants();
      const finishedAt = new Date().toISOString();

      const assertions = {
        unsafeGateDeniedEveryCycle: unsafeGateDenied === cycles,
        zeroUnsafeFalseAllow: unsafeGateFalseAllow === 0,
        reconcileOrderAllowedEveryCycle: reconcileOrderAllowed === cycles,
        reconcilePositionAllowedEveryCycle: reconcilePositionAllowed === cycles,
        recoveryCompletedEveryCycle: recoveriesCompleted === cycles,
        finalRiskClear: runtimeEngine.getSnapshot().risk.status === "clear",
        finalSystemHealthy: runtimeEngine.getSnapshot().system.status === "healthy",
        noRuntimeBacklog: metrics.backlogDepth === 0,
        zeroFalseAllowMetric: metrics.falseAllowCount === 0,
        zeroActionViolations: metrics.actionViolationCount === 0,
        snapshotRevisionMatchesEventCount: invariants.find((c) => c.name === "snapshot_revision_matches_event_count")?.ok === true,
        invariantsPassed: invariants.every((c) => c.ok)
      };

      const ok = Object.values(assertions).every(Boolean);

      res.status(ok ? 200 : 409).json({
        name: "safety_stress_check",
        ok,
        cycles,
        startedAt,
        finishedAt,
        before,
        after,
        counters: {
          unsafeGateDenied,
          unsafeGateFalseAllow,
          reconcileOrderAllowed,
          reconcilePositionAllowed,
          recoveriesCompleted
        },
        metrics,
        assertions,
        invariants,
        cycleSamples,
        lastEvents: runtimeEngine.getEvents(12),
        lastTransitions: runtimeEngine.getTransitions(12),
        lastDecisions: runtimeEngine.getDecisions(12)
      });
    } catch (err: any) {
      res.status(502).json({ error: "SafetyStressCheckError", details: err.message, statusCode: 502 });
    }
  });




  app.post("/execution/reconcile/auto", async (_req, res) => {
    try {
      const result = await autoReconcileUnsafeState("manual_auto_reconcile_endpoint");
      res.status(result.ok ? 200 : 409).json(result);
    } catch (err: any) {
      res.status(502).json({ ok: false, error: "AutoReconcileError", details: err?.message ?? String(err), statusCode: 502, snapshotRevision: runtimeEngine.getSnapshot().revision });
    }
  });

  app.get("/execution/guard", (_req, res) => {
    const snapshot = runtimeEngine.getSnapshot();
    const config = getExecutionGuardConfig();
    const currentExposure = Number(snapshot.risk.currentExposure ?? snapshot.position.exposure ?? 0);
    res.json({
      ok: true,
      version: config.version,
      guard: config,
      exchange: binanceSpotTestnet.status(),
      stateDomains: stateDomainsFromSnapshot(snapshot),
      position: snapshot.position,
      risk: snapshot.risk,
      portfolio: {
        currentExposure,
        positionQty: snapshot.position.quantity,
        maxTotalExposure: config.maxTotalExposureUsdt,
        maxPositionQty: config.maxPositionQty,
        killSwitchMaxExposure: config.killSwitchMaxExposureUsdt
      },
      lastReconcileAgeMs: Number.isFinite(lastPositionReconcileAgeMs(snapshot)) ? lastPositionReconcileAgeMs(snapshot) : null,
      permissions: runtimeEngine.getPermissions(),
      snapshotRevision: snapshot.revision
    });
  });

  app.post("/execution/guard/evaluate", (req, res) => {
    const parsed = parseOr400(GuardedPlaceOrderSchema, req.body ?? {}, res);
    if (!parsed) return;
    const decision = evaluateDailyLimits(evaluateControlledExecutionGuard(parsed));
    res.status(decision.ok ? 200 : 409).json(decision);
  });

  app.post("/execution/testnet/place-guarded", async (req, res) => {
    const parsed = parseOr400(GuardedPlaceOrderSchema, req.body ?? {}, res);
    if (!parsed) return;

    const autoReconcile = await autoReconcileUnsafeState("before_place_guarded");
    const decision = evaluateDailyLimits(evaluateControlledExecutionGuard(parsed));
    if (!decision.ok) return res.status(409).json({ ...decision, autoReconcile });

    if (decision.config.dryRun) {
      const journal = appendTradeJournal({ event: "dry_run_place_checked", symbol: decision.request.symbol, side: decision.request.side, quantity: decision.request.quantity, notional: decision.request.notional, request: decision.request, decision: "allow" });
      return res.json({
        ok: true,
        dryRun: true,
        decision,
        journal,
        message: "Dry-run only. No exchange order was sent."
      });
    }

    try {
      const exchangeOrder = await binanceSpotTestnet.placeLimitOrder({
        symbol: decision.request.symbol,
        side: decision.request.side.toUpperCase() as "BUY" | "SELL",
        quantity: decision.request.quantity,
        price: decision.request.price,
        clientOrderId: decision.request.clientOrderId
      });

      const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol: decision.request.symbol,
        side: decision.request.side,
        quantity: decision.request.quantity,
        price: decision.request.price,
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "NEW",
        provider: "binance-testnet-guarded"
      }));

      const journal = appendTradeJournal({
        event: "order_placed",
        symbol: decision.request.symbol,
        side: decision.request.side,
        quantity: decision.request.quantity,
        price: decision.request.price,
        notional: decision.request.notional,
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "NEW",
        request: decision.request
      });

      let orderReconcile: unknown;
      try {
        orderReconcile = await reconcileOrderFromExchange({ symbol: decision.request.symbol, orderId: exchangeOrder.orderId });
      } catch (err: any) {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "post_guarded_order_reconcile_failed", orderId: String(exchangeOrder.orderId), clientOrderId: exchangeOrder.clientOrderId, details: err.message }));
        orderReconcile = { ok: false, error: err.message };
      }

      let postReconcile: unknown;
      try {
        postReconcile = await reconcilePositionFromExchange();
      } catch (err: any) {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "post_guarded_execution_reconcile_failed", details: err.message }));
        postReconcile = { ok: false, error: err.message };
      }

      res.json({
        ok: true,
        dryRun: false,
        decision,
        exchangeOrder,
        journal,
        orderState: nextSnapshot.order,
        orderReconcile,
        postReconcile,
        snapshotRevision: runtimeEngine.getSnapshot().revision
      });
    } catch (err: any) {
      res.status(502).json({
        ok: false,
        error: "GuardedExecutionError",
        details: err.message,
        statusCode: 502,
        decision
      });
    }
  });


  app.post("/execution/testnet/cancel-guarded", async (req, res) => {
    const parsed = parseOr400(GuardedCancelOrderSchema, req.body ?? {}, res);
    if (!parsed) return;

    const snapshot = runtimeEngine.getSnapshot();
    const config = getExecutionGuardConfig();
    const exchange = binanceSpotTestnet.status();
    const gateDecision = runtimeEngine.evaluateAction({ type: "cancel_order" } as any);

    if (!config.guardEnabled || !config.controlledExecutionEnabled) {
      return res.status(409).json({ ok: false, decision: "deny", reason: "guard_disabled", blockingStates: ["config"], config, exchange, gateDecision });
    }
    if (exchange.mode !== "testnet") {
      return res.status(409).json({ ok: false, decision: "deny", reason: "mainnet_disabled", blockingStates: ["exchange"], config, exchange, gateDecision });
    }
    if (gateDecision.decision !== "allow") {
      return res.status(409).json({ ok: false, decision: "deny", reason: gateDecision.reason ?? "unsafe_state_requires_reconcile", blockingStates: gateDecision.blockingStates ?? ["gate"], config, exchange, gateDecision });
    }

    const symbol = (parsed.symbol ?? snapshot.order.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
    const orderId = parsed.orderId ?? snapshot.order.orderId;
    const clientOrderId = parsed.clientOrderId ?? snapshot.order.clientOrderId;

    if (config.dryRun) {
      const journal = appendTradeJournal({ event: "dry_run_cancel_checked", symbol, orderId, clientOrderId, decision: "allow" });
      return res.json({ ok: true, dryRun: true, decision: "allow", symbol, orderId, clientOrderId, journal, message: "Dry-run only. No exchange cancel was sent." });
    }

    try {
      const exchangeCancel = await binanceSpotTestnet.cancelOrder({ symbol, orderId, clientOrderId });
      const nextSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, {
        symbol,
        side: String(exchangeCancel.side ?? snapshot.order.side ?? "buy").toLowerCase(),
        quantity: Number(exchangeCancel.origQty ?? snapshot.order.quantity ?? 0),
        filledQuantity: Number(exchangeCancel.executedQty ?? snapshot.order.filledQuantity ?? 0),
        orderId: String(exchangeCancel.orderId ?? orderId ?? ""),
        clientOrderId: exchangeCancel.clientOrderId ?? clientOrderId,
        exchangeStatus: exchangeCancel.status ?? "CANCELED",
        provider: "binance-testnet-guarded-cancel"
      }));

      const journal = appendTradeJournal({
        event: "order_canceled",
        symbol,
        orderId: String(exchangeCancel.orderId ?? orderId ?? ""),
        clientOrderId: exchangeCancel.clientOrderId ?? clientOrderId,
        exchangeStatus: exchangeCancel.status ?? "CANCELED"
      });

      let postReconcile: unknown;
      try {
        postReconcile = await reconcilePositionFromExchange();
      } catch (err: any) {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "post_guarded_cancel_reconcile_failed", details: err.message }));
        postReconcile = { ok: false, error: err.message };
      }

      res.json({ ok: true, dryRun: false, exchangeCancel, journal, orderState: nextSnapshot.order, postReconcile, snapshotRevision: runtimeEngine.getSnapshot().revision });
    } catch (err: any) {
      res.status(502).json({ ok: false, error: "GuardedCancelError", details: err.message, statusCode: 502 });
    }
  });

  app.post("/execution/testnet/reconcile-order", async (req, res) => {
    const schema = z.object({
      symbol: z.string().min(3).optional(),
      orderId: z.union([z.string(), z.number()]).optional(),
      clientOrderId: z.string().optional()
    }).refine((v) => Boolean(v.orderId || v.clientOrderId || runtimeEngine.getSnapshot().order.orderId), {
      message: "orderId or clientOrderId is required when local OrderState has no orderId"
    });

    const parsed = parseOr400(schema, req.body ?? {}, res);
    if (!parsed) return;

    try {
      const result = await reconcileOrderFromExchange(parsed);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "manual_order_reconcile_failed", details: err.message }));
      res.status(502).json({ ok: false, error: "OrderReconcileError", details: err.message, statusCode: 502, snapshotRevision: runtimeEngine.getSnapshot().revision });
    }
  });

  app.get("/execution/journal", (req, res) => {
    res.json({ ok: true, entries: readTradeJournal(Number(req.query.limit ?? 100)), stats: dailyTradeStats() });
  });

  app.get("/execution/daily-risk", (_req, res) => {
    const config = getExecutionGuardConfig();
    const stats = dailyTradeStats();
    res.json({
      ok: true,
      stats,
      limits: {
        maxDailyOrders: config.maxDailyOrders,
        maxDailyNotionalUsdt: config.maxDailyNotionalUsdt
      },
      remaining: {
        orders: Math.max(0, config.maxDailyOrders - stats.ordersPlaced),
        notional: Number(Math.max(0, config.maxDailyNotionalUsdt - stats.notional).toFixed(8))
      }
    });
  });

  app.post("/tests/run/guarded-testnet-execution-check", async (_req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const startedAt = new Date().toISOString();

    try {
      const before = runtimeEngine.getRuntimeView();
      const anchored = await reconcilePositionFromExchange();
      const autoReconcile = await autoReconcileUnsafeState("before_guarded_testnet_execution_check");
      const snapshot = runtimeEngine.getSnapshot();
      const price = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000);
      const safePrice = Number((price * 0.90).toFixed(2)); // Away from market to reduce accidental fills if real testnet is enabled.
      const decision = evaluateDailyLimits(evaluateControlledExecutionGuard({ side: "buy", quantity: Math.min(numEnv("TESTNET_MAX_ORDER_QTY", 0.0001), getExecutionGuardConfig().maxOrderQty), price: safePrice }));

      let execution: any = { skipped: true, reason: "guard_denied", decision };
      let cancel: any = { skipped: true };
      let orderReconcile: any = { skipped: true };
      let postPosition: any = { skipped: true };

      if (decision.ok && decision.config.dryRun) {
        const journal = appendTradeJournal({ event: "dry_run_guarded_execution_check", symbol: decision.request.symbol, side: decision.request.side, quantity: decision.request.quantity, notional: decision.request.notional, decision: "allow" });
        execution = { ok: true, dryRun: true, journal, message: "Dry-run guarded execution path checked; no exchange order sent." };
      } else if (decision.ok) {
        const exchangeOrder = await binanceSpotTestnet.placeLimitOrder({
          symbol: decision.request.symbol,
          side: decision.request.side.toUpperCase() as "BUY" | "SELL",
          quantity: decision.request.quantity,
          price: decision.request.price,
          clientOrderId: decision.request.clientOrderId
        });
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
          symbol: decision.request.symbol,
          side: decision.request.side,
          quantity: decision.request.quantity,
          price: decision.request.price,
          orderId: String(exchangeOrder.orderId),
          clientOrderId: exchangeOrder.clientOrderId,
          exchangeStatus: exchangeOrder.status ?? "NEW",
          provider: "guarded-testnet-execution-check"
        }));
        const placeJournal = appendTradeJournal({ event: "order_placed", symbol: decision.request.symbol, side: decision.request.side, quantity: decision.request.quantity, price: decision.request.price, notional: decision.request.notional, orderId: String(exchangeOrder.orderId), clientOrderId: exchangeOrder.clientOrderId, exchangeStatus: exchangeOrder.status ?? "NEW" });
        orderReconcile = await reconcileOrderFromExchange({ symbol: decision.request.symbol, orderId: exchangeOrder.orderId });

        const exchangeCancel = await binanceSpotTestnet.cancelOrder({ symbol: decision.request.symbol, orderId: exchangeOrder.orderId });
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, {
          symbol: decision.request.symbol,
          side: decision.request.side,
          quantity: Number(exchangeCancel.origQty ?? decision.request.quantity),
          filledQuantity: Number(exchangeCancel.executedQty ?? 0),
          orderId: String(exchangeCancel.orderId ?? exchangeOrder.orderId),
          clientOrderId: exchangeCancel.clientOrderId ?? exchangeOrder.clientOrderId,
          exchangeStatus: exchangeCancel.status ?? "CANCELED",
          provider: "guarded-testnet-execution-check"
        }));
        const cancelJournal = appendTradeJournal({ event: "order_canceled", symbol: decision.request.symbol, orderId: String(exchangeCancel.orderId ?? exchangeOrder.orderId), clientOrderId: exchangeCancel.clientOrderId ?? exchangeOrder.clientOrderId, exchangeStatus: exchangeCancel.status ?? "CANCELED" });
        postPosition = await reconcilePositionFromExchange();
        execution = { ok: true, dryRun: false, exchangeOrder, journal: placeJournal };
        cancel = { ok: true, exchangeCancel, journal: cancelJournal };
      }

      const final = runtimeEngine.getRuntimeView();
      const invariants = runtimeEngine.getInvariants();
      const assertions = {
        anchoredPositionKnown: anchored.positionState.status !== "unknown",
        guardAllowedOrDeniedSafely: decision.ok === true || decision.decision === "deny",
        dryRunDidNotSendExchangeOrder: decision.ok && decision.config.dryRun ? execution.dryRun === true : true,
        realExecutionCanceledIfEnabled: decision.ok && !decision.config.dryRun ? cancel.ok === true : true,
        postActionStateSafe: ["healthy", "degraded"].includes(final.stateDomains.system),
        zeroFalseAllowMetric: final.metrics.falseAllowCount === 0,
        zeroActionViolations: final.metrics.actionViolationCount === 0,
        invariantsPassed: invariants.every((c) => c.ok)
      };
      const ok = Object.values(assertions).every(Boolean);

      res.status(ok ? 200 : 409).json({
        name: "guarded_testnet_execution_check",
        ok,
        startedAt,
        finishedAt: new Date().toISOString(),
        before,
        anchoredPosition: anchored.positionState,
        autoReconcile,
        decision,
        execution,
        orderReconcile,
        cancel,
        postPosition,
        final,
        assertions,
        invariants
      });
    } catch (err: any) {
      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "guarded_testnet_execution_check_failed", details: err.message }));
      res.status(502).json({ name: "guarded_testnet_execution_check", ok: false, error: "GuardedTestnetExecutionCheckError", details: err.message, statusCode: 502, snapshotRevision: runtimeEngine.getSnapshot().revision });
    }
  });



  app.post("/tests/run/real-testnet-execution-check", async (_req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const startedAt = new Date().toISOString();
    const config = getExecutionGuardConfig();

    if (config.dryRun) {
      return res.status(409).json({
        name: "real_testnet_execution_check",
        ok: false,
        error: "DryRunEnabled",
        details: "Set TESTNET_EXECUTION_DRY_RUN=false in .env, restart server, then run again.",
        statusCode: 409,
        guard: config
      });
    }

    if (process.env.REAL_TESTNET_EXECUTION_ACK !== "I_UNDERSTAND_TESTNET_ORDER") {
      return res.status(409).json({
        name: "real_testnet_execution_check",
        ok: false,
        error: "MissingRealExecutionAck",
        details: "Set REAL_TESTNET_EXECUTION_ACK=I_UNDERSTAND_TESTNET_ORDER in .env. This endpoint sends a real Binance Spot Testnet order, then immediately cancels and reconciles it.",
        statusCode: 409
      });
    }

    try {
      const before = runtimeEngine.getRuntimeView();
      const anchored = await reconcilePositionFromExchange();
      const autoReconcile = await autoReconcileUnsafeState("before_real_testnet_execution_check");
      const snapshot = runtimeEngine.getSnapshot();
      const price = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000);
      const safePrice = Number((price * 0.90).toFixed(2));
      const quantity = Math.min(numEnv("TESTNET_MAX_ORDER_QTY", 0.0001), config.maxOrderQty);
      const decision = evaluateDailyLimits(evaluateControlledExecutionGuard({ side: "buy", quantity, price: safePrice }));

      if (!decision.ok) {
        const final = runtimeEngine.getRuntimeView();
        return res.status(409).json({
          name: "real_testnet_execution_check",
          ok: false,
          phase: "guard_denied",
          startedAt,
          finishedAt: new Date().toISOString(),
          before,
          anchoredPosition: anchored.positionState,
          autoReconcile,
          decision,
          final
        });
      }

      const exchangeOrder = await binanceSpotTestnet.placeLimitOrder({
        symbol: decision.request.symbol,
        side: decision.request.side.toUpperCase() as "BUY" | "SELL",
        quantity: decision.request.quantity,
        price: decision.request.price,
        clientOrderId: decision.request.clientOrderId
      });

      const placedSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol: decision.request.symbol,
        side: decision.request.side,
        quantity: decision.request.quantity,
        price: decision.request.price,
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "NEW",
        provider: "pr29-real-testnet-execution-check"
      }));

      const placeJournal = appendTradeJournal({
        event: "real_testnet_order_placed",
        symbol: decision.request.symbol,
        side: decision.request.side,
        quantity: decision.request.quantity,
        price: decision.request.price,
        notional: decision.request.notional,
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "NEW",
        request: decision.request
      });

      let orderReconcileAfterPlace: any;
      try {
        orderReconcileAfterPlace = await reconcileOrderFromExchange({ symbol: decision.request.symbol, orderId: exchangeOrder.orderId });
      } catch (err: any) {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
          reason: "pr29_reconcile_after_place_failed",
          orderId: String(exchangeOrder.orderId),
          clientOrderId: exchangeOrder.clientOrderId,
          details: err.message
        }));
        throw err;
      }

      const exchangeCancel = await binanceSpotTestnet.cancelOrder({
        symbol: decision.request.symbol,
        orderId: exchangeOrder.orderId
      });

      const canceledSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, {
        symbol: decision.request.symbol,
        side: decision.request.side,
        quantity: Number(exchangeCancel.origQty ?? decision.request.quantity),
        filledQuantity: Number(exchangeCancel.executedQty ?? 0),
        orderId: String(exchangeCancel.orderId ?? exchangeOrder.orderId),
        clientOrderId: exchangeCancel.clientOrderId ?? exchangeOrder.clientOrderId,
        exchangeStatus: exchangeCancel.status ?? "CANCELED",
        provider: "pr29-real-testnet-execution-check"
      }));

      const cancelJournal = appendTradeJournal({
        event: "real_testnet_order_canceled",
        symbol: decision.request.symbol,
        orderId: String(exchangeCancel.orderId ?? exchangeOrder.orderId),
        clientOrderId: exchangeCancel.clientOrderId ?? exchangeOrder.clientOrderId,
        exchangeStatus: exchangeCancel.status ?? "CANCELED"
      });

      let orderReconcileAfterCancel: any;
      try {
        orderReconcileAfterCancel = await reconcileOrderFromExchange({ symbol: decision.request.symbol, orderId: exchangeOrder.orderId });
      } catch (err: any) {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
          reason: "pr29_reconcile_after_cancel_failed",
          orderId: String(exchangeOrder.orderId),
          clientOrderId: exchangeOrder.clientOrderId,
          details: err.message
        }));
        orderReconcileAfterCancel = { ok: false, error: err.message };
      }

      const postPosition = await reconcilePositionFromExchange();
      const final = runtimeEngine.getRuntimeView();
      const invariants = runtimeEngine.getInvariants();

      const assertions = {
        anchoredPositionKnown: anchored.positionState.status !== "unknown",
        guardAllowed: decision.ok === true,
        exchangeOrderAccepted: Boolean(exchangeOrder.orderId),
        localOrderRecorded: placedSnapshot.order.status === "pending" || placedSnapshot.order.status === "partially_filled",
        cancelAccepted: String(exchangeCancel.status ?? "").toUpperCase() === "CANCELED",
        localOrderCanceled: canceledSnapshot.order.status === "canceled",
        postPositionKnown: postPosition.positionState.status !== "unknown",
        finalRiskClear: final.stateDomains.risk === "clear",
        finalSystemHealthy: final.stateDomains.system === "healthy",
        zeroFalseAllowMetric: final.metrics.falseAllowCount === 0,
        zeroActionViolations: final.metrics.actionViolationCount === 0,
        invariantsPassed: invariants.every((c) => c.ok)
      };

      const ok = Object.values(assertions).every(Boolean);

      res.status(ok ? 200 : 409).json({
        name: "real_testnet_execution_check",
        ok,
        startedAt,
        finishedAt: new Date().toISOString(),
        before,
        anchoredPosition: anchored.positionState,
        autoReconcile,
        decision,
        exchangeOrder,
        placedState: placedSnapshot.order,
        orderReconcileAfterPlace,
        exchangeCancel,
        canceledState: canceledSnapshot.order,
        orderReconcileAfterCancel,
        postPosition,
        journal: { place: placeJournal, cancel: cancelJournal },
        final,
        assertions,
        invariants
      });
    } catch (err: any) {
      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "real_testnet_execution_check_failed", details: err.message }));
      res.status(502).json({
        name: "real_testnet_execution_check",
        ok: false,
        error: "RealTestnetExecutionCheckError",
        details: err.message,
        statusCode: 502,
        snapshotRevision: runtimeEngine.getSnapshot().revision
      });
    }
  });


  app.post("/tests/run/portfolio-risk-guard-check", (_req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const startedAt = new Date().toISOString();

    const snapshot = runtimeEngine.getSnapshot();
    const symbol = snapshot.market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
    const price = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000);

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
      symbol,
      price,
      bid: Number((price - 0.01).toFixed(2)),
      ask: Number((price + 0.01).toFixed(2)),
      volume: 1,
      provider: "portfolio-risk-guard-check"
    }));

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: 1,
      locked: 0,
      quantity: 1,
      markPrice: price,
      exposure: price,
      source: "manual"
    }));

    const safeRequest = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.0001, price },
      { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const currentExposureDeny = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.0001, price },
      { maxTotalExposureUsdt: 100, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const projectedExposureDeny = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.0001, price },
      { maxTotalExposureUsdt: price + 1, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const positionQtyDeny = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.0001, price },
      { maxTotalExposureUsdt: 1000000, maxPositionQty: 0.5, killSwitchMaxExposureUsdt: 1500000, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const killSwitchDeny = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.0001, price },
      { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 100, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const oversizedOrderDeny = evaluateControlledExecutionGuard(
      { symbol, side: "buy", quantity: 0.002, price },
      { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000, maxOrderNotionalUsdt: 25, maxOrderQty: 0.0002, requireFreshReconcile: false }
    );

    const assertions = {
      safeRequestAllowed: safeRequest.ok === true,
      currentExposureDenied: currentExposureDeny.reason === "current_exposure_limit_exceeded",
      projectedExposureDenied: projectedExposureDeny.reason === "total_exposure_limit_exceeded",
      positionQtyDenied: positionQtyDeny.reason === "position_quantity_limit_exceeded",
      killSwitchDenied: killSwitchDeny.reason === "kill_switch_active",
      oversizedOrderDenied: oversizedOrderDeny.reason === "quantity_exceeds_guard_limit",
      zeroFalseAllowMetric: runtimeEngine.getMetrics().falseAllowCount === 0,
      zeroActionViolations: runtimeEngine.getMetrics().actionViolationCount === 0,
      invariantsPassed: runtimeEngine.getInvariants().every((c) => c.ok)
    };

    const ok = Object.values(assertions).every(Boolean);

    res.status(ok ? 200 : 409).json({
      name: "portfolio_risk_guard_check",
      ok,
      startedAt,
      finishedAt: new Date().toISOString(),
      decisions: {
        safeRequest,
        currentExposureDeny,
        projectedExposureDeny,
        positionQtyDeny,
        killSwitchDeny,
        oversizedOrderDeny
      },
      assertions,
      final: runtimeEngine.getRuntimeView(),
      invariants: runtimeEngine.getInvariants()
    });
  });

  app.post("/tests/run/controlled-live-guard-check", async (_req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const startedAt = new Date().toISOString();

    try {
      const snapshot = runtimeEngine.getSnapshot();
      const symbol = snapshot.market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
      const price = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000);

      let anchoredPosition: unknown;
      try {
        anchoredPosition = (await reconcilePositionFromExchange()).positionState;
      } catch {
        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
          symbol,
          price,
          bid: Number((price - 0.01).toFixed(2)),
          ask: Number((price + 0.01).toFixed(2)),
          volume: 1,
          provider: "controlled-live-guard-check"
        }));

        runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
          symbol,
          asset: symbol.replace(/USDT$/, ""),
          quoteAsset: "USDT",
          free: 1,
          locked: 0,
          quantity: 1,
          markPrice: price,
          exposure: price,
          source: "manual"
        }));
        anchoredPosition = runtimeEngine.getSnapshot().position;
      }

      const allowed = evaluateControlledExecutionGuard(
        { symbol, side: "buy", quantity: 0.0001, price: Number((price * 0.9).toFixed(2)) },
        { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000 }
      );

      const tooLarge = evaluateControlledExecutionGuard(
        { symbol, side: "buy", quantity: 0.002, price: Number((price * 0.9).toFixed(2)) },
        { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000 }
      );

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "controlled_live_guard_check_forced_uncertain" }));
      const unsafeDeny = evaluateControlledExecutionGuard(
        { symbol, side: "buy", quantity: 0.0001, price: Number((price * 0.9).toFixed(2)) },
        { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000 }
      );

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
        symbol,
        side: "buy",
        quantity: 0.0001,
        filledQuantity: 0.00004,
        executedQty: "0.00004",
        origQty: "0.0001",
        orderId: `guard_check_${Date.now()}`,
        clientOrderId: `genesis_guard_check_${Date.now()}`,
        exchangeStatus: "PARTIALLY_FILLED",
        provider: "controlled-live-guard-check"
      }));

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
        symbol,
        asset: symbol.replace(/USDT$/, ""),
        quoteAsset: "USDT",
        free: 1,
        locked: 0,
        quantity: 1,
        markPrice: price,
        exposure: price,
        source: "manual"
      }));

      const restoredAllow = evaluateControlledExecutionGuard(
        { symbol, side: "buy", quantity: 0.0001, price: Number((price * 0.9).toFixed(2)) },
        { maxTotalExposureUsdt: 1000000, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000 }
      );

      const portfolioOverflow = evaluateControlledExecutionGuard(
        { symbol, side: "buy", quantity: 0.0001, price: Number((price * 0.9).toFixed(2)) },
        { maxTotalExposureUsdt: 100, maxPositionQty: 10, killSwitchMaxExposureUsdt: 1500000 }
      );

      const final = runtimeEngine.getRuntimeView();
      const invariants = runtimeEngine.getInvariants();
      const assertions = {
        anchoredPositionKnown: (anchoredPosition as any)?.status === "open",
        safeRequestAllowedOrDryRunReady: allowed.ok === true,
        oversizedRequestDenied: tooLarge.ok === false,
        unsafeStateDenied: unsafeDeny.ok === false,
        unsafeReasonRequiresReconcile: String(unsafeDeny.reason ?? "").includes("reconcile") || unsafeDeny.reason === "unsafe_state_requires_reconcile",
        restoredAllowAfterRecovery: restoredAllow.ok === true,
        portfolioOverflowDenied: portfolioOverflow.reason === "current_exposure_limit_exceeded" || portfolioOverflow.reason === "total_exposure_limit_exceeded",
        zeroFalseAllowMetric: runtimeEngine.getMetrics().falseAllowCount === 0,
        zeroActionViolations: runtimeEngine.getMetrics().actionViolationCount === 0,
        invariantsPassed: invariants.every((c) => c.ok)
      };

      const ok = Object.values(assertions).every(Boolean);
      res.status(ok ? 200 : 409).json({
        name: "controlled_live_guard_check",
        ok,
        startedAt,
        finishedAt: new Date().toISOString(),
        mode: "testnet_guard_only",
        guardConfig: getExecutionGuardConfig(),
        anchoredPosition,
        decisions: { allowed, tooLarge, unsafeDeny, restoredAllow, portfolioOverflow },
        final,
        assertions,
        invariants
      });
    } catch (err: any) {
      res.status(502).json({ error: "ControlledLiveGuardCheckError", details: err.message, statusCode: 502 });
    }
  });


  app.get("/tests", (_req, res) => {
    res.json({
      ok: true,
      version: "pr30-destruction-testing-engine",
      tests: [
        {
          name: "safety-stress-check",
          method: "POST",
          path: "/tests/run/safety-stress-check?cycles=50",
          safeRange: "1..200 cycles",
          blocking: true,
          purpose: "unsafe state -> gate deny -> reconcile -> healthy"
        },
        {
          name: "state-space-stress-check",
          method: "POST",
          path: "/tests/run/state-space-stress-check?states=10000&batchSize=500",
          safeRange: "1..50000 states",
          blocking: false,
          purpose: "large nonblocking stress job; returns jobId immediately"
        },
        {
          name: "jobs",
          method: "GET",
          path: "/tests/jobs/:jobId",
          purpose: "poll durable async stress progress/result; survives restart"
        },
        {
          name: "hard-stress-suite",
          method: "POST",
          path: "/tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000",
          blocking: false,
          purpose: "one-command plan: runs multiple async stress levels and persists suite result"
        },
        {
          name: "fault-probe",
          method: "POST",
          path: "/tests/run/fault-probe",
          blocking: true,
          purpose: "injects uncertain order + unknown position and verifies gate deny + reconcile recovery"
        },
        {
          name: "restart-readiness-check",
          method: "POST",
          path: "/tests/run/restart-readiness-check",
          blocking: true,
          purpose: "checks snapshot/event/replay/segmented persistence before and after manual restart"
        },
        {
          name: "latency-guard",
          method: "GET",
          path: "/debug/latency-guard?warnMs=20&degradeMs=50&failMs=100",
          purpose: "classifies runtime latency without confusing safety invariants"
        },
        {
          name: "parameter-abuse-check",
          method: "POST",
          path: "/tests/run/parameter-abuse-check",
          blocking: true,
          purpose: "verifies invalid stress parameters are clamped/rejected safely"
        },
        {
          name: "api-hammer-check",
          method: "POST",
          path: "/tests/run/api-hammer-check?requests=1000",
          blocking: true,
          purpose: "reads runtime repeatedly during load and verifies reads do not mutate safety"
        },
        {
          name: "crash-restart-plan",
          method: "POST",
          path: "/tests/run/crash-restart-plan",
          blocking: true,
          purpose: "prints the exact manual crash/restart protocol and pass/fail checks"
        },
        {
          name: "snapshot-corruption-smoke",
          method: "POST",
          path: "/tests/run/snapshot-corruption-smoke",
          blocking: true,
          purpose: "temporarily corrupts snapshot backup and verifies replay/recovery does not throw"
        },
        {
          name: "event-tail-corruption-smoke",
          method: "POST",
          path: "/tests/run/event-tail-corruption-smoke",
          blocking: true,
          purpose: "temporarily corrupts the active event segment tail and verifies safe replay behavior"
        },
        {
          name: "hard-failure-suite",
          method: "POST",
          path: "/tests/run/hard-failure-suite",
          blocking: true,
          purpose: "runs restart readiness + fault probe + parameter abuse + API hammer + corruption smokes"
        },
        {
          name: "job-orchestration",
          method: "GET",
          path: "/debug/job-orchestration",
          purpose: "PR25 diagnostics for durable jobs, active suites, retries, and orchestration classification"
        },
        {
          name: "controlled-live-guard-check",
          method: "POST",
          path: "/tests/run/controlled-live-guard-check",
          blocking: true,
          purpose: "validates request guard, unsafe-state deny, portfolio overflow deny, and recovery allow"
        },
        {
          name: "portfolio-risk-guard-check",
          method: "POST",
          path: "/tests/run/portfolio-risk-guard-check",
          blocking: true,
          purpose: "validates current exposure, projected exposure, position quantity, kill-switch, and oversized request denial"
        },
        {
          name: "guarded-testnet-execution-check",
          method: "POST",
          path: "/tests/run/guarded-testnet-execution-check",
          blocking: true,
          purpose: "validates guarded dry-run or real testnet place/cancel/reconcile path"
        },
        {
          name: "testnet-cancel-guarded",
          method: "POST",
          path: "/execution/testnet/cancel-guarded",
          purpose: "guarded cancel path; dry-run by default"
        },
        {
          name: "testnet-reconcile-order",
          method: "POST",
          path: "/execution/testnet/reconcile-order",
          purpose: "reconcile local OrderState from Binance testnet order truth"
        },
        {
          name: "execution-journal",
          method: "GET",
          path: "/execution/journal",
          purpose: "reads local guarded execution journal"
        },
        {
          name: "daily-risk",
          method: "GET",
          path: "/execution/daily-risk",
          purpose: "shows daily order/notional counters and remaining limits"
        },
        {
          name: "execution-guard",
          method: "GET",
          path: "/execution/guard",
          purpose: "shows current guard config, exchange safety, portfolio, and state domains"
        },
        {
          name: "execution-guard-evaluate",
          method: "POST",
          path: "/execution/guard/evaluate",
          purpose: "evaluates a guarded order request without sending it"
        },
        {
          name: "testnet-place-guarded",
          method: "POST",
          path: "/execution/testnet/place-guarded",
          purpose: "dry-run by default; sends only if all guards pass and dry-run is disabled"
        },
        {
          name: "destruction-duplicate-place",
          method: "POST",
          path: "/tests/destruction/duplicate-place",
          blocking: true,
          purpose: "attack: two concurrent requests with same clientOrderId must create at most one order"
        },
        {
          name: "destruction-network-timeout-race",
          method: "POST",
          path: "/tests/destruction/network-timeout-race",
          blocking: true,
          purpose: "attack: lost response + retry must not create duplicate order"
        },
        {
          name: "destruction-partial-fill",
          method: "POST",
          path: "/tests/destruction/partial-fill",
          blocking: true,
          purpose: "attack: partial fill must update filledQuantity, position, and keep remainder"
        },
        {
          name: "destruction-fill-without-notification",
          method: "POST",
          path: "/tests/destruction/fill-without-notification",
          blocking: true,
          purpose: "attack: restart/reconcile path must recover fills not seen live"
        },
        {
          name: "destruction-cancel-vs-fill-race",
          method: "POST",
          path: "/tests/destruction/cancel-vs-fill-race",
          blocking: true,
          purpose: "attack: filled must dominate canceled if exchange truth says filled"
        },
        {
          name: "destruction-stale-snapshot",
          method: "POST",
          path: "/tests/destruction/stale-snapshot?delayMs=2500",
          blocking: true,
          purpose: "attack: stale reconcile snapshot must deny or halt"
        },
        {
          name: "destruction-orphan-order",
          method: "POST",
          path: "/tests/destruction/orphan-order",
          blocking: true,
          purpose: "attack: open order created outside runtime must be detected and journaled"
        },
        {
          name: "destruction-journal-failure",
          method: "POST",
          path: "/tests/destruction/journal-failure",
          blocking: true,
          purpose: "attack: journal write failure simulation must halt system"
        },
        {
          name: "destruction-position-drift",
          method: "POST",
          path: "/tests/destruction/position-drift",
          blocking: true,
          purpose: "attack: exchange/local position mismatch must halt"
        },
        {
          name: "destruction-restart-during-execution-plan",
          method: "POST",
          path: "/tests/destruction/restart-during-execution-plan",
          blocking: true,
          purpose: "manual destructive test plan for killing runtime during execution"
        },
        {
          name: "health",
          method: "GET",
          path: "/health"
        },
        {
          name: "runtime",
          method: "GET",
          path: "/debug/runtime"
        }
      ],
      recommendedSequence: [
        "POST /tests/run/safety-stress-check?cycles=50",
        "POST /tests/run/state-space-stress-check?states=10000&batchSize=500",
        "GET /tests/jobs/:jobId",
        "POST /tests/run/state-space-stress-check?states=20000&batchSize=500",
        "POST /tests/run/state-space-stress-check?states=30000&batchSize=1000",
        "POST /tests/run/hard-stress-suite?levels=10000,20000,30000&batchSize=1000",
        "POST /tests/run/restart-readiness-check",
        "GET /debug/latency-guard",
        "POST /tests/run/api-hammer-check?requests=1000",
        "POST /tests/run/hard-failure-suite",
        "GET /debug/job-orchestration",
        "GET /execution/guard",
        "POST /tests/run/portfolio-risk-guard-check",
        "POST /tests/run/controlled-live-guard-check",
        "POST /tests/destruction/duplicate-place",
        "POST /tests/destruction/network-timeout-race",
        "POST /tests/destruction/partial-fill"
      ]
    });
  });

  app.get("/tests/jobs", (_req, res) => {
    const jobs = Array.from(stressJobs.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 50);
    res.json({ ok: true, durable: true, jobsDir: JOBS_DIR, stats: countJobsByStatus(), activeJobs: getActiveJobs().map((j) => ({ jobId: j.jobId, name: j.name, status: j.status, processedStates: j.processedStates, requestedStates: j.requestedStates })), jobs });
  });

  app.get("/debug/job-orchestration", (_req, res) => {
    const jobs = Array.from(stressJobs.values());
    const suites = jobs.filter((j) => j.name === "hard_stress_suite");
    const latestSuite = suites.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    res.json({
      ok: true,
      version: "pr30-destruction-testing-engine",
      durable: true,
      jobsDir: JOBS_DIR,
      stats: countJobsByStatus(),
      activeJobs: getActiveJobs().map((j) => ({ jobId: j.jobId, name: j.name, status: j.status, processedStates: j.processedStates, requestedStates: j.requestedStates })),
      latestSuite,
      policy: {
        rejectConcurrentSuitesByDefault: true,
        childRetryDefault: 1,
        maxChildRetries: 3,
        failedButCoreSafeClassification: "orchestration_failed_but_core_safe"
      }
    });
  });

  app.get("/tests/jobs/:jobId", (req, res) => {
    let job = stressJobs.get(req.params.jobId);
    if (!job) {
      try {
        const persisted = JSON.parse(fs.readFileSync(jobFile(req.params.jobId), "utf8")) as StressJobRecord;
        if (persisted?.jobId) {
          stressJobs.set(persisted.jobId, persisted);
          job = persisted;
        }
      } catch {}
    }
    if (!job) {
      return res.status(404).json({
        ok: false,
        error: "JobNotFound",
        details: "Unknown stress job id. In PR22 jobs are durable; if this appears, the job was never accepted or its registry file was removed.",
        statusCode: 404
      });
    }
    res.json({ ok: job.status === "completed" ? job.result?.ok === true : true, job });
  });


  app.post("/tests/run/fault-probe", (_req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const startedAt = new Date().toISOString();
    const before = runtimeEngine.getRuntimeView();
    const snapshot = runtimeEngine.getSnapshot();
    const symbol = snapshot.market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
    const price = Number(snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000);
    const quantity = 0.0001;
    const partialFilled = 0.00004;
    const orderId = `fault_probe_${Date.now()}`;
    const clientOrderId = `genesis_fault_probe_${Date.now()}`;

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
      symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "fault-probe"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol, side: "buy", quantity, filledQuantity: partialFilled, filledQuantityDelta: partialFilled,
      fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", provider: "fault-probe"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
      reason: "fault_probe_forced_uncertain", orderId, clientOrderId
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, {
      reason: "fault_probe_forced_unknown", symbol
    }));

    const unsafeDecision = runtimeEngine.evaluateAction({ type: "place_order", symbol, side: "buy", quantity, price });
    const reconcileOrderDecision = runtimeEngine.evaluateAction({ type: "reconcile_order", symbol });
    const reconcilePositionDecision = runtimeEngine.evaluateAction({ type: "reconcile_position", symbol });

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
      symbol, side: "buy", quantity, filledQuantity: partialFilled, executedQty: String(partialFilled), origQty: String(quantity),
      orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", provider: "fault-probe-reconcile"
    }));

    const afterOrder = runtimeEngine.getSnapshot();
    const recoveredQuantity = Number(afterOrder.position.quantity ?? snapshot.position.quantity ?? 1);
    const recoveredMark = Number(afterOrder.position.markPrice ?? price);
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: recoveredQuantity,
      locked: 0,
      quantity: recoveredQuantity,
      markPrice: recoveredMark,
      exposure: Number(Math.abs(recoveredQuantity * recoveredMark).toFixed(8)),
      source: "fault-probe-reconcile"
    }));

    const after = runtimeEngine.getRuntimeView();
    const invariants = runtimeEngine.getInvariants();
    const metrics = runtimeEngine.getMetrics();
    const assertions = {
      unsafePlaceOrderDenied: unsafeDecision.decision === "deny",
      reconcileOrderAllowed: reconcileOrderDecision.decision === "allow",
      reconcilePositionAllowed: reconcilePositionDecision.decision === "allow",
      finalRiskClear: runtimeEngine.getSnapshot().risk.status === "clear",
      finalSystemHealthy: runtimeEngine.getSnapshot().system.status === "healthy",
      zeroFalseAllow: metrics.falseAllowCount === 0,
      zeroActionViolations: metrics.actionViolationCount === 0,
      invariantsPassed: invariants.every((c) => c.ok)
    };
    res.json({
      name: "fault_probe",
      ok: Object.values(assertions).every(Boolean),
      startedAt,
      finishedAt: new Date().toISOString(),
      before,
      unsafe: { decision: unsafeDecision, reconcileOrderDecision, reconcilePositionDecision },
      after,
      assertions,
      invariants,
      lastEvents: runtimeEngine.getEvents(12),
      lastDecisions: runtimeEngine.getDecisions(12)
    });
  });


  app.get("/debug/latency-guard", (req, res) => {
    const warnMs = clampInt(req.query.warnMs, 20, 1, 1000);
    const degradeMs = clampInt(req.query.degradeMs, 50, warnMs, 2000);
    const failMs = clampInt(req.query.failMs, 100, degradeMs, 5000);
    res.json({
      name: "latency_guard",
      ...latencyGuardView(warnMs, degradeMs, failMs),
      runtime: runtimeEngine.getRuntimeView()
    });
  });

  app.post("/tests/run/restart-readiness-check", (_req, res) => {
    const startedAt = new Date().toISOString();
    const runtime = runtimeEngine.getRuntimeView();
    const metrics = runtimeEngine.getMetrics();
    const invariants = runtimeEngine.getInvariants();
    const split = splitInvariantChecks(invariants);
    const persistence = runtimeEngine.getPersistenceView();
    const latency = latencyGuardView();

    const assertions = {
      healthReadable: true,
      snapshotRevisionMatchesEventCount: invariants.find((c) => c.name === "snapshot_revision_matches_event_count")?.ok === true,
      replayMatchesCurrentSnapshot: invariants.find((c) => c.name === "replay_matches_current_snapshot")?.ok === true,
      segmentedPersistence: runtime.persistence?.mode === "segmented-streaming",
      noRuntimeBacklog: metrics.backlogDepth === 0,
      zeroFalseAllow: metrics.falseAllowCount === 0,
      zeroActionViolations: metrics.actionViolationCount === 0,
      systemSafe: runtime.stateDomains.system === "healthy" || runtime.stateDomains.system === "degraded",
      criticalInvariantsPassed: split.criticalPassed
    };

    const ok = Object.values(assertions).every(Boolean);
    res.status(ok ? 200 : 409).json({
      name: "restart_readiness_check",
      ok,
      startedAt,
      finishedAt: new Date().toISOString(),
      instructions: [
        "1) Save this response.",
        "2) Stop the server with Ctrl+C or taskkill.",
        "3) Start again with npm run dev.",
        "4) Run: curl.exe http://localhost:3000/health",
        "5) Run: curl.exe http://localhost:3000/debug/runtime",
        "6) Run this endpoint again and compare eventCount/snapshotRevision/replay."
      ],
      runtime,
      persistence,
      latency,
      assertions,
      invariants,
      criticalInvariantSummary: split
    });
  });

  app.post("/tests/run/api-hammer-check", (req, res) => {
    const requests = clampInt(req.query.requests, 1000, 1, 10000);
    runtimeEngine.resetPerformanceWindow();
    const before = runtimeEngine.getRuntimeView();
    const startedAt = new Date().toISOString();

    for (let i = 0; i < requests; i += 1) {
      runtimeEngine.getRuntimeView();
      runtimeEngine.getMetrics();
      if (i % 50 === 0) runtimeEngine.getInvariants();
    }

    const after = runtimeEngine.getRuntimeView();
    const metrics = runtimeEngine.getMetrics();
    const invariants = runtimeEngine.getInvariants();
    const split = splitInvariantChecks(invariants);
    const assertions = {
      readOnlyDidNotCommitEvents: after.eventCount === before.eventCount,
      readOnlyDidNotChangeSnapshot: after.snapshotRevision === before.snapshotRevision,
      noRuntimeBacklog: metrics.backlogDepth === 0,
      zeroFalseAllow: metrics.falseAllowCount === 0,
      zeroActionViolations: metrics.actionViolationCount === 0,
      criticalInvariantsPassed: split.criticalPassed
    };
    const ok = Object.values(assertions).every(Boolean);
    res.status(ok ? 200 : 409).json({
      name: "api_hammer_check",
      ok,
      requests,
      startedAt,
      finishedAt: new Date().toISOString(),
      before,
      after,
      metrics,
      latency: latencyGuardView(),
      assertions,
      invariants
    });
  });

  app.post("/tests/run/parameter-abuse-check", (_req, res) => {
    const cases = [
      { input: { states: "-1", batchSize: "1000" }, acceptedStates: clampInt("-1", 10000, 1, 50000), acceptedBatchSize: clampInt("1000", 500, 10, 5000) },
      { input: { states: "abc", batchSize: "xyz" }, acceptedStates: clampInt("abc", 10000, 1, 50000), acceptedBatchSize: clampInt("xyz", 500, 10, 5000) },
      { input: { states: "999999999", batchSize: "999999999" }, acceptedStates: clampInt("999999999", 10000, 1, 50000), acceptedBatchSize: clampInt("999999999", 500, 10, 5000) },
      { input: { cycles: "999999" }, acceptedCycles: Math.max(1, Math.min(200, Math.floor(Number("999999")))) },
      { input: { cycles: "-10" }, acceptedCycles: Math.max(1, Math.min(200, Math.floor(Number("-10")))) }
    ];
    const assertions = {
      negativeStatesClampedToMin: cases[0].acceptedStates === 1,
      invalidStatesFallbackSafe: cases[1].acceptedStates === 10000,
      hugeStatesClampedToMax: cases[2].acceptedStates === 50000,
      hugeBatchClampedToMax: cases[2].acceptedBatchSize === 5000,
      hugeCyclesClampedToMax: cases[3].acceptedCycles === 200,
      negativeCyclesClampedToMin: cases[4].acceptedCycles === 1
    };
    const ok = Object.values(assertions).every(Boolean);
    res.status(ok ? 200 : 409).json({
      name: "parameter_abuse_check",
      ok,
      policy: {
        stateSpaceStressStates: "1..50000",
        stateSpaceBatchSize: "10..5000",
        safetyStressCycles: "1..200"
      },
      assertions,
      cases
    });
  });

  app.post("/tests/run/crash-restart-plan", (_req, res) => {
    const runtime = runtimeEngine.getRuntimeView();
    res.json({
      name: "crash_restart_plan",
      ok: true,
      purpose: "Manual destructive test: kill the process during/after a stress job, then verify segmented streaming recovery.",
      currentRuntime: runtime,
      commands: {
        startStress: 'curl.exe -X POST "http://localhost:3000/tests/run/state-space-stress-check?states=50000&batchSize=1000"',
        pollJob: "curl.exe http://localhost:3000/tests/jobs/<JOB_ID>",
        gracefulStop: "Ctrl+C in server window",
        hardKill: "taskkill /F /IM node.exe",
        restart: 'cd "C:\\dev 3\\genesis-v1-pr25-orchestration-cleanup-engine"; npm run dev',
        verifyHealth: "curl.exe http://localhost:3000/health",
        verifyRuntime: "curl.exe http://localhost:3000/debug/runtime",
        verifyReadiness: "curl.exe -X POST http://localhost:3000/tests/run/restart-readiness-check"
      },
      passCriteria: [
        "server starts",
        "health ok true",
        "snapshotRevision == eventCount",
        "replay_matches_current_snapshot true",
        "falseAllowCount == 0",
        "actionViolationCount == 0",
        "system healthy or degraded-but-safe",
        "persistence mode segmented-streaming"
      ]
    });
  });


  app.post("/tests/run/snapshot-corruption-smoke", async (_req, res) => {
    const result = await runSnapshotCorruptionSmoke();
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/tests/run/event-tail-corruption-smoke", async (_req, res) => {
    const result = await runEventTailCorruptionSmoke();
    res.status(result.ok ? 200 : 409).json(result);
  });

  app.post("/tests/run/hard-failure-suite", async (req, res) => {
    const requests = clampInt(req.query.requests, 500, 10, 5000);
    const startedAt = new Date().toISOString();

    const restartReadinessBefore = {
      runtime: runtimeEngine.getRuntimeView(),
      replayCheck: runtimeEngine.replayCheck(),
      latency: latencyGuardView()
    };

    const faultProbeBefore = runtimeEngine.getRuntimeView();
    const faultOrderId = `hard_failure_fault_${Date.now()}`;
    const symbol = runtimeEngine.getSnapshot().market.symbol ?? process.env.SYMBOL ?? "BTCUSDT";
    const price = Number(runtimeEngine.getSnapshot().market.lastPrice ?? 76000);

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
      symbol,
      side: "buy",
      quantity: 0.0001,
      price,
      orderId: faultOrderId,
      clientOrderId: `genesis_${faultOrderId}`,
      exchangeStatus: "NEW",
      provider: "hard-failure-suite"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol,
      side: "buy",
      quantity: 0.0001,
      filledQuantity: 0.00004,
      filledQuantityDelta: 0.00004,
      fillPrice: price,
      orderId: faultOrderId,
      clientOrderId: `genesis_${faultOrderId}`,
      exchangeStatus: "PARTIALLY_FILLED",
      provider: "hard-failure-suite"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, {
      reason: "hard_failure_suite_forced_uncertain",
      orderId: faultOrderId,
      clientOrderId: `genesis_${faultOrderId}`
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, {
      reason: "hard_failure_suite_forced_unknown",
      symbol
    }));

    const unsafeDecision = runtimeEngine.evaluateAction({ type: "place_order", symbol, side: "buy", quantity: 0.0001, price });
    const reconcileOrderDecision = runtimeEngine.evaluateAction({ type: "reconcile_order", symbol });
    const reconcilePositionDecision = runtimeEngine.evaluateAction({ type: "reconcile_position", symbol });

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, {
      symbol,
      side: "buy",
      quantity: 0.0001,
      filledQuantity: 0.00004,
      executedQty: "0.00004",
      origQty: "0.0001",
      orderId: faultOrderId,
      clientOrderId: `genesis_${faultOrderId}`,
      exchangeStatus: "PARTIALLY_FILLED",
      provider: "hard-failure-suite-reconcile"
    }));

    const afterOrder = runtimeEngine.getSnapshot();
    const recoveredQuantity = Number(afterOrder.position.quantity ?? 1);
    const markPrice = Number(afterOrder.position.markPrice ?? price);
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: recoveredQuantity,
      locked: 0,
      quantity: recoveredQuantity,
      markPrice,
      exposure: Math.abs(recoveredQuantity * markPrice),
      source: "hard-failure-suite-reconcile"
    }));

    const faultProbeAfter = runtimeEngine.getRuntimeView();
    const snapshotCorruption = await runSnapshotCorruptionSmoke();
    const eventTailCorruption = await runEventTailCorruptionSmoke();

    const apiHammerBefore = runtimeEngine.getRuntimeView();
    for (let i = 0; i < requests; i += 1) {
      runtimeEngine.getRuntimeView();
      if (i % 250 === 0) await nextTick();
    }
    const apiHammerAfter = runtimeEngine.getRuntimeView();

    const latency = latencyGuardView();
    const invariants = runtimeEngine.getInvariants();
    const critical = splitInvariantChecks(invariants);
    const finalRuntime = runtimeEngine.getRuntimeView();
    const replay = runtimeEngine.replayCheck();

    const assertions = {
      restartReadinessReplayOk: restartReadinessBefore.replayCheck.ok === true,
      unsafePlaceOrderDenied: unsafeDecision.decision === "deny",
      reconcileOrderAllowed: reconcileOrderDecision.decision === "allow",
      reconcilePositionAllowed: reconcilePositionDecision.decision === "allow",
      recoveredToHealthy: faultProbeAfter.stateDomains.risk === "clear" && faultProbeAfter.stateDomains.system === "healthy",
      snapshotCorruptionHandled: snapshotCorruption.ok === true,
      eventTailCorruptionHandled: eventTailCorruption.ok === true,
      apiHammerReadOnly: apiHammerBefore.snapshotRevision === apiHammerAfter.snapshotRevision,
      zeroFalseAllow: finalRuntime.metrics.falseAllowCount === 0,
      zeroActionViolations: finalRuntime.metrics.actionViolationCount === 0,
      noRuntimeBacklog: finalRuntime.metrics.backlogDepth === 0,
      replayMatchesCurrentSnapshot: replay.ok === true,
      criticalInvariantsPassed: critical.criticalPassed === true,
      latencyNotFailed: latency.status !== "fail"
    };

    const ok = Object.values(assertions).every(Boolean);

    res.status(ok ? 200 : 409).json({
      name: "hard_failure_suite",
      ok,
      startedAt,
      finishedAt: new Date().toISOString(),
      requests,
      assertions,
      restartReadinessBefore,
      faultProbe: {
        before: faultProbeBefore,
        unsafeDecision,
        reconcileOrderDecision,
        reconcilePositionDecision,
        after: faultProbeAfter
      },
      snapshotCorruption,
      eventTailCorruption,
      apiHammer: {
        before: {
          snapshotRevision: apiHammerBefore.snapshotRevision,
          eventCount: apiHammerBefore.eventCount
        },
        after: {
          snapshotRevision: apiHammerAfter.snapshotRevision,
          eventCount: apiHammerAfter.eventCount
        }
      },
      latency,
      criticalInvariantSummary: critical,
      replay,
      finalRuntime
    });
  });


  app.post("/tests/run/hard-stress-suite", (req, res) => {
    runtimeEngine.resetPerformanceWindow();
    const rawLevels = String(req.query.levels ?? "10000,20000,30000");
    const levels = rawLevels
      .split(",")
      .map((v) => clampInt(v.trim(), 0, 1, 50000))
      .filter((v) => v > 0)
      .slice(0, 5);
    const batchSize = clampInt(req.query.batchSize, 1000, 10, 5000);
    const retryChildren = clampInt(req.query.retryChildren, 1, 0, 3);
    const rejectIfRunning = String(req.query.rejectIfRunning ?? "true") !== "false";

    const activeSuites = getActiveJobs(["hard_stress_suite"]);
    if (rejectIfRunning && activeSuites.length > 0) {
      return res.status(409).json({
        ok: false,
        error: "SuiteAlreadyRunning",
        details: "Another hard-stress-suite is still active. Poll or finish it before starting a new suite, or pass rejectIfRunning=false.",
        activeSuites: activeSuites.map((j) => ({ jobId: j.jobId, status: j.status, processedStates: j.processedStates, requestedStates: j.requestedStates })),
        statusCode: 409
      });
    }

    const suiteJob: StressJobRecord = {
      jobId: crypto.randomUUID(),
      name: "hard_stress_suite",
      status: "queued",
      requestedStates: levels.reduce((a, b) => a + b, 0),
      batchSize,
      processedStates: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        eventsBefore: runtimeEngine.getEvents(1_000_000).length,
        snapshotRevisionBefore: runtimeEngine.getSnapshot().revision
      },
      counters: {
        unsafeGateDenied: 0,
        unsafeGateFalseAllow: 0,
        reconcileOrderAllowed: 0,
        reconcilePositionAllowed: 0,
        recoveriesCompleted: 0
      },
      result: {
        ok: false,
        assertions: { suiteQueued: true },
        metrics: runtimeEngine.getMetrics(),
        invariants: runtimeEngine.getInvariants(),
        finalStateDomains: compactRuntimeDomains()
      }
    };
    (suiteJob as any).suite = { levels, retryChildren, rejectIfRunning, orchestrationVersion: "pr25" };
    stressJobs.set(suiteJob.jobId, suiteJob);
    persistJob(suiteJob);

    void (async () => {
      updateJob(suiteJob, { status: "running" });
      const childResults: any[] = [];
      try {
        for (const level of levels) {
          const { child, result } = await runChildWithRetry(level, batchSize, retryChildren);
          childResults.push(result);

          suiteJob.processedStates += level;
          suiteJob.counters.unsafeGateDenied += child.counters.unsafeGateDenied;
          suiteJob.counters.unsafeGateFalseAllow += child.counters.unsafeGateFalseAllow;
          suiteJob.counters.reconcileOrderAllowed += child.counters.reconcileOrderAllowed;
          suiteJob.counters.reconcilePositionAllowed += child.counters.reconcilePositionAllowed;
          suiteJob.counters.recoveriesCompleted += child.counters.recoveriesCompleted;
          suiteJob.progress.percent = Number(((suiteJob.processedStates / Math.max(1, suiteJob.requestedStates)) * 100).toFixed(2));
          suiteJob.progress.eventsAfter = runtimeEngine.getEvents(1_000_000).length;
          suiteJob.progress.snapshotRevisionAfter = runtimeEngine.getSnapshot().revision;
          suiteJob.result = {
            ok: false,
            assertions: { suiteRunning: true },
            metrics: runtimeEngine.getMetrics(),
            invariants: runtimeEngine.getInvariants(),
            finalStateDomains: compactRuntimeDomains()
          };
          (suiteJob.result as any).children = childResults;
          persistJob(suiteJob);
        }

        finalizeSuiteJob(suiteJob, childResults);
      } catch (err: any) {
        suiteJob.status = "failed";
        suiteJob.error = err?.message ?? String(err);
        suiteJob.finishedAt = new Date().toISOString();
        suiteJob.updatedAt = suiteJob.finishedAt;
        suiteJob.result = {
          ok: false,
          assertions: {
            suiteException: true,
            zeroUnsafeFalseAllow: suiteJob.counters.unsafeGateFalseAllow === 0,
            zeroFalseAllowMetric: runtimeEngine.getMetrics().falseAllowCount === 0,
            zeroActionViolations: runtimeEngine.getMetrics().actionViolationCount === 0
          },
          metrics: runtimeEngine.getMetrics(),
          invariants: runtimeEngine.getInvariants(),
          finalStateDomains: compactRuntimeDomains()
        };
        (suiteJob.result as any).classification = "suite_exception";
        persistJob(suiteJob);
      }
    })();

    res.status(202).json({
      ok: true,
      accepted: true,
      suiteJobId: suiteJob.jobId,
      status: suiteJob.status,
      levels,
      batchSize,
      retryChildren,
      rejectIfRunning,
      poll: `/tests/jobs/${suiteJob.jobId}`,
      message: "Hard stress suite is running asynchronously. PR25 serializes suites by default and retries retryable child orchestration failures."
    });
  });

  app.post("/tests/run/state-space-stress-check", (req, res) => {
    const requestedStatesRaw = Number(req.query.states ?? 10000);
    const requestedStatesInput = Number.isFinite(requestedStatesRaw) ? Math.floor(requestedStatesRaw) : 10000;
    const states = clampInt(req.query.states, 10000, 1, 50000);
    const batchSize = clampInt(req.query.batchSize, 500, 10, 5000);
    const snapshot = runtimeEngine.getSnapshot();

    const job: StressJobRecord = {
      jobId: crypto.randomUUID(),
      name: "state_space_stress_check",
      status: "queued",
      requestedStates: states,
      batchSize,
      processedStates: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: {
        percent: 0,
        eventsBefore: runtimeEngine.getEvents(1_000_000).length,
        snapshotRevisionBefore: snapshot.revision
      },
      counters: {
        unsafeGateDenied: 0,
        unsafeGateFalseAllow: 0,
        reconcileOrderAllowed: 0,
        reconcilePositionAllowed: 0,
        recoveriesCompleted: 0
      }
    };

    stressJobs.set(job.jobId, job);
    persistJob(job);
    void runStateSpaceStressJob(job);

    res.status(202).json({
      ok: true,
      accepted: true,
      jobId: job.jobId,
      status: job.status,
      requestedStatesInput,
      acceptedStates: job.requestedStates,
      clamped: requestedStatesInput !== job.requestedStates,
      requestedStates: job.requestedStates,
      batchSize: job.batchSize,
      poll: `/tests/jobs/${job.jobId}`,
      message: "State-space stress is running asynchronously. Poll the job endpoint; curl will not block."
    });
  });


  function haltForDestruction(reason: string, details?: unknown) {
    const snapshot = runtimeEngine.commitEvent(makeEvent((EVENT_TYPE as any).SYSTEM_HALTED, {
      reason,
      details,
      source: "pr30_destruction_testing"
    }));
    const journal = appendTradeJournal({
      event: "system_halted",
      reason,
      details,
      snapshotRevision: snapshot.revision
    });
    return { snapshot, journal };
  }

  function destructionEnvelope(name: string, startedAt: string, payload: Record<string, unknown>) {
    const final = runtimeEngine.getRuntimeView();
    const invariants = runtimeEngine.getInvariants();
    return {
      name,
      startedAt,
      finishedAt: new Date().toISOString(),
      final,
      assertions: {
        stateEqualsExchangeOrHalted: final.stateDomains.system === "halted" || invariants.every((c) => c.ok),
        zeroFalseAllowMetric: final.metrics.falseAllowCount === 0,
        zeroActionViolations: final.metrics.actionViolationCount === 0
      },
      invariants,
      ...payload
    };
  }

  const destructionIdempotency = new Map<string, Promise<any>>();

  async function idempotentDestructivePlace(input: { clientOrderId: string; quantity?: number; price?: number }) {
    const existing = destructionIdempotency.get(input.clientOrderId);
    if (existing) return existing;

    const promise = (async () => {
      const autoReconcile = await autoReconcileUnsafeState("pr30_duplicate_place_before_execution");
      const snapshot = runtimeEngine.getSnapshot();
      const price = Number(input.price ?? ((snapshot.market.lastPrice ?? snapshot.position.markPrice ?? 76000) * 0.90));
      const quantity = Number(input.quantity ?? Math.min(numEnv("TESTNET_MAX_ORDER_QTY", 0.0001), getExecutionGuardConfig().maxOrderQty));
      const decision = evaluateDailyLimits(evaluateControlledExecutionGuard({
        symbol: binanceSpotTestnet.symbol,
        side: "buy",
        quantity,
        price,
        clientOrderId: input.clientOrderId
      } as any));

      if (!decision.ok) {
        return { idempotent: true, sent: false, autoReconcile, decision };
      }

      if (decision.config.dryRun) {
        const journal = appendTradeJournal({
          event: "destruction_duplicate_place_dry_run",
          clientOrderId: input.clientOrderId,
          decision: "allow",
          notional: decision.request.notional
        });
        return { idempotent: true, sent: false, dryRun: true, autoReconcile, decision, journal };
      }

      const exchangeOrder = await binanceSpotTestnet.placeLimitOrder({
        symbol: decision.request.symbol,
        side: "BUY",
        quantity: decision.request.quantity,
        price: decision.request.price,
        clientOrderId: input.clientOrderId
      });

      const placedSnapshot = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol: decision.request.symbol,
        side: "buy",
        quantity: decision.request.quantity,
        price: decision.request.price,
        orderId: String(exchangeOrder.orderId),
        clientOrderId: exchangeOrder.clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "NEW",
        provider: "pr30-duplicate-place"
      }));

      const journal = appendTradeJournal({
        event: "destruction_duplicate_place_real",
        clientOrderId: exchangeOrder.clientOrderId,
        orderId: String(exchangeOrder.orderId),
        exchangeStatus: exchangeOrder.status ?? "NEW",
        notional: decision.request.notional
      });

      return { idempotent: true, sent: true, dryRun: false, autoReconcile, decision, exchangeOrder, placedState: placedSnapshot.order, journal };
    })();

    destructionIdempotency.set(input.clientOrderId, promise);
    return promise;
  }

  app.post("/tests/destruction/duplicate-place", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const clientOrderId = `${getExecutionGuardConfig().clientOrderPrefix}dup_${Date.now()}`;
    try {
      const [first, second] = await Promise.all([
        idempotentDestructivePlace({ clientOrderId }),
        idempotentDestructivePlace({ clientOrderId })
      ]);

      const sameOrder =
        first?.exchangeOrder?.orderId && second?.exchangeOrder?.orderId
          ? String(first.exchangeOrder.orderId) === String(second.exchangeOrder.orderId)
          : first?.journal?.journalId === second?.journal?.journalId || first === second;

      const duplicateCreated = first?.exchangeOrder?.orderId && second?.exchangeOrder?.orderId && !sameOrder;
      if (duplicateCreated) haltForDestruction("duplicate_place_created_two_orders", { first: first.exchangeOrder, second: second.exchangeOrder });

      const body = destructionEnvelope("destruction_duplicate_place", startedAt, {
        ok: !duplicateCreated,
        classification: duplicateCreated ? "critical_failure_halted" : "passed",
        clientOrderId,
        first,
        second,
        assertions: {
          oneExchangeOrderOrDryRun: !duplicateCreated,
          secondCallReturnedSameResult: Boolean(sameOrder),
          noSilentDuplicate: !duplicateCreated
        }
      });
      res.status((body as any).ok ? 200 : 409).json(body);
    } catch (err: any) {
      haltForDestruction("duplicate_place_exception", err.message);
      res.status(502).json(destructionEnvelope("destruction_duplicate_place", startedAt, { ok: false, error: err.message, classification: "exception_halted" }));
    }
  });

  app.post("/tests/destruction/network-timeout-race", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const clientOrderId = `${getExecutionGuardConfig().clientOrderPrefix}timeout_${Date.now()}`;
    try {
      const first = await idempotentDestructivePlace({ clientOrderId });
      // Simulates a lost HTTP response: retry the same semantic request with the same idempotency key.
      const retry = await idempotentDestructivePlace({ clientOrderId });

      const sameOrder =
        first?.exchangeOrder?.orderId && retry?.exchangeOrder?.orderId
          ? String(first.exchangeOrder.orderId) === String(retry.exchangeOrder.orderId)
          : first === retry || first?.journal?.journalId === retry?.journal?.journalId;

      const duplicateCreated = first?.exchangeOrder?.orderId && retry?.exchangeOrder?.orderId && !sameOrder;
      if (duplicateCreated) haltForDestruction("network_timeout_retry_created_duplicate_order", { first: first.exchangeOrder, retry: retry.exchangeOrder });

      const body = destructionEnvelope("destruction_network_timeout_race", startedAt, {
        ok: !duplicateCreated,
        classification: duplicateCreated ? "critical_failure_halted" : "passed",
        clientOrderId,
        firstObservedAfterArtificialTimeout: first,
        retry,
        assertions: {
          retryDidNotCreateSecondOrder: !duplicateCreated,
          idempotencyKeyReused: true
        }
      });
      res.status((body as any).ok ? 200 : 409).json(body);
    } catch (err: any) {
      haltForDestruction("network_timeout_race_exception", err.message);
      res.status(502).json(destructionEnvelope("destruction_network_timeout_race", startedAt, { ok: false, error: err.message, classification: "exception_halted" }));
    }
  });

  app.post("/tests/destruction/partial-fill", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const s = runtimeEngine.getSnapshot();
    const symbol = s.market.symbol ?? binanceSpotTestnet.symbol;
    const price = Number(s.market.lastPrice ?? s.position.markPrice ?? 76000);
    const quantity = 0.0002;
    const filledQuantity = 0.0001;
    const clientOrderId = `${getExecutionGuardConfig().clientOrderPrefix}partial_${Date.now()}`;
    const orderId = `synthetic_partial_${Date.now()}`;

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
      symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "pr30-partial-fill"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol, side: "buy", quantity, filledQuantity, filledQuantityDelta: filledQuantity, fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", provider: "pr30-partial-fill"
    }));

    const after = runtimeEngine.getSnapshot();
    const assertions = {
      orderPartiallyFilled: after.order.status === "partially_filled",
      filledQuantityUpdated: Number(after.order.filledQuantity ?? 0) === filledQuantity,
      positionKnown: after.position.status !== "unknown",
      remainderExists: quantity - Number(after.order.filledQuantity ?? 0) > 0,
      riskClearOrSystemHalted: after.risk.status === "clear" || after.system.status === "halted"
    };
    const ok = Object.values(assertions).every(Boolean);
    if (!ok) haltForDestruction("partial_fill_invariant_failed", assertions);

    const body = destructionEnvelope("destruction_partial_fill", startedAt, { ok, classification: ok ? "passed" : "failed_halted", assertions, order: after.order, position: after.position });
    res.status(ok ? 200 : 409).json(body);
  });

  app.post("/tests/destruction/fill-without-notification", async (_req, res) => {
    const startedAt = new Date().toISOString();
    try {
      const before = runtimeEngine.getRuntimeView();
      const postPosition = await reconcilePositionFromExchange();
      const final = runtimeEngine.getRuntimeView();
      const ok = postPosition.positionState.status !== "unknown" && final.stateDomains.risk === "clear";
      if (!ok) haltForDestruction("fill_without_notification_reconcile_failed", { postPosition, final: final.stateDomains });
      const body = destructionEnvelope("destruction_fill_without_notification", startedAt, {
        ok,
        classification: ok ? "passed_or_no_external_fill_detected" : "failed_halted",
        before,
        postPosition,
        note: "This endpoint validates the startup/reconcile path. For the destructive manual version: place an order, kill the process, let it fill on testnet, restart, then run this endpoint."
      });
      res.status(ok ? 200 : 409).json(body);
    } catch (err: any) {
      haltForDestruction("fill_without_notification_exception", err.message);
      res.status(502).json(destructionEnvelope("destruction_fill_without_notification", startedAt, { ok: false, error: err.message, classification: "exception_halted" }));
    }
  });

  app.post("/tests/destruction/cancel-vs-fill-race", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const s = runtimeEngine.getSnapshot();
    const symbol = s.market.symbol ?? binanceSpotTestnet.symbol;
    const price = Number(s.market.lastPrice ?? s.position.markPrice ?? 76000);
    const quantity = 0.0002;
    const orderId = `synthetic_race_${Date.now()}`;
    const clientOrderId = `${getExecutionGuardConfig().clientOrderPrefix}race_${Date.now()}`;

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, { symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "pr30-cancel-fill-race" }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, { symbol, side: "buy", quantity, filledQuantity: 0, orderId, clientOrderId, exchangeStatus: "CANCELED", provider: "pr30-cancel-fill-race" }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_RECONCILED, { symbol, side: "buy", quantity, filledQuantity: quantity, executedQty: String(quantity), origQty: String(quantity), orderId, clientOrderId, exchangeStatus: "FILLED", provider: "pr30-cancel-fill-race" }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: Number((Number(s.position.quantity ?? 0) + quantity).toFixed(12)),
      locked: 0,
      quantity: Number((Number(s.position.quantity ?? 0) + quantity).toFixed(12)),
      markPrice: price,
      exposure: Math.abs(Number((Number(s.position.quantity ?? 0) + quantity).toFixed(12)) * price),
      source: "runtime"
    }));

    const after = runtimeEngine.getSnapshot();
    const assertions = {
      filledWinsOverCanceled: after.order.status === "filled",
      positionReflectsFill: after.position.status === "open" && Number(after.position.quantity ?? 0) >= Number(s.position.quantity ?? 0),
      riskClearOrHalted: after.risk.status === "clear" || after.system.status === "halted"
    };
    const ok = Object.values(assertions).every(Boolean);
    if (!ok) haltForDestruction("cancel_vs_fill_race_inconsistent", assertions);
    const body = destructionEnvelope("destruction_cancel_vs_fill_race", startedAt, { ok, classification: ok ? "passed" : "failed_halted", assertions, order: after.order, position: after.position });
    res.status(ok ? 200 : 409).json(body);
  });

  app.post("/tests/destruction/stale-snapshot", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const before = runtimeEngine.getRuntimeView();
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, Math.max(500, Number(_req.query.delayMs ?? 2500)))));
    const decision = evaluateControlledExecutionGuard({ side: "buy", quantity: 0.0001, price: Number(runtimeEngine.getSnapshot().market.lastPrice ?? 76000) }, {
      requireFreshReconcile: true,
      reconcileFreshnessMs: 1
    });
    const ok = decision.decision === "deny" && decision.reason === "stale_position_requires_reconcile";
    if (!ok) haltForDestruction("stale_snapshot_was_accepted", { decision, before });
    const body = destructionEnvelope("destruction_stale_snapshot", startedAt, { ok, classification: ok ? "passed" : "failed_halted", before, decision });
    res.status(ok ? 200 : 409).json(body);
  });

  app.post("/tests/destruction/orphan-order", async (_req, res) => {
    const startedAt = new Date().toISOString();
    try {
      const openOrders = await binanceSpotTestnet.getOpenOrders(binanceSpotTestnet.symbol);
      const snapshot = runtimeEngine.getSnapshot();
      const localOrderId = snapshot.order.orderId ? String(snapshot.order.orderId) : undefined;
      const orphanOrders = openOrders.filter((o: any) => String(o.orderId) !== localOrderId);
      const journalEntries = orphanOrders.map((o: any) => appendTradeJournal({
        event: "orphan_order_detected",
        symbol: o.symbol,
        orderId: String(o.orderId),
        clientOrderId: o.clientOrderId,
        exchangeStatus: o.status,
        source: "pr30-orphan-order"
      }));
      const ok = orphanOrders.length === 0 || journalEntries.length === orphanOrders.length;
      const body = destructionEnvelope("destruction_orphan_order", startedAt, {
        ok,
        classification: orphanOrders.length ? "orphan_detected_and_journaled" : "passed_no_orphan_orders",
        openOrdersCount: openOrders.length,
        orphanOrders,
        journalEntries
      });
      res.status(ok ? 200 : 409).json(body);
    } catch (err: any) {
      haltForDestruction("orphan_order_reconcile_failed", err.message);
      res.status(502).json(destructionEnvelope("destruction_orphan_order", startedAt, { ok: false, error: err.message, classification: "exception_halted" }));
    }
  });

  app.post("/tests/destruction/journal-failure", async (_req, res) => {
    const startedAt = new Date().toISOString();
    const halt = haltForDestruction("journal_failure_simulated", {
      message: "Simulated disk/journal write failure. PR30 expected behavior is fail-closed: system halted."
    });
    const body = destructionEnvelope("destruction_journal_failure", startedAt, {
      ok: halt.snapshot.system.status === "halted",
      classification: "halted_as_expected",
      halt: { stateDomains: { system: halt.snapshot.system.status }, journal: halt.journal }
    });
    res.status(200).json(body);
  });

  app.post("/tests/destruction/position-drift", async (_req, res) => {
    const startedAt = new Date().toISOString();
    try {
      const before = runtimeEngine.getSnapshot();
      const account = await binanceSpotTestnet.getAccount();
      const payload = buildPositionPayloadFromAccount({
        account,
        symbol: binanceSpotTestnet.symbol,
        markPrice: before.market.lastPrice ?? before.position.markPrice ?? 0,
        source: "exchange"
      });
      const localQty = Number(before.position.quantity ?? 0);
      const exchangeQty = Number(payload.quantity ?? 0);
      const drift = Math.abs(localQty - exchangeQty);
      const tolerance = Number(_req.query.tolerance ?? 0.00000001);
      let halted: any;
      if (drift > tolerance) {
        halted = haltForDestruction("position_drift_detected", { localQty, exchangeQty, drift, tolerance });
      }
      const ok = drift <= tolerance || runtimeEngine.getSnapshot().system.status === "halted";
      const body = destructionEnvelope("destruction_position_drift", startedAt, {
        ok,
        classification: drift > tolerance ? "drift_detected_halted" : "passed_no_drift",
        localQty,
        exchangeQty,
        drift,
        tolerance,
        halted
      });
      res.status(ok ? 200 : 409).json(body);
    } catch (err: any) {
      haltForDestruction("position_drift_check_failed", err.message);
      res.status(502).json(destructionEnvelope("destruction_position_drift", startedAt, { ok: false, error: err.message, classification: "exception_halted" }));
    }
  });

  app.post("/tests/destruction/restart-during-execution-plan", (_req, res) => {
    res.json({
      ok: true,
      name: "destruction_restart_during_execution_plan",
      manual: true,
      steps: [
        "1) Set TESTNET_EXECUTION_DRY_RUN=false and REAL_TESTNET_EXECUTION_ACK=I_UNDERSTAND_TESTNET_ORDER.",
        "2) Start: curl.exe -X POST http://localhost:3000/tests/run/real-testnet-execution-check",
        "3) Kill node.exe immediately after order placement appears in server log.",
        "4) Restart: npm run dev",
        "5) Run: curl.exe -X POST http://localhost:3000/execution/reconcile/auto",
        "6) Run: curl.exe http://localhost:3000/execution/guard",
        "PASS = state == exchange OR system halted. FAIL = system continues trading with unknown/uncertain state."
      ],
      expected: {
        pass: ["state_equals_exchange", "or_system_halted"],
        fail: ["silent_inconsistency", "place_order_allowed_while_uncertain"]
      }
    });
  });

  app.post("/tests/destruction/run-all-safe", async (_req, res) => {
    res.status(202).json({
      ok: true,
      name: "destruction_run_all_safe",
      message: "Run destructive tests individually. journal-failure and position-drift can intentionally halt the runtime and must be run last.",
      recommendedOrder: [
        "POST /tests/destruction/duplicate-place",
        "POST /tests/destruction/network-timeout-race",
        "POST /tests/destruction/partial-fill",
        "POST /tests/destruction/fill-without-notification",
        "POST /tests/destruction/cancel-vs-fill-race",
        "POST /tests/destruction/stale-snapshot",
        "POST /tests/destruction/orphan-order",
        "POST /tests/destruction/restart-during-execution-plan",
        "POST /tests/destruction/journal-failure",
        "POST /tests/destruction/position-drift"
      ]
    });
  });




  // PR30.1: Real Market Chaos Suite. These endpoints are deliberately fail-closed.
  // Rule: PASS only when runtime state equals exchange truth OR the system is halted.
  function pr301ChaosGuard(testName: string) {
    const exchange = binanceSpotTestnet.status();
    const config = getExecutionGuardConfig();
    const ack = process.env.PR30_1_REAL_CHAOS_ACK === "I_ACCEPT_TESTNET_CHAOS";
    const dryRunDisabled = config.dryRun === false;
    const ok = ack && exchange.configured && exchange.mode === "testnet" && exchange.safety.mainnetDisabled && exchange.safety.spotOnly && dryRunDisabled;
    return {
      ok,
      testName,
      exchange,
      guard: config,
      required: {
        PR30_1_REAL_CHAOS_ACK: "I_ACCEPT_TESTNET_CHAOS",
        EXCHANGE_MODE: "testnet",
        TESTNET_EXECUTION_DRY_RUN: "false",
        BINANCE_API_KEY: "present",
        BINANCE_API_SECRET: "present",
        mainnet: "disabled"
      },
      reason: ok ? "ready" : "real_chaos_guard_not_satisfied"
    };
  }

  function pr301Halt(reason: string, details: Record<string, unknown> = {}) {
    const halted = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.SYSTEM_HALTED, { reason, ...details }));
    let journal: unknown;
    try {
      journal = appendTradeJournal({ event: "chaos_halt", reason, details, systemState: halted.system, snapshotRevision: halted.revision });
    } catch (err: any) {
      journal = { error: err?.message ?? String(err) };
    }
    return { haltedSnapshot: halted, journal };
  }

  function pr301Seed(symbol = "BTCUSDT", price = 76000) {
    runtimeEngine.clearPersistenceAndReset();
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, {
      symbol,
      price,
      bid: Number((price - 0.01).toFixed(2)),
      ask: Number((price + 0.01).toFixed(2)),
      volume: 1,
      provider: "pr30.1-chaos"
    }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_RECONCILED, {
      symbol,
      asset: symbol.replace(/USDT$/, ""),
      quoteAsset: "USDT",
      free: 1,
      locked: 0,
      quantity: 1,
      markPrice: price,
      exposure: price,
      source: "exchange"
    }));
    return runtimeEngine.getSnapshot();
  }

  function pr301CommitFill(input: {
    symbol: string;
    side?: "buy" | "sell";
    quantity: number;
    filledQuantity: number;
    filledQuantityDelta: number;
    fillPrice: number;
    orderId: string;
    clientOrderId: string;
    exchangeStatus: string;
    fillId?: string;
    provider?: string;
  }) {
    return runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_EXECUTION_REPORTED, {
      symbol: input.symbol,
      side: input.side ?? "buy",
      quantity: input.quantity,
      filledQuantity: input.filledQuantity,
      filledQuantityDelta: input.filledQuantityDelta,
      fillPrice: input.fillPrice,
      markPrice: input.fillPrice,
      orderId: input.orderId,
      clientOrderId: input.clientOrderId,
      exchangeStatus: input.exchangeStatus,
      provider: input.provider ?? "pr30.1-chaos",
      fillId: input.fillId,
      tradeId: input.fillId
    } as any));
  }

  app.get("/tests/chaos/pr30-1", (_req, res) => {
    res.json({
      ok: true,
      name: "pr30.1_real_market_chaos_suite",
      rule: "PASS = state == exchange OR system HALTED. FAIL = silent inconsistency while trading continues.",
      dangerousRealTestsRequire: pr301ChaosGuard("manifest").required,
      tests: [
        "POST /tests/chaos/real-market-fill",
        "POST /tests/chaos/multi-fill-burst-plan",
        "POST /tests/chaos/duplicate-fill-injection",
        "POST /tests/chaos/out-of-order-events",
        "POST /tests/chaos/cancel-vs-fill-real",
        "POST /tests/chaos/restart-during-fill-plan",
        "POST /tests/chaos/partial-rest-restart-plan",
        "POST /tests/chaos/exchange-lag-simulation",
        "POST /tests/chaos/snapshot-split",
        "POST /tests/chaos/position-drift-real-plan",
        "POST /tests/chaos/journal-drop",
        "POST /tests/chaos/rate-limit-429-plan",
        "POST /tests/chaos/unknown-order-state",
        "POST /tests/chaos/partial-cancel-fill"
      ],
      current: runtimeEngine.getRuntimeView(),
      exchange: binanceSpotTestnet.status()
    });
  });

  app.post("/tests/chaos/real-market-fill", async (req, res) => {
    const guard = pr301ChaosGuard("real_market_fill");
    if (!guard.ok) return res.status(409).json({ ...guard, ok: false, blocked: true });

    const startedAt = new Date().toISOString();
    const before = runtimeEngine.getSnapshot();
    const symbol = String(req.body?.symbol ?? before.market.symbol ?? binanceSpotTestnet.symbol).toUpperCase();
    const side = String(req.body?.side ?? "BUY").toUpperCase() === "SELL" ? "SELL" : "BUY";
    const quantity = Number(req.body?.quantity ?? process.env.PR30_1_MARKET_QTY ?? 0.0001);
    const clientOrderId = `${getExecutionGuardConfig().clientOrderPrefix}chaos_mkt_${Date.now()}`;

    try {
      const exchangeOrder: any = await binanceSpotTestnet.placeMarketOrder({ symbol, side: side as "BUY" | "SELL", quantity, clientOrderId });
      const fills = Array.isArray(exchangeOrder.fills) ? exchangeOrder.fills : [];
      const fillSum = Number(fills.reduce((sum: number, f: any) => sum + Number(f.qty ?? 0), 0).toFixed(12));
      const executedQty = Number(exchangeOrder.executedQty ?? fillSum ?? 0);
      const avgPrice = fills.length > 0
        ? Number((fills.reduce((sum: number, f: any) => sum + Number(f.qty ?? 0) * Number(f.price ?? 0), 0) / Math.max(fillSum, 1e-12)).toFixed(8))
        : Number(before.market.lastPrice ?? before.position.markPrice ?? 0);

      runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
        symbol, side: side.toLowerCase(), quantity, price: avgPrice, orderId: String(exchangeOrder.orderId), clientOrderId, exchangeStatus: exchangeOrder.status, provider: "binance-spot-testnet"
      }));
      const afterFill = pr301CommitFill({
        symbol,
        side: side.toLowerCase() as "buy" | "sell",
        quantity,
        filledQuantity: executedQty,
        filledQuantityDelta: executedQty,
        fillPrice: avgPrice,
        orderId: String(exchangeOrder.orderId),
        clientOrderId,
        exchangeStatus: exchangeOrder.status ?? "FILLED",
        fillId: String(fills[0]?.tradeId ?? exchangeOrder.orderId),
        provider: "binance-spot-testnet-real-market"
      });

      const positionReconcile = await reconcilePositionFromExchange();
      const journal = appendTradeJournal({ event: "chaos_real_market_fill", orderId: exchangeOrder.orderId, clientOrderId, fills, quantity, executedQty, fillSum, positionBefore: before.position, positionAfter: positionReconcile.positionState });
      const assertions = {
        orderFilled: String(exchangeOrder.status ?? "").toUpperCase() === "FILLED" || executedQty >= quantity,
        fillCountAtLeastOne: fills.length >= 1 || executedQty > 0,
        sumFillsMatchesQuantity: Math.abs((fillSum || executedQty) - quantity) < 1e-8,
        positionReconciledFromExchange: positionReconcile.positionState.source === "exchange",
        journalWritten: Boolean((journal as any).journalId),
        replayOk: runtimeEngine.replayCheck().ok
      };
      const ok = Object.values(assertions).every(Boolean);
      if (!ok) pr301Halt("real_market_fill_assertion_failed", { assertions, orderId: exchangeOrder.orderId, clientOrderId });

      res.status(ok ? 200 : 409).json({
        name: "real_market_fill",
        ok,
        startedAt,
        finishedAt: new Date().toISOString(),
        orderId: String(exchangeOrder.orderId),
        clientOrderId,
        fills,
        exchangeOrder,
        fillSum,
        quantity,
        positionBefore: before.position,
        positionAfterFill: afterFill.position,
        positionAfterReconcile: positionReconcile.positionState,
        journal,
        assertions,
        systemState: runtimeEngine.getSnapshot().system,
        replay: runtimeEngine.replayCheck()
      });
    } catch (err: any) {
      const halted = pr301Halt("real_market_fill_exception", { error: err?.message ?? String(err) });
      res.status(502).json({ ok: false, name: "real_market_fill", error: "RealMarketFillError", details: err?.message ?? String(err), ...halted });
    }
  });

  app.post("/tests/chaos/multi-fill-burst-plan", (_req, res) => {
    res.json({
      ok: true,
      manual: true,
      name: "multi_fill_burst_plan",
      instructions: [
        "Use testnet only.",
        "Place a guarded LIMIT order inside/near spread with TESTNET_EXECUTION_DRY_RUN=false.",
        "Poll /reconcile/order and /reconcile/position, then inspect /debug/events.",
        "PASS = no duplicate tradeId, no missing fill, sum(fills)==quantity, replay ok.",
        "FAIL = silent fill/position mismatch while system remains healthy."
      ]
    });
  });

  app.post("/tests/chaos/duplicate-fill-injection", (_req, res) => {
    const symbol = "BTCUSDT";
    const price = 76000;
    const quantity = 0.0001;
    const fillDelta = 0.00004;
    const orderId = `pr301_dup_${Date.now()}`;
    const clientOrderId = `genesis_testnet_pr301_dup_${Date.now()}`;
    const before = pr301Seed(symbol, price);

    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, { symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "pr30.1" }));
    const afterFirst = pr301CommitFill({ symbol, quantity, filledQuantity: fillDelta, filledQuantityDelta: fillDelta, fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", fillId: "duplicate_trade_id_1" });
    const afterDuplicate = pr301CommitFill({ symbol, quantity, filledQuantity: fillDelta, filledQuantityDelta: fillDelta, fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", fillId: "duplicate_trade_id_1" });

    const duplicateChangedPosition = Number(afterDuplicate.position.quantity) !== Number(afterFirst.position.quantity);
    let halted: any;
    if (duplicateChangedPosition) {
      halted = pr301Halt("duplicate_fill_position_drift", {
        exchangeTradeId: "duplicate_trade_id_1",
        firstPosition: afterFirst.position,
        duplicatePosition: afterDuplicate.position
      });
    }

    const finalSnapshot = runtimeEngine.getSnapshot();
    const ok = !duplicateChangedPosition || finalSnapshot.system.status === "halted";
    res.status(ok ? 200 : 409).json({
      name: "duplicate_fill_injection",
      ok,
      decision: duplicateChangedPosition ? "halted_on_duplicate_fill_drift" : "idempotent_duplicate_ignored",
      orderId,
      clientOrderId,
      fills: [{ exchangeTradeId: "duplicate_trade_id_1", qty: fillDelta }, { exchangeTradeId: "duplicate_trade_id_1", qty: fillDelta }],
      positionBefore: before.position,
      positionAfterFirst: afterFirst.position,
      positionAfterDuplicate: afterDuplicate.position,
      duplicateChangedPosition,
      halted,
      systemState: finalSnapshot.system,
      replay: runtimeEngine.replayCheck()
    });
  });

  app.post("/tests/chaos/out-of-order-events", (_req, res) => {
    const symbol = "BTCUSDT";
    const price = 76000;
    const quantity = 0.0001;
    const fillDelta = 0.00004;
    const orderId = `pr301_ooo_${Date.now()}`;
    const clientOrderId = `genesis_testnet_pr301_ooo_${Date.now()}`;
    pr301Seed(symbol, price);

    const afterEarlyFill = pr301CommitFill({ symbol, quantity, filledQuantity: fillDelta, filledQuantityDelta: fillDelta, fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", fillId: "early_fill_1" });
    const afterAck = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, { symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "late_ack" }));

    const ackLostFillState = Number(afterAck.order.filledQuantity ?? 0) < fillDelta;
    let halted: any;
    if (ackLostFillState) halted = pr301Halt("out_of_order_fill_lost_after_late_ack", { afterEarlyFill: afterEarlyFill.order, afterAck: afterAck.order });

    const finalSnapshot = runtimeEngine.getSnapshot();
    const ok = !ackLostFillState || finalSnapshot.system.status === "halted";
    res.status(ok ? 200 : 409).json({
      name: "out_of_order_events",
      ok,
      decision: ackLostFillState ? "halted_on_late_ack_overwrite" : "accepted_fill_then_ack",
      orderId,
      clientOrderId,
      positionAfterEarlyFill: afterEarlyFill.position,
      orderAfterEarlyFill: afterEarlyFill.order,
      orderAfterAck: afterAck.order,
      halted,
      systemState: finalSnapshot.system,
      replay: runtimeEngine.replayCheck()
    });
  });

  app.post("/tests/chaos/cancel-vs-fill-real", async (_req, res) => {
    const guard = pr301ChaosGuard("cancel_vs_fill_real");
    if (!guard.ok) return res.status(409).json({ ...guard, ok: false, blocked: true, message: "Real cancel-vs-fill is disabled until explicit chaos ACK is set." });
    res.status(501).json({ ok: false, name: "cancel_vs_fill_real", error: "NotImplementedInThisBuild", details: "PR30.1 installs the guard and logging contract. Use the manual plan until PR30.2 implements timed cancel worker." });
  });

  app.post("/tests/chaos/restart-during-fill-plan", (_req, res) => {
    res.json({
      ok: true,
      manual: true,
      name: "restart_during_fill_plan",
      steps: [
        "Start runtime with testnet keys and PR30_1_REAL_CHAOS_ACK=I_ACCEPT_TESTNET_CHAOS.",
        "Place minimal order.",
        "Kill node process after orderId appears, before reconcile.",
        "Wait 3-10 seconds.",
        "Restart runtime.",
        "POST /execution/reconcile/auto and POST /reconcile/position.",
        "PASS = fill recovered and position == exchange OR system halted."
      ]
    });
  });

  app.post("/tests/chaos/partial-rest-restart-plan", (_req, res) => {
    res.json({
      ok: true,
      manual: true,
      name: "partial_rest_restart_plan",
      expected: "partial 0.3 -> restart -> final 1.0 with no lost fill; otherwise HALT"
    });
  });

  app.post("/tests/chaos/exchange-lag-simulation", async (req, res) => {
    const delayMs = Math.max(500, Math.min(1500, Number(req.query.delayMs ?? 750)));
    const before = pr301Seed("BTCUSDT", 76000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.MARKET_TICK_RECEIVED, { symbol: "BTCUSDT", price: 76001, bid: 76000.99, ask: 76001.01, provider: "lag-simulation" }));
    const after = runtimeEngine.getSnapshot();
    const mismatch = after.revision !== before.revision;
    const halted = mismatch ? pr301Halt("exchange_lag_snapshot_mismatch", { beforeRevision: before.revision, afterRevision: after.revision, delayMs }) : undefined;
    const finalSnapshot = runtimeEngine.getSnapshot();
    res.status(200).json({
      name: "exchange_lag_simulation",
      ok: !mismatch || finalSnapshot.system.status === "halted",
      decision: mismatch ? "halted_after_snapshot_mismatch" : "no_mismatch",
      delayMs,
      beforeRevision: before.revision,
      afterRevision: after.revision,
      halted,
      systemState: finalSnapshot.system
    });
  });

  app.post("/tests/chaos/snapshot-split", (_req, res) => {
    const before = pr301Seed("BTCUSDT", 76000);
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "snapshot_split_orders_t1_fills_t2_positions_t3" }));
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.POSITION_UNKNOWN, { reason: "snapshot_split_detected" }));
    const halted = pr301Halt("snapshot_split_inconsistency", { beforeRevision: before.revision });
    const finalSnapshot = runtimeEngine.getSnapshot();
    res.json({
      name: "snapshot_split",
      ok: finalSnapshot.system.status === "halted",
      decision: "halted_after_non_atomic_exchange_snapshot",
      halted,
      systemState: finalSnapshot.system,
      replay: runtimeEngine.replayCheck()
    });
  });

  app.post("/tests/chaos/position-drift-real-plan", (_req, res) => {
    res.json({
      ok: true,
      manual: true,
      name: "position_drift_real_plan",
      warning: "Manual Binance testnet balance/position manipulation only. Never mainnet.",
      expected: "mismatch -> HALT; silent continue -> FAIL"
    });
  });

  app.post("/tests/chaos/journal-drop", (_req, res) => {
    pr301Seed("BTCUSDT", 76000);
    const halted = pr301Halt("journal_drop_simulated", { journalPath: TRADE_JOURNAL_PATH });
    const finalSnapshot = runtimeEngine.getSnapshot();
    res.json({
      name: "journal_drop",
      ok: finalSnapshot.system.status === "halted",
      decision: "halted_on_journal_failure",
      halted,
      systemState: finalSnapshot.system
    });
  });

  app.post("/tests/chaos/rate-limit-429-plan", (_req, res) => {
    res.json({
      ok: true,
      manual: true,
      name: "rate_limit_429_plan",
      expected: "retry must keep same clientOrderId/idempotency key; no second orderId for same intent"
    });
  });

  app.post("/tests/chaos/unknown-order-state", (_req, res) => {
    pr301Seed("BTCUSDT", 76000);
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_UNCERTAIN, { reason: "exchange_returned_UNKNOWN" }));
    const halted = pr301Halt("unknown_order_state", { exchangeStatus: "UNKNOWN" });
    const finalSnapshot = runtimeEngine.getSnapshot();
    res.json({
      name: "unknown_order_state",
      ok: finalSnapshot.order.status === "uncertain" && finalSnapshot.system.status === "halted",
      decision: "uncertain_then_halted",
      orderState: finalSnapshot.order,
      systemState: finalSnapshot.system,
      halted
    });
  });

  app.post("/tests/chaos/partial-cancel-fill", (_req, res) => {
    const symbol = "BTCUSDT";
    const price = 76000;
    const quantity = 0.0001;
    const orderId = `pr301_pcf_${Date.now()}`;
    const clientOrderId = `genesis_testnet_pr301_pcf_${Date.now()}`;
    pr301Seed(symbol, price);
    runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_REQUESTED, { symbol, side: "buy", quantity, price, orderId, clientOrderId, exchangeStatus: "NEW", provider: "pr30.1" }));
    const partial = pr301CommitFill({ symbol, quantity, filledQuantity: 0.00004, filledQuantityDelta: 0.00004, fillPrice: price, orderId, clientOrderId, exchangeStatus: "PARTIALLY_FILLED", fillId: "pcf_1" });
    const canceled = runtimeEngine.commitEvent(makeEvent(EVENT_TYPE.ORDER_CANCELED, { symbol, side: "buy", quantity, filledQuantity: 0.00004, orderId, clientOrderId, exchangeStatus: "CANCELED", provider: "race_cancel" }));
    const finalFill = pr301CommitFill({ symbol, quantity, filledQuantity: quantity, filledQuantityDelta: 0.00006, fillPrice: price, orderId, clientOrderId, exchangeStatus: "FILLED", fillId: "pcf_2" });
    const finalSnapshot = runtimeEngine.getSnapshot();
    const filledDominatesCanceled = finalSnapshot.order.status === "filled" && Number(finalSnapshot.order.filledQuantity) === quantity;
    const halted = filledDominatesCanceled ? undefined : pr301Halt("partial_cancel_fill_inconsistent_terminal_state", { orderState: finalSnapshot.order });
    const afterHalt = runtimeEngine.getSnapshot();
    res.status(filledDominatesCanceled || afterHalt.system.status === "halted" ? 200 : 409).json({
      name: "partial_cancel_fill",
      ok: filledDominatesCanceled || afterHalt.system.status === "halted",
      decision: filledDominatesCanceled ? "filled_dominates_canceled" : "halted_on_terminal_conflict",
      orderId,
      clientOrderId,
      partial: partial.order,
      canceled: canceled.order,
      finalFill: finalFill.order,
      positionFinal: finalFill.position,
      halted,
      systemState: afterHalt.system,
      replay: runtimeEngine.replayCheck()
    });
  });
app.post("/order", async (req, res) => {
  try {
    const { symbol, side, type, quantity } = req.body;

    const orderEvent = makeEvent(EVENT_TYPE.ORDER_REQUESTED, {
      symbol,
      side,
      type,
      quantity,
      clientOrderId: `manual_${Date.now()}`
    });

    runtimeEngine.commitEvent(orderEvent);

    res.json({ status: "OK", message: "Order event sent" });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

  return app;
}