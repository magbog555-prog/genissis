import assert from "node:assert/strict";
import { ACTION_TYPE, type GateDecision } from "../../core/contracts/src/actions.js";
import { PermissionLedger, createPermissionRecord } from "../../core/permissions/permission-ledger.js";
import { runtimeEngine } from "../../core/runtime/src/runtime-engine.js";

function reset() {
  runtimeEngine.clearPersistenceAndReset();
}

function placeOrderDenied() {
  return runtimeEngine.evaluateAction({
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000
  });
}

function diagnosticVerdict(): GateDecision {
  return {
    action: {
      actionId: "diagnostic:runtime-status",
      actionType: ACTION_TYPE.RECONCILE_POSITION,
      request: {
        type: ACTION_TYPE.RECONCILE_POSITION
      }
    },
    allowed: true,
    actionClass: "DIAGNOSTIC",
    severity: "info",
    snapshotRevision: runtimeEngine.getSnapshot().revision,
    kernelTrustState: "UNCERTAIN",
    blockingReasons: [],
    allowedAlternatives: [],
    relatedInvariants: [],
    gateVersion: "action-gate-v2",
    actionId: "diagnostic:runtime-status",
    actionType: ACTION_TYPE.RECONCILE_POSITION,
    decision: "allow"
  };
}

function testDeniedPlaceOrderCreatesLedgerRecord() {
  reset();
  const ledger = new PermissionLedger();
  const verdict = placeOrderDenied();

  assert.equal(verdict.allowed, false);
  const record = ledger.record(verdict, {
    requestedBy: "permission-ledger-test",
    decidedAt: "2026-05-07T00:00:00.000Z"
  });

  assert.equal(ledger.count(), 1);
  assert.equal(record.action.actionType, ACTION_TYPE.PLACE_ORDER);
  assert.equal(record.allowed, false);
  assert.equal(record.requestedBy, "permission-ledger-test");
  assert.equal(record.gateVersion, "action-gate-v2");
}

function testAllowedDiagnosticActionCreatesLedgerRecord() {
  reset();
  const ledger = new PermissionLedger();
  const verdict = diagnosticVerdict();

  const record = ledger.record(verdict, {
    requestedBy: "diagnostic-probe",
    decidedAt: "2026-05-07T00:00:01.000Z"
  });

  assert.equal(record.allowed, true);
  assert.equal(record.actionClass, "DIAGNOSTIC");
  assert.equal(record.kernelTrustState, "UNCERTAIN");
  assert.equal(record.blockingReasons.length, 0);
  assert.equal(record.requestedBy, "diagnostic-probe");
}

function testLedgerRecordIncludesSnapshotRevisionTrustStateAndBlockingReasons() {
  reset();
  const ledger = new PermissionLedger();
  const verdict = placeOrderDenied();
  const record = ledger.record(verdict, {
    requestedBy: "permission-ledger-test",
    decidedAt: "2026-05-07T00:00:02.000Z"
  });

  assert.equal(record.snapshotRevision, verdict.snapshotRevision);
  assert.equal(record.snapshotRevision, runtimeEngine.getSnapshot().revision);
  assert.equal(record.kernelTrustState, verdict.kernelTrustState);
  assert.ok(record.blockingReasons.includes("bootstrap_not_reconciled"));
  assert.ok(record.blockingReasons.includes("exchange_truth_unknown"));
  assert.ok(record.allowedAlternatives.includes(ACTION_TYPE.RECONCILE_POSITION));
  assert.match(record.permissionId, /^permission:[a-f0-9]{16}$/);
  assert.match(record.decisionHash, /^[a-f0-9]{64}$/);
}

function testLedgerDoesNotMutateSnapshot() {
  reset();
  const ledger = new PermissionLedger();
  const verdict = placeOrderDenied();
  const before = JSON.stringify(runtimeEngine.getSnapshot());

  ledger.record(verdict, {
    requestedBy: "permission-ledger-test",
    decidedAt: "2026-05-07T00:00:03.000Z"
  });

  const after = JSON.stringify(runtimeEngine.getSnapshot());
  assert.equal(after, before);
}

function testLedgerExportsLastNRecords() {
  reset();
  const ledger = new PermissionLedger();

  for (let i = 0; i < 5; i += 1) {
    const record = createPermissionRecord(diagnosticVerdict(), {
      requestedBy: `diagnostic-${i}`,
      decidedAt: `2026-05-07T00:00:0${i}.000Z`
    });
    ledger.record({
      ...diagnosticVerdict(),
      action: {
        ...diagnosticVerdict().action,
        actionId: `diagnostic:${i}`
      },
      actionId: `diagnostic:${i}`
    }, {
      requestedBy: record.requestedBy,
      decidedAt: record.decidedAt
    });
  }

  const lastTwo = ledger.last(2);
  assert.equal(lastTwo.length, 2);
  assert.equal(lastTwo[0].requestedBy, "diagnostic-3");
  assert.equal(lastTwo[1].requestedBy, "diagnostic-4");

  lastTwo[0].blockingReasons.push("mutated-copy");
  assert.equal(ledger.last(2)[0].blockingReasons.includes("mutated-copy"), false);
}

testDeniedPlaceOrderCreatesLedgerRecord();
testAllowedDiagnosticActionCreatesLedgerRecord();
testLedgerRecordIncludesSnapshotRevisionTrustStateAndBlockingReasons();
testLedgerDoesNotMutateSnapshot();
testLedgerExportsLastNRecords();

console.log(JSON.stringify({
  name: "core_permission_ledger",
  ok: true,
  recordsAudited: 9
}, null, 2));
