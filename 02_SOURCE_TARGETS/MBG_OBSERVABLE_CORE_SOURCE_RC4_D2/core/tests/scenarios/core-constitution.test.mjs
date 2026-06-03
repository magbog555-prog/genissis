import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const constitutionPath = path.join(repoRoot, "CORE_CONSTITUTION.md");
const constantsPath = path.join(repoRoot, "core", "kernel", "kernel-constitution.ts");

const constitution = fs.readFileSync(constitutionPath, "utf-8");
const constants = fs.readFileSync(constantsPath, "utf-8");

const acceptanceReportPath = path.join(repoRoot, "ALPHA5_ACCEPTANCE_REPORT.md");
assert.ok(
  fs.existsSync(acceptanceReportPath),
  "ALPHA5_ACCEPTANCE_REPORT.md must exist"
);

const acceptanceReport = fs.readFileSync(acceptanceReportPath, "utf-8");

const requiredAcceptanceSections = [
  "What entered alpha1",
  "What entered alpha2",
  "What entered alpha3",
  "What entered alpha4",
  "What entered alpha5",
  "Main kernel laws now active",
  "Required checks",
  "Strict prohibitions",
  "Remaining risks",
  "Next stage"
];

for (const section of requiredAcceptanceSections) {
  assert.ok(
    acceptanceReport.includes(section),
    `ALPHA5_ACCEPTANCE_REPORT.md must include section: ${section}`
  );
}

assert.ok(
  constitution.includes("Base code: `mbg-core-v0.1-alpha9`"),
  "CORE_CONSTITUTION.md must be aligned to alpha9 base"
);


const requiredLawIds = Array.from({ length: 65 }, (_, index) => `LAW-${String(index + 1).padStart(3, "0")}`);
const requiredTrustStates = ["TRUSTED", "RECOVERABLE", "UNCERTAIN", "COMPROMISED", "HALTED", "PANIC"];

for (const lawId of requiredLawIds) {
  assert.ok(
    constitution.includes(lawId),
    `CORE_CONSTITUTION.md must document ${lawId}`
  );
  assert.ok(
    constants.includes(`"${lawId}"`),
    `kernel-constitution.ts must export ${lawId}`
  );
}

for (const state of requiredTrustStates) {
  assert.ok(
    constitution.includes(`\`${state}\``) || constitution.includes(state),
    `CORE_CONSTITUTION.md must document kernel trust state ${state}`
  );
  assert.ok(
    constants.includes(`${state}: "${state}"`),
    `kernel-constitution.ts must export kernel trust state ${state}`
  );
}

const requiredPhrases = [
  "No event, no state change",
  "No trusted state, no trading action",
  "Unknown is safer than fake confidence",
  "Position unknown blocks risk",
  "Order uncertain blocks risk",
  "Bootstrap not reconciled forbids trading",
  "Stale exchange truth forbids trading",
  "Replay mismatch breaks trust",
  "Invalid event never enters journal",
  "Duplicate event does not change state",
  "No fill, no PnL",
  "Live order without metadata is forbidden",
  "Exchange truth outranks local memory",
  "Frontend is not authority",
  "V1 is not authority",
  "Bootstrap FSM governs trading readiness",
  "Event validation is core responsibility",
  "Idempotency index is recoverable from journal",
  "Reducers remain pure",
  "Duplicate event cannot mutate state",
  "Invalid event never enters canonical journal",
  "Bootstrap failed cannot transition to reconciled without recovery event",
  "ExchangeTruth unknown forbids normal trading",
  "ExchangeTruth stale forbids normal trading",
  "ExchangeTruth conflicted forbids normal trading",
  "Market data stale forbids normal trading",
  "Health must not report fake truth",
  "Unknown connection state is not connected",
  "Local flat position is not trusted without fresh exchange reconcile",
  "Freshness unknown is stale for normal trading",
  "Kernel Authority is the canonical trust evaluator",
  "Kernel Authority must be pure",
  "CoreTrustReport is the canonical trust output",
  "Frontend must not calculate trust",
  "V1 must not calculate core trust",
  "Every denied action must have machine-readable reasons",
  "Trust state must be explainable",
  "ActionGate must use kernel trust state",
  "Invalid or suspicious data must not enter canonical journal",
  "Quarantined data must not mutate runtime state",
  "Quarantine is diagnostic, not canonical history",
  "Every ActionGate verdict must be auditable",
  "Permission Ledger records allow and deny decisions",
  "Recovery Planner suggests actions but does not execute them",
  "Recovery actions must still pass ActionGate",
  "Normal trading remains forbidden until recovery conditions are satisfied",
  "Permission Ledger must not mutate trading state",
  "Quarantine must preserve rejected evidence",
  "Every committed event must have a stable event hash",
  "Every produced snapshot must have a deterministic snapshot hash",
  "Every transition must link before snapshot, event, and after snapshot",
  "Snapshot revision must match applied event revision",
  "Hash chain discontinuity is a corruption signal",
  "Causality trace must explain every state transition",
  "Trust state changes must be causally explainable",
  "ActionGate verdict must reference snapshot revision and causality trace when available",
  "Replay mismatch with hash evidence marks kernel COMPROMISED or PANIC",
  "Unknown hash is not corruption; proven mismatch is corruption"
];

for (const phrase of requiredPhrases) {
  assert.ok(
    constitution.includes(phrase),
    `CORE_CONSTITUTION.md must contain required law phrase: ${phrase}`
  );
}

const requiredModuleReferences = [
  "core/contracts/src/events.ts",
  "core/state/src/types.ts",
  "core/transitions/src/reducers.ts",
  "core/gates/src/action-gate.ts",
  "core/invariants/engine.invariants.ts",
  "core/system/journal.ts",
  "core/system/state-hash.ts",
  "core/kernel/core-trust-report.ts",
  "core/events/validate-domain-event.ts",
  "core/runtime/event-index.ts",
  "core/exchange/exchange-truth.ts",
  "core/freshness/freshness-guard.ts",
  "core/health/runtime-health-snapshot.ts",
  "core/kernel/kernel-authority.ts",
  "core/runtime/src/runtime-engine.ts",
  "apps/runtime-api/src/app.ts",
  "tests/scenarios/*",
  "core/quarantine/quarantine.ts",
  "core/permissions/permission-ledger.ts",
  "core/recovery/recovery-planner.ts",
  "core/hash/event-hash.ts",
  "core/hash/snapshot-hash.ts",
  "core/integrity/snapshot-hash-chain.ts",
  "core/causality/transition-trace.ts",
  "core/trace/causality-trace.ts"
];

for (const moduleRef of requiredModuleReferences) {
  assert.ok(
    constitution.includes(moduleRef),
    `CORE_CONSTITUTION.md must link law coverage to module: ${moduleRef}`
  );
}

const forbiddenAuthorityPatterns = [
  /frontend may certify/i,
  /V1 may certify/i,
  /strategy is authority/i,
  /ядро ищет сделки/i,
  /core searches for trades/i
];

for (const pattern of forbiddenAuthorityPatterns) {
  assert.equal(
    pattern.test(constitution),
    false,
    `CORE_CONSTITUTION.md contains forbidden authority wording: ${pattern}`
  );
}

assert.ok(
  constants.includes("CORE_REVIEW_RULE"),
  "kernel-constitution.ts must export CORE_REVIEW_RULE"
);


const requiredWave3Constants = [
  "WAVE3_CONSTITUTION_SCOPE",
  "WAVE3_MODULE_MAPPING",
  "EXCHANGE_TRUTH_STATUS",
  "FRESHNESS_STATUS",
  "HEALTH_TRUTH_RULE"
];

for (const exportedName of requiredWave3Constants) {
  assert.ok(
    constants.includes(`export const ${exportedName}`),
    `kernel-constitution.ts must export ${exportedName}`
  );
}

const requiredWave3Mappings = [
  "EXCHANGE_TRUTH",
  "FRESHNESS",
  "HEALTH_TRUTH",
  "SCENARIO_AUDIT"
];

for (const mapping of requiredWave3Mappings) {
  assert.ok(
    constants.includes(`${mapping}:`),
    `kernel-constitution.ts must include Wave 3 mapping ${mapping}`
  );
}

const forbiddenWave3RuntimeClaims = [
  /IMPLEMENTS_KERNEL_AUTHORITY:\s*true/,
  /IMPLEMENTS_CORE_TRUST_REPORT:\s*true/,
  /CONNECTS_V1:\s*true/,
  /CONNECTS_V2:\s*true/,
  /ENABLES_LIVE_TRADING:\s*true/,
  /ADDS_REAL_EXCHANGE_KEYS:\s*true/
];

for (const pattern of forbiddenWave3RuntimeClaims) {
  assert.equal(
    pattern.test(constants),
    false,
    `kernel-constitution.ts must not claim forbidden Wave 3 implementation: ${pattern}`
  );
}

const requiredHealthTruthPhrases = [
  "unknown connection state is not connected",
  "local flat position is not trusted without fresh exchange reconcile",
  "Health must not report fake truth"
];

for (const phrase of requiredHealthTruthPhrases) {
  assert.ok(
    constitution.toLowerCase().includes(phrase.toLowerCase()),
    `CORE_CONSTITUTION.md must document health truth phrase: ${phrase}`
  );
}



const requiredWave4Constants = [
  "WAVE4_CONSTITUTION_SCOPE",
  "WAVE4_MODULE_MAPPING",
  "ACTION_GATE_VERDICT_V2_REQUIREMENT",
  "CORE_TRUST_REPORT_REQUIREMENT",
  "KERNEL_AUTHORITY_REQUIREMENT"
];

for (const exportedName of requiredWave4Constants) {
  assert.ok(
    constants.includes(`export const ${exportedName}`),
    `kernel-constitution.ts must export ${exportedName}`
  );
}

const requiredWave5Constants = [
  "WAVE5_CONSTITUTION_SCOPE",
  "WAVE5_MODULE_MAPPING",
  "QUARANTINE_REQUIREMENT",
  "PERMISSION_LEDGER_REQUIREMENT",
  "RECOVERY_PLANNER_REQUIREMENT"
];

for (const exportedName of requiredWave5Constants) {
  assert.ok(
    constants.includes(`export const ${exportedName}`),
    `kernel-constitution.ts must export ${exportedName}`
  );
}

const requiredWave5Mappings = [
  "QUARANTINE",
  "PERMISSION_LEDGER",
  "RECOVERY_PLANNER",
  "SCENARIO_AUDIT"
];

for (const mapping of requiredWave5Mappings) {
  assert.ok(
    constants.includes(`${mapping}:`),
    `kernel-constitution.ts must include Wave 5 mapping ${mapping}`
  );
}

const requiredWave5Phrases = [
  "invalid or suspicious data must not enter canonical journal",
  "quarantined data must not mutate runtime state",
  "quarantine is diagnostic, not canonical history",
  "every ActionGate verdict must be auditable",
  "Permission Ledger records allow and deny decisions",
  "Recovery Planner suggests actions but does not execute them",
  "Recovery actions must still pass ActionGate",
  "normal trading remains forbidden until recovery conditions are satisfied",
  "Permission Ledger must not mutate trading state",
  "Quarantine must preserve rejected evidence",
  "Every committed event must have a stable event hash",
  "Every produced snapshot must have a deterministic snapshot hash",
  "Every transition must link before snapshot, event, and after snapshot",
  "Snapshot revision must match applied event revision",
  "Hash chain discontinuity is a corruption signal",
  "Causality trace must explain every state transition",
  "Trust state changes must be causally explainable",
  "ActionGate verdict must reference snapshot revision and causality trace when available",
  "Replay mismatch with hash evidence marks kernel COMPROMISED or PANIC",
  "Unknown hash is not corruption; proven mismatch is corruption"
];

for (const phrase of requiredWave5Phrases) {
  assert.ok(
    constitution.toLowerCase().includes(phrase.toLowerCase()),
    `CORE_CONSTITUTION.md must document Wave 5 phrase: ${phrase}`
  );
}

const forbiddenWave5RuntimeClaims = [
  /IMPLEMENTS_RUNTIME_BEHAVIOR:\s*true/,
  /IMPLEMENTS_RECOVERY_PLANNER_CODE:\s*true/,
  /IMPLEMENTS_QUARANTINE_CODE:\s*true/,
  /IMPLEMENTS_PERMISSION_LEDGER_CODE:\s*true/,
  /EXECUTES_AUTOMATIC_RECOVERY:\s*true/,
  /CONNECTS_V1:\s*true/,
  /CONNECTS_V2:\s*true/,
  /ENABLES_LIVE_TRADING:\s*true/,
  /ADDS_REAL_EXCHANGE_KEYS:\s*true/
];

for (const pattern of forbiddenWave5RuntimeClaims) {
  assert.equal(
    pattern.test(constants),
    false,
    `kernel-constitution.ts must not claim forbidden Wave 5 implementation: ${pattern}`
  );
}



const requiredWave7Constants = [
  "WAVE7_CONSTITUTION_SCOPE",
  "WAVE7_MODULE_MAPPING",
  "HASH_CHAIN_REQUIREMENT",
  "CAUSALITY_TRACE_REQUIREMENT"
];

for (const exportedName of requiredWave7Constants) {
  assert.ok(
    constants.includes(`export const ${exportedName}`),
    `kernel-constitution.ts must export ${exportedName}`
  );
}

const requiredWave7Mappings = [
  "SNAPSHOT_HASH_CHAIN",
  "CAUSALITY_TRACE",
  "REPLAY_HASH_EVIDENCE",
  "SCENARIO_AUDIT"
];

for (const mapping of requiredWave7Mappings) {
  assert.ok(
    constants.includes(`${mapping}:`),
    `kernel-constitution.ts must include Wave 7 mapping ${mapping}`
  );
}

const requiredWave7Phrases = [
  "every committed event must have a stable event hash",
  "every produced snapshot must have a deterministic snapshot hash",
  "every transition must link before snapshot, event, and after snapshot",
  "snapshot revision must match applied event revision",
  "hash chain discontinuity is a corruption signal",
  "causality trace must explain every state transition",
  "trust state changes must be causally explainable",
  "ActionGate verdict must reference snapshot revision and causality trace when available",
  "Replay mismatch with hash evidence must mark kernel as `COMPROMISED` or `PANIC` depending on severity",
  "Unknown hash is not corruption; proven mismatch is corruption"
];

for (const phrase of requiredWave7Phrases) {
  assert.ok(
    constitution.toLowerCase().includes(phrase.toLowerCase()),
    `CORE_CONSTITUTION.md must document Wave 7 phrase: ${phrase}`
  );
}

const forbiddenWave7RuntimeClaims = [
  /IMPLEMENTS_RUNTIME_BEHAVIOR:\s*true/,
  /IMPLEMENTS_HASH_CHAIN_CODE:\s*true/,
  /IMPLEMENTS_CAUSALITY_TRACE_CODE:\s*true/,
  /CONNECTS_V1:\s*true/,
  /CONNECTS_V2:\s*true/,
  /ENABLES_LIVE_TRADING:\s*true/,
  /ADDS_REAL_EXCHANGE_KEYS:\s*true/
];

for (const pattern of forbiddenWave7RuntimeClaims) {
  assert.equal(
    pattern.test(constants),
    false,
    `kernel-constitution.ts must not claim forbidden Wave 7 implementation: ${pattern}`
  );
}


console.log("✅ Core Constitution checks passed");
