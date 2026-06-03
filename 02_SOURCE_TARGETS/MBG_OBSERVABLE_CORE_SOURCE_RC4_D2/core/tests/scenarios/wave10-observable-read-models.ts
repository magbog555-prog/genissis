import assert from "node:assert/strict";
import { ACTION_TYPE } from "../../core/contracts/src/actions.js";
import { ActionGate } from "../../core/gates/src/action-gate.js";
import { buildMarketInputIntegrityReport, buildProvenanceHealthReport } from "../../core/integrity/integrity-report.js";
import {
  buildObservableActionGateVerdict,
  buildObservableCoreReadModel,
  buildObservableRecoveryPlan,
  buildObservableTrustReport
} from "../../core/observable/observable-read-models.js";
import { planRecovery } from "../../core/recovery/recovery-planner.js";
import { DEFAULT_FRESHNESS_CONFIG } from "../../core/runtime/src/freshness.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

const fixedNow = new Date("2026-05-07T18:27:14.000Z");

function coldRuntimeReadModelIsDeterministic() {
  runtimeEngine.clearPersistenceAndReset();

  const report = runtimeEngine.getCoreTrustReport({ test: "wave10-observable-read-models" });
  const recoveryPlan = planRecovery({ coreTrustReport: report });
  const verdict = report.actions.place_order;

  const first = buildObservableCoreReadModel({
    coreTrustReport: report,
    gateVerdict: verdict,
    recoveryPlan,
    quarantineSummary: { count: 0, hasItems: false, reasons: [] }
  });
  const second = buildObservableCoreReadModel({
    coreTrustReport: report,
    gateVerdict: verdict,
    recoveryPlan,
    quarantineSummary: { count: 0, hasItems: false, reasons: [] }
  });

  assert.deepEqual(second, first, "same Core report/verdict must produce the same observable read model");
  assert.equal(first.modelVersion, "observable-read-models-v0.1");
  assert.equal(first.gateVerdict?.gateVersion, "action-gate-v2");
  assert.equal(first.machine.revision, report.revision);
}

function denyReasonsArePreservedForUi() {
  runtimeEngine.clearPersistenceAndReset();

  const report = runtimeEngine.getCoreTrustReport({ test: "wave10-deny-reasons" });
  const verdict = report.actions.place_order;
  const observable = buildObservableActionGateVerdict(verdict);

  assert.ok(observable, "observable verdict exists");
  assert.equal(observable.allowed, false);
  assert.deepEqual(
    observable.blockingReasons.map((reason) => reason.code).sort(),
    [...verdict.blockingReasons].sort(),
    "UI-safe verdict must preserve ActionGate blocking reason codes"
  );
  assert.ok(observable.deterministicExplanation.includes("deny"));
  assert.ok(observable.deterministicExplanation.includes(String(verdict.snapshotRevision)));
}

function recoveryHintsAreDeterministicAndObservableOnly() {
  runtimeEngine.clearPersistenceAndReset();

  const report = runtimeEngine.getCoreTrustReport({ test: "wave10-recovery-hints" });
  const firstPlan = planRecovery({ coreTrustReport: report });
  const secondPlan = planRecovery({ coreTrustReport: report });

  const first = buildObservableRecoveryPlan(firstPlan);
  const second = buildObservableRecoveryPlan(secondPlan);

  assert.deepEqual(second, first, "same recovery input must produce same observable recovery hints");
  assert.ok(first?.nextActions.every((hint) => hint.safeToDisplay), "recovery hints must be display-safe");
  assert.ok(first?.nextActions.every((hint) => hint.detail.includes("ActionGate")), "hints must not imply UI-side execution");
}

function observableTrustReportExposesIntegrityAndEvidence() {
  runtimeEngine.clearPersistenceAndReset();

  const report = runtimeEngine.getCoreTrustReport({ test: "wave10-trust-report" });
  const observable = buildObservableTrustReport(report);

  assert.equal(observable.revision, report.revision);
  assert.equal(observable.trustState, report.trustState);
  assert.equal(observable.integrity?.status, report.integrity?.status);
  assert.equal(observable.provenance?.status, report.provenanceStatus);
  assert.equal(observable.marketInput?.status, report.marketInputStatus);
}

function sameStateSameObservableVerdictWithExplicitGateInputs() {
  runtimeEngine.clearPersistenceAndReset();

  const snapshot = runtimeEngine.getSnapshot();
  const gate = new ActionGate();
  const provenance = buildProvenanceHealthReport({
    status: "missing",
    checkedAt: fixedNow
  });
  const marketInput = buildMarketInputIntegrityReport({
    status: "unknown",
    checkedAt: fixedNow
  });
  const options = {
    enforceFreshness: true,
    now: fixedNow,
    freshness: runtimeEngine.getFreshness(fixedNow),
    freshnessConfig: DEFAULT_FRESHNESS_CONFIG,
    integrity: runtimeEngine.getIntegrityReport(fixedNow),
    causality: runtimeEngine.getCausalityReport(undefined, undefined, undefined),
    provenance,
    marketInput
  };

  const first = buildObservableActionGateVerdict(gate.evaluate({ type: ACTION_TYPE.PLACE_ORDER }, snapshot, options));
  const second = buildObservableActionGateVerdict(gate.evaluate({ type: ACTION_TYPE.PLACE_ORDER }, snapshot, options));

  assert.deepEqual(second, first, "same state and same gate evidence must produce same observable verdict");
  assert.ok(first?.blockingReasons.some((reason) => reason.code === "provenance_missing"));
  assert.ok(first?.blockingReasons.some((reason) => reason.code === "MARKET_INPUT_UNKNOWN"));
}

coldRuntimeReadModelIsDeterministic();
denyReasonsArePreservedForUi();
recoveryHintsAreDeterministicAndObservableOnly();
observableTrustReportExposesIntegrityAndEvidence();
sameStateSameObservableVerdictWithExplicitGateInputs();

console.log("wave10 observable read models scenarios passed");
