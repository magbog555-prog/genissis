import { z } from "zod";
import {
  ComputationTraceDTOSchema,
  GateVerdictDTOSchema,
  IntegrityStatusSchema,
  MachinePulseDTOSchema,
  MarketInputIntegrityDTOSchema,
  QuarantineRecordDTOSchema,
  RecoveryHintDTOSchema,
  SnapshotDiffDTOSchema,
  UI_DTO_VERSION
} from "./computation-trace-dto.js";

export const CONNECTED_READONLY_CORE_API_VERSION = "wave10b-connected-readonly-core-api-v1" as const;

export const ConnectedReadOnlyCoreEndpointSchema = z.enum([
  "/core/status",
  "/core/trace/latest",
  "/core/trust/report",
  "/core/integrity/report",
  "/core/revisions/timeline",
  "/core/market-input/status",
  "/core/recovery",
  "/core/quarantine"
]);

export type ConnectedReadOnlyCoreEndpoint = z.infer<typeof ConnectedReadOnlyCoreEndpointSchema>;

export const ConnectedReadOnlyCoreEndpointListSchema = z.array(ConnectedReadOnlyCoreEndpointSchema);

export const CoreApiAdapterMetaSchema = z.object({
  apiVersion: z.literal(CONNECTED_READONLY_CORE_API_VERSION),
  dtoVersion: z.literal(UI_DTO_VERSION),
  scenarioId: z.string(),
  source: z.literal("core-mock-scenario-api"),
  adapterCompatibility: z.object({
    mockAdapter: z.literal(true),
    apiAdapter: z.literal(true),
    readOnly: z.literal(true),
    deterministic: z.literal(true)
  }).strict(),
  generatedAtFromEvent: z.string()
}).strict();

export type CoreApiAdapterMeta = z.infer<typeof CoreApiAdapterMetaSchema>;

export const CoreApiMachineSchema = z.object({
  status: z.string(),
  trustState: z.string(),
  runtimeMode: z.string(),
  tradingAllowed: z.boolean(),
  blocked: z.boolean(),
  revision: z.number().int().nonnegative(),
  snapshotHash: z.string().optional(),
  mainReason: z.string(),
  blockingReasons: z.array(z.string())
}).strict();

export type CoreApiMachine = z.infer<typeof CoreApiMachineSchema>;

export const CoreApiEventSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  source: z.string(),
  receivedAt: z.string(),
  eventTime: z.string(),
  sequence: z.union([z.number(), z.string()]),
  payloadHash: z.string(),
  provenanceId: z.string().optional()
}).strict();

export type CoreApiEvent = z.infer<typeof CoreApiEventSchema>;

export const AdapterCompatibleComputationTraceResponseSchema = ComputationTraceDTOSchema.extend({
  apiVersion: z.literal(CONNECTED_READONLY_CORE_API_VERSION),
  machine: CoreApiMachineSchema,
  event: CoreApiEventSchema,
  adapterMeta: CoreApiAdapterMetaSchema
}).strict();

export type AdapterCompatibleComputationTraceResponse = z.infer<typeof AdapterCompatibleComputationTraceResponseSchema>;

export const CoreStatusResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/status"),
  status: MachinePulseDTOSchema,
  machine: CoreApiMachineSchema,
  scenarios: z.array(z.string()),
  endpoints: ConnectedReadOnlyCoreEndpointListSchema
}).strict();

export type CoreStatusResponse = z.infer<typeof CoreStatusResponseSchema>;

export const CoreTrustReportResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/trust/report"),
  trustState: z.string(),
  tradingAllowed: z.boolean(),
  runtimeMode: z.string(),
  blockingReasons: z.array(z.string()),
  gateVerdict: GateVerdictDTOSchema.optional()
}).strict();

export type CoreTrustReportResponse = z.infer<typeof CoreTrustReportResponseSchema>;

export const CoreIntegrityReportResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/integrity/report"),
  status: IntegrityStatusSchema,
  snapshotHash: z.string().optional(),
  previousSnapshotHash: z.string().optional(),
  eventHash: z.string().optional(),
  transitionHash: z.string().optional(),
  causality: z.object({
    eventId: z.string().optional(),
    transitionId: z.string().optional(),
    previousSnapshotHash: z.string().optional(),
    eventHash: z.string().optional(),
    transitionHash: z.string().optional(),
    snapshotHash: z.string().optional()
  }).strict()
}).strict();

export type CoreIntegrityReportResponse = z.infer<typeof CoreIntegrityReportResponseSchema>;

export const CoreRevisionTimelineResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/revisions/timeline"),
  snapshotDiff: SnapshotDiffDTOSchema,
  revisions: z.array(z.object({
    revision: z.number().int().nonnegative(),
    snapshotHash: z.string().optional(),
    label: z.string(),
    deterministic: z.literal(true)
  }).strict())
}).strict();

export type CoreRevisionTimelineResponse = z.infer<typeof CoreRevisionTimelineResponseSchema>;

export const CoreMarketInputStatusResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/market-input/status"),
  marketInput: MarketInputIntegrityDTOSchema
}).strict();

export type CoreMarketInputStatusResponse = z.infer<typeof CoreMarketInputStatusResponseSchema>;

export const CoreRecoveryResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/recovery"),
  required: z.boolean(),
  hints: z.array(RecoveryHintDTOSchema)
}).strict();

export type CoreRecoveryResponse = z.infer<typeof CoreRecoveryResponseSchema>;

export const CoreQuarantineResponseSchema = z.object({
  adapterMeta: CoreApiAdapterMetaSchema,
  endpoint: z.literal("/core/quarantine"),
  count: z.number().int().nonnegative(),
  records: z.array(QuarantineRecordDTOSchema)
}).strict();

export type CoreQuarantineResponse = z.infer<typeof CoreQuarantineResponseSchema>;
