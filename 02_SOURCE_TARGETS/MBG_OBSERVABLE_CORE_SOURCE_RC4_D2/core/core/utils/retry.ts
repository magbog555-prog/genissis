import { HaltReason, haltSystem, isHalted, systemState } from "../system/state.js";

export { HaltReason, haltSystem, isHalted, systemState };

export const MAX_RETRIES = 3;

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(err: unknown): number | string | undefined {
  const anyErr = err as { code?: number | string; status?: number; statusCode?: number };
  return anyErr?.code ?? anyErr?.status ?? anyErr?.statusCode;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = 300
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    if (isHalted()) {
      throw new Error("SYSTEM HALTED - retry aborted");
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = getErrorCode(err);
      const message = err instanceof Error ? err.message : String(err);

      if (String(code) === "429" && attempt < retries) {
        await sleep(1000 + Math.random() * 1000);
        continue;
      }

      const retryableNetworkError =
        message.includes("ECONNREFUSED") ||
        message.includes("ETIMEDOUT") ||
        message.toLowerCase().includes("socket") ||
        message.toLowerCase().includes("fetch failed");

      if (retryableNetworkError && attempt < retries) {
        await sleep(delay * attempt);
        continue;
      }

      break;
    }
  }

  const finalError = lastError instanceof Error ? lastError : new Error(String(lastError));
  haltSystem(HaltReason.RETRY_EXHAUSTED, { message: finalError.message });
  throw finalError;
}

let lastOrderTime = 0;

export function canTrade(): boolean {
  const now = Date.now();

  if (now - lastOrderTime < 2000) {
    return false;
  }

  lastOrderTime = now;
  return true;
}

// Backward-compatible aliases for existing project imports.
export const SYSTEM_HALTED = false;

export function isSystemHalted(): boolean {
  return isHalted();
}

export function canPlaceOrder(): boolean {
  return canTrade();
}
