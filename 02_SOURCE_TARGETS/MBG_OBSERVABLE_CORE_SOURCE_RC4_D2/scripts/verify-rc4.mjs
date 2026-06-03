
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

async function waitFor(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let server;
try {
  await run("npm", ["run", "check:core"]);
  await run("npm", ["run", "verify:semantic-hardening"]);
  await run("npm", ["run", "verify:rc4-live-readonly"]);
  await run("npm", ["run", "verify:core-overview"]);
  await run("npm", ["run", "build:frontend"]);

  server = spawn("npm", ["--prefix", "core", "run", "dev:readonly-api"], {
    stdio: "ignore",
    shell: process.platform === "win32"
  });
  await waitFor("http://127.0.0.1:3011/health");
  await run("npm", ["run", "verify:readonly-surface"]);

  console.log("verify:rc4 PASS");
} finally {
  if (server) {
    server.kill();
  }
}
