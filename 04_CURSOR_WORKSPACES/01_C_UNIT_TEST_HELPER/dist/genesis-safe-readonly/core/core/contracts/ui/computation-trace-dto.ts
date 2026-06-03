import { z } from "zod";

export const UI_DTO_VERSION = "core-ui-dto-v1" as const;

export const TrustStateSchema = z.enum([
  "TRUSTED",
  "RECOVERABLE",
  "UNCERTAIN",
  "COMPROMISED",
  "HALTED",
  "PANIC"
]);

export const IntegrityStatusSchema = z.enum([
  "unknown",
  "valid",
  "warning",
  "broken",
  "tampered",
  "discontinuity"
]);

export const ProvenanceDTOSchema = z.object({
  provenanceId: z.string(),
  originType: z.string(),
  originEventId: z.string().optional(),
  targetId: z.string(),
  parentProvenanceIds: z.array(z.string()).default([]),
  source: z.string().optional(),
  adapterMode: z.enum(["mock", "api", "runtime", "unknown"]).default("mock"),
  sourceMode: z.enum(["simulated", "local-dto", "runtime-readonly", "live", "unknown"]).default("simulated"),
  providerFormat: z.string().default("binance-like"),
  liveExchangeConnected: z.literal(false).default(false),
  localProvenanceValid: z.boolean().default(false),
  exchangeProofValid: z.literal(false).default(false),
  exchangeTruthStatus: z.literal("unknown").default("unknown"),
  confidence: z.number().min(0).max(1),
  createdAtFromEvent: z.string(),
  hash: z.string().optional(),
  payloadHash: z.string().optional(),
  hashType: z.literal("demo").default("demo"),
  hashStrength: z.literal("non_cryptographic_demo").default("non_cryptographic_demo")
}).strict();

export type ProvenanceDTO = z.infer<typeof ProvenanceDTOSchema>;

export const RuleEvaluationDTOSchema = z.object({
  ruleId: z.string(),
  label: z.string(),
  passed: z.boolean(),
  severity: z.enum(["info", "warning", "blocking", "critical", "panic"]),
  reasonCode: z.string().optional(),
  evidence: z.record(z.unknown()).default({})
}).strict();

export type RuleEvaluationDTO = z.infer<typeof RuleEvaluationDTOSchema>;

export const FormulaExplanationDTOSchema = z.object({
  formulaId: z.string(),
  label: z.string(),
  expression: z.string(),
  inputs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  result: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  deterministic: z.literal(true)
}).strict();

export type FormulaExplanationDTO = z.infer<typeof FormulaExplanationDTOSchema>;

export const SnapshotDiffDTOSchema = z.object({
  beforeRevision: z.number().int().nonnegative(),
  afterRevision: z.number().int().nonnegative(),
  beforeHash: z.string().optional(),
  afterHash: z.string().optional(),
  changedPaths: z.array(z.string()),
  addedPaths: z.array(z.string()).default([]),
  removedPaths: z.array(z.string()).default([])
}).strict();

export type SnapshotDiffDTO = z.infer<typeof SnapshotDiffDTOSchema>;

export const GateVerdictDTOSchema = z.object({
  actionId: z.string(),
  actionType: z.string(),
  allowed: z.boolean(),
  actionClass: z.string(),
  kernelTrustState: TrustStateSchema,
  severity: z.enum(["info", "warning", "critical", "panic"]).or(z.string()),
  blockingReasons: z.array(z.string()),
  allowedAlternatives: z.array(z.string()).default([]),
  gateVersion: z.string()
}).strict();

export type GateVerdictDTO = z.infer<typeof GateVerdictDTOSchema>;

export const LedgerRecordDTOSchema = z.object({
  recordId: z.string(),
  decision: z.enum(["allow", "deny"]),
  actionType: z.string(),
  reasonCodes: z.array(z.string()),
  recordedAtFromEvent: z.string(),
  sourceEventId: z.string().optional()
}).strict();

export type LedgerRecordDTO = z.infer<typeof LedgerRecordDTOSchema>;

export const QuarantineRecordDTOSchema = z.object({
  quarantineId: z.string(),
  reason: z.string(),
  source: z.string(),
  eventId: z.string().optional(),
  eventType: z.string().optional(),
  payloadHash: z.string(),
  severity: z.enum(["info", "warning", "blocking", "critical", "panic"]),
  detectedAtFromEvent: z.string(),
  recoverable: z.boolean()
}).strict();

export type QuarantineRecordDTO = z.infer<typeof QuarantineRecordDTOSchema>;

export const RecoveryHintDTOSchema = z.object({
  dto: z.literal("RecoveryHintDTO").optional(),
  hintId: z.string(),
  actionType: z.string(),
  reason: z.string(),
  priority: z.enum(["none", "low", "medium", "high", "critical"]),
  manualReviewRequired: z.boolean(),
  mode: z.string().optional(),
  systemRecoveryRequired: z.boolean(),
  trustRecoverySuggested: z.boolean(),
  trustRecoveryReason: z.string(),
  autoRecoveryEnabled: z.boolean(),
  hints: z.array(z.string())
}).strict();

export type RecoveryHintDTO = z.infer<typeof RecoveryHintDTOSchema>;

export const FailureMatrixDTOSchema = z.object({
  dto: z.literal("FailureMatrixDTO"),
  scenario: z.string(),
  renderGuardTriggered: z.boolean(),
  renderFallbackActive: z.boolean(),
  adapterMode: z.enum(["mock", "api", "runtime", "unknown"]),
  dataMode: z.enum(["simulated", "local-dto", "runtime-readonly", "live", "unknown"]).or(z.string()),
  finalSafetyState: z.enum(["allowed", "prohibited", "observe_only"]).or(z.string()),
  executionSurface: z.literal("closed"),
  severity: z.enum(["info", "normal", "warning", "critical", "panic"]).or(z.string()),
  blocks: z.array(z.object({
    block: z.string(),
    state: z.string()
  }).strict())
}).strict();

export type FailureMatrixDTO = z.infer<typeof FailureMatrixDTOSchema>;

export const MarketInputIntegrityDTOSchema = z.object({
  status: z.enum([
    "unknown",
    "valid",
    "stale",
    "duplicate",
    "gap_detected",
    "checksum_mismatch",
    "invalid",
    "unverifiable"
  ]),
  observationId: z.string().optional(),
  eventId: z.string().optional(),
  symbol: z.string().optional(),
  channel: z.string().optional(),
  sourceName: z.string().optional(),
  sequence: z.union([z.number(), z.string()]).optional(),
  payloadHash: z.string().optional(),
  provenanceId: z.string().optional(),
  exchangeTruthPresent: z.boolean().default(true),
  exchangeTruthStatus: z.literal("unknown").default("unknown"),
  exchangeTruthProof: z.literal("missing").default("missing"),
  blockingReasons: z.array(z.string()),
  checkedAtFromEvent: z.string()
}).strict();

export type MarketInputIntegrityDTO = z.infer<typeof MarketInputIntegrityDTOSchema>;

export const PipelineStepDTOSchema = z.object({
  stepId: z.string(),
  label: z.string(),
  status: z.enum(["not_started", "running", "passed", "blocked", "failed", "skipped"]),
  inputRefs: z.array(z.string()).default([]),
  outputRefs: z.array(z.string()).default([]),
  startedAtFromEvent: z.string().optional(),
  completedAtFromEvent: z.string().optional(),
  rules: z.array(RuleEvaluationDTOSchema).default([]),
  formulas: z.array(FormulaExplanationDTOSchema).default([])
}).strict();

export type PipelineStepDTO = z.infer<typeof PipelineStepDTOSchema>;

export const MachinePulseDTOSchema = z.object({
  dtoVersion: z.literal(UI_DTO_VERSION),
  pulseId: z.string(),
  scenarioId: z.string().optional(),
  emittedAtFromEvent: z.string(),
  snapshotRevision: z.number().int().nonnegative(),
  snapshotHash: z.string().optional(),
  trustState: TrustStateSchema,
  runtimeMode: z.string(),
  tradingAllowed: z.boolean(),
  summary: z.string(),
  blocked: z.boolean(),
  blockingReasons: z.array(z.string())
}).strict();

export type MachinePulseDTO = z.infer<typeof MachinePulseDTOSchema>;

export const ComputationTraceDTOSchema = z.object({
  dtoVersion: z.literal(UI_DTO_VERSION),
  traceId: z.string(),
  scenarioId: z.string(),
  title: z.string(),
  description: z.string(),
  createdAtFromEvent: z.string(),
  pulse: MachinePulseDTOSchema,
  pipeline: z.array(PipelineStepDTOSchema),
  snapshotDiff: SnapshotDiffDTOSchema,
  gateVerdict: GateVerdictDTOSchema.optional(),
  ledgerRecords: z.array(LedgerRecordDTOSchema).default([]),
  quarantineRecords: z.array(QuarantineRecordDTOSchema).default([]),
  recoveryHints: z.array(RecoveryHintDTOSchema).default([]),
  failureVisualization: FailureMatrixDTOSchema.optional(),
  marketInputIntegrity: MarketInputIntegrityDTOSchema.optional(),
  provenance: z.array(ProvenanceDTOSchema).default([]),
  causality: z.object({
    eventId: z.string().optional(),
    transitionId: z.string().optional(),
    previousSnapshotHash: z.string().optional(),
    eventHash: z.string().optional(),
    transitionHash: z.string().optional(),
    snapshotHash: z.string().optional()
  }).strict(),
  notes: z.array(z.string()).default([])
}).strict();

export type ComputationTraceDTO = z.infer<typeof ComputationTraceDTOSchema>;

export function canonicalDtoStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalDtoStringify(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalDtoStringify(record[key])}`)
    .join(",")}}`;
}

export function validateComputationTraceDTO(value: unknown): ComputationTraceDTO {
  return ComputationTraceDTOSchema.parse(value);
}

export function validateMachinePulseDTO(value: unknown): MachinePulseDTO {
  return MachinePulseDTOSchema.parse(value);
}
