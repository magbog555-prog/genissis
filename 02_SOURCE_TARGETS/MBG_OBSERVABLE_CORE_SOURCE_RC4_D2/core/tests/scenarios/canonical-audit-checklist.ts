import fs from "node:fs";
import path from "node:path";

type AuditResult = {
  id: number;
  name: string;
  ok: boolean;
  details?: string;
};

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8")) as T;
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(root, relativePath));
}

function listFiles(relativeDir = "."): string[] {
  const start = path.join(root, relativeDir);
  if (!fs.existsSync(start)) return [];

  const output: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relative = path.relative(root, full).replaceAll(path.sep, "/");

      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", "coverage"].includes(entry.name)) continue;
        walk(full);
      } else {
        output.push(relative);
      }
    }
  };

  walk(start);
  return output.sort();
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function scriptExists(scripts: Record<string, string>, name: string): boolean {
  return typeof scripts[name] === "string" && scripts[name].trim().length > 0;
}

function scriptText(scripts: Record<string, string>): string {
  return Object.entries(scripts)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n")
    .toLowerCase();
}

function assertNoForbiddenDefaultWiring(
  scripts: Record<string, string>,
  forbidden: Array<{ label: string; pattern: RegExp }>
): void {
  const text = scriptText(scripts);
  const hits = forbidden.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  assert(hits.length === 0, `Forbidden default wiring found in package scripts: ${hits.join(", ")}`);
}

function assertNoSecretEnvFiles(files: string[]): void {
  const envFiles = files.filter((file) => {
    const base = path.basename(file);
    return base === ".env" || base.startsWith(".env.");
  });
  assert(envFiles.length === 0, `Secret-bearing env files must not be packaged: ${envFiles.join(", ")}`);
}

function assertRuntimeDataClean(files: string[]): void {
  const runtimeFiles = files.filter((file) => file.startsWith("data/runtime/") || file.startsWith("data/journal/"));
  const bad = runtimeFiles.filter((file) => path.basename(file) !== ".gitkeep");
  assert(bad.length === 0, `Runtime data must not be packaged except .gitkeep: ${bad.join(", ")}`);
}

function assertAnyFile(files: string[], patterns: RegExp[], label: string): void {
  const hit = files.some((file) => patterns.some((pattern) => pattern.test(file)));
  assert(hit, `Missing expected ${label}`);
}

async function runAudit(id: number, name: string, fn: () => void | Promise<void>): Promise<AuditResult> {
  try {
    await fn();
    return { id, name, ok: true };
  } catch (error) {
    return {
      id,
      name,
      ok: false,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const pkg = readJson<{ name?: string; description?: string; scripts?: Record<string, string> }>("package.json");
  const scripts = pkg.scripts ?? {};
  const files = listFiles(".");

  const keyScripts = [
    "verify",
    "typecheck",
    "test",
    "test:core-constitution",
    "test:core:cold-start",
    "test:core:bootstrap",
    "test:core:event-validation",
    "test:core:idempotency",
    "test:wave2:scenario-audit",
    "test:core:exchange-truth",
    "test:core:freshness",
    "test:core:health-truth",
    "test:wave3:scenario-audit",
    "test:core:kernel-authority",
    "test:core:trust-report",
    "test:core:action-gate-verdict",
    "test:wave4:scenario-audit",
    "test:core:recovery-planner",
    "test:core:quarantine",
    "test:core:permission-ledger",
    "test:wave5:scenario-audit",
    "test:canonical-audit-checklist",
  ];

  const audits: Array<[number, string, () => void | Promise<void>]> = [
    [
      1,
      "No V1 inside active core defaults",
      () => {
        assertNoForbiddenDefaultWiring(scripts, [{ label: "V1", pattern: /\bv1\b|genesis-v1|connect:v1/ }]);
      },
    ],
    [
      2,
      "No V2 inside active core defaults",
      () => {
        assertNoForbiddenDefaultWiring(scripts, [{ label: "V2", pattern: /\bv2\b|connect:v2/ }]);
      },
    ],
    [
      3,
      "No frontend/control UI",
      () => {
        const allowedCoreObservableApi = (file: string) =>
          file.startsWith("core/contracts/ui/") ||
          file.startsWith("core/ui-api/") ||
          file === "core/contracts/src/ui.ts";
        const uiLikeFiles = files.filter(
          (file) => /(^|\/)(ui|frontend|webapp|web-ui)(\/|$)/i.test(file) && !allowedCoreObservableApi(file)
        );
        assert(
          uiLikeFiles.length === 0,
          `Frontend/control UI files/directories are not allowed outside read-only Core UI API contracts: ${uiLikeFiles.join(", ")}`
        );
        assertNoForbiddenDefaultWiring(scripts, [
          { label: "frontend/control UI", pattern: /\b(frontend|webapp|vite|next|react)\b/ }
        ]);
      },
    ],
    [
      4,
      "No strategy logic in active defaults",
      () => {
        assertNoForbiddenDefaultWiring(scripts, [{ label: "strategy", pattern: /\bstrategy\b|signal-layer|decision-engine/ }]);
      },
    ],
    [
      5,
      "No live trading defaults",
      () => {
        assertNoForbiddenDefaultWiring(scripts, [
          { label: "live trading", pattern: /live\s*trading|live-trading|real[-:]?order|marketbuy|marketsell/ },
          { label: "real exchange keys", pattern: /api[_-]?key|secret[_-]?key|exchange[_-]?key/ },
        ]);
      },
    ],
    [
      6,
      "No .env with keys",
      () => {
        assertNoSecretEnvFiles(files);
      },
    ],
    [
      7,
      "CoreTrustReport exists",
      () => {
        assert(exists("core/kernel/core-trust-report.ts"), "Missing core/kernel/core-trust-report.ts");
        assert(scriptExists(scripts, "test:core:trust-report"), "Missing script test:core:trust-report");
      },
    ],
    [
      8,
      "Kernel Authority exists",
      () => {
        assert(exists("core/kernel/kernel-authority.ts"), "Missing core/kernel/kernel-authority.ts");
        assert(scriptExists(scripts, "test:core:kernel-authority"), "Missing script test:core:kernel-authority");
      },
    ],
    [
      9,
      "ActionGate Verdict exists",
      () => {
        assert(exists("core/gates/src/action-gate.ts"), "Missing core/gates/src/action-gate.ts");
        assert(scriptExists(scripts, "test:core:action-gate-verdict"), "Missing script test:core:action-gate-verdict");
      },
    ],
    [
      10,
      "Recovery Planner exists",
      () => {
        assert(exists("core/recovery/recovery-planner.ts"), "Missing core/recovery/recovery-planner.ts");
        assert(scriptExists(scripts, "test:core:recovery-planner"), "Missing script test:core:recovery-planner");
      },
    ],
    [
      11,
      "Quarantine exists",
      () => {
        assert(exists("core/quarantine/quarantine.ts"), "Missing core/quarantine/quarantine.ts");
        assert(scriptExists(scripts, "test:core:quarantine"), "Missing script test:core:quarantine");
      },
    ],
    [
      12,
      "Permission Ledger exists",
      () => {
        assert(exists("core/permissions/permission-ledger.ts"), "Missing core/permissions/permission-ledger.ts");
        assert(scriptExists(scripts, "test:core:permission-ledger"), "Missing script test:core:permission-ledger");
      },
    ],
    [
      13,
      "ExchangeTruth exists",
      () => {
        assert(scriptExists(scripts, "test:core:exchange-truth"), "Missing script test:core:exchange-truth");
        assertAnyFile(files, [/DELIVERY_REPORT_WAVE3_EXCHANGE_TRUTH\.md$/, /tests\/scenarios\/exchange-truth\.ts$/], "ExchangeTruth evidence");
      },
    ],
    [
      14,
      "Freshness Guard exists",
      () => {
        assert(exists("core/runtime/src/freshness.ts"), "Missing core/runtime/src/freshness.ts");
        assert(scriptExists(scripts, "test:core:freshness"), "Missing script test:core:freshness");
      },
    ],
    [
      15,
      "HealthTruth exists",
      () => {
        assert(scriptExists(scripts, "test:core:health-truth"), "Missing script test:core:health-truth");
        assertAnyFile(files, [/DELIVERY_REPORT_WAVE3_HEALTH_TRUTH\.md$/, /tests\/scenarios\/core-health-truth\.ts$/], "HealthTruth evidence");
      },
    ],
    [
      16,
      "package.json description corresponds to alpha5 or alpha5.1",
      () => {
        assert(
          /alpha5(\.1)?/i.test(pkg.description ?? ""),
          `package.json description must mention alpha5 or alpha5.1. Current description: ${pkg.description ?? "<missing>"}`
        );
      },
    ],
    [
      17,
      "npm run verify exists",
      () => {
        assert(scriptExists(scripts, "verify"), "Missing script verify");
      },
    ],
    [
      18,
      "All key scripts exist",
      () => {
        const missing = keyScripts.filter((script) => !scriptExists(scripts, script));
        assert(missing.length === 0, `Missing key scripts: ${missing.join(", ")}`);
      },
    ],
    [
      19,
      "No runtime data in archive except .gitkeep",
      () => {
        assertRuntimeDataClean(files);
      },
    ],
    [
      20,
      "Documents alpha1-alpha5 are present",
      () => {
        for (const alpha of [1, 2, 3, 4, 5]) {
          assertAnyFile(files, [new RegExp(`INTEGRATION_REPORT_ALPHA${alpha}\\.md$`, "i")], `alpha${alpha} integration report`);
          assertAnyFile(files, [new RegExp(`alpha${alpha}-integration\\.patch$`, "i")], `alpha${alpha} integration patch`);
        }

        const deliveryChecks = [
          /DELIVERY_REPORT_WAVE2/i,
          /DELIVERY_REPORT_WAVE3/i,
          /DELIVERY_REPORT_WAVE4/i,
          /DELIVERY_REPORT_WAVE5/i,
        ];

        for (const pattern of deliveryChecks) {
          assert(files.some((file) => pattern.test(file)), `Missing delivery documentation matching ${pattern}`);
        }
      },
    ],
  ];

  const results: AuditResult[] = [];
  for (const [id, name, fn] of audits) {
    results.push(await runAudit(id, name, fn));
  }

  const failed = results.filter((result) => !result.ok);
  const summary = {
    name: "canonical_audit_checklist",
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
