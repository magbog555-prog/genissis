import fs from "node:fs";
import assert from "node:assert/strict";

const main = fs.readFileSync("frontend/src/main.jsx", "utf8");

const requiredSnippets = [
  "function CoreOverviewPanel",
  "function LiveMarketStreamPanel",
  "Raw CoreOverviewDTO",
  "Raw LiveMarketStreamDTO",
  "trace.coreOverview",
  "trace.liveStream?.status",
  "NO PROOF → NO ALLOW",
  "['coreOverview'",
  "['liveStream'"
];

for (const snippet of requiredSnippets) {
  assert(main.includes(snippet), `missing RC4-B frontend snippet: ${snippet}`);
}

assert(!main.includes("JSON.stringify(trace.liveStream?.status"), "live stream raw must use safeValue/safeStringify");
assert(main.includes("safeStringify"), "safeStringify must remain available");
assert(main.includes("rawSummary"), "last-event rawSummary must be visible in source path");

console.log("verify:rc4-b-frontend-panels PASS");
