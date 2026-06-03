import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import {
  MARKET_INPUT_BLOCKING_REASON,
  PROVENANCE_BLOCKING_REASON,
  buildMarketInputIntegrityReport,
  buildProvenanceHealthReport
} from "../../core/integrity/integrity-report.js";
import {
  buildActionGateVerdictSummaryDto,
  buildObservableSummariesDto,
  buildRecoverySummaryDto
} from "../../core/observable/observable-read-models.js";
import { planRecovery } from "../../core/recovery/recovery-planner.js";
import { DEFAULT_FRESHNESS_CONFIG } from "../../core/runtime/src/freshness.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

const fixedNow = new Date("2026-05-07T18:27:14.000Z");

function coldReport() {
  runtimeEngine.clearPersistenceAndReset();
  return runtimeEngine.getCoreTrustReport({ test: "wave10b-observable-summaries" });
}

function observableSummariesAreDeterministic() {
  const report = coldReport();
  const recoveryPlan = planRecovery({ coreTrustReport: report });
  const quarantineSummary = { count: 2, hasItems: true, reasons: ["invalid_event", "bad_metadata"] };
  const input = {
    coreTrustReport: report,
    gateVerdict: report.actions.place_order,
    recoveryPlan,
    quarantineSummary
  };

  const first = buildObservableSummariesDto(input);
  const second = buildObservableSummariesDto(input);

  assert.deepEqual(second, first, "same Core state must produce same DTO summaries");
  assert.equal(first.dtoVersion, "observable-dto-summaries-v0.1");
  assert.equal(first.trust.revision, report.revision);
  assert.equal(first.quarantine?.hasItems, true);
}

function denyReasonsArePreservedInUiSafeDto() {
  const report = coldReport();
  const summaries = buildObservableSummariesDto({
    coreTrustReport: report,
    gateVerdict: report.actions.place_order,
    recoveryPlan: planRecovery({ coreTrustReport: report })
  });

  const verdict = summaries.actionGateVerdict;
  assert.ok(verdict, "verdict summary exists");
  assert.equal(verdict.allowed, false);
  assert.deepEqual(
    verdict.blockingReasonCodes,
    [...report.actions.place_order.blockingReasons].sort(),
    "ActionGate blocking reason codes must be preserved for UI"
  );
  assert.ok(verdict.explanations.every((explanation) => explanation.uiSafe));
  assert.ok(verdict.deterministicExplanation.includes("deny"));
}

function recoveryHintsAreDeterministicAndObservableOnly() {
  const report = coldReport();
  const first = buildRecoverySummaryDto(planRecovery({ coreTrustReport: report }));
  const second = buildRecoverySummaryDto(planRecovery({ coreTrustReport: report }));

  assert.deepEqual(second, first, "same recovery input must produce same recovery summary");
  assert.ok(first?.nextActions.length, "recovery hints must be observable");
  assert.ok(first?.forbiddenActions.includes("BYPASS_ACTION_GATE"), "summary must preserve forbidden bypass semantics");
}

function marketAndProvenanceSummariesAreVisible() {
  runtimeEngine.clearPersistenceAndReset();
  const snapshot = runtimeEngine.getSnapshot();
  const gate = new ActionGate();

  const provenance = buildProvenanceHealthReport({
    status: "missing",
    blockingReasons: [PROVENANCE_BLOCKING_REASON.MISSING],
    checkedAt: fixedNow,
    traceId: "trace-provenance-missing"
  });
  const marketInput = buildMarketInputIntegrityReport({
    status: "stale",
    blockingReasons: [MARKET_INPUT_BLOCKING_REASON.STALE],
    source: "mock",
    provider: "wave10b-test",
    eventId: "market-input-event-1",
    sequence: 7,
    provenanceId: "prov-market-1",
    checkedAt: fixedNow
  });

  const verdict = gate.evaluate({ type: ACTION_TYPE.PLACE_ORDER }, snapshot, {
    enforceFreshness: true,
    now: fixedNow,
    freshness: runtimeEngine.getFreshness(fixedNow),
    freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
    integrity: runtimeEngine.getIntegrityReport(fixedNow),
    causality: runtimeEngine.getCausalityReport(undefined, undefined, undefined),
    provenance,
    marketInput
  });

  const summary = buildActionGateVerdictSummaryDto(verdict);

  assert.ok(summary, "verdict summary exists");
  assert.equal(summary.marketInputStatus, "stale");
  assert.equal(summary.provenanceStatus, "missing");
  assert.ok(summary.blockingReasonCodes.includes("provenance_missing"));
  assert.ok(summary.blockingReasonCodes.includes("MARKET_INPUT_STALE"));
  assert.ok(summary.explanations.every((explanation) => explanation.uiSafe));
}

function dtoSummaryDoesNotMutateSnapshot() {
  const report = coldReport();
  const before = JSON.stringify(runtimeEngine.getSnapshot());
  buildObservableSummariesDto({
    coreTrustReport: report,
    gateVerdict: report.actions.place_order,
    recoveryPlan: planRecovery({ coreTrustReport: report }),
    quarantineSummary: { count: 1, hasItems: true, reasons: ["invalid_event"] }
  });
  const after = JSON.stringify(runtimeEngine.getSnapshot());
  assert.equal(after, before, "observable DTO summary must not mutate runtime snapshot");
}

observableSummariesAreDeterministic();
denyReasonsArePreservedInUiSafeDto();
recoveryHintsAreDeterministicAndObservableOnly();
marketAndProvenanceSummariesAreVisible();
dtoSummaryDoesNotMutateSnapshot();

console.log("wave10b observable summaries scenarios passed");
