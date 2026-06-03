import fs from "node:fs";
import assert from "node:assert/strict";

const main = fs.readFileSync("frontend/src/main.jsx", "utf8");
const css = fs.readFileSync("frontend/src/styles.css", "utf8");

const required = [
  "RC4C_LAYOUT_SCHEMA_VERSION='rc4-c-layout-v1'",
  "RC4C_LAYOUT_STORAGE_KEY='mbg.rc4c.layout.v1'",
  "function readRc4cLayoutState",
  "function buildRc4cLayoutState",
  "function saveRc4cLayoutState",
  "function clearRc4cLayoutState",
  "activeTabId",
  "openTabs",
  "panels",
  "compactMode",
  "language",
  "resetMode:'manual-only'",
  "panelsToLayout",
  "panelsToVisible",
  "panelsToCollapsed"
];

for (const snippet of required) {
  assert(main.includes(snippet), `missing RC4-C layout persistence snippet: ${snippet}`);
}

assert(
  main.includes("usePersistedState('ocm_rc4c_compact'") || main.includes("useLocalState('ocm_rc4c_compact'"),
  "compact mode must be persistent (localStorage-backed)"
);
assert(
  !/function applyWorkspacePayload\([^)]*\)\{[^}]*setCompact\(false\)/.test(main),
  "applyWorkspacePayload must not reset compact mode when switching scenes"
);
assert(main.includes("function buildWorkspaceBootstrap"), "hydration must prefer mbg.rc4c.layout.v1 over stale legacy keys");
assert(main.includes("setWorkspaceTabs(makeDefaultWorkspaceTabs())"), "manual reset must reset tabs intentionally");
assert(main.includes("clearRc4cLayoutState()"), "manual reset must clear versioned layout storage");
assert(main.includes("saveRc4cLayoutState({"), "layout state must be saved to versioned localStorage");
assert(!main.includes("const [compact,setCompact]=useState(false)"), "compact mode must not be volatile useState only");

const cssRequired = [
  ".window-body",
  "overflow:auto",
  ".raw-json",
  "overflow:auto!important",
  "overflow-wrap:anywhere",
  ".workspace"
];

for (const snippet of cssRequired) {
  assert(css.includes(snippet), `missing stable layout/raw scroll CSS snippet: ${snippet}`);
}

console.log("verify:frontend-layout PASS");
