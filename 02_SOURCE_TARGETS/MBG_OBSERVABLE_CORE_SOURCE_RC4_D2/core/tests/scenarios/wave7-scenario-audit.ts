import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave7-scenario-audit-${process.pid}-${Date.now()}`);
process.env.GENESIS_DATA_DIR = dataDir;
process.env.PERSISTENCE_ENABLED = "true";
process.env.MBG_HEALTH_CONNECTION_STATUS_TTL_MS = "15000";
process.env.MBG_EVENT_FUTURE_TOLERANCE_MS = "5000";

const { runtimeEngine } = await import("../../core/runtime/src/runtime-engine.js");
const { ACTION_TYPE } = await import("../../core/contracts/src/actions.js");
const { EVENT_TYPE } = await import("../../core/contracts/src/events.js");

type ScenarioResult = {
  name: string;
  covers: string[];
  ok: boolean;
  detail?: string;
};

type CommitResult = {
  ok?: boolean;
  status?: string;
  eventId?: string;
  eventType?: string;
  snapshotRevision?: number;
  snapshot?: unknown;
  diagnostic?: unknown;
  [key: string]: unknown;
};

type RuntimeLike = typeof runtimeEngine & {
  commitEventResult?: (event: Record<string, unknown>, options?: { log?: boolean }) => CommitResult;
  getHashChainView?: (input?: unknown) => unknown;
  getSnapshotHashChain?: (input?: unknown) => unknown;
  getSnapshotHashChainView?: (input?: unknown) => unknown;
  getHashChain?: (input?: unknown) => unknown;
  getIntegrityView?: (input?: unknown) => unknown;
  verifyHashChain?: (input?: unknown) => unknown;
  verifySnapshotHashChain?: (input?: unknown) => unknown;
  verifyIntegrity?: (input?: unknown) => unknown;
  getCausalityTrace?: (input?: unknown) => unknown;
  getCausalityTraceView?: (input?: unknown) => unknown;
  getCausalityView?: (input?: unknown) => unknown;
  getTrace?: (input?: unknown) => unknown;
  getCoreTrustReport?: (input?: unknown) => unknown;
  getRecoveryPlan?: (input?: unknown) => unknown;
  getRecoveryPlannerView?: (input?: unknown) => unknown;
  getRecoverySuggestions?: (input?: unknown) => unknown;
  planRecovery?: (input?: unknown) => unknown;
  getPermissionLedgerView?: (limit?: number) => unknown;
  getPermissionLedger?: (limit?: number) => unknown;
  getPermissionsLedgerView?: (limit?: number) => unknown;
  evaluateAction?: (action: unknown) => unknown;
  dispatchAction?: (action: unknown) => unknown;
  getRuntimeView?: () => unknown;
};

const engine = runtimeEngine as RuntimeLike;
const results: ScenarioResult[] = [];

function scenario(name: string, covers: string[], body: () => void) {
  try {
    runtimeEngine.clearPersistenceAndReset();
    body();
    results.push({ name, covers, ok: true });
  } catch (err) {
    results.push({
      name,
      covers,
      ok: false,
      detail: err instanceof Error ? err.message : String(err)
    });
  }
}

function isoNow() {
  return new Date().toISOString();
}

function event(
  eventType: string,
  payload: Record<string, unknown>,
  eventId: string,
  timestamp = isoNow(),
  source = "wave7-scenario-audit"
) {
  return {
    eventId,
    eventType,
    timestamp,
    source,
    schemaVersion: "1",
    payload
  };
}

function validMarketTick(eventId: string, price = 65000) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price,
    bid: price - 1,
    ask: price + 1,
    volume: 1,
    provider: "wave7-scenario-audit"
  }, eventId, isoNow(), "market-data");
}

function invalidMarketTick(eventId: string) {
  return event(EVENT_TYPE.MARKET_TICK_RECEIVED, {
    symbol: "BTCUSDT",
    price: -1,
    bid: 64999,
    ask: 65001,
    volume: 1,
    provider: "wave7-scenario-audit"
  }, eventId, isoNow(), "market-data");
}

function bootstrapEvent(eventType: string, eventId: string) {
  return event(eventType, {
    reason: eventType.replace(".", "_"),
    provider: "wave7-scenario-audit",
    source: "wave7-scenario-audit"
  }, eventId, isoNow(), "core");
}

function commitResult(eventToCommit: Record<string, unknown>) {
  assert.equal(typeof engine.commitEventResult, "function", "runtimeEngine.commitEventResult(event, { log: false }) is required");
  return engine.commitEventResult!(eventToCommit, { log: false });
}

function commitAccepted(eventToCommit: Record<string, unknown>) {
  const result = commitResult(eventToCommit);
  assert.equal(result.ok, true, `expected accepted event, got ${JSON.stringify(result)}`);
  assert.equal(result.status, "accepted", `expected status=accepted, got ${String(result.status)}`);
  return result;
}

function rejectEvent(eventToCommit: Record<string, unknown>) {
  const result = commitResult(eventToCommit);
  assert.equal(result.ok, false, `expected rejected event, got ${JSON.stringify(result)}`);
  return result;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function stable(value: unknown): unknown {
  const copy = clone(value);
  const seen = new Set<unknown>();

  function scrub(current: unknown): unknown {
    if (!current || typeof current !== "object") return current;
    if (seen.has(current)) return "[circular]";
    seen.add(current);

    if (Array.isArray(current)) return current.map(scrub);

    const object = current as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(object).sort()) {
      if (["timestamp", "observedAt", "generatedAt", "committedAt", "checkedAt", "createdAt", "updatedAt", "detectedAt"].includes(key)) continue;
      out[key] = scrub(object[key]);
    }
    return out;
  }

  return scrub(copy);
}

function flattenUnknown(value: unknown): unknown[] {
  const items: unknown[] = [];
  const seen = new Set<unknown>();

  function visit(current: unknown) {
    if (current === null || current === undefined) return;
    if (typeof current !== "object") {
      items.push(current);
      return;
    }
    if (seen.has(current)) return;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    items.push(current);
    for (const nested of Object.values(current as Record<string, unknown>)) visit(nested);
  }

  visit(value);
  return items;
}

function viewRecords(view: unknown): unknown[] {
  if (Array.isArray(view)) return view;
  if (!view || typeof view !== "object") return [];
  const object = view as Record<string, unknown>;
  const candidates = [
    object.records,
    object.entries,
    object.events,
    object.items,
    object.chain,
    object.links,
    object.transitions,
    object.traces,
    object.diagnostics,
    object.proofs,
    object.decisions
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return flattenUnknown(view).filter((item) => item && typeof item === "object");
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function assertTextContains(value: unknown, fragments: string[], message: string) {
  const text = asText(value).toLowerCase();
  const missing = fragments.filter((fragment) => !text.includes(fragment.toLowerCase()));
  assert.equal(missing.length, 0, `${message}: missing ${missing.join(", ")} in ${text}`);
}

function hasFieldLike(value: unknown, keys: string[]) {
  const lowerKeys = keys.map((key) => key.toLowerCase());
  return flattenUnknown(value).some((item) => {
    if (!item || typeof item !== "object") return false;
    const object = item as Record<string, unknown>;
    return Object.keys(object).some((key) => lowerKeys.includes(key.toLowerCase()) && object[key] !== undefined && object[key] !== "");
  });
}

function findRecordContaining(view: unknown, fragments: string[]) {
  const lower = fragments.map((fragment) => fragment.toLowerCase());
  return viewRecords(view).find((record) => {
    const text = asText(record).toLowerCase();
    return lower.every((fragment) => text.includes(fragment));
  });
}

function getHashChainViewStrict(input?: unknown) {
  const candidates = [
    engine.getHashChainView,
    engine.getSnapshotHashChainView,
    engine.getSnapshotHashChain,
    engine.getHashChain,
    engine.getIntegrityView
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }

  throw new Error("Wave 7 hash-chain view API is not available");
}

function verifyHashChainStrict(input?: unknown) {
  const candidates = [
    engine.verifyHashChain,
    engine.verifySnapshotHashChain,
    engine.verifyIntegrity,
    engine.getIntegrityView
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }

  throw new Error("Wave 7 hash-chain verification API is not available");
}

function getCausalityTraceStrict(input?: unknown) {
  const candidates = [
    engine.getCausalityTrace,
    engine.getCausalityTraceView,
    engine.getCausalityView,
    engine.getTrace
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }

  throw new Error("Wave 7 causality trace API is not available");
}

function getCoreTrustReportStrict(input?: unknown) {
  assert.equal(typeof engine.getCoreTrustReport, "function", "runtimeEngine.getCoreTrustReport() is required");
  return engine.getCoreTrustReport!(input);
}

function getRecoveryPlanStrict(input?: unknown) {
  const candidates = [
    engine.getRecoveryPlan,
    engine.getRecoveryPlannerView,
    engine.getRecoverySuggestions,
    engine.planRecovery
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, input);
  }

  throw new Error("Wave 5 Recovery Planner API is not available");
}

function getPermissionLedgerViewStrict() {
  const candidates = [
    engine.getPermissionLedgerView,
    engine.getPermissionLedger,
    engine.getPermissionsLedgerView
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "function") return candidate.call(engine, 100);
  }

  throw new Error("Wave 5 Permission Ledger API is not available");
}

function evaluatePlaceOrder() {
  const request = {
    type: ACTION_TYPE.PLACE_ORDER,
    symbol: "BTCUSDT",
    side: "buy",
    quantity: 0.01,
    price: 65000,
    requestedBy: "wave7-scenario-audit"
  };

  if (typeof engine.dispatchAction === "function") return engine.dispatchAction(request);
  if (typeof engine.evaluateAction === "function") return engine.evaluateAction(request);
  throw new Error("ActionGate evaluation API is not available");
}

function assertHashLike(value: unknown, label: string) {
  assert.equal(typeof value, "string", `${label} must be a string hash`);
  assert.ok((value as string).length >= 16, `${label} is too short: ${value}`);
}

function getHashValue(record: unknown, keys: string[]) {
  if (!record || typeof record !== "object") return undefined;
  const object = record as Record<string, unknown>;
  for (const key of keys) {
    if (typeof object[key] === "string") return object[key];
  }
  return undefined;
}

function assertVerificationFailed(result: unknown, fragments: string[], message: string) {
  const object = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const ok = object.ok ?? object.valid ?? object.verified ?? object.passed;
  assert.ok(ok === false, `${message}: expected failed verification result. Result=${JSON.stringify(result)}`);
  assertTextContains(result, fragments, message);
}

function assertReportTrustStateNotCompromised(report: unknown) {
  const object = report && typeof report === "object" ? report as Record<string, unknown> : {};
  const trustState = String(object.trustState ?? object.state ?? object.status ?? "");
  assert.notEqual(trustState, "COMPROMISED", `cold start with unknown legacy hash must not be COMPROMISED. Report=${JSON.stringify(report)}`);
}

function assertNoForbiddenDefaultWiring() {
  const root = process.cwd();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const scripts = Object.entries(pkg.scripts ?? {}).map(([name, value]) => `${name}: ${value}`).join("\n").toLowerCase();
  const forbidden = [
    { label: "V1", pattern: /\bv1\b|connect:v1/ },
    { label: "V2", pattern: /\bv2\b|connect:v2/ },
    { label: "UI", pattern: /\b(ui|frontend|webapp|vite|next|react)\b/ },
    { label: "strategy", pattern: /\bstrategy\b|signal-layer|decision-engine/ },
    { label: "live trading", pattern: /live\s*trading|live-trading|real[-:]?order|marketbuy|marketsell/ },
    { label: "real exchange keys", pattern: /api[_-]?key|secret[_-]?key|exchange[_-]?key/ }
  ];
  const hits = forbidden.filter(({ pattern }) => pattern.test(scripts)).map(({ label }) => label);
  assert.equal(hits.length, 0, `Forbidden active wiring found in package scripts: ${hits.join(", ")}`);
}

scenario(
  "accepted event produces eventHash",
  ["eventHash", "hash-chain"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-event-hash-1", 65000));
    const chain = getHashChainViewStrict();
    const record = findRecordContaining(chain, [String(accepted.eventId)]);
    assert.ok(record, `hash-chain view must contain accepted eventId ${accepted.eventId}. View=${JSON.stringify(chain)}`);
    const eventHash = getHashValue(record, ["eventHash", "hash"]);
    assertHashLike(eventHash, "eventHash");
  }
);

scenario(
  "accepted event produces snapshotHash",
  ["snapshotHash", "hash-chain"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-snapshot-hash-1", 65001));
    const chain = getHashChainViewStrict();
    const record = findRecordContaining(chain, [String(accepted.eventId)]);
    assert.ok(record, `hash-chain view must contain accepted eventId ${accepted.eventId}. View=${JSON.stringify(chain)}`);
    const snapshotHash = getHashValue(record, ["snapshotHash", "afterHash", "afterSnapshotHash"]);
    assertHashLike(snapshotHash, "snapshotHash");
  }
);

scenario(
  "transition links beforeHash, eventHash, afterHash",
  ["transition proof", "beforeHash", "eventHash", "afterHash"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-transition-link-1", 65002));
    const chain = getHashChainViewStrict();
    const record = findRecordContaining(chain, [String(accepted.eventId)]);
    assert.ok(record, `transition proof must contain accepted eventId ${accepted.eventId}. View=${JSON.stringify(chain)}`);
    assertHashLike(getHashValue(record, ["beforeHash", "beforeSnapshotHash", "previousSnapshotHash"]), "beforeHash");
    assertHashLike(getHashValue(record, ["eventHash", "hash"]), "eventHash");
    assertHashLike(getHashValue(record, ["afterHash", "afterSnapshotHash", "snapshotHash"]), "afterHash");
  }
);

scenario(
  "changed snapshot changes snapshotHash",
  ["snapshotHash", "changed snapshot"],
  () => {
    const first = commitAccepted(validMarketTick("wave7-changed-snapshot-1", 65003));
    const chainAfterFirst = getHashChainViewStrict();
    const firstRecord = findRecordContaining(chainAfterFirst, [String(first.eventId)]);
    assert.ok(firstRecord, `first hash record missing. View=${JSON.stringify(chainAfterFirst)}`);
    const firstHash = getHashValue(firstRecord, ["afterHash", "afterSnapshotHash", "snapshotHash"]);

    const second = commitAccepted(validMarketTick("wave7-changed-snapshot-2", 65033));
    const chainAfterSecond = getHashChainViewStrict();
    const secondRecord = findRecordContaining(chainAfterSecond, [String(second.eventId)]);
    assert.ok(secondRecord, `second hash record missing. View=${JSON.stringify(chainAfterSecond)}`);
    const secondHash = getHashValue(secondRecord, ["afterHash", "afterSnapshotHash", "snapshotHash"]);

    assertHashLike(firstHash, "first snapshotHash");
    assertHashLike(secondHash, "second snapshotHash");
    assert.notEqual(firstHash, secondHash, "changed snapshot must change snapshotHash");
  }
);

scenario(
  "revision gap fails hash-chain verification",
  ["hash-chain verification", "revision gap"],
  () => {
    const result = verifyHashChainStrict({
      mode: "scenario_audit_revision_gap",
      chain: [
        { revision: 0, snapshotHash: "legacy-genesis" },
        { revision: 2, previousHash: "legacy-genesis", snapshotHash: "gap-after" }
      ]
    });
    assertVerificationFailed(result, ["revision", "gap"], "revision gap must fail hash-chain verification");
  }
);

scenario(
  "legacy unknown hash does not mark cold start as COMPROMISED",
  ["legacy unknown hash", "cold start", "trustState"],
  () => {
    const report = getCoreTrustReportStrict({ legacyHashStatus: "unknown", source: "wave7_scenario_audit" });
    assertReportTrustStateNotCompromised(report);
    assertTextContains(report, ["UNCERTAIN"], "cold start with unknown legacy hash should remain UNCERTAIN or equivalent");
  }
);

scenario(
  "proven hash mismatch creates integrity blocking reason",
  ["hash mismatch", "integrity blocking reason"],
  () => {
    const result = verifyHashChainStrict({
      mode: "scenario_audit_hash_mismatch",
      chain: [
        { revision: 0, snapshotHash: "genesis" },
        { revision: 1, previousHash: "wrong-previous-hash", snapshotHash: "after" }
      ]
    });
    assertVerificationFailed(result, ["hash", "mismatch"], "proven hash mismatch must fail verification");
    assertTextContains(result, ["integrity"], "proven hash mismatch must create an integrity blocking reason");
  }
);

scenario(
  "accepted event produces causality trace",
  ["causality trace", "accepted event"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-causality-1", 65004));
    const trace = getCausalityTraceStrict({ eventId: accepted.eventId });
    assertTextContains(trace, [String(accepted.eventId)], "causality trace must reference accepted eventId");
  }
);

scenario(
  "causality trace captures changed domains",
  ["causality trace", "changed domains"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-causality-domains-1", 65005));
    const trace = getCausalityTraceStrict({ eventId: accepted.eventId });
    assertTextContains(trace, ["market"], "causality trace must capture changed market domain");
    assert.ok(
      hasFieldLike(trace, ["changedDomains", "domainsChanged", "changed"]),
      `causality trace must expose changed domain structure. Trace=${JSON.stringify(trace)}`
    );
  }
);

scenario(
  "causality trace captures trustState before/after",
  ["causality trace", "trustState before/after"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-causality-trust-1", 65006));
    const trace = getCausalityTraceStrict({ eventId: accepted.eventId });
    assert.ok(
      hasFieldLike(trace, ["trustStateBefore", "beforeTrustState", "trustBefore"]),
      `causality trace must expose trustState before. Trace=${JSON.stringify(trace)}`
    );
    assert.ok(
      hasFieldLike(trace, ["trustStateAfter", "afterTrustState", "trustAfter"]),
      `causality trace must expose trustState after. Trace=${JSON.stringify(trace)}`
    );
  }
);

scenario(
  "rejected event references quarantine in trace",
  ["rejected event", "quarantine", "causality trace"],
  () => {
    const rejected = invalidMarketTick("wave7-rejected-trace-1");
    const result = rejectEvent(rejected);
    const trace = getCausalityTraceStrict({ eventId: rejected.eventId, includeRejected: true });
    assertTextContains(trace, [String(rejected.eventId), "quarantine"], "rejected event trace must reference quarantine");
    assertTextContains(trace, [String(result.status)], "rejected event trace must capture rejection status");
  }
);

scenario(
  "denied action references permission ledger in trace",
  ["denied action", "permission ledger", "causality trace"],
  () => {
    const verdict = evaluatePlaceOrder();
    const ledger = getPermissionLedgerViewStrict();
    assertTextContains(ledger, ["deny"], "denied PLACE_ORDER must be recorded in Permission Ledger");
    const trace = getCausalityTraceStrict({ actionType: ACTION_TYPE.PLACE_ORDER, includeActions: true });
    assertTextContains(trace, ["permission", "ledger"], "denied action trace must reference Permission Ledger");
    assertTextContains(trace, ["deny"], "denied action trace must capture deny decision");
    assertTextContains(trace, [asText(verdict).includes("PLACE_ORDER") ? "PLACE_ORDER" : "place_order"], "denied action trace should preserve action context");
  }
);

scenario(
  "CoreTrustReport exposes integrity summary",
  ["CoreTrustReport", "integrity summary"],
  () => {
    const report = getCoreTrustReportStrict();
    assert.ok(
      hasFieldLike(report, ["integrity", "integritySummary", "hashChain", "hashChainIntegrity"]),
      `CoreTrustReport must expose integrity summary. Report=${JSON.stringify(report)}`
    );
  }
);

scenario(
  "CoreTrustReport exposes causality summary",
  ["CoreTrustReport", "causality summary"],
  () => {
    const report = getCoreTrustReportStrict();
    assert.ok(
      hasFieldLike(report, ["causality", "causalitySummary", "lastCausalityTrace", "causalTrace"]),
      `CoreTrustReport must expose causality summary. Report=${JSON.stringify(report)}`
    );
  }
);

scenario(
  "broken integrity suggests recovery actions",
  ["broken integrity", "Recovery Planner"],
  () => {
    const verification = verifyHashChainStrict({
      mode: "scenario_audit_hash_mismatch",
      chain: [
        { revision: 0, snapshotHash: "genesis" },
        { revision: 1, previousHash: "wrong-previous-hash", snapshotHash: "after" }
      ]
    });
    assertVerificationFailed(verification, ["hash", "mismatch"], "broken integrity fixture must fail verification");

    const plan = getRecoveryPlanStrict({
      source: "wave7_scenario_audit",
      integrity: verification
    });
    assertTextContains(
      plan,
      ["integrity"],
      "Recovery Planner must include an integrity-focused recovery suggestion for broken hash chain"
    );
    assert.ok(
      /REPLAY|REBUILD|VERIFY|AUDIT|QUARANTINE|RESTORE/i.test(asText(plan)),
      `Recovery Planner should suggest replay/rebuild/verify/audit/quarantine/restore actions. Plan=${JSON.stringify(plan)}`
    );
  }
);

scenario(
  "trace is read-only and does not mutate snapshot",
  ["causality trace", "read-only"],
  () => {
    const accepted = commitAccepted(validMarketTick("wave7-trace-readonly-1", 65007));
    const before = stable(runtimeEngine.getSnapshot());
    getCausalityTraceStrict({ eventId: accepted.eventId });
    getHashChainViewStrict();
    verifyHashChainStrict();
    const after = stable(runtimeEngine.getSnapshot());
    assert.deepEqual(after, before, "trace/hash-chain reads must not mutate snapshot");
  }
);

scenario(
  "hash-chain verification is deterministic",
  ["hash-chain verification", "determinism"],
  () => {
    commitAccepted(validMarketTick("wave7-deterministic-1", 65008));
    const first = stable(verifyHashChainStrict());
    const second = stable(verifyHashChainStrict());
    assert.deepEqual(second, first, "hash-chain verification must be deterministic for the same history");
  }
);

scenario(
  "no V1/UI/strategy/live trading added",
  ["canonical boundaries", "no V1", "no UI", "no strategy", "no live trading"],
  () => {
    assertNoForbiddenDefaultWiring();

    const runtimeViewText = engine.getRuntimeView ? asText(engine.getRuntimeView()).toLowerCase() : "";
    assert.ok(!runtimeViewText.includes("trading terminal"), `runtime must not expose trading terminal. Runtime=${runtimeViewText}`);
    assert.ok(!runtimeViewText.includes("real exchange key"), `runtime must not expose real exchange keys. Runtime=${runtimeViewText}`);
  }
);

const failed = results.filter((result) => !result.ok);
const summary = {
  name: "wave7_scenario_audit",
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
