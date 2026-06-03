import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = path.join(os.tmpdir(), `mbg-core-wave10-observable-machine-audit-${process.pid}`);
process.env.GENESIS_DATA_DIR = dataDir;
process.env.PERSISTENCE_ENABLED = "true";
process.env.MBG_HEALTH_CONNECTION_STATUS_TTL_MS = "15000";
process.env.MBG_EVENT_FUTURE_TOLERANCE_MS = "5000";

const { runtimeEngine } = await import("../../core/runtime/src/runtime-engine.js");

type ScenarioResult = {
  name: string;
  covers: string[];
  ok: boolean;
  detail?: string;
};

type RuntimeLike = typeof runtimeEngine & Record<string, unknown>;

type ObservableSurface = {
  sourceName: string;
  getCatalog?: () => unknown;
  getDto?: (input?: unknown) => unknown;
  renderScenario?: (input?: unknown) => unknown;
  getReplayProof?: () => unknown;
};

const engine = runtimeEngine as RuntimeLike;
const results: ScenarioResult[] = [];

const METHOD_CATALOG_CANDIDATES = [
  "getObservableCoreMachineScenarios",
  "getObservableMachineScenarios",
  "getCoreUiMockScenarios",
  "getCoreUIScenarios",
  "getComputationTraceScenarios",
  "getObservableScenarioCatalog",
  "getMockScenarioCatalog"
];

const METHOD_DTO_CANDIDATES = [
  "getObservableCoreMachineView",
  "getObservableCoreMachineDto",
  "getObservableMachineView",
  "getCoreUiDto",
  "getCoreUIDto",
  "getCoreUiView",
  "getComputationTrace",
  "getComputationTraceLatest",
  "getLatestComputationTrace",
  "getCoreComputationTrace",
  "getRuntimeObservableView"
];

const METHOD_RENDER_CANDIDATES = [
  "renderObservableCoreScenario",
  "renderObservableMachineScenario",
  "renderCoreUiScenario",
  "renderComputationTraceScenario",
  "getObservableScenario",
  "getMockScenario"
];

async function tryImportSurface(): Promise<ObservableSurface | undefined> {
  const candidateModules = [
    "../../core/ui-api/src/observable-core-machine.js",
    "../../core/ui-api/observable-core-machine.js",
    "../../core/observable/src/observable-core-machine.js",
    "../../core/observable/observable-core-machine.js",
    "../../apps/runtime-api/src/observable-core-machine.js"
  ];

  for (const modulePath of candidateModules) {
    try {
      const mod = await import(modulePath);
      const surface =
        mod.observableCoreMachine ??
        mod.observableMachine ??
        mod.coreUiApi ??
        mod.coreUIApi ??
        mod.default ??
        mod;

      if (surface && typeof surface === "object") {
        return {
          sourceName: modulePath,
          getCatalog: pickMethod(surface, METHOD_CATALOG_CANDIDATES),
          getDto: pickMethod(surface, METHOD_DTO_CANDIDATES),
          renderScenario: pickMethod(surface, METHOD_RENDER_CANDIDATES),
          getReplayProof: pickMethod(surface, ["verifyReplay", "replayCheck", "getReplayProof"])
        };
      }
    } catch {
      // Optional Wave 10 surface may not exist on alpha8. Scenario failures report the missing contract.
    }
  }

  return undefined;
}

function pickMethod(target: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (typeof target[name] === "function") {
      const fn = target[name] as (input?: unknown) => unknown;
      return (input?: unknown) => fn.call(target, input);
    }
  }
  return undefined;
}

function getEngineSurface(): ObservableSurface {
  return {
    sourceName: "runtimeEngine",
    getCatalog: pickMethod(engine, METHOD_CATALOG_CANDIDATES),
    getDto: pickMethod(engine, METHOD_DTO_CANDIDATES),
    renderScenario: pickMethod(engine, METHOD_RENDER_CANDIDATES),
    getReplayProof:
      pickMethod(engine, ["verifyReplay", "replayCheck", "getReplayProof"]) ??
      (() => {
        if (typeof engine.replayCheck === "function") return (engine.replayCheck as () => unknown)();
        return undefined;
      })
  };
}

let resolvedSurface: ObservableSurface | undefined;

async function getSurface(): Promise<ObservableSurface> {
  if (resolvedSurface) return resolvedSurface;
  const imported = await tryImportSurface();
  const engineSurface = getEngineSurface();

  resolvedSurface = {
    sourceName: imported?.sourceName ?? engineSurface.sourceName,
    getCatalog: imported?.getCatalog ?? engineSurface.getCatalog,
    getDto: imported?.getDto ?? engineSurface.getDto,
    renderScenario: imported?.renderScenario ?? engineSurface.renderScenario,
    getReplayProof: imported?.getReplayProof ?? engineSurface.getReplayProof
  };

  return resolvedSurface;
}

function resetRuntime(): void {
  for (const name of ["clearPersistenceAndReset", "resetForTest", "__resetForTest", "reset"]) {
    const fn = engine[name];
    if (typeof fn === "function") {
      (fn as () => void).call(engine);
      return;
    }
  }
}

function getSnapshot(): unknown {
  if (typeof engine.getSnapshot === "function") return (engine.getSnapshot as () => unknown).call(engine);
  if (typeof engine.getRuntimeView === "function") return (engine.getRuntimeView as () => unknown).call(engine);
  throw new Error("No runtime snapshot/view API available");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower === "generatedat" ||
        lower === "updatedat" ||
        lower === "committedat" ||
        lower === "receivedat" ||
        lower === "eventtime" ||
        lower === "timestamp" ||
        lower === "lastcommitms" ||
        lower === "latencyms" ||
        lower === "corelatencyms" ||
        lower === "sourcelatencyms"
      ) {
        continue;
      }
      out[key] = stable(raw);
    }
    return out;
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

function allText(value: unknown): string {
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return String(value).toLowerCase();
  }
}

function assertContainsAny(value: unknown, fragments: string[], message: string): void {
  const text = allText(value);
  assert(
    fragments.some((fragment) => text.includes(fragment.toLowerCase())),
    `${message}. Missing one of: ${fragments.join(", ")}. Value=${JSON.stringify(value)}`
  );
}

function assertNotContainsAny(value: unknown, fragments: string[], message: string): void {
  const text = allText(value);
  assert(
    fragments.every((fragment) => !text.includes(fragment.toLowerCase())),
    `${message}. Forbidden one of: ${fragments.join(", ")}. Value=${JSON.stringify(value).slice(0, 2000)}`
  );
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["scenarios", "items", "catalog", "mockScenarios", "entries"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

async function getScenarioCatalog(): Promise<unknown[]> {
  const surface = await getSurface();
  assert(surface.getCatalog, "Wave 10 observable machine scenario catalog API is missing");
  const catalog = asArray(surface.getCatalog());
  assert(catalog.length > 0, "Wave 10 observable machine scenario catalog is empty");
  return catalog;
}

function scenarioId(scenario: unknown): unknown {
  if (!scenario || typeof scenario !== "object") return scenario;
  const record = scenario as Record<string, unknown>;
  return record.id ?? record.scenarioId ?? record.name ?? record.key ?? scenario;
}

async function getDto(input?: unknown): Promise<unknown> {
  const surface = await getSurface();

  if (input !== undefined && surface.renderScenario) return surface.renderScenario(input);
  if (input !== undefined && surface.getDto) {
    try {
      return surface.getDto(input);
    } catch {
      return surface.getDto({ scenarioId: scenarioId(input), scenario: input });
    }
  }
  if (surface.getDto) return surface.getDto();

  throw new Error("Wave 10 observable machine DTO/API surface is missing");
}

async function getDtoForScenario(scenario: unknown): Promise<unknown> {
  if (scenario && typeof scenario === "object") {
    const record = scenario as Record<string, unknown>;
    for (const key of ["dto", "trace", "view", "payload", "expectedDto"]) {
      if (record[key]) return record[key];
    }
  }
  return getDto(scenario);
}

async function findScenario(fragments: string[]): Promise<unknown> {
  const catalog = await getScenarioCatalog();
  const match = catalog.find((scenario) => {
    const text = allText(scenario);
    return fragments.some((fragment) => text.includes(fragment.toLowerCase()));
  });
  assert(match, `Missing mock scenario matching: ${fragments.join(", ")}`);
  return match;
}

function extractVisualVerdict(dto: unknown): unknown {
  if (!dto || typeof dto !== "object") return dto;
  const record = dto as Record<string, unknown>;
  return {
    machine: record.machine,
    gateVerdict: record.gateVerdict,
    verdict: record.verdict,
    visualVerdict: record.visualVerdict,
    trustState: (record.machine as Record<string, unknown> | undefined)?.trustState ?? record.trustState,
    tradingAllowed: (record.machine as Record<string, unknown> | undefined)?.tradingAllowed ?? record.tradingAllowed
  };
}

function assertReadOnlyDto(dto: unknown): void {
  assertNotContainsAny(
    dto,
    [
      "placeOrderUrl",
      "placeOrderEndpoint",
      "submitOrder",
      "submitTrade",
      "executeTrade",
      "executeOrder",
      "executionCommand",
      "tradingControl",
      "buyButton",
      "sellButton",
      "orderButton",
      "websocketAuthority",
      "wsCommand",
      "sendOrder"
    ],
    "Observable UI DTO must be read-only and must not expose command/control surfaces"
  );
}

function assertNoExecutionLeak(dto: unknown): void {
  assertNotContainsAny(
    dto,
    [
      "executionEnabled:true",
      "\"executionEnabled\":true",
      "liveExecution",
      "orderPlacementEnabled:true",
      "\"orderPlacementEnabled\":true",
      "exchangeKey",
      "apiSecret",
      "secretKey",
      "privateKey"
    ],
    "Observable UI DTO must not expose execution/live credential semantics"
  );
}

function packageJson(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
}

async function scenario(name: string, covers: string[], body: () => void | Promise<void>) {
  try {
    resetRuntime();
    await body();
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

async function main() {
  await scenario("all 15 mock scenarios render deterministically", ["mock", "determinism", "visual"], async () => {
    const catalog = await getScenarioCatalog();
    assert(catalog.length >= 15, `Expected at least 15 mock scenarios, got ${catalog.length}`);

    for (const item of catalog.slice(0, 15)) {
      const dtoA = await getDtoForScenario(item);
      const dtoB = await getDtoForScenario(item);
      assert.deepEqual(stable(dtoA), stable(dtoB), `Scenario ${String(scenarioId(item))} did not render deterministically`);
      assertContainsAny(dtoA, ["machine", "event", "pipeline", "snapshotDiff", "gateVerdict"], "Rendered DTO missing observable core fields");
      assertReadOnlyDto(dtoA);
    }
  });

  await scenario("UI DTO stable across replay", ["dto", "replay", "determinism"], async () => {
    const before = await getDto();
    const surface = await getSurface();
    if (surface.getReplayProof) surface.getReplayProof();
    else if (typeof engine.replayCheck === "function") (engine.replayCheck as () => unknown).call(engine);
    const after = await getDto();
    assert.deepEqual(stable(before), stable(after), "UI DTO changed after replay verification");
  });

  await scenario("same scenario -> same visual verdict", ["visual-verdict", "determinism"], async () => {
    const item = (await getScenarioCatalog())[0];
    const verdictA = extractVisualVerdict(await getDtoForScenario(item));
    const verdictB = extractVisualVerdict(await getDtoForScenario(item));
    assert.deepEqual(stable(verdictA), stable(verdictB), "Same scenario produced different visual verdict");
  });

  await scenario("market input integrity visible", ["market-input", "visibility"], async () => {
    const dto = await getDtoForScenario(await findScenario(["market", "observation", "input"]));
    assertContainsAny(dto, ["marketInput", "market input", "payloadHash", "checksum", "sequence"], "Market input integrity is not visible in UI DTO");
  });

  await scenario("provenance visible", ["provenance", "visibility"], async () => {
    const dto = await getDtoForScenario(await findScenario(["provenance", "origin", "metadata"]));
    assertContainsAny(dto, ["provenance", "origin", "source", "payloadHash"], "Provenance is not visible in UI DTO");
  });

  await scenario("gap/stale/duplicate visible", ["gap", "stale", "duplicate", "visibility"], async () => {
    const catalog = await getScenarioCatalog();
    const catalogText = allText(catalog);
    assert(catalogText.includes("gap"), "Scenario catalog does not expose a gap scenario");
    assert(catalogText.includes("stale"), "Scenario catalog does not expose a stale scenario");
    assert(catalogText.includes("duplicate"), "Scenario catalog does not expose a duplicate scenario");

    const gapDto = await getDtoForScenario(await findScenario(["gap"]));
    const staleDto = await getDtoForScenario(await findScenario(["stale"]));
    const duplicateDto = await getDtoForScenario(await findScenario(["duplicate"]));
    assertContainsAny(gapDto, ["gap", "sequence"], "Gap state is not visible in UI DTO");
    assertContainsAny(staleDto, ["stale", "freshness"], "Stale state is not visible in UI DTO");
    assertContainsAny(duplicateDto, ["duplicate", "idempotent", "idempotency"], "Duplicate/idempotency state is not visible in UI DTO");
  });

  await scenario("snapshot diff visible", ["snapshot-diff", "visibility"], async () => {
    const dto = await getDto();
    assertContainsAny(dto, ["snapshotDiff", "changedDomains", "before", "after"], "Snapshot diff is not visible in UI DTO");
  });

  await scenario("recovery visibility preserved", ["recovery", "visibility"], async () => {
    const dto = await getDtoForScenario(await findScenario(["recovery", "recover", "reconcile", "refresh"]));
    assertContainsAny(dto, ["recovery", "suggest", "reconcile", "refresh"], "Recovery guidance is not visible in UI DTO");
  });

  await scenario("quarantine visibility preserved", ["quarantine", "visibility"], async () => {
    const dto = await getDtoForScenario(await findScenario(["quarantine", "rejected", "invalid"]));
    assertContainsAny(dto, ["quarantine", "rejected", "invalid"], "Quarantine visibility is missing from UI DTO");
  });

  await scenario("ActionGate deny reasoning visible", ["action-gate", "deny", "reason"], async () => {
    const dto = await getDtoForScenario(await findScenario(["deny", "place_order", "actiongate", "gate"]));
    assertContainsAny(dto, ["deny", "reason", "blocking", "machine"], "ActionGate deny reason is not visible in UI DTO");
  });

  await scenario("valid observation does not imply permission", ["market-input", "permission", "safety"], async () => {
    const dto = await getDtoForScenario(await findScenario(["valid", "observation"]));
    const text = allText(extractVisualVerdict(dto));
    assert(
      !text.includes('"tradingallowed":true') && !text.includes('"decision":"allow"'),
      `Valid market observation alone must not imply permission. Verdict=${JSON.stringify(extractVisualVerdict(dto))}`
    );
  });

  await scenario("UI DTO does not mutate Core state", ["read-only", "state"], async () => {
    const before = stableJson(getSnapshot());
    await getDto();
    const catalog = await getScenarioCatalog();
    await getDtoForScenario(catalog[0]);
    const after = stableJson(getSnapshot());
    assert.equal(after, before, "Reading UI DTO mutated Core snapshot/state");
  });

  await scenario("UI contracts remain read-only", ["read-only", "contract"], async () => {
    const dto = await getDto();
    assertReadOnlyDto(dto);
  });

  await scenario("no execution semantics leak", ["no-execution", "safety"], async () => {
    const dto = await getDto();
    assertNoExecutionLeak(dto);
  });

  await scenario("no trading controls leak", ["no-trading-controls", "safety"], async () => {
    const dto = await getDto();
    assertNotContainsAny(
      dto,
      ["tradeControl", "tradingControl", "buyButton", "sellButton", "orderTicket", "manualOrder", "placeOrderForm"],
      "Observable machine must not leak trading controls"
    );
  });

  await scenario("no websocket authority", ["no-websocket-authority", "safety"], async () => {
    const dto = await getDto();
    assertNotContainsAny(
      dto,
      ["websocketAuthority", "wsUrl", "websocketUrl", "subscribeCommand", "liveSocketAuthority"],
      "Observable machine must not expose websocket authority/control"
    );
  });

  await scenario("no V1/live integration", ["no-v1", "no-live", "safety"], async () => {
    const pkg = packageJson();
    const scripts = JSON.stringify(pkg.scripts ?? {});
    assertNotContainsAny(scripts, ["v1:live", "live:v1", "start:live", "trade:live"], "Package scripts must not add V1/live integration commands");

    const dto = await getDto();
    assertNotContainsAny(dto, ["v1Live", "liveV1", "liveTradingEnabled", "exchangeWebsocketConnected:true"], "UI DTO must not expose V1/live integration");
  });

  await scenario("deterministic replay preserved", ["replay", "determinism"], async () => {
    const surface = await getSurface();
    const replayA = surface.getReplayProof ? surface.getReplayProof() : undefined;
    const replayB = surface.getReplayProof ? surface.getReplayProof() : undefined;
    assert.deepEqual(stable(replayA), stable(replayB), "Replay verification result is not deterministic");

    const dtoA = await getDto();
    const dtoB = await getDto();
    assert.deepEqual(stable(dtoA), stable(dtoB), "Observable DTO is not deterministic after replay checks");
  });

  const failed = results.filter((result) => !result.ok);
  const summary = {
    name: "wave10_observable_machine_audit",
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
