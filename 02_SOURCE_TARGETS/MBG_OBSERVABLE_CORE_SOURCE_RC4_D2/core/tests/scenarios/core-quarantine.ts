import assert from "node:assert/strict";
import { RuntimeEngine } from "../../core/runtime/src/runtime-engine.js";
import { EVENT_TYPE, type DomainEvent } from "../../core/contracts/src/events.js";

function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: "evt-" + crypto.randomUUID(),
    eventType: EVENT_TYPE.MARKET_TICK_RECEIVED,
    timestamp: new Date().toISOString(),
    source: "test",
    payload: {
      symbol: "BTCUSDT",
      price: 100,
      bid: 99,
      ask: 101,
      volume: 1,
      provider: "test"
    },
    ...overrides
  } as DomainEvent;
}

function resetEngine() {
  const engine = new RuntimeEngine();
  engine.clearPersistenceAndReset();
  return engine;
}

function assertNoMutation(engine: RuntimeEngine, beforeRevision: number, beforeJournalCount: number) {
  assert.equal(engine.getSnapshot().revision, beforeRevision, "quarantined event must not mutate snapshot revision");
  assert.equal(engine.getPersistenceView().replayCheck.eventCount, beforeJournalCount, "quarantined event must not enter canonical journal/replay event count");
}

{
  const engine = resetEngine();
  const beforeRevision = engine.getSnapshot().revision;
  const beforeJournalCount = engine.getPersistenceView().replayCheck.eventCount;
  const invalid = event({ payload: { symbol: "BTCUSDT", price: -1, bid: 99, ask: 101, volume: 1, provider: "test" } as any });

  const result = engine.commitEventResult(invalid, { log: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, "rejected");
  assertNoMutation(engine, beforeRevision, beforeJournalCount);

  const quarantine = engine.getQuarantineView();
  assert.equal(quarantine.count, 1, "invalid event creates quarantine record");
  assert.equal(quarantine.records[0].source, "schema_violation");
  assert.equal(quarantine.records[0].eventId, invalid.eventId);
  assert.equal(quarantine.records[0].eventType, EVENT_TYPE.MARKET_TICK_RECEIVED);
  assert.ok(quarantine.records[0].payloadHash);
}

{
  const engine = resetEngine();
  const beforeRevision = engine.getSnapshot().revision;
  const beforeJournalCount = engine.getPersistenceView().replayCheck.eventCount;
  const unknown = event({ eventType: "unknown.event.type" as any });

  const result = engine.commitEventResult(unknown, { log: false });
  assert.equal(result.ok, false);
  assertNoMutation(engine, beforeRevision, beforeJournalCount);

  const quarantine = engine.getQuarantineView();
  assert.equal(quarantine.count, 1, "unknown event type quarantined");
  assert.equal(quarantine.records[0].source, "unknown_event_type");
  assert.equal(quarantine.records[0].eventType, "unknown.event.type");
}

{
  const engine = resetEngine();
  const accepted = event({ eventId: "duplicate-conflict-event" });
  const first = engine.commitEventResult(accepted, { log: false });
  assert.equal(first.status, "accepted");

  const beforeRevision = engine.getSnapshot().revision;
  const beforeJournalCount = engine.getPersistenceView().replayCheck.eventCount;

  const conflict = event({
    eventId: "duplicate-conflict-event",
    timestamp: accepted.timestamp,
    payload: {
      symbol: "BTCUSDT",
      price: 101,
      bid: 100,
      ask: 102,
      volume: 1,
      provider: "test"
    } as any
  });

  const result = engine.commitEventResult(conflict, { log: false });
  assert.equal(result.ok, false);
  assert.equal(result.status, "duplicate_conflict");
  assertNoMutation(engine, beforeRevision, beforeJournalCount);

  const quarantine = engine.getQuarantineView();
  assert.equal(quarantine.count, 1, "idempotency conflict quarantined");
  assert.equal(quarantine.records[0].source, "idempotency_conflict");
  assert.equal(quarantine.records[0].recoverable, true);
  assert.equal(engine.getIdempotencyView().conflictCount, 1);
}

{
  const engine = resetEngine();
  const bad = event({ payload: { symbol: "BTCUSDT", price: -10, bid: 99, ask: 101, volume: 1, provider: "test" } as any });
  const replayBefore = engine.replayCheck();
  engine.commitEventResult(bad, { log: false });
  const replayAfter = engine.replayCheck();

  const report = engine.getCoreTrustReport();
  const metadata = report.metadata as Record<string, unknown>;
  const quarantine = metadata.quarantine as { count: number };
  assert.equal(quarantine.count, 1, "quarantine count available to CoreTrustReport metadata");
  assert.equal(replayAfter.eventCount, replayBefore.eventCount, "quarantine does not add replay events");
  assert.equal(replayAfter.currentRevision, replayBefore.currentRevision, "quarantine does not change replay revision");
  assert.equal(replayAfter.eventCount, engine.getSnapshot().revision, "quarantine records are outside replay event count");
}

console.log("core quarantine checks passed");
