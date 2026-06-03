#!/usr/bin/env node
/**
 * serve-genesis-lab-panel.mjs — static server for Genesis Lab L2 panel
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFoundationWorkspaceRoot, getGenesisRoot } from "../verification/genesis-paths.mjs";
import { buildMissionControlTruthStrip } from "./build-mission-control-truth-strip.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = getFoundationWorkspaceRoot();
const genesisRoot = getGenesisRoot();
const labRoot = path.join(workspaceRoot, "lab/genesis-lab-panel");
const port = Number(process.env.GENESIS_LAB_PANEL_PORT ?? 5199);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj, null, 2));
}

function safeRead(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

function resolveStatic(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.startsWith("/reports/")) {
    return path.join(workspaceRoot, clean.slice(1));
  }
  if (clean.startsWith("/tests/")) {
    return path.join(workspaceRoot, clean.slice(1));
  }
  if (clean.startsWith("/lab/")) {
    return path.join(workspaceRoot, clean.slice(1));
  }
  const rel = clean.replace(/^\//, "");
  const candidate = path.join(labRoot, rel);
  if (candidate.startsWith(labRoot) && fs.existsSync(candidate)) return candidate;
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const clean = decodeURIComponent(url.split("?")[0]);

  if (clean === "/" || clean === "" || clean === "/lab/genesis-lab-panel" || clean === "/lab/genesis-lab-panel/") {
    res.writeHead(302, { Location: "/lab/genesis-lab-panel/index.html" });
    return res.end();
  }

  if (url === "/data/board.json") {
    const boardPath = path.join(genesisRoot, "05_REPORTS_AND_MANIFESTS/genesis-system-status-board.json");
    const raw = safeRead(boardPath);
    if (!raw) return sendJson(res, 404, { error: "board not found", path: boardPath });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(raw);
  }

  if (url === "/data/manifest.json") {
    return sendJson(res, 200, {
      workspaceRoot: workspaceRoot.replace(/\\/g, "/"),
      genesisRoot: genesisRoot.replace(/\\/g, "/"),
      port,
      mbgUi: "http://localhost:5173",
      mbgCore: "http://127.0.0.1:3011"
    });
  }

  if (clean === "/data/mission-control-truth-strip.json") {
    const { strip, missing } = buildMissionControlTruthStrip();
    if (missing.length) {
      return sendJson(res, 404, { error: "canonical reports missing", missing, strip });
    }
    return sendJson(res, 200, strip);
  }

  const filePath = resolveStatic(url);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(fs.readFileSync(filePath));
});

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/lab/genesis-lab-panel/index.html`;
  console.log(JSON.stringify({ ok: true, url, port, labRoot: labRoot.replace(/\\/g, "/") }, null, 2));
});
