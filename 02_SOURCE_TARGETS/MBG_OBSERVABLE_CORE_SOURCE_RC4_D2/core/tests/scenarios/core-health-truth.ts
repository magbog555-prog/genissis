import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-health-truth-${process.pid}-${Date.now()}`);
process.env.GENESIS_DATA_DIR = dataDir;
process.env.PERSISTENCE_ENABLED = "true";
process.env.MBG_HEALTH_CONNECTION_STATUS_TTL_MS = "1000";

const { RuntimeEngine } = await import("../../core/runtime/src/runtime-engine.js");
const { EVENT_TYPE } = await import("../../core/contracts/src/events.js");

function makeHealthEvent(eventId: string, status: "connected" | "disconnected" | "unknown", timestamp = new Date().toISOString()) {
  return {
    eventId,
    eventType: EVENT_TYPE.SYSTEM_HEALTH_CHANGED,
    timestamp,
    source: "health-truth-test",
    payload: {
      connection: "websocket",
      status,
      source: "health-truth-test"
    }
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const engine = new RuntimeEngine();
engine.clearPersistenceAndReset();

const coldHealth = engine.getHealthSnapshot();
assert.equal(coldHealth.wsConnected, "unknown");
assert.notEqual(coldHealth.wsConnected, true);
assert.equal(coldHealth.healthTruthComplete, false);
assert.ok(coldHealth.healthTruthDiagnostics.includes("connection_state_unknown"));
assert.ok(coldHealth.healthTruthDiagnostics.includes("ws_status_unknown"));
assert.ok(coldHealth.healthTruthDiagnostics.includes("health_truth_partial"));
assert.equal(coldHealth.wsReconnects, "unknown");

const connected = engine.commitEventResult(makeHealthEvent("health-ws-connected-1", "connected"));
assert.equal(connected.status, "accepted");
const connectedHealth = engine.getHealthSnapshot();
assert.equal(connectedHealth.wsConnected, true);
assert.equal(connectedHealth.connections.websocket.status, true);
assert.equal(connectedHealth.connections.websocket.sourceEventId, "health-ws-connected-1");
assert.ok(!connectedHealth.healthTruthDiagnostics.includes("ws_status_unknown"));

const disconnected = engine.commitEventResult(makeHealthEvent("health-ws-disconnected-1", "disconnected"));
assert.equal(disconnected.status, "accepted");
const disconnectedHealth = engine.getHealthSnapshot();
assert.equal(disconnectedHealth.wsConnected, false);
assert.equal(disconnectedHealth.connections.websocket.status, false);
assert.equal(disconnectedHealth.connections.websocket.sourceEventId, "health-ws-disconnected-1");

const beforeStale = clone(engine.getSnapshot());
const staleEvent = makeHealthEvent("health-ws-stale-1", "connected", "2026-05-06T00:00:00.000Z");
const staleCommit = engine.commitEventResult(staleEvent);
assert.equal(staleCommit.status, "accepted");
const staleHealth = engine.getHealthSnapshot();
assert.equal(staleHealth.wsConnected, "stale");
assert.equal(staleHealth.connections.websocket.status, "stale");
assert.equal(staleHealth.connections.websocket.reason, "connection_state_stale");
assert.ok(staleHealth.healthTruthDiagnostics.includes("connection_state_stale"));
assert.ok(staleHealth.healthTruthDiagnostics.includes("health_truth_partial"));
assert.ok(engine.getSnapshot().revision > beforeStale.revision);

const source = fs.readFileSync("core/runtime/src/runtime-engine.ts", "utf8");
assert.ok(!source.includes("wsConnected: true, // TODO"));
assert.ok(!source.includes("wsReconnects: 0"));

const { createApp } = await import("../../apps/runtime-api/src/app.js");
const app = createApp();
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = (address as { port: number }).port;
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  const body: any = await response.json();
  assert.equal(body.service, "mbg-core-runtime-api");
  assert.equal(body.health.wsConnected, "unknown");
  assert.notEqual(body.health.wsConnected, true);
  assert.equal(body.health.healthTruthComplete, false);
  assert.ok(body.health.healthTruthDiagnostics.includes("ws_status_unknown"));
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}

fs.rmSync(dataDir, { recursive: true, force: true });

console.log(JSON.stringify({
  name: "core_health_truth",
  ok: true,
  cold: {
    wsConnected: coldHealth.wsConnected,
    healthTruthComplete: coldHealth.healthTruthComplete,
    diagnostics: coldHealth.healthTruthDiagnostics
  },
  connected: {
    wsConnected: connectedHealth.wsConnected,
    sourceEventId: connectedHealth.connections.websocket.sourceEventId
  },
  disconnected: {
    wsConnected: disconnectedHealth.wsConnected,
    sourceEventId: disconnectedHealth.connections.websocket.sourceEventId
  },
  stale: {
    wsConnected: staleHealth.wsConnected,
    diagnostics: staleHealth.healthTruthDiagnostics
  }
}, null, 2));
