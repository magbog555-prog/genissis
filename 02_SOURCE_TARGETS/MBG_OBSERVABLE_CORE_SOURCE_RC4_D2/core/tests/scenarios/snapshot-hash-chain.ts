import assert from "node:assert/strict";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";
import { initialSnapshot, type RuntimeSnapshot } from "../../core/state/src/types.js";
import {
  buildHashChainLink,
  buildHashStatusReport,
  canonicalStringify,
  hashDomainEvent,
  hashSnapshot,
  hashTransition,
  verifyHashChainLink,
  verifyRevisionContinuity
} from "../../core/integrity/snapshot-hash-chain.js";

function event(eventId: string, payload: unknown = { value: 1 }): DomainEvent {
  return {
    eventId,
    eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
    timestamp: "2026-01-01T00:00:00.000Z",
    source: "snapshot-hash-chain-test",
    schemaVersion: "1",
    payload
  };
}

function snapshot(revision = 0): RuntimeSnapshot {
  const state = initialSnapshot();
  state.revision = revision;
  state.committedAt = "2026-01-01T00:00:00.000Z";
  state.market.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.trade.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.order.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.position.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.risk.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.system.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.system.startedAt = "2026-01-01T00:00:00.000Z";
  state.bootstrap.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.exchangeTruth.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.provenance.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  state.marketInput.meta.updatedAt = "2026-01-01T00:00:00.000Z";
  return state;
}

function assertDifferent(left: string, right: string, message: string) {
  assert.notEqual(left, right, message);
}

const canonicalA = canonicalStringify({ b: 2, a: { d: 4, c: 3 } });
const canonicalB = canonicalStringify({ a: { c: 3, d: 4 }, b: 2 });
assert.equal(canonicalA, canonicalB, "canonical stringify must sort object keys deterministically");

const sameSnapshotA = snapshot(1);
const sameSnapshotB = snapshot(1);
assert.equal(hashSnapshot(sameSnapshotA), hashSnapshot(sameSnapshotB), "same snapshot -> same snapshotHash");

const changedSnapshot = snapshot(1);
changedSnapshot.position.status = "flat";
assertDifferent(hashSnapshot(sameSnapshotA), hashSnapshot(changedSnapshot), "changed snapshot -> different snapshotHash");

const sameEventA = event("evt-1", { symbol: "BTCUSDT", price: 100 });
const sameEventB = event("evt-1", { price: 100, symbol: "BTCUSDT" });
assert.equal(hashDomainEvent(sameEventA), hashDomainEvent(sameEventB), "same event -> same eventHash");

const changedEvent = event("evt-1", { symbol: "BTCUSDT", price: 101 });
assertDifferent(hashDomainEvent(sameEventA), hashDomainEvent(changedEvent), "changed event -> different eventHash");

const beforeHash = hashSnapshot(snapshot(1));
const eventHash = hashDomainEvent(sameEventA);
const afterHash = hashSnapshot(snapshot(2));
const transitionHash = hashTransition({
  revision: 2,
  beforeSnapshotHash: beforeHash,
  eventHash,
  afterSnapshotHash: afterHash
});

assertDifferent(
  transitionHash,
  hashTransition({
    revision: 2,
    beforeSnapshotHash: `changed-${beforeHash}`,
    eventHash,
    afterSnapshotHash: afterHash
  }),
  "transitionHash changes if before changes"
);

assertDifferent(
  transitionHash,
  hashTransition({
    revision: 2,
    beforeSnapshotHash: beforeHash,
    eventHash: `changed-${eventHash}`,
    afterSnapshotHash: afterHash
  }),
  "transitionHash changes if event changes"
);

assertDifferent(
  transitionHash,
  hashTransition({
    revision: 2,
    beforeSnapshotHash: beforeHash,
    eventHash,
    afterSnapshotHash: `changed-${afterHash}`
  }),
  "transitionHash changes if after changes"
);

const previousLink = buildHashChainLink({
  previousSnapshotHash: hashSnapshot(snapshot(0)),
  snapshot: snapshot(1),
  event: event("evt-prev"),
  builtAt: "2026-01-01T00:00:01.000Z"
});

const currentLink = buildHashChainLink({
  previousSnapshotHash: previousLink.snapshotHash,
  snapshot: snapshot(2),
  event: event("evt-current"),
  builtAt: "2026-01-01T00:00:02.000Z"
});

assert.equal(verifyRevisionContinuity(previousLink, currentLink).status, "valid", "contiguous revisions pass");

const gapLink = buildHashChainLink({
  previousSnapshotHash: currentLink.snapshotHash,
  snapshot: snapshot(4),
  event: event("evt-gap"),
  builtAt: "2026-01-01T00:00:04.000Z"
});
assert.equal(verifyRevisionContinuity(currentLink, gapLink).status, "discontinuity", "revision gap fails");

assert.equal(
  verifyHashChainLink({
    link: currentLink,
    event: event("evt-current"),
    previousSnapshotHash: previousLink.snapshotHash,
    snapshot: snapshot(2)
  }).status,
  "valid",
  "valid link verifies"
);

const brokenLink = {
  ...currentLink,
  snapshotHash: "tampered-snapshot-hash"
};
const brokenReport = verifyHashChainLink({
  link: brokenLink,
  event: event("evt-current"),
  previousSnapshotHash: previousLink.snapshotHash,
  snapshot: snapshot(2)
});
assert.equal(brokenReport.ok, false, "hash mismatch fails verification");
assert.equal(brokenReport.status, "tampered", "hash mismatch returns tampered");

const legacyLink = {
  ...currentLink,
  snapshotHash: undefined,
  transitionHash: undefined
};
const legacyReport = verifyHashChainLink({ link: legacyLink });
assert.equal(legacyReport.status, "unknown", "unknown legacy hash does not mark corruption");
assert.equal(legacyReport.ok, true, "unknown legacy hash is not a corruption signal");

const reportA = buildHashStatusReport({
  link: currentLink,
  previousLink,
  event: event("evt-current"),
  previousSnapshotHash: previousLink.snapshotHash,
  snapshot: snapshot(2)
});

const reportB = buildHashStatusReport({
  link: currentLink,
  previousLink,
  event: event("evt-current"),
  previousSnapshotHash: previousLink.snapshotHash,
  snapshot: snapshot(2)
});

assert.deepEqual(reportA, reportB, "hash report is deterministic");
assert.equal(reportA.status, "valid", "valid report is valid");

console.log("Snapshot Hash Chain scenarios passed");
