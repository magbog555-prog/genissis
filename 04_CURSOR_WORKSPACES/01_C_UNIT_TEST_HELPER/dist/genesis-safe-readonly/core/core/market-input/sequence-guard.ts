import type { MarketInputObservation, MarketInputValidationIssue } from "./market-input-types.js";

export interface MarketInputSequenceGuardContext {
  lastSequence?: number;
  lastObservationId?: string;
}

export function assessMarketInputSequence(
  observation: MarketInputObservation,
  context: MarketInputSequenceGuardContext
): MarketInputValidationIssue[] {
  const issues: MarketInputValidationIssue[] = [];

  if (context.lastObservationId && context.lastObservationId === observation.observationId) {
    issues.push({
      code: "duplicate_observation",
      path: "observationId",
      message: `market input observation ${observation.observationId} was already applied`
    });
  }

  if (context.lastSequence === undefined) return issues;

  if (observation.sequence <= context.lastSequence) {
    issues.push({
      code: observation.sequence === context.lastSequence ? "duplicate_observation" : "sequence_not_monotonic",
      path: "sequence",
      message: `market input sequence ${observation.sequence} must be greater than previous sequence ${context.lastSequence}`
    });
    return issues;
  }

  const expectedPrevious = context.lastSequence;
  if (observation.previousSequence !== undefined && observation.previousSequence !== expectedPrevious) {
    issues.push({
      code: "sequence_gap",
      path: "previousSequence",
      message: `market input previousSequence ${observation.previousSequence} does not match last sequence ${expectedPrevious}`
    });
  }

  if (observation.sequence !== expectedPrevious + 1) {
    issues.push({
      code: "sequence_gap",
      path: "sequence",
      message: `market input sequence ${observation.sequence} is not contiguous after ${expectedPrevious}`
    });
  }

  return issues;
}
