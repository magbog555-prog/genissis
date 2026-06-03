import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = path.join(workspaceRoot, "frontend", "src");

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const NEGATIVE_FIXTURE_ALLOWLIST = [
  /[\\/]tests[\\/].*[\\/]fixtures[\\/].*[\\/]negative[\\/]/i,
  /[\\/]tests[\\/].*[\\/]negative[\\/]/i
];

const POLICY = [
  {
    id: "compute-allow-or-execute",
    regex: /\bcompute[A-Za-z0-9_]*(Allow|Execute)\b/i,
    reason: "UI panel must not compute machine allow/execute decisions."
  },
  {
    id: "actionpath-execution-route",
    regex: /\bactionPath\b\s*[:=]\s*["'`][^"'`\n]*(buy|sell|execute)[^"'`\n]*["'`]/i,
    reason: "UI panel must not carry buy/sell/execute action paths."
  },
  {
    id: "canexecute-true",
    regex: /\bcanExecute\b\s*[:=]\s*true\b/i,
    reason: "UI panel must not expose executable state."
  },
  {
    id: "buy-sell-command-route",
    regex: /\b(commandRoute|commandPath|routeToCommand)\b\s*[:=]\s*["'`][^"'`\n]*(buy|sell)[^"'`\n]*["'`]/i,
    reason: "UI panel must not include buy/sell command routing."
  },
  {
    id: "execution-api-call",
    regex: /\/api\/[^"'`\n]*(buy|sell|execute)\b/i,
    reason: "UI panel must not call execution APIs."
  }
];

function isNegativeFixture(filePath) {
  return NEGATIVE_FIXTURE_ALLOWLIST.some((rule) => rule.test(filePath));
}

function collectSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, out);
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry))) continue;
    out.push(fullPath);
  }
  return out;
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

const failures = [];
const files = collectSourceFiles(uiRoot);

for (const filePath of files) {
  if (isNegativeFixture(filePath)) continue;
  const content = readFileSync(filePath, "utf8");
  for (const policy of POLICY) {
    const match = policy.regex.exec(content);
    if (!match) continue;
    failures.push({
      filePath: path.relative(workspaceRoot, filePath),
      rule: policy.id,
      reason: policy.reason,
      line: lineNumberAt(content, match.index),
      snippet: match[0]
    });
  }
}

if (failures.length > 0) {
  console.error("verify:ui-machine-guardrail FAILED");
  for (const failure of failures) {
    console.error(
      ` - ${failure.filePath}:${failure.line} [${failure.rule}] ${failure.reason} :: ${failure.snippet}`
    );
  }
  process.exit(1);
}

console.log("verify:ui-machine-guardrail PASS");
