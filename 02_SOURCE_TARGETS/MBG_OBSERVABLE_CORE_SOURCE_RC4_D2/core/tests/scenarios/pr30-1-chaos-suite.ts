
import { createApp } from "../../apps/runtime-api/src/app.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function post(base: string, path: string) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function get(base: string, path: string) {
  const res = await fetch(`${base}${path}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  delete process.env.PR30_1_REAL_CHAOS_ACK;
  process.env.TESTNET_EXECUTION_DRY_RUN = "true";
  process.env.EXCHANGE_MODE = process.env.EXCHANGE_MODE ?? "mock";

  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed_to_bind_test_server");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const manifest = await get(base, "/tests/chaos/pr30-1");
    assert(manifest.status === 200 && manifest.body.ok === true, "manifest must be ok");

    const realBlocked = await post(base, "/tests/chaos/real-market-fill");
    assert(realBlocked.status === 409, "real market fill must be blocked without explicit chaos ACK");
    assert(realBlocked.body.blocked === true, "blocked response must be explicit");

    const duplicate = await post(base, "/tests/chaos/duplicate-fill-injection");
    assert(duplicate.status === 200 && duplicate.body.ok === true, "duplicate fill injection must fail closed");
    assert(["halted_on_duplicate_fill_drift", "idempotent_duplicate_ignored"].includes(duplicate.body.decision), "duplicate fill decision missing");

    const outOfOrder = await post(base, "/tests/chaos/out-of-order-events");
    assert(outOfOrder.status === 200 && outOfOrder.body.ok === true, "out-of-order test must fail closed or handle correctly");

    const partialCancelFill = await post(base, "/tests/chaos/partial-cancel-fill");
    assert(partialCancelFill.status === 200 && partialCancelFill.body.ok === true, "partial-cancel-fill must resolve filled or halt");

    const lag = await post(base, "/tests/chaos/exchange-lag-simulation?delayMs=500");
    assert(lag.status === 200 && lag.body.ok === true, "exchange lag simulation must halt on mismatch");

    const snapshotSplit = await post(base, "/tests/chaos/snapshot-split");
    assert(snapshotSplit.status === 200 && snapshotSplit.body.ok === true, "snapshot split must halt");

    const journalDrop = await post(base, "/tests/chaos/journal-drop");
    assert(journalDrop.status === 200 && journalDrop.body.ok === true, "journal drop must halt");

    const unknown = await post(base, "/tests/chaos/unknown-order-state");
    assert(unknown.status === 200 && unknown.body.ok === true, "unknown order state must become uncertain and halt");

    console.log(JSON.stringify({
      name: "pr30_1_chaos_suite_contract",
      ok: true,
      realMarketGuardBlocked: realBlocked.body.reason,
      duplicateDecision: duplicate.body.decision,
      outOfOrderDecision: outOfOrder.body.decision,
      partialCancelFillDecision: partialCancelFill.body.decision,
      lagDecision: lag.body.decision,
      snapshotSplitDecision: snapshotSplit.body.decision,
      journalDropDecision: journalDrop.body.decision,
      unknownDecision: unknown.body.decision
    }, null, 2));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
