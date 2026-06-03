import { spawn, spawnSync } from "node:child_process";

function run(label, command, args) {
  console.log(`\n[verify:rc3] ${label}`);
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
run("frontend build", "npm", ["--prefix", "frontend", "run", "build"]);

console.log("\n[verify:rc3] starting readonly API for surface verification");
const server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
  stdio: "ignore",
  shell: process.platform === "win32"
});

try {
  await wait(2500);
  run("readonly surface", "npm", ["--prefix", "core", "run", "verify:readonly-surface"]);
} finally {
  server.kill();
}

console.log("\n[verify:rc3] PASS");
