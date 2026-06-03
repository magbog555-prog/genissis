import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function run(label, command, args, options = {}) {
  console.log(`\n[verify:semantic-hardening] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, label, attempts = 20, delayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await wait(delayMs);
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError?.message ?? String(lastError)}`);
}

function assertNoDangerousRawContract(value, path = "$") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    const looksLikeOldFailureMatrixArray =
      value.length > 0 &&
      value.every((item) =>
        item &&
        typeof item === "object" &&
        Object.prototype.hasOwnProperty.call(item, "block") &&
        Object.prototype.hasOwnProperty.call(item, "state")
      );
    const isAllowedBlocksArray = path.endsWith(".blocks") || path.includes(".blocks[");
    if (looksLikeOldFailureMatrixArray && !isAllowedBlocksArray) {
      throw new Error(`${path} is an old ambiguous FailureMatrix array; wrap it in FailureMatrixDTO.blocks`);
    }
    value.forEach((item, index) => assertNoDangerousRawContract(item, `${path}[${index}]`));
    return;
  }

  if (Object.prototype.hasOwnProperty.call(value, "exchangeTruth") && value.exchangeTruth === "known") {
    throw new Error(`${path}.exchangeTruth uses forbidden ambiguous value "known"`);
  }

  const dto = value.dto;
  const looksLikeProvenance =
    dto === "ProvenanceDTO" ||
    Object.prototype.hasOwnProperty.call(value, "localProvenanceValid") ||
    Object.prototype.hasOwnProperty.call(value, "exchangeProofValid") ||
    Object.prototype.hasOwnProperty.call(value, "provider") ||
    Object.prototype.hasOwnProperty.call(value, "chainValid");

  if (looksLikeProvenance) {
    if (Object.prototype.hasOwnProperty.call(value, "provider") && !Object.prototype.hasOwnProperty.call(value, "providerFormat")) {
      throw new Error(`${path}.provider is ambiguous; use providerFormat`);
    }
    if (Object.prototype.hasOwnProperty.call(value, "chainValid") && !Object.prototype.hasOwnProperty.call(value, "localProvenanceValid")) {
      throw new Error(`${path}.chainValid is ambiguous; use localProvenanceValid`);
    }
    if (value.exchangeProofValid !== false) {
      throw new Error(`${path}.exchangeProofValid must be false for mock/simulated provenance`);
    }
    if (value.exchangeTruthStatus !== "unknown") {
      throw new Error(`${path}.exchangeTruthStatus must be "unknown"`);
    }
  }


  const looksLikeRecovery =
    dto === "RecoveryHintDTO" ||
    Object.prototype.hasOwnProperty.call(value, "systemRecoveryRequired") ||
    Object.prototype.hasOwnProperty.call(value, "trustRecoverySuggested") ||
    (Object.prototype.hasOwnProperty.call(value, "hints") && Array.isArray(value.hints));

  if (looksLikeRecovery && dto === "RecoveryHintDTO") {
    if (!Object.prototype.hasOwnProperty.call(value, "systemRecoveryRequired")) {
      throw new Error(`${path}.systemRecoveryRequired is required for RecoveryHintDTO`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, "trustRecoverySuggested")) {
      throw new Error(`${path}.trustRecoverySuggested is required for RecoveryHintDTO`);
    }
    if (value.systemRecoveryRequired !== false) {
      throw new Error(`${path}.systemRecoveryRequired must be false in RC3.5 observe-only self-truth mode`);
    }
    if (value.trustRecoverySuggested !== true) {
      throw new Error(`${path}.trustRecoverySuggested must be true when exchange truth is unknown`);
    }
    if (value.trustRecoveryReason !== "exchange_truth_unknown") {
      throw new Error(`${path}.trustRecoveryReason must be exchange_truth_unknown`);
    }
    if (value.autoRecoveryEnabled !== false) {
      throw new Error(`${path}.autoRecoveryEnabled must be false`);
    }
    const hints = Array.isArray(value.hints) ? value.hints : [];
    if (hints.includes("no recovery required")) {
      throw new Error(`${path}.hints must not contain ambiguous "no recovery required"`);
    }
    if (!hints.includes("reconcile_exchange_truth") || !hints.includes("check_market_data_source")) {
      throw new Error(`${path}.hints must include reconcile_exchange_truth and check_market_data_source`);
    }
  }

  const looksLikeFailureVisualization =
    (dto === "FailureVisualizationDTO" || dto === "FailureMatrixDTO") ||
    Object.prototype.hasOwnProperty.call(value, "renderGuardTriggered") ||
    Object.prototype.hasOwnProperty.call(value, "renderFallbackActive") ||
    Object.prototype.hasOwnProperty.call(value, "renderGuard") ||
    Object.prototype.hasOwnProperty.call(value, "fallback");

  if (looksLikeFailureVisualization && (dto === "FailureVisualizationDTO" || dto === "FailureMatrixDTO")) {
    for (const required of ["renderGuardTriggered", "renderFallbackActive", "adapterMode", "dataMode", "finalSafetyState", "executionSurface", "blocks"]) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        throw new Error(`${path}.${required} is required for FailureMatrixDTO`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(value, "renderGuard")) {
      throw new Error(`${path}.renderGuard is ambiguous; use renderGuardTriggered`);
    }
    if (Object.prototype.hasOwnProperty.call(value, "fallback")) {
      throw new Error(`${path}.fallback is ambiguous; use renderFallbackActive`);
    }
    if (value.executionSurface !== "closed") {
      throw new Error(`${path}.executionSurface must be closed`);
    }
    if (!Array.isArray(value.blocks)) {
      throw new Error(`${path}.blocks must be an array`);
    }
    if (Object.prototype.hasOwnProperty.call(value, "matrix")) {
      throw new Error(`${path}.matrix is ambiguous; use blocks`);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    assertNoDangerousRawContract(child, `${path}.${key}`);
  }
}

function scanFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) scanFiles(path, files);
    else if (/\.(ts|js|json)$/.test(name)) files.push(path);
  }
  return files;
}

function assertSourceHasNoForbiddenContractStrings() {
  const files = [...scanFiles("core"), ...scanFiles("frontend")];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (text.includes('"exchangeTruth": "known"') || text.includes("exchangeTruth:'known'") || text.includes('exchangeTruth: "known"')) {
      throw new Error(`${file} contains forbidden exchangeTruth known contract`);
    }
    if (text.includes("dto:'ProvenanceDTO'") || text.includes('dto: "ProvenanceDTO"') || text.includes('"dto": "ProvenanceDTO"')) {
      if (!text.includes("exchangeProofValid:false") && !text.includes("exchangeProofValid: false") && !text.includes('"exchangeProofValid": false')) {
        throw new Error(`${file} contains ProvenanceDTO without exchangeProofValid=false`);
      }
      if (!text.includes("exchangeTruthStatus:'unknown'") && !text.includes('exchangeTruthStatus: "unknown"') && !text.includes('"exchangeTruthStatus": "unknown"')) {
        throw new Error(`${file} contains ProvenanceDTO without exchangeTruthStatus="unknown"`);
      }
    }
    if (text.includes("dto:'RecoveryHintDTO'") || text.includes('dto: "RecoveryHintDTO"') || text.includes('"dto": "RecoveryHintDTO"')) {
      if (!text.includes("systemRecoveryRequired")) {
        throw new Error(`${file} contains RecoveryHintDTO without systemRecoveryRequired`);
      }
      if (!text.includes("trustRecoverySuggested")) {
        throw new Error(`${file} contains RecoveryHintDTO without trustRecoverySuggested`);
      }
      if (text.includes("no recovery required")) {
        throw new Error(`${file} contains ambiguous recovery hint "no recovery required"`);
      }
    }
    if (text.includes("dto:'FailureVisualizationDTO'") || text.includes('dto: "FailureVisualizationDTO"') || text.includes('"dto": "FailureVisualizationDTO"') || text.includes("dto:\'FailureMatrixDTO\'") || text.includes('dto: "FailureMatrixDTO"') || text.includes('"dto": "FailureMatrixDTO"')) {
      for (const required of ["renderGuardTriggered", "renderFallbackActive", "adapterMode", "dataMode", "finalSafetyState", "executionSurface", "blocks"]) {
        if (!text.includes(required)) {
          throw new Error(`${file} contains FailureMatrixDTO without ${required}`);
        }
      }
      if (text.includes("renderGuard:") || text.includes("fallback:")) {
        throw new Error(`${file} contains ambiguous FailureMatrixDTO renderGuard/fallback fields`);
      }
      if (text.includes("matrix:")) {
        throw new Error(`${file} contains ambiguous FailureMatrixDTO matrix field; use blocks`);
      }
    }
  }
}


run("core semantic hardening tests", "npm", ["--prefix", "core", "run", "verify:semantic-hardening"]);
run("frontend build", "npm", ["--prefix", "frontend", "run", "build"]);
assertSourceHasNoForbiddenContractStrings();

const verifyPort = String(4200 + Math.floor(Math.random() * 500));
const verifyBaseUrl = `http://127.0.0.1:${verifyPort}`;
console.log("\n[verify:semantic-hardening] starting readonly API");
const server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
  stdio: "ignore",
  shell: process.platform === "win32",
  env: { ...process.env, CORE_READONLY_API_PORT: verifyPort, SELF_TRUTH_CLEAN_MODE: "true" }
});

try {
  await wait(1000);

  const audit = await fetchJsonWithRetry(`${verifyBaseUrl}/api/core/self-truth/audit`, "self-truth audit");
  if (audit?.result !== "pass") throw new Error(`self-truth audit result must be pass, got ${JSON.stringify(audit)}`);

  const snapshot = await fetchJsonWithRetry(`${verifyBaseUrl}/api/core/runtime/snapshot`, "runtime snapshot");
  if ("raw" in snapshot) throw new Error("UI-facing RuntimeSnapshot must not contain raw");
  if (!snapshot?.rawSummary?.omittedForUiSafety) throw new Error("RuntimeSnapshot must expose rawSummary safety marker");
  if (!snapshot?.semantic?.exchangeTruth?.status) throw new Error("RuntimeSnapshot must expose semantic.exchangeTruth.status");
  if (!snapshot?.semantic?.provenance) throw new Error("RuntimeSnapshot must expose semantic.provenance");
  assertNoDangerousRawContract(snapshot, "$.runtimeSnapshot");
  if (snapshot.semantic.exchangeTruth.status !== "unknown") throw new Error("semantic.exchangeTruth.status must be unknown");
  if (snapshot.semantic.provenance.exchangeProofValid !== false) throw new Error("semantic.provenance.exchangeProofValid must be false");
  if (snapshot.semantic.provenance.exchangeTruthStatus !== "unknown") throw new Error("semantic.provenance.exchangeTruthStatus must be unknown");
  if (snapshot.semantic.recovery.systemRecoveryRequired !== false) throw new Error("semantic.recovery.systemRecoveryRequired must be false");
  if (snapshot.semantic.recovery.trustRecoverySuggested !== true) throw new Error("semantic.recovery.trustRecoverySuggested must be true");
  if (snapshot.semantic.recovery.trustRecoveryReason !== "exchange_truth_unknown") throw new Error("semantic.recovery.trustRecoveryReason must be exchange_truth_unknown");
  if (snapshot.semantic.failureMatrix.executionSurface !== "closed") throw new Error("semantic.failureMatrix.executionSurface must be closed");

  const trace = await fetchJsonWithRetry(`${verifyBaseUrl}/api/core/computation-trace/latest?scenario=MARKET_INPUT_STALE_DENY`, "latest computation trace");
  assertNoDangerousRawContract(trace, "$.latestTrace");
  const rawFailure = trace?.failureVisualization;
  if (Array.isArray(rawFailure)) {
    throw new Error("Failure Matrix raw DTO must be an object, got bare array");
  }
  if (!rawFailure || typeof rawFailure !== "object") {
    throw new Error("Failure Matrix raw DTO is missing");
  }
  if (rawFailure.dto !== "FailureMatrixDTO") {
    throw new Error(`Failure Matrix raw DTO must have dto="FailureMatrixDTO", got ${rawFailure.dto}`);
  }
  for (const required of ["scenario", "renderGuardTriggered", "renderFallbackActive", "adapterMode", "dataMode", "finalSafetyState", "executionSurface", "severity", "blocks"]) {
    if (!Object.prototype.hasOwnProperty.call(rawFailure, required)) {
      throw new Error(`Failure Matrix raw DTO missing ${required}`);
    }
  }
  if (!Array.isArray(rawFailure.blocks)) {
    throw new Error("Failure Matrix raw DTO blocks must be an array");
  }
  if (snapshot?.verdict?.result === "allowed" && snapshot?.trust?.state !== "TRUSTED") {
    throw new Error("allowed without TRUSTED proof is forbidden");
  }

  run("readonly surface", "npm", ["--prefix", "core", "run", "verify:readonly-surface"], {
    env: { ...process.env, CORE_READONLY_API_BASE_URL: verifyBaseUrl }
  });
} finally {
  server.kill();
}

console.log("\n[verify:semantic-hardening] PASS");
