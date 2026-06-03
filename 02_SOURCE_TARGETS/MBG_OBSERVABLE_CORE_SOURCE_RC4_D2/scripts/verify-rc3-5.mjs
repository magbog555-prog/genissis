import { spawn, spawnSync } from "node:child_process";

function run(label, command, args) {
  console.log(`\n[verify:rc3_5] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run("core typecheck", "npm", ["--prefix", "core", "run", "typecheck"]);
run("core tests", "npm", ["--prefix", "core", "test"]);
run("runtime snapshot tests", "npm", ["--prefix", "core", "run", "test:runtime-snapshot"]);
run("runtime read-model tests", "npm", ["--prefix", "core", "run", "verify:runtime-readmodel"]);
run("runtime API tests", "npm", ["--prefix", "core", "run", "verify:runtime-api"]);
run("runtime source tests", "npm", ["--prefix", "core", "run", "verify:runtime-source"]);
run("self-truth tests", "npm", ["--prefix", "core", "run", "verify:self-truth"]);
run("frontend build", "npm", ["--prefix", "frontend", "run", "build"]);

console.log("\n[verify:rc3_5] starting readonly API for surface verification");
const verifyPort = "4011";
const verifyBaseUrl = `http://127.0.0.1:${verifyPort}`;
const server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
  stdio: "ignore",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    CORE_READONLY_API_PORT: verifyPort,
    CORE_READONLY_API_BASE_URL: verifyBaseUrl,
    SELF_TRUTH_CLEAN_MODE: "true"
  }
});

try {
  await wait(2500);
  const surface = spawnSync("npm", ["--prefix", "core", "run", "verify:readonly-surface"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, CORE_READONLY_API_BASE_URL: verifyBaseUrl }
  });
  if (surface.status !== 0) {
    throw new Error(`readonly surface failed with exit code ${surface.status}`);
  }

  console.log("\n[verify:rc3_5] self-truth audit endpoint");
  const auditResponse = await fetch(`${verifyBaseUrl}/api/core/self-truth/audit`);
  if (!auditResponse.ok) {
    throw new Error(`self-truth audit endpoint failed with HTTP ${auditResponse.status}`);
  }
  const audit = await auditResponse.json();
  if (audit?.result !== "pass") {
    throw new Error(`self-truth audit endpoint result must be pass, got ${JSON.stringify(audit)}`);
  }
  if (audit?.selfTruthCleanMode !== true) {
    throw new Error("self-truth audit must run in clean mode");
  }
} finally {
  server.kill();
}

console.log("\n[verify:rc3_5] PASS");
