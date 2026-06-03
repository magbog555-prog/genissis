import fs from "node:fs";
import path from "node:path";
import { DomainEvent } from "../../contracts/src/events.js";
import { RuntimeSnapshot } from "../../state/src/types.js";
import type { TransitionTrace } from "./runtime-engine.js";

export interface PersistedRuntimeEnvelope {
  format: "genesis.runtime.snapshot.v1";
  writtenAt: string;
  snapshot: RuntimeSnapshot;
}

export interface PersistenceStatus {
  enabled: boolean;
  dataDir: string;
  eventLogPath: string;
  snapshotPath: string;
  transitionLogPath: string;
  eventCount: number;
  snapshotRevision?: number;
  lastEventId?: string;
  lastSnapshotCommittedAt?: string;
  mode?: string;
  segmentSize?: number;
  eventSegmentCount?: number;
  transitionSegmentCount?: number;
  quarantinePath?: string;
  snapshotCorrupted?: boolean;
}

type EventVisitor = (event: DomainEvent, index: number) => void;

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function segmentName(index: number) {
  return `segment-${String(index).padStart(8, "0")}.jsonl`;
}

function listSegments(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^segment-\d+\.jsonl$/.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

function quarantineFile(filePath: string, reason: string) {
  try {
    const root = path.dirname(path.dirname(filePath));
    const quarantineDir = path.join(root, "quarantine");
    ensureDir(quarantineDir);
    const safeReason = reason.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 80);
    const target = path.join(quarantineDir, `${path.basename(filePath)}.${Date.now()}.${safeReason}.corrupt`);
    fs.copyFileSync(filePath, target);
    return target;
  } catch {
    return undefined;
  }
}

function countLines(filePath: string) {
  if (!fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw) return 0;
  return raw.endsWith("\n") ? raw.split("\n").length - 1 : raw.split(/\r?\n/).filter(Boolean).length;
}

function readJsonlSmallFile<T>(filePath: string, visitor: (value: T) => void) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return;
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    try {
      visitor(JSON.parse(line) as T);
    } catch (err) {
      // ✅ FIX: Не молчим при ошибке JSON! Логируем и quarantine файл
      console.error(`[CRITICAL] JSON parse error at line ${i} in ${filePath}:`);
      console.error(`  Line content: ${line.slice(0, 200)}`);
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      const quarantined = quarantineFile(filePath, `json-parse-error-line-${i}`);
      if (quarantined) {
        console.error(`  ⚠️  Файл quarantined to: ${quarantined}`);
      }
      // Не прерываем цикл - продолжаем читать оставшиеся строки
      continue;
    }
  }
}

function readJsonlSmallFileOld<T>(filePath: string, visitor: (value: T) => void) {
  // This was the old version - keeping for reference
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return;
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    try {
      visitor(JSON.parse(line) as T);
    } catch {
      quarantineFile(filePath, `jsonl_parse_error_line_${i + 1}`);
      // Treat a corrupt tail as truncated. This keeps recovery safe:
      // runtime must not crash or allow unsafe actions because one segment tail is malformed.
      break;
    }
  }
}

export class FileRuntimePersistence {
  readonly enabled: boolean;
  private batching = false;
  private eventBuffer: string[] = [];
  private transitionBuffer: string[] = [];
  private pendingSnapshot?: RuntimeSnapshot;

  readonly dataDir: string;
  readonly eventLogPath: string; // legacy path, kept for compatibility
  readonly snapshotPath: string;
  readonly transitionLogPath: string; // legacy path, kept for compatibility
  readonly eventSegmentsDir: string;
  readonly transitionSegmentsDir: string;
  readonly quarantineDir: string;
  readonly segmentSize: number;
  private snapshotCorrupted = false;

  private knownEventCount = 0;
  private knownTransitionCount = 0;
  private lastEventId?: string;

  constructor(
    dataDir = process.env.GENESIS_DATA_DIR ?? "data/runtime",
    enabled = process.env.PERSISTENCE_ENABLED !== "false",
    segmentSize = Number(process.env.GENESIS_EVENT_SEGMENT_SIZE ?? 5000)
  ) {
    this.enabled = enabled;
    this.dataDir = dataDir;
    this.eventLogPath = path.join(dataDir, "events.jsonl");
    this.snapshotPath = path.join(dataDir, "snapshot.json");
    this.transitionLogPath = path.join(dataDir, "transitions.jsonl");
    this.eventSegmentsDir = path.join(dataDir, "events");
    this.transitionSegmentsDir = path.join(dataDir, "transitions");
    this.quarantineDir = path.join(dataDir, "quarantine");
    this.segmentSize = Math.max(100, segmentSize);

    if (this.enabled) {
      ensureDir(this.dataDir);
      ensureDir(this.eventSegmentsDir);
      ensureDir(this.transitionSegmentsDir);
      ensureDir(this.quarantineDir);
      this.refreshCounts();
    }
  }

  private refreshCounts() {
    this.knownEventCount = 0;
    this.knownTransitionCount = 0;
    this.lastEventId = undefined;

    for (const file of listSegments(this.eventSegmentsDir)) {
      readJsonlSmallFile<DomainEvent>(file, (event) => {
        this.knownEventCount += 1;
        this.lastEventId = event.eventId;
      });
    }

    for (const file of listSegments(this.transitionSegmentsDir)) {
      this.knownTransitionCount += countLines(file);
    }
  }

  private eventSegmentPathForIndex(indexZeroBased: number) {
    const segmentIndex = Math.floor(indexZeroBased / this.segmentSize);
    return path.join(this.eventSegmentsDir, segmentName(segmentIndex));
  }

  private transitionSegmentPathForIndex(indexZeroBased: number) {
    const segmentIndex = Math.floor(indexZeroBased / this.segmentSize);
    return path.join(this.transitionSegmentsDir, segmentName(segmentIndex));
  }

  beginBatch() {
    if (!this.enabled) return;
    this.batching = true;
  }

  flushBatch() {
    if (!this.enabled) return;

    for (const line of this.eventBuffer) {
      const filePath = this.eventSegmentPathForIndex(this.knownEventCount);
      fs.appendFileSync(filePath, line, "utf8");
      try {
        this.lastEventId = (JSON.parse(line) as DomainEvent).eventId;
      } catch {
        // append path already validates through runtime event shape; ignore status-only parse failure
      }
      this.knownEventCount += 1;
    }
    this.eventBuffer = [];

    for (const line of this.transitionBuffer) {
      const filePath = this.transitionSegmentPathForIndex(this.knownTransitionCount);
      fs.appendFileSync(filePath, line, "utf8");
      this.knownTransitionCount += 1;
    }
    this.transitionBuffer = [];

    if (this.pendingSnapshot) {
      this.writeSnapshotNow(this.pendingSnapshot);
      this.pendingSnapshot = undefined;
    }
  }

  endBatch() {
    if (!this.enabled) return;
    this.flushBatch();
    this.batching = false;
  }

  appendEvent(event: DomainEvent) {
    if (!this.enabled) return;
    const line = JSON.stringify(event) + "\n";
    if (this.batching) {
      this.eventBuffer.push(line);
      return;
    }
    const filePath = this.eventSegmentPathForIndex(this.knownEventCount);
    fs.appendFileSync(filePath, line, "utf8");
    this.knownEventCount += 1;
    this.lastEventId = event.eventId;
  }

  appendTransition(trace: TransitionTrace) {
    if (!this.enabled) return;
    const line = JSON.stringify(trace) + "\n";
    if (this.batching) {
      this.transitionBuffer.push(line);
      return;
    }
    const filePath = this.transitionSegmentPathForIndex(this.knownTransitionCount);
    fs.appendFileSync(filePath, line, "utf8");
    this.knownTransitionCount += 1;
  }

  private writeSnapshotNow(snapshot: RuntimeSnapshot) {
    const envelope: PersistedRuntimeEnvelope = {
      format: "genesis.runtime.snapshot.v1",
      writtenAt: new Date().toISOString(),
      snapshot
    };
    const tmp = `${this.snapshotPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(envelope), "utf8");
    fs.renameSync(tmp, this.snapshotPath);
  }

  saveSnapshot(snapshot: RuntimeSnapshot) {
    if (!this.enabled) return;
    if (this.batching) {
      this.pendingSnapshot = snapshot;
      return;
    }
    this.writeSnapshotNow(snapshot);
  }

  /**
   * Compatibility method. Safe because PR21 stores events in bounded segment files.
   * Runtime recovery should prefer forEachEventAfterSnapshot() to avoid retaining all history.
   */
  loadEvents(): DomainEvent[] {
    const events: DomainEvent[] = [];
    this.forEachEvent((event) => events.push(event));
    return events;
  }

  forEachEvent(visitor: EventVisitor) {
    if (!this.enabled) return;
    let index = 0;
    for (const file of listSegments(this.eventSegmentsDir)) {
      readJsonlSmallFile<DomainEvent>(file, (event) => {
        visitor(event, index);
        index += 1;
      });
    }
  }

  forEachEventAfterRevision(revision: number, visitor: EventVisitor) {
    if (!this.enabled) return;
    let index = 0;
    for (const file of listSegments(this.eventSegmentsDir)) {
      const segmentStart = index;
      const segmentEndExclusive = segmentStart + this.segmentSize;
      if (segmentEndExclusive <= revision) {
        index = segmentEndExclusive;
        continue;
      }

      readJsonlSmallFile<DomainEvent>(file, (event) => {
        if (index >= revision) visitor(event, index);
        index += 1;
      });
    }
  }

  loadEventsAfterRevision(revision: number): DomainEvent[] {
    const events: DomainEvent[] = [];
    this.forEachEventAfterRevision(revision, (event) => events.push(event));
    return events;
  }

  loadSnapshot(): RuntimeSnapshot | undefined {
    if (!this.enabled || !fs.existsSync(this.snapshotPath)) return undefined;
    try {
      const raw = fs.readFileSync(this.snapshotPath, "utf8").trim();
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as PersistedRuntimeEnvelope;
      this.snapshotCorrupted = false;
      return parsed.snapshot;
    } catch {
      this.snapshotCorrupted = true;
      try {
        ensureDir(this.quarantineDir);
        const target = path.join(this.quarantineDir, `snapshot.${Date.now()}.corrupt.json`);
        fs.copyFileSync(this.snapshotPath, target);
      } catch {}
      return undefined;
    }
  }

  clear() {
    if (!this.enabled) return;
    ensureDir(this.dataDir);
    fs.rmSync(this.eventSegmentsDir, { recursive: true, force: true });
    fs.rmSync(this.transitionSegmentsDir, { recursive: true, force: true });
    ensureDir(this.eventSegmentsDir);
    ensureDir(this.transitionSegmentsDir);

    // Remove legacy monolithic logs if present.
    if (fs.existsSync(this.eventLogPath)) fs.unlinkSync(this.eventLogPath);
    if (fs.existsSync(this.transitionLogPath)) fs.unlinkSync(this.transitionLogPath);
    if (fs.existsSync(this.snapshotPath)) fs.unlinkSync(this.snapshotPath);

    this.knownEventCount = 0;
    this.knownTransitionCount = 0;
    this.lastEventId = undefined;
    this.eventBuffer = [];
    this.transitionBuffer = [];
    this.pendingSnapshot = undefined;
  }

  getStatus(): PersistenceStatus {
    const snapshot = this.loadSnapshot();
    return {
      enabled: this.enabled,
      dataDir: this.dataDir,
      eventLogPath: this.eventSegmentsDir,
      snapshotPath: this.snapshotPath,
      transitionLogPath: this.transitionSegmentsDir,
      eventCount: this.knownEventCount + this.eventBuffer.length,
      snapshotRevision: snapshot?.revision,
      lastEventId: this.lastEventId,
      lastSnapshotCommittedAt: snapshot?.committedAt,
      mode: "segmented-streaming",
      segmentSize: this.segmentSize,
      eventSegmentCount: listSegments(this.eventSegmentsDir).length,
      transitionSegmentCount: listSegments(this.transitionSegmentsDir).length,
      quarantinePath: this.quarantineDir,
      snapshotCorrupted: this.snapshotCorrupted
    };
  }
}
