import * as fs from "fs";
import * as path from "path";

export type Hypothesis = {
  hypothesisId: string;
  strategyId: string;
  status: string;
  marketType: string;
  symbols: string[];
  expectedBehavior: string;
  invalidation: string;
  minSampleSize: number;
};

type HypothesisConfig = {
  hypotheses: Hypothesis[];
};

const CONFIG_PATH = path.resolve(
  process.cwd(),
  "config/hypotheses.json"
);

let cache: Map<string, Hypothesis> | null = null;

function loadHypotheses(): Map<string, Hypothesis> {
  if (cache) return cache;

  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`hypotheses.json not found at ${CONFIG_PATH}`);
  }

  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed: HypothesisConfig = JSON.parse(raw);

  const map = new Map<string, Hypothesis>();

  for (const h of parsed.hypotheses) {
    map.set(h.hypothesisId, h);
  }

  cache = map;
  return map;
}

export function resolveHypothesis(
  hypothesisId?: string,
  strategyId?: string
): Hypothesis | null {
  const hypotheses = loadHypotheses();

  if (!hypothesisId) {
    console.warn("[PR35] missing hypothesisId");
    return null;
  }

  const h = hypotheses.get(hypothesisId);

  if (!h) {
    console.warn(`[PR35] unknown hypothesisId=${hypothesisId}`);
    return null;
  }

  if (strategyId && h.strategyId !== strategyId) {
    console.warn(
      `[PR35] hypothesis ${hypothesisId} mismatch strategy ${strategyId} → fallback`
    );
    return null;
  }

  return h;
}