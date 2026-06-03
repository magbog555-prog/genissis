import { createHash } from "node:crypto";
import type { DomainEvent } from "../contracts/src/events.js";
import type { RuntimeSnapshot } from "../state/src/types.js";

export type HashStatus =
  | "unknown"
  | "valid"
  | "broken"
  | "discontinuity"
  | "tampered";

export interface SnapshotHashTransition {
  revision: number;
  beforeSnapshotHash?: string;
  eventHash?: string;
  afterSnapshotHash?: string;
}

export interface SnapshotHashChainLink {
  revision: number;
  eventId?: string;
  eventType?: string;
  eventHash?: string;
  previousSnapshotHash?: string;
  snapshotHash?: string;
  transitionHash?: string;
  builtAt: string;
  algorithm: "sha256";
  canonicalVersion: "v1";
}

export interface HashChainVerification {
  status: HashStatus;
  ok: boolean;
  reasons: string[];
  expected?: Partial<SnapshotHashChainLink>;
  actual?: Partial<SnapshotHashChainLink>;
}

export interface RevisionContinuityReport {
  status: HashStatus;
  ok: boolean;
  reasons: string[];
  expectedNextRevision?: number;
  actualRevision?: number;
}

export interface HashStatusReport {
  status: HashStatus;
  ok: boolean;
  reasons: string[];
  link?: HashChainVerification;
  continuity?: RevisionContinuityReport;
  reportHash: string;
}

/**
 * Deterministically stringify JSON-compatible data.
 *
 * Rules:
 * - Object keys are sorted lexicographically.
 * - Array order is preserved.
 * - undefined object fields are omitted.
 * - undefined array values are represented as null, matching JSON.stringify behavior.
 * - Date instances are normalized to ISO strings.
 * - Non-finite numbers are rejected because they are not portable JSON facts.
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(toCanonicalValue(value));
}

function toCanonicalValue(value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const valueType = typeof value;

  if (valueType === "string" || valueType === "boolean") {
    return value;
  }

  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot canonicalize non-finite number");
    }
    return value;
  }

  if (valueType === "bigint") {
    return (value as bigint).toString();
  }

  if (valueType === "undefined") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      const canonicalItem = toCanonicalValue(item);
      return canonicalItem === undefined ? null : canonicalItem;
    });
  }

  if (valueType === "object") {
    const record = value as Record<string, unknown>;
    const canonicalRecord: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const canonicalValue = toCanonicalValue(record[key]);
      if (canonicalValue !== undefined) {
        canonicalRecord[key] = canonicalValue;
      }
    }
    return canonicalRecord;
  }

  throw new Error(`Cannot canonicalize value of type ${valueType}`);
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

export function hashDomainEvent(event: DomainEvent): string {
  return hashCanonical(event);
}

export function hashSnapshot(snapshot: RuntimeSnapshot | Record<string, unknown>): string {
  return hashCanonical(snapshot);
}

export function hashTransition(transition: SnapshotHashTransition): string {
  return hashCanonical({
    afterSnapshotHash: transition.afterSnapshotHash,
    beforeSnapshotHash: transition.beforeSnapshotHash,
    eventHash: transition.eventHash,
    revision: transition.revision
  });
}

export function buildHashChainLink(args: {
  event?: DomainEvent;
  previousSnapshotHash?: string;
  snapshot: RuntimeSnapshot;
  builtAt?: string;
}): SnapshotHashChainLink {
  const eventHash = args.event ? hashDomainEvent(args.event) : undefined;
  const snapshotHash = hashSnapshot(args.snapshot);
  const revision = args.snapshot.revision;
  const transitionHash = hashTransition({
    revision,
    beforeSnapshotHash: args.previousSnapshotHash,
    eventHash,
    afterSnapshotHash: snapshotHash
  });

  return {
    revision,
    eventId: args.event?.eventId,
    eventType: args.event?.eventType,
    eventHash,
    previousSnapshotHash: args.previousSnapshotHash,
    snapshotHash,
    transitionHash,
    builtAt: args.builtAt ?? "unknown",
    algorithm: "sha256",
    canonicalVersion: "v1"
  };
}

export function verifyHashChainLink(args: {
  link: SnapshotHashChainLink;
  event?: DomainEvent;
  previousSnapshotHash?: string;
  snapshot?: RuntimeSnapshot;
}): HashChainVerification {
  const reasons: string[] = [];

  if (!args.link.snapshotHash || !args.link.transitionHash) {
    return {
      status: "unknown",
      ok: true,
      reasons: ["legacy_hash_missing"]
    };
  }

  const expectedSnapshotHash = args.snapshot ? hashSnapshot(args.snapshot) : args.link.snapshotHash;
  const expectedEventHash = args.event ? hashDomainEvent(args.event) : args.link.eventHash;
  const expectedPreviousSnapshotHash = args.previousSnapshotHash ?? args.link.previousSnapshotHash;

  if (args.snapshot && args.link.revision !== args.snapshot.revision) {
    reasons.push("revision_mismatch");
  }

  if (args.event && args.link.eventId !== args.event.eventId) {
    reasons.push("event_id_mismatch");
  }

  if (args.event && args.link.eventType !== args.event.eventType) {
    reasons.push("event_type_mismatch");
  }

  if (args.event && args.link.eventHash !== expectedEventHash) {
    reasons.push("event_hash_mismatch");
  }

  if (args.previousSnapshotHash !== undefined && args.link.previousSnapshotHash !== expectedPreviousSnapshotHash) {
    reasons.push("previous_snapshot_hash_mismatch");
  }

  if (args.snapshot && args.link.snapshotHash !== expectedSnapshotHash) {
    reasons.push("snapshot_hash_mismatch");
  }

  const expectedTransitionHash = hashTransition({
    revision: args.link.revision,
    beforeSnapshotHash: expectedPreviousSnapshotHash,
    eventHash: expectedEventHash,
    afterSnapshotHash: expectedSnapshotHash
  });

  if (args.link.transitionHash !== expectedTransitionHash) {
    reasons.push("transition_hash_mismatch");
  }

  const isTampered = reasons.some((reason) =>
    [
      "event_hash_mismatch",
      "previous_snapshot_hash_mismatch",
      "snapshot_hash_mismatch",
      "transition_hash_mismatch"
    ].includes(reason)
  );

  return {
    status: reasons.length === 0 ? "valid" : isTampered ? "tampered" : "broken",
    ok: reasons.length === 0,
    reasons,
    expected: {
      revision: args.snapshot?.revision ?? args.link.revision,
      eventId: args.event?.eventId ?? args.link.eventId,
      eventType: args.event?.eventType ?? args.link.eventType,
      eventHash: expectedEventHash,
      previousSnapshotHash: expectedPreviousSnapshotHash,
      snapshotHash: expectedSnapshotHash,
      transitionHash: expectedTransitionHash
    },
    actual: args.link
  };
}

export function verifyRevisionContinuity(
  previous: Pick<SnapshotHashChainLink, "revision"> | undefined,
  current: Pick<SnapshotHashChainLink, "revision">
): RevisionContinuityReport {
  if (!previous) {
    return {
      status: "unknown",
      ok: true,
      reasons: ["no_previous_revision"]
    };
  }

  const expectedNextRevision = previous.revision + 1;

  if (current.revision !== expectedNextRevision) {
    return {
      status: "discontinuity",
      ok: false,
      reasons: ["revision_gap"],
      expectedNextRevision,
      actualRevision: current.revision
    };
  }

  return {
    status: "valid",
    ok: true,
    reasons: [],
    expectedNextRevision,
    actualRevision: current.revision
  };
}

export function buildHashStatusReport(args: {
  link?: SnapshotHashChainLink;
  previousLink?: Pick<SnapshotHashChainLink, "revision">;
  event?: DomainEvent;
  previousSnapshotHash?: string;
  snapshot?: RuntimeSnapshot;
}): HashStatusReport {
  if (!args.link) {
    const report = {
      status: "unknown" as HashStatus,
      ok: true,
      reasons: ["hash_chain_link_missing"]
    };
    return {
      ...report,
      reportHash: hashCanonical(report)
    };
  }

  const link = verifyHashChainLink({
    link: args.link,
    event: args.event,
    previousSnapshotHash: args.previousSnapshotHash,
    snapshot: args.snapshot
  });

  const continuity = verifyRevisionContinuity(args.previousLink, args.link);
  const reasons = [...link.reasons, ...continuity.reasons];

  let status: HashStatus = "valid";
  if (link.status === "unknown" && continuity.status === "unknown") {
    status = "unknown";
  } else if (link.status === "tampered") {
    status = "tampered";
  } else if (continuity.status === "discontinuity") {
    status = "discontinuity";
  } else if (link.status === "broken") {
    status = "broken";
  } else if (link.status === "unknown" || continuity.status === "unknown") {
    status = "unknown";
  }

  const reportWithoutHash = {
    status,
    ok: status === "valid" || status === "unknown",
    reasons,
    link,
    continuity
  };

  return {
    ...reportWithoutHash,
    reportHash: hashCanonical(reportWithoutHash)
  };
}
