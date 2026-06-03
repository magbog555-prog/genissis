import * as fs from "fs";
import * as path from "path";

export type Strategy = {
  strategyId: string;
  strategyVersion: string;
  setupType: string;
  sourceLogic: string;
  enabled: boolean;
  description?: string;
};

type StrategyConfig = {
  strategies: Strategy[];
};

const CONFIG_PATH = path.resolve(
  process.cwd(),
  "config/strategies.json"
);

let cache: Map<string, Strategy> | null = null;

function loadStrategies(): Map<string, Strategy> {
  if (cache) return cache;

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`strategies.json not found at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed: StrategyConfig = JSON.parse(raw);

  const map = new Map<string, Strategy>();

  for (const s of parsed.strategies) {
    map.set(s.strategyId, s);
  }

  cache = map;
  return map;
}

export function resolveStrategy(strategyId?: string): Strategy {
  const strategies = loadStrategies();

  const fallback = strategies.get("manual_unknown_v1");

  if (!fallback) {
    throw new Error("Fallback strategy manual_unknown_v1 missing");
  }

  if (!strategyId) {
    console.warn("[PR35] missing strategyId → fallback");
    return fallback;
  }

  const strategy = strategies.get(strategyId);

  if (!strategy) {
    console.warn(`[PR35] unknown strategyId=${strategyId} → fallback`);
    return fallback;
  }

  if (!strategy.enabled) {
    console.warn(`[PR35] disabled strategyId=${strategyId} → fallback`);
    return fallback;
  }

  return strategy;
}
