#!/usr/bin/env node
/**
 * genesis-paths.mjs — P0.1 portable roots (AA-2)
 * GENESIS_ROOT: repo root (default: two levels above Foundation workspace)
 * SOURCE_TARGET_ROOT: MBG read-only target (default: GENESIS_ROOT/02_SOURCE_TARGETS/...)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_SOURCE_TARGET_REL =
  path.join("02_SOURCE_TARGETS", "MBG_OBSERVABLE_CORE_SOURCE_RC4_D2");

export function getFoundationWorkspaceRoot() {
  return path.resolve(__dirname, "../..");
}

export function getGenesisRoot() {
  if (process.env.GENESIS_ROOT) {
    return path.resolve(process.env.GENESIS_ROOT);
  }
  return path.resolve(getFoundationWorkspaceRoot(), "../..");
}

export function getSourceTargetRoot() {
  if (process.env.SOURCE_TARGET_ROOT) {
    return path.resolve(process.env.SOURCE_TARGET_ROOT);
  }
  return path.join(getGenesisRoot(), ...DEFAULT_SOURCE_TARGET_REL.split("/"));
}

/** Normalize config/manifest: replace placeholder or legacy absolute paths */
export function resolveSourceTargetInRecord(record) {
  const st = record?.source_target;
  if (
    !st ||
    st === "${SOURCE_TARGET_ROOT}" ||
    /^[A-Za-z]:\//.test(st.replace(/\\/g, "/")) ||
    st.startsWith("/")
  ) {
    return { ...record, source_target: getSourceTargetRoot() };
  }
  return { ...record, source_target: path.resolve(st) };
}

export function loadFoundationScopeConfig(configPath) {
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return resolveSourceTargetInRecord(raw);
}

export function loadSafeArtifactManifest(manifestPath) {
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return resolveSourceTargetInRecord(raw);
}

export function sourceTargetForReport(absPath) {
  return path.resolve(absPath).replace(/\\/g, "/");
}

export function assertSourceTargetExists(root = getSourceTargetRoot()) {
  if (!fs.existsSync(root)) {
    throw new Error(
      `SOURCE_TARGET_ROOT not found: ${root}\nSet SOURCE_TARGET_ROOT or GENESIS_ROOT to your clone.`
    );
  }
  return root;
}
