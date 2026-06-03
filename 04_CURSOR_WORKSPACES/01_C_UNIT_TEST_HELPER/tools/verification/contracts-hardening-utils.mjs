import { createHash } from "node:crypto";

export const RUNTIME_ALIGNMENT_STATUS_ENUM = new Set(["ALIGNED_OFFLINE", "MISALIGNED_OFFLINE"]);
export const OWNER_VIEW_STATUS_ENUM = new Set(["OWNER_VIEW_OK", "OWNER_VIEW_DEGRADED"]);
export const FRESHNESS_MODE_ENUM = new Set(["TTL_OK", "TTL_EXCEEDED"]);
export const CLOSURE_STATUS_ENUM = new Set(["COMPLETE", "PARTIAL", "FAIL"]);

export const MAX_SOURCE_REPORT_AGE_MS = 12 * 60 * 60 * 1000; // 12h TTL window for offline reports

export function hashHex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function addViolation(violations, ruleId, severity, message, extra = {}) {
  violations.push({ ruleId, severity, message, ...extra });
}

export function parseIsoMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function ensureEnumValue({
  violations,
  value,
  allowed,
  ruleId,
  message,
  extra = {}
}) {
  if (!allowed.has(value)) {
    addViolation(violations, ruleId, "RED", message, { actual: value, allowed: Array.from(allowed), ...extra });
  }
}

export function checkNoFakePassFallback({
  violations,
  report,
  passField = "pass",
  contextRulePrefix,
  context
}) {
  const pass = report?.[passField];
  if (typeof pass !== "boolean") {
    addViolation(violations, `${contextRulePrefix}-PASS-TYPE`, "RED", `${passField} must be boolean`, {
      actualType: typeof pass,
      ...context
    });
  }
  if (report?.fallbackUsed === true || report?.passViaFallback === true || report?.syntheticPass === true) {
    addViolation(
      violations,
      `${contextRulePrefix}-NO-FALLBACK-PASS`,
      "RED",
      "fake PASS via fallback flags is forbidden",
      context
    );
  }
}
