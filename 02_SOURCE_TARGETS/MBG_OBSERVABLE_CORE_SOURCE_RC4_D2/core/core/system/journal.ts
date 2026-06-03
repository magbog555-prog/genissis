import fs from "node:fs";
import path from "node:path";

export type RuntimeEventType =
  | "RUNTIME_START"
  | "RUNTIME_STOP"
  | "CYCLE"
  | "RECONCILE"
  | "ORDER_PLACED"
  | "ORDER_SIMULATED"
  | "ORDER_BLOCKED"
  | "HALT";

export interface RuntimeJournalEvent {
  ts: number;
  type: RuntimeEventType;
  position?: number;
  activeOrder?: boolean;
  halted?: boolean;
  reason?: string;
  stateHash?: string;
  details?: unknown;
}

const journalDir = path.resolve(process.cwd(), "data", "journal");
const journalPath = path.join(journalDir, "runtime-events.jsonl");

export class RuntimeJournal {
  readonly path = journalPath;

  log(event: RuntimeJournalEvent): void {
    fs.mkdirSync(journalDir, { recursive: true });
    fs.appendFileSync(journalPath, `${JSON.stringify(event)}\n`, "utf-8");
  }
}

export const runtimeJournal = new RuntimeJournal();
