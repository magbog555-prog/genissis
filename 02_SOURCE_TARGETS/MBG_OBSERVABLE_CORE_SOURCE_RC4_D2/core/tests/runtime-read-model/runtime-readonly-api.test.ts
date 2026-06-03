import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { createConnectedReadOnlyCoreApiApp } from "../../core/ui-api/connected-readonly-core-api.js";

const app = createConnectedReadOnlyCoreApiApp();
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("No test server address");
const baseUrl = `http://127.0.0.1:${address.port}`;

async function get(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  assert.equal(res.status, 200, `${path} should be 200`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function postClosed(path: string) {
  const res = await fetch(`${baseUrl}${path}`, { method: "POST" });
  assert.notEqual(res.status, 200, `${path} must not return 200`);
  assert.ok([404, 405].includes(res.status), `${path} should be 404/405, got ${res.status}`);
}

try {
  const snapshot = await get("/api/core/runtime/snapshot");
  assert.equal((snapshot.meta as Record<string, unknown>).source, "runtime");
  assert.equal((snapshot.meta as Record<string, unknown>).readOnly, true);
  assert.ok(snapshot.trust);
  assert.ok(snapshot.verdict);
  assert.ok(snapshot.kernelAuthority);
  assert.ok(snapshot.actionGate);
  assert.ok(!("raw" in snapshot), "UI-facing snapshot must not expose circular raw");
  assert.ok(snapshot.rawSummary, "UI-facing snapshot should expose rawSummary");

  await get("/api/core/runtime/status");
  await get("/api/core/runtime/trust");
  await get("/api/core/runtime/integrity");
  await get("/api/core/runtime/causality-trace");
  await get("/api/core/runtime/permission-ledger");

  await postClosed("/api/core/runtime/snapshot");
  await postClosed("/execution/testnet/place-guarded");
  await postClosed("/order");

  console.log("runtime-readonly-api: PASS");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
