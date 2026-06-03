import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const readonlyApi = path.join(
  root,
  "core",
  "core",
  "ui-api",
  "connected-readonly-core-api.ts"
);
const mainJsx = path.join(root, "frontend", "src", "main.jsx");
const finalReport = path.join(root, "RC4_FINAL_ACCEPTANCE_REPORT.md");

const apiSrc = fs.readFileSync(readonlyApi, "utf8");
assert(
  !/\brouter\.post\s*\(/.test(apiSrc) && !/\bapp\.post\s*\(/.test(apiSrc),
  "connected-readonly-core-api must not register POST handlers (read-only boundary)"
);

for (const pathPart of [
  "/api/core/overview",
  "/api/core/live-stream/status",
  "/api/core/live-stream/health",
  "/api/core/live-stream/last-event",
  "/api/core/runtime/snapshot"
]) {
  assert(
    apiSrc.includes(`router.get("${pathPart}"`) || apiSrc.includes(`router.get('${pathPart}')`),
    `readonly API must expose GET ${pathPart}`
  );
}

const main = fs.readFileSync(mainJsx, "utf8");
assert(
  main.includes("NO PROOF") && main.includes("NO ALLOW"),
  "operator UI must surface NO PROOF → NO ALLOW"
);
assert(
  main.includes("mbg.rc4c.layout.v1") && main.includes("rc4-c-layout-v1"),
  "frontend must keep RC4-C layout persistence contract markers"
);

const report = fs.readFileSync(finalReport, "utf8");
assert(
  report.includes("OBSERVE-ONLY RELEASE CANDIDATE") || report.includes("RC4-D FINAL CANDIDATE"),
  "RC4_FINAL_ACCEPTANCE_REPORT must declare OBSERVE-ONLY RELEASE CANDIDATE or RC4-D FINAL CANDIDATE"
);
assert(
  !/\bPRODUCTION\s+READY\b/i.test(report),
  "RC4_FINAL_ACCEPTANCE_REPORT must not claim PRODUCTION READY"
);

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert(pkg.scripts["verify:rc4-d"], "package.json must define verify:rc4-d");
assert(pkg.scripts["verify:launchers"], "package.json must define verify:launchers (RC4-D2)");

console.log("verify:final-acceptance PASS");
