import fs from "node:fs";
import path from "node:path";
import type { TradeMetadata } from "./trade-metadata.js";

const runtimeDir = path.resolve(process.cwd(), "data", "runtime");
const storePath = path.join(runtimeDir, "order-metadata-store.json");

type PersistedStore = Record<string, TradeMetadata>;

let loaded = false;
const store = new Map<string, TradeMetadata>();

function clone(metadata: TradeMetadata): TradeMetadata {
  return { ...metadata, tags: [...(metadata.tags ?? [])] };
}

function loadOnce(): void {
  if (loaded) return;
  loaded = true;

  try {
    if (!fs.existsSync(storePath)) return;
    const raw = fs.readFileSync(storePath, "utf-8");
    if (!raw.trim()) return;

    const parsed = JSON.parse(raw) as PersistedStore;
    for (const [key, value] of Object.entries(parsed)) {
      if (key && value?.strategyId) {
        store.set(String(key), clone(value));
      }
    }
  } catch (error) {
    console.warn("[PR35] failed to load order metadata store", error);
  }
}

function persist(): void {
  fs.mkdirSync(runtimeDir, { recursive: true });

  const payload: PersistedStore = {};
  for (const [key, value] of store.entries()) {
    payload[key] = clone(value);
  }

  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf-8");
  fs.renameSync(tmp, storePath);
}

export function setOrderMetadata(orderKey: string | number | undefined, metadata: TradeMetadata): void {
  if (orderKey === undefined || orderKey === null || String(orderKey) === "") return;
  loadOnce();
  store.set(String(orderKey), clone(metadata));
  persist();
}

export function aliasOrderMetadata(sourceKey: string | number | undefined, targetKey: string | number | undefined): void {
  if (sourceKey === undefined || sourceKey === null || targetKey === undefined || targetKey === null) return;
  loadOnce();
  const metadata = store.get(String(sourceKey));
  if (!metadata) return;
  store.set(String(targetKey), clone(metadata));
  persist();
}

export function getOrderMetadata(orderKey: string | number | undefined): TradeMetadata | undefined {
  if (orderKey === undefined || orderKey === null || String(orderKey) === "") return undefined;
  loadOnce();
  const metadata = store.get(String(orderKey));
  return metadata ? clone(metadata) : undefined;
}


export function deleteOrderMetadata(orderKey: string | number | undefined): void {
  if (orderKey === undefined || orderKey === null || String(orderKey) === "") return;
  loadOnce();
  if (!store.delete(String(orderKey))) return;
  persist();
}

export function deleteOrderMetadataMany(orderKeys: Array<string | number | undefined>): void {
  loadOnce();
  let changed = false;

  for (const orderKey of orderKeys) {
    if (orderKey === undefined || orderKey === null || String(orderKey) === "") continue;
    changed = store.delete(String(orderKey)) || changed;
  }

  if (changed) persist();
}

export function clearOrderMetadataStoreForTests(): void {
  loaded = true;
  store.clear();
  if (fs.existsSync(storePath)) fs.rmSync(storePath);
}
