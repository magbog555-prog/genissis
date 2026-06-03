#!/usr/bin/env node
/**
 * Genesis Foundation — Env / Secrets Scanner (Stage 6)
 * Read-only. Never prints secret values — only [REDACTED].
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPath } from "./scope-match.mjs";
import {
  assertSourceTargetExists,
  loadFoundationScopeConfig,
  sourceTargetForReport
} from "./genesis-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "foundation-scope.config.json");

const ENV_FILE_NAMES = /^\.env|\.env\.|\.example$/i;
const ENV_SCAN_EXTENSIONS = /\.(ts|js|mjs|cjs|json|ya?ml|example|env)$/i;

const PROCESS_ENV_RE = /process\.env\.([A-Z0-9_]+)/g;
const PROCESS_ENV_BRACKET_RE = /process\.env\[['"]([A-Z0-9_]+)['"]\]/g;
const ENV_CALL_RE = /\benv\s*\(\s*['"]([A-Z0-9_]+)['"]/g;
const ENV_LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function loadConfig() {
  return loadFoundationScopeConfig(CONFIG_PATH);
}

function normalize(p) {
  return p.replace(/\\/g, "/");
}

function isForbiddenEnvName(name, config) {
  const upper = name.toUpperCase();
  for (const token of config.forbidden_env_names_in_safe ?? []) {
    const t = token.toUpperCase();
    if (upper === t || upper.includes(t)) return { matched: true, token: t };
  }
  return { matched: false, token: null };
}

function redactValue(name, rawValue, forbidden) {
  if (forbidden.matched) return "[REDACTED]";
  const upper = name.toUpperCase();
  if (/SECRET|KEY|PASSWORD|TOKEN|PRIVATE|SIGNATURE/i.test(upper)) return "[REDACTED]";
  const v = (rawValue ?? "").trim();
  if (v.length === 0) return "";
  if (/^['"].*['"]$/.test(v)) return "[REDACTED]";
  return v.length > 80 ? "[REDACTED]" : v;
}

function evaluateHit(fileScope, forbidden) {
  if (!forbidden.matched) {
    return { scanStatus: "OK", violation: false, rule: null };
  }
  if (fileScope === "SAFE") {
    return { scanStatus: "RED", violation: true, rule: "SAFE_FORBIDDEN_ENV" };
  }
  if (fileScope === "UNSAFE") {
    return { scanStatus: "FINDING", violation: true, rule: "UNSAFE_FORBIDDEN_ENV" };
  }
  if (fileScope === "DONOR") {
    return { scanStatus: "DONOR_FINDING", violation: true, rule: "DONOR_FORBIDDEN_ENV" };
  }
  return { scanStatus: "YELLOW", violation: true, rule: "UNKNOWN_FORBIDDEN_ENV" };
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else {
      const relName = name.toLowerCase();
      if (ENV_FILE_NAMES.test(relName) || ENV_SCAN_EXTENSIONS.test(name)) out.push(full);
    }
  }
  return out;
}

function parseEnvFile(content, fileRel, config) {
  const scope = classifyPath(fileRel, config);
  const hits = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = ENV_LINE_RE.exec(line);
    if (!m) continue;
    const name = m[1];
    const forbidden = isForbiddenEnvName(name, config);
    const v = evaluateHit(scope, forbidden);
    hits.push({
      kind: "env-file",
      file: fileRel,
      line: name,
      envName: name,
      scope,
      value: redactValue(name, m[2], forbidden),
      forbiddenToken: forbidden.token,
      scanStatus: v.scanStatus,
      violation: v.violation,
      rule: v.rule,
    });
  }
  return hits;
}

function scanSourceRefs(content, fileRel, config) {
  const scope = classifyPath(fileRel, config);
  const hits = [];
  const patterns = [
    { re: PROCESS_ENV_RE, source: "process.env" },
    { re: PROCESS_ENV_BRACKET_RE, source: "process.env[]" },
    { re: ENV_CALL_RE, source: "env()" },
  ];

  for (const { re, source } of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      const forbidden = isForbiddenEnvName(name, config);
      const v = evaluateHit(scope, forbidden);
      const lineNo = content.slice(0, m.index).split("\n").length;
      hits.push({
        kind: "code-reference",
        file: fileRel,
        line: lineNo,
        envName: name,
        scope,
        value: "[REDACTED]",
        forbiddenToken: forbidden.token,
        scanStatus: forbidden.matched ? v.scanStatus : "OK",
        violation: v.violation,
        rule: v.rule,
        referenceType: source,
      });
    }
  }
  return hits;
}

function main() {
  const config = loadConfig();
  const sourceRoot = assertSourceTargetExists(config.source_target);
  const files = walkFiles(sourceRoot);
  const allHits = [];

  for (const full of files) {
    const rel = normalize(path.relative(sourceRoot, full));
    if (rel.includes("node_modules")) continue;
    const content = fs.readFileSync(full, "utf8");
    const isEnvFile = /\.env/i.test(path.basename(full)) || full.endsWith(".example");
    if (isEnvFile) allHits.push(...parseEnvFile(content, rel, config));
    if (/\.(ts|js|mjs|cjs)$/.test(full)) {
      allHits.push(...scanSourceRefs(content, rel, config));
    }
  }

  const redInSafe = allHits.filter((h) => h.scope === "SAFE" && h.scanStatus === "RED");
  const findings = allHits.filter((h) => h.violation);

  const byStatus = {};
  for (const h of allHits) {
    byStatus[h.scanStatus] = (byStatus[h.scanStatus] ?? 0) + 1;
  }

  const report = {
    schema: "genesis.foundation.env-inventory.v1",
    generatedAt: new Date().toISOString(),
    scanner: "tools/verification/scan-env.mjs",
    configVersion: config.version,
    sourceTarget: sourceTargetForReport(sourceRoot),
    redactionPolicy: "Secret and forbidden env values are always [REDACTED] in this report.",
    limitations: [
      "Static scan only; runtime .env on operator machine not visible.",
      "Only shipped files in source target; no live process env.",
      "Import and route scanners out of scope for this stage.",
    ],
    summary: {
      filesScanned: files.length,
      totalHits: allHits.length,
      violationHits: findings.length,
      byStatus,
      redInSafeCount: redInSafe.length,
      foundationCheckFailed: redInSafe.length > 0,
    },
    redInSafe,
    hits: allHits,
  };

  const reportsDir = path.join(__dirname, "../../reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "env-inventory.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const md = buildMarkdown(report, config);
  const mdPath = path.join(reportsDir, "env-inventory.md");
  fs.writeFileSync(mdPath, md, "utf8");

  console.log(
    JSON.stringify(
      { ok: redInSafe.length === 0, jsonPath, mdPath, summary: report.summary },
      null,
      2
    )
  );
  process.exit(redInSafe.length > 0 ? 1 : 0);
}

function buildMarkdown(report, config) {
  const lines = [
    "# Env Inventory (Genesis Foundation)",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: \`${report.sourceTarget}\``,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Files scanned | ${report.summary.filesScanned} |`,
    `| Total env references | ${report.summary.totalHits} |`,
    `| RED in SAFE | ${report.summary.redInSafeCount} |`,
    `| Foundation gate | ${report.summary.redInSafeCount === 0 ? "PASS" : "FAIL"} |`,
    "",
    "## Forbidden names (SAFE policy)",
    "",
    ...config.forbidden_env_names_in_safe.map((n) => `- \`${n}\``),
    "",
    "## RED in SAFE",
    "",
  ];

  if (report.redInSafe.length === 0) {
    lines.push("_None._");
  } else {
    for (const h of report.redInSafe) {
      lines.push(
        `- \`${h.envName}\` in \`${h.file}\`${h.line ? ` (line ${h.line})` : ""} — value: \`[REDACTED]\``
      );
    }
  }

  lines.push("", "## Violations by scope", "");
  for (const status of ["RED", "FINDING", "DONOR_FINDING", "YELLOW"]) {
    const group = report.hits.filter((h) => h.scanStatus === status && h.violation);
    if (group.length === 0) continue;
    lines.push(`### ${status}`, "");
    for (const h of group.slice(0, 40)) {
      lines.push(
        `- \`${h.envName}\` — \`${h.file}\`${typeof h.line === "number" ? `:${h.line}` : ""} — scope: ${h.scope} — value: \`${h.value}\``
      );
    }
    if (group.length > 40) lines.push(`- _… and ${group.length - 40} more_`);
    lines.push("");
  }

  lines.push("## SAFE operator env (allowed references)", "");
  const safeOk = report.hits.filter(
    (h) => h.scope === "SAFE" && !h.violation && (h.kind === "env-file" || h.kind === "code-reference")
  );
  const seen = new Set();
  for (const h of safeOk) {
    const key = `${h.envName}@${h.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- \`${h.envName}\` in \`${h.file}\`${h.value ? ` = ${h.value}` : ""}`);
  }

  lines.push("", "---", "", "_All secret/forbidden values redacted as [REDACTED]._", "");
  return lines.join("\n");
}

main();
