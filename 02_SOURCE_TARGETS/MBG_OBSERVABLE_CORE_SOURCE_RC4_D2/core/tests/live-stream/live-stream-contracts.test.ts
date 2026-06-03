
import assert from "node:assert/strict";
import { createConnectedReadOnlyCoreApiApp } from "../../core/ui-api/connected-readonly-core-api.js";
import {
  LiveReadOnlyMarketStream,
  normalizeBinancePublicEvent,
  readLiveStreamConfig
} from "../../core/live-stream/live-market-stream.js";

async function request(app: ReturnType<typeof createConnectedReadOnlyCoreApiApp>, path: string, method = "GET") {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const res = await fetch(`http://127.0.0.1:${address.port}${path}`, { method });
  const text = await res.text();
  server.close();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

function assertNoProofNoAllow(dto: any) {
  assert.equal(dto.executionSurface, "closed");
  assert.equal(dto.actionVerdict, "prohibited");
  assert.equal(dto.trustState, "UNCERTAIN");
  assert.equal(dto.exchangeProofValid, false);
  assert.notEqual(dto.exchangeProofStatus, "verified");
}

{
  const config = readLiveStreamConfig({
    LIVE_STREAM_ENABLED: "false",
    LIVE_STREAM_SYMBOL: "BTCUSDT",
    LIVE_STREAM_URL: "wss://stream.binance.com:9443/ws/btcusdt@trade"
  } as NodeJS.ProcessEnv);
  const stream = new LiveReadOnlyMarketStream(config);
  await stream.start();
  const status = stream.getStatus();
  assert.equal(status.dto, "LiveMarketStreamDTO");
  assert.equal(status.connectionStatus, "disconnected");
  assert.equal(status.liveExchangeConnected, false);
  assert.equal(status.exchangeProofStatus, "missing");
  assertNoProofNoAllow(status);
}

{
  const event = normalizeBinancePublicEvent({
    e: "trade",
    E: 1672515782136,
    s: "BTCUSDT",
    p: "16800.01",
    q: "0.001",
    T: 1672515782136
  });
  assert(event);
  assert.equal(event.dto, "LiveMarketStreamEventDTO");
  assert.equal(event.rawSummary.present, true);
  assert.equal(event.rawSummary.omittedForUiSafety, true);
  assert(!("raw" in event));
}

{
  const stream = new LiveReadOnlyMarketStream(readLiveStreamConfig({
    LIVE_STREAM_ENABLED: "false",
    LIVE_STREAM_SYMBOL: "BTCUSDT",
    LIVE_STREAM_URL: "wss://stream.binance.com:9443/ws/btcusdt@trade"
  } as NodeJS.ProcessEnv));
  const event = stream.ingestRawEvent({
    e: "trade",
    E: Date.now(),
    s: "BTCUSDT",
    p: "100",
    q: "0.01"
  });
  assert(event);
  const status = stream.getStatus();
  assert.equal(status.marketFreshnessStatus, "fresh");
  assert.equal(status.exchangeProofStatus, "pending");
  assertNoProofNoAllow(status);
}

{
  const app = createConnectedReadOnlyCoreApiApp();
  const status = await request(app, "/api/core/live-stream/status");
  assert.equal(status.status, 200);
  assert.equal(status.body.dto, "LiveMarketStreamDTO");
  assertNoProofNoAllow(status.body);

  const health = await request(app, "/api/core/live-stream/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.readOnly, true);
  assert.equal(health.body.executionSurface, "closed");

  const lastEvent = await request(app, "/api/core/live-stream/last-event");
  assert.equal(lastEvent.status, 200);
  assert.equal(lastEvent.body.dto, "LiveMarketStreamEventDTO");
  assert(!("raw" in lastEvent.body));

  const overview = await request(app, "/api/core/overview");
  assert.equal(overview.status, 200);
  assert.equal(overview.body.dto, "CoreOverviewDTO");
  assert.equal(overview.body.executionSurface, "closed");
  assert.equal(overview.body.operatorRule, "NO_PROOF_NO_ALLOW");
  assert(Array.isArray(overview.body.blocks));
  assert(overview.body.blocks.some((block: any) => block.id === "liveStream"));

  const livePost = await request(app, "/api/core/live-stream/status", "POST");
  assert(livePost.status === 404 || livePost.status === 405);
}

console.log("RC4 live read-only contracts: PASS");
