#!/usr/bin/env node
/**
 * build-profitops-slice12.mjs — OwnerProfitOpsSummary offline rollup from paper trade history.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getFoundationWorkspaceRoot } from "./genesis-paths.mjs";

const workspaceRoot = getFoundationWorkspaceRoot();
const tradeHistoryDir = path.join(workspaceRoot, "tests/fixtures/phase3/trade-history");
const paperExecutionDir = path.join(workspaceRoot, "tests/fixtures/phase3/paper-execution");
const outDir = path.join(workspaceRoot, "tests/fixtures/phase3/profitops");
const reportsDir = path.join(workspaceRoot, "reports");

const SUMMARY_SCHEMA = "genesis.owner-profitops-summary.v1";
const TRADE_HISTORY_SCHEMA = "genesis.trade-history-read-model.v1";
const BATCH_SCHEMA = "genesis.phase3.slice12-profitops-trade-batch.v1";

/** Offline cost model (bps on notional, paper-forward v1). */
const COST = {
  feeBpsRoundTrip: 8,
  slippageBpsRoundTrip: 4,
  fundingBps: 1
};

function lineageHash(parts) {
  return `sha256:${createHash("sha256").update(parts.join("|")).digest("hex")}`;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function simulateTradeEconomics(tradeHistory, paperExecution) {
  const plan = paperExecution.simulationPlan ?? {};
  const entryLow = Number(plan.entryZone?.low ?? 0);
  const entryHigh = Number(plan.entryZone?.high ?? 0);
  const entry = (entryLow + entryHigh) / 2;
  const stop = Number(plan.invalidationLevel ?? entry);
  const tps = plan.takeProfitLevels ?? [];
  const exit = tps.length ? Number(tps[tps.length - 1]) : entry;
  const riskPerUnit = Math.max(entry - stop, 1);
  const grossR = (exit - entry) / riskPerUnit;

  const notional = 10_000;
  const feeDragR = (COST.feeBpsRoundTrip / 10_000) * (notional / riskPerUnit);
  const slippageImpactR = (COST.slippageBpsRoundTrip / 10_000) * (notional / riskPerUnit);
  const fundingImpactR = (COST.fundingBps / 10_000) * (notional / riskPerUnit);

  const netAfterFees = grossR - feeDragR;
  const netAfterSlippage = netAfterFees - slippageImpactR;
  const netAfterFunding = netAfterSlippage - fundingImpactR;

  const grossPnlUsd = ((exit - entry) / entry) * notional;
  const costUsd =
    notional * ((COST.feeBpsRoundTrip + COST.slippageBpsRoundTrip + COST.fundingBps) / 10_000);
  const netPnlUsd = grossPnlUsd - costUsd;

  const win = netAfterFunding > 0;
  return {
    grossR,
    feeDragR,
    slippageImpactR,
    fundingImpactR,
    netAfterFees,
    netAfterSlippage,
    netAfterFunding,
    netPnlUsd,
    win,
    profitFactor: win ? Math.max(1.25, grossR / Math.max(feeDragR + slippageImpactR + fundingImpactR, 0.01)) : 0.5
  };
}

function computeMaxDrawdownUsd(economicsList) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const e of economicsList) {
    cumulative += e.netPnlUsd;
    if (cumulative > peak) peak = cumulative;
    const dd = cumulative - peak;
    if (dd < maxDd) maxDd = dd;
  }
  return maxDd;
}

function computeMaxLossStreak(economicsList) {
  let streak = 0;
  let maxStreak = 0;
  for (const e of economicsList) {
    if (!e.win) {
      streak += 1;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
  }
  return maxStreak;
}

function estimateRiskOfRuin(winrate, maxLossStreak, sampleCount) {
  const lossProb = Math.max(0, Math.min(1, 1 - winrate));
  if (lossProb <= 0 || sampleCount < 1) return 0;
  const streakFactor = Math.pow(lossProb, Math.max(1, maxLossStreak));
  const depthFactor = Math.min(1, maxLossStreak / Math.max(sampleCount, 1));
  return Math.min(1, streakFactor * (1 + depthFactor));
}

function rollupEconomics(economicsList) {
  const n = economicsList.length;
  const wins = economicsList.filter((e) => e.win).length;
  const grossWins = economicsList
    .filter((e) => e.netAfterFunding > 0)
    .reduce((s, e) => s + e.netAfterFunding, 0);
  const grossLosses = economicsList
    .filter((e) => e.netAfterFunding <= 0)
    .reduce((s, e) => s + Math.abs(e.netAfterFunding), 0);
  const profitFactor =
    grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? grossWins / 0.01 : 0.5;

  const sum = (fn) => economicsList.reduce((s, e) => s + fn(e), 0);
  const avg = (fn) => (n ? sum(fn) / n : 0);

  return {
    sampleCount: n,
    winrate: n ? wins / n : 0,
    expectancy: avg((e) => e.netAfterFunding),
    pnl: sum((e) => e.netPnlUsd),
    maxDrawdown: computeMaxDrawdownUsd(economicsList),
    profitFactor,
    netExpectancyAfterFees: avg((e) => e.netAfterFees),
    netExpectancyAfterSlippage: avg((e) => e.netAfterSlippage),
    netExpectancyAfterFunding: avg((e) => e.netAfterFunding),
    feeDrag: avg((e) => e.feeDragR),
    slippageImpact: avg((e) => e.slippageImpactR),
    fundingImpact: avg((e) => e.fundingImpactR),
    missedOpportunityRate: 0,
    blockedButProfitableRate: avg((e) => (e.win ? 1 : 0))
  };
}

function rollupByDimension(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row) ?? "UNKNOWN";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.economics);
  }
  const breakdown = {};
  for (const [key, econ] of groups) {
    breakdown[key] = rollupEconomics(econ);
  }
  return breakdown;
}

function buildSummary(tradePairs, economicsList, expansionId) {
  const computedAt = new Date().toISOString();
  const fromTimes = tradePairs.map((p) => p.tradeHistory.historyTimestamps?.sourceComputedAt).filter(Boolean);
  const from = fromTimes.length ? fromTimes.sort()[0] : "2026-06-02T07:00:00.000Z";
  const to = computedAt;
  const metrics = rollupEconomics(economicsList);

  const sourceRefs = [];
  for (const { tradeHistory, paperExecution, thRel, peRel } of tradePairs) {
    sourceRefs.push({
      refId: tradeHistory.tradeHistoryId,
      refType: "Evidence",
      refPath: thRel
    });
    sourceRefs.push({
      refId: paperExecution.paperExecutionId,
      refType: "Evidence",
      refPath: peRel
    });
  }

  const instrumentId = tradePairs[0]?.tradeHistory.instrumentId ?? "ETHUSDT";
  const lineageParts = tradePairs.flatMap((p) => [
    p.tradeHistory.tradeHistoryId,
    p.paperExecution.paperExecutionId
  ]);
  lineageParts.push(String(metrics.netExpectancyAfterFunding), String(metrics.sampleCount));

  const notesByExpansion = {
    "profitops-expanded-sample-v3":
      "Paper-only ProfitOps batch rollup (100+ trades, ETH/BTC, TREND/RANGE/CHOP, ASIA/LONDON/NY). Costs: fee/slippage/funding bps. Sprint 7 research batch — offline mechanics only, not capital-grade edge.",
    "profitops-expanded-sample-v2":
      "Paper-only ProfitOps batch rollup (20+ trades, mixed ETH/BTC/regimes). Costs: fee/slippage/funding bps model. Non-capital edge validation (profitops-expanded-sample-v2)."
  };

  return {
    schema: SUMMARY_SCHEMA,
    summaryId: `ops-${instrumentId}-paper-slice12-offline`,
    ownerRole: "Foundation Lead (derived offline)",
    consumerRoles: ["MissionControl", "OperatorReadModel"],
    metricsScope: "PAPER",
    window: { from, to, computedAt },
    metrics,
    dataFreshness: {
      status: "FRESH",
      computedAgeMs: 500,
      maxAgeMs: 86_400_000
    },
    sourceRefs,
    provenance: {
      sourceId: "fixture:phase3/profitops/profitops-liquidity-sweep-ethusdt-offline.json",
      sourceKind: "DERIVED_ENGINE",
      derivation: expansionId?.includes("v3")
        ? "OFFLINE_SLICE12_COST_ADJUSTED_BATCH_ROLLUP_V3"
        : "OFFLINE_SLICE12_COST_ADJUSTED_BATCH_ROLLUP_V1",
      lineageHash: lineageHash(lineageParts)
    },
    notes:
      notesByExpansion[expansionId] ??
      "Paper-only ProfitOps batch rollup. Costs: fee/slippage/funding bps model."
  };
}

function buildNegative(base) {
  return {
    ...base,
    summaryId: "ops-NEG-profit-factor-below-threshold",
    metrics: {
      ...base.metrics,
      sampleCount: base.metrics.sampleCount,
      profitFactor: 0.85,
      netExpectancyAfterFunding: -0.12,
      expectancy: -0.12,
      pnl: -120,
      winrate: 0
    },
    provenance: {
      ...base.provenance,
      lineageHash: lineageHash([base.summaryId, "NEG", "profitFactor"])
    }
  };
}

function buildScenarioPerformance(rows, expansionId) {
  return {
    schema: "genesis.profitops-scenario-performance-v1.v1",
    generatedAt: new Date().toISOString(),
    slice: 12,
    expansionId,
    mode: "PAPER_OFFLINE_ONLY",
    breakdown: {
      byInstrument: rollupByDimension(rows, (r) => r.tradeHistory.instrumentId),
      byRegime: rollupByDimension(rows, (r) => r.regimeTag),
      bySession: rollupByDimension(rows, (r) => r.sessionTag)
    },
    notaryGreenClaimed: false,
    liveIngestion: false,
    executionAllowed: false
  };
}

function buildCostRealism(economicsList, expansionId) {
  const n = economicsList.length;
  const sum = (fn) => economicsList.reduce((s, e) => s + fn(e), 0);
  const avg = (fn) => (n ? sum(fn) / n : 0);
  const grossPnl = sum((e) => e.netPnlUsd + (e.feeDragR + e.slippageImpactR + e.fundingImpactR) * 100);
  const totalCostDragR = sum((e) => e.feeDragR + e.slippageImpactR + e.fundingImpactR);
  return {
    schema: "genesis.profitops-cost-realism-v1.v1",
    generatedAt: new Date().toISOString(),
    slice: 12,
    expansionId,
    costAssumptionsBps: COST,
    sampleCount: n,
    avgFeeDragR: avg((e) => e.feeDragR),
    avgSlippageImpactR: avg((e) => e.slippageImpactR),
    avgFundingImpactR: avg((e) => e.fundingImpactR),
    totalCostDragR,
    costAsPercentOfGross: grossPnl > 0 ? (totalCostDragR / n / Math.max(avg((e) => e.grossR), 0.01)) * 100 : 0,
    netExpectancyAfterFees: avg((e) => e.netAfterFees),
    netExpectancyAfterSlippage: avg((e) => e.netAfterSlippage),
    netExpectancyAfterFunding: avg((e) => e.netAfterFunding),
    notaryGreenClaimed: false,
    liveIngestion: false,
    notes: "Offline bps cost model applied to paper simulation plans — not exchange-fee reconciliation."
  };
}

function buildRiskReport(economicsList, expansionId) {
  const metrics = rollupEconomics(economicsList);
  const maxLossStreak = computeMaxLossStreak(economicsList);
  return {
    schema: "genesis.profitops-risk-report-v1.v1",
    generatedAt: new Date().toISOString(),
    slice: 12,
    expansionId,
    sampleCount: metrics.sampleCount,
    maxDrawdown: metrics.maxDrawdown,
    maxLossStreak,
    winrate: metrics.winrate,
    riskOfRuinEstimate: estimateRiskOfRuin(metrics.winrate, maxLossStreak, metrics.sampleCount),
    profitFactor: metrics.profitFactor,
    notaryGreenClaimed: false,
    liveIngestion: false,
    executionAllowed: false,
    notes: "Simple offline risk-of-ruin from loss-streak and winrate — research indicator only."
  };
}

function loadTradeBatch() {
  const batchPath = path.join(outDir, "slice12-trade-batch.json");
  if (!fs.existsSync(batchPath)) {
    return {
      expansion: "profitops-expanded-sample-v2",
      trades: [
        {
          tradeHistory: "trade-history-liquidity-sweep-ethusdt-offline.json",
          paperExecution: "paper-execution-liquidity-sweep-ethusdt-offline.json"
        }
      ]
    };
  }
  const batch = loadJson(batchPath);
  if (batch.schema !== BATCH_SCHEMA) throw new Error("slice12 trade batch schema mismatch");
  return batch;
}

function main() {
  const batchDoc = loadTradeBatch();
  const batchEntries = batchDoc.trades ?? [];
  const expansionId = batchDoc.expansion ?? "profitops-expanded-sample-v2";
  const isV3 = expansionId === "profitops-expanded-sample-v3";
  const MIN_BATCH_TRADES = isV3 ? 100 : 20;

  if (batchEntries.length < MIN_BATCH_TRADES) {
    console.error(
      JSON.stringify({
        ok: false,
        error: `slice12 trade batch requires >= ${MIN_BATCH_TRADES} trades`,
        expansion: expansionId,
        actual: batchEntries.length
      })
    );
    process.exit(1);
  }

  const tradePairs = [];
  const economicsList = [];
  const enrichedRows = [];

  for (const entry of batchEntries) {
    const thPath = path.join(tradeHistoryDir, entry.tradeHistory);
    const pePath = path.join(paperExecutionDir, entry.paperExecution);
    if (!fs.existsSync(thPath) || !fs.existsSync(pePath)) {
      console.error(
        JSON.stringify({ ok: false, error: "Missing trade fixture", tradeHistory: entry.tradeHistory })
      );
      process.exit(1);
    }
    const tradeHistory = loadJson(thPath);
    const paperExecution = loadJson(pePath);
    if (tradeHistory.schema !== TRADE_HISTORY_SCHEMA) throw new Error("trade history schema mismatch");
    const economics = simulateTradeEconomics(tradeHistory, paperExecution);
    tradePairs.push({
      tradeHistory,
      paperExecution,
      thRel: `tests/fixtures/phase3/trade-history/${entry.tradeHistory}`,
      peRel: `tests/fixtures/phase3/paper-execution/${entry.paperExecution}`
    });
    economicsList.push(economics);
    enrichedRows.push({
      tradeHistory,
      economics,
      regimeTag: entry.regimeTag ?? "UNKNOWN",
      sessionTag: entry.sessionTag ?? "UNKNOWN"
    });
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const summary = buildSummary(tradePairs, economicsList, expansionId);
  const negative = buildNegative(summary);

  const goldenFile = "profitops-liquidity-sweep-ethusdt-offline.json";
  const negativeFile = "negative-profit-factor-below-threshold.json";
  fs.writeFileSync(path.join(outDir, goldenFile), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, negativeFile), JSON.stringify(negative, null, 2));

  const regimeTags = batchDoc.regimeTags ?? [
    ...new Set((batchDoc.trades ?? []).map((t) => t.regimeTag).filter(Boolean))
  ];
  const sessionTags = batchDoc.sessionTags ?? [
    ...new Set((batchDoc.trades ?? []).map((t) => t.sessionTag).filter(Boolean))
  ];

  const manifest = {
    schema: "genesis.phase3.slice12-profitops-manifest.v1",
    slice: 12,
    mode: "PAPER_OFFLINE_ONLY",
    costAssumptionsBps: COST,
    tradeBatch: "slice12-trade-batch.json",
    expansion: expansionId,
    regimeTags,
    sessionTags: sessionTags.length ? sessionTags : undefined,
    files: [goldenFile],
    negativeFiles: [negativeFile],
    notaryGreenClaimed: false,
    liveIngestion: false
  };
  fs.writeFileSync(path.join(outDir, "slice12-manifest.json"), JSON.stringify(manifest, null, 2));

  const expandedReport = {
    schema: isV3 ? "genesis.profitops-expanded-sample-v3.v1" : "genesis.profitops-expanded-sample-v2.v1",
    generatedAt: new Date().toISOString(),
    slice: 12,
    expansionId,
    mode: "PAPER_OFFLINE_ONLY",
    notaryGreenClaimed: false,
    liveIngestion: false,
    executionAllowed: false,
    costAssumptionsBps: COST,
    regimeTags,
    sessionTags: sessionTags.length ? sessionTags : undefined,
    instruments: [...new Set(tradePairs.map((p) => p.tradeHistory.instrumentId))],
    tradeCount: batchEntries.length,
    metrics: {
      sampleCount: summary.metrics.sampleCount,
      profitFactor: summary.metrics.profitFactor,
      winrate: summary.metrics.winrate,
      netExpectancyAfterFunding: summary.metrics.netExpectancyAfterFunding,
      pnl: summary.metrics.pnl,
      maxDrawdown: summary.metrics.maxDrawdown
    },
    goldenSummaryId: summary.summaryId,
    goldenFixture: goldenFile,
    tradeBatch: "tests/fixtures/phase3/profitops/slice12-trade-batch.json",
    notes: isV3
      ? "Sprint 7 expanded offline paper batch (n>=100). Instrument/regime/session breakdowns + cost/risk reports."
      : "Expanded offline paper batch (n>=20). Mechanics + cost-adjusted rollup proof only — not live edge or capital-grade profitability."
  };

  const expandedFileName = isV3 ? "profitops-expanded-sample-v3.json" : "profitops-expanded-sample-v2.json";
  fs.writeFileSync(path.join(reportsDir, expandedFileName), JSON.stringify(expandedReport, null, 2));

  if (isV3) {
    fs.writeFileSync(
      path.join(reportsDir, "profitops-scenario-performance-v1.json"),
      JSON.stringify(buildScenarioPerformance(enrichedRows, expansionId), null, 2)
    );
    fs.writeFileSync(
      path.join(reportsDir, "profitops-cost-realism-v1.json"),
      JSON.stringify(buildCostRealism(economicsList, expansionId), null, 2)
    );
    fs.writeFileSync(
      path.join(reportsDir, "profitops-risk-report-v1.json"),
      JSON.stringify(buildRiskReport(economicsList, expansionId), null, 2)
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        written: isV3 ? 5 : 2,
        expansionId,
        sampleCount: summary.metrics.sampleCount,
        outDir: "tests/fixtures/phase3/profitops",
        reportsDir: "reports",
        netExpectancyAfterFunding: summary.metrics.netExpectancyAfterFunding,
        profitFactor: summary.metrics.profitFactor,
        winrate: summary.metrics.winrate,
        maxDrawdown: summary.metrics.maxDrawdown
      },
      null,
      2
    )
  );
}

main();
