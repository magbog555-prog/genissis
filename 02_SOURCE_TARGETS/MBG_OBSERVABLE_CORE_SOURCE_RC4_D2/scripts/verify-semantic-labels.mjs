/**
 * RC4-D1 — operator UI semantic labels (local core trust vs exchange trust vs proof).
 * Static checks on frontend source only; does not change DTOs or backend safety.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainPath = path.join(root, "frontend", "src", "main.jsx");

function fail(msg) {
  console.error(`verify:semantic-labels FAIL — ${msg}`);
  process.exit(1);
}

const src = fs.readFileSync(mainPath, "utf8");

// Forbidden bare patterns (ambiguous operator copy).
if (/\bTrust:\s*TRUSTED\b/i.test(src)) {
  fail('found bare "Trust: TRUSTED" pattern');
}
if (src.includes("Итог доверия")) {
  fail('found Russian "Итог доверия" (replaced by local validity / exchange trust / proof)');
}
if (src.includes("Trust outcome")) {
  fail('found "Trust outcome" label (replaced by local validity / exchange trust / proof)');
}
if (src.includes("Финальное состояние безопасности") || src.includes("Final safety state")) {
  fail('failure matrix must not use bare "final safety state" row for operator copy');
}

// Required positive labels (RU + EN paths).
const required = [
  ["Local trust", "Core overview EN local trust label"],
  ["Локальное доверие", "Core overview RU local trust label"],
  ["lang==='ru'?'Proof':'Proof'", "Core overview proof row label"],
  ["Exchange trust", "Exchange trust EN"],
  ["Биржевое доверие", "Exchange trust RU"],
  ["readSemanticTrustSignals", "semantic trust helper"],
  ["display allowed", "failure matrix scenario copy (EN)"],
  ["разрешён к отображению", "failure matrix scenario copy (RU)"],
  ["Состояние сценария", "failure matrix scenario row RU"],
  ["Scenario state", "failure matrix scenario row EN"],
  ["Торговое действие", "failure matrix trading action RU"],
  ["Trading action", "failure matrix trading action EN"],
  ["NO PROOF → NO ALLOW", "safety banner copy preserved"]
];
for (const [needle, why] of required) {
  if (!src.includes(needle)) {
    fail(`missing required fragment (${why}): ${needle}`);
  }
}

// Local core trust wording in operator truth / pulse / mini verdict dictionary.
if (!src.includes("Локальное доверие ядра") || !src.includes("Local core trust")) {
  fail("missing RU/EN 'local core trust' phrasing");
}

console.log("verify:semantic-labels PASS (RC4-D1 semantic label checks)");
