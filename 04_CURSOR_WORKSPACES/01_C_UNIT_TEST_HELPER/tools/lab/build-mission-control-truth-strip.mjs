#!/usr/bin/env node
/**
 * build-mission-control-truth-strip.mjs — read-only Sprint 7 truth strip from canonical reports.
 */
import fs from "node:fs";
import path from "node:path";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "../verification/genesis-paths.mjs";

export function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asArchGreenBool(value) {
  if (value === true || value === "YES") return true;
  return false;
}

/**
 * @returns {{ strip: object, missing: string[] }}
 */
export function buildMissionControlTruthStrip() {
  const workspaceRoot = getFoundationWorkspaceRoot();
  const genesisRoot = getGenesisRoot();
  const missing = [];

  const boardPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/genesis-system-status-board.json");
  const profitopsPath = path.join(workspaceRoot, "reports/profitops-expanded-sample-v3.json");

  const board = readJson(boardPath);
  if (!board) missing.push("genesis-system-status-board.json");

  const profitops = readJson(profitopsPath);
  if (!profitops) missing.push("profitops-expanded-sample-v3.json");

  const program = board?.program ?? {};
  const sampleCount = profitops?.metrics?.sampleCount ?? null;

  const strip = {
    schema: "genesis.mission-control-truth-strip.v1",
    generatedAt: new Date().toISOString(),
    notaryGreen: program.notaryGreen ?? null,
    archGreenApproved: asArchGreenBool(program.archGreenApproved),
    executionAllowed: program.executionAllowed === true,
    profitops: {
      expansionId: profitops?.expansionId ?? null,
      sampleCount
    },
    b5: {
      status: program.audit3BlockersB5V2 ?? program.audit3BlockersB5 ?? null
    },
    b6: {
      status: program.audit3BlockersB6 ?? null
    },
    sources: {
      board: boardPath.replace(/\\/g, "/"),
      profitops: profitopsPath.replace(/\\/g, "/")
    }
  };

  return { strip, missing, board, profitops };
}
