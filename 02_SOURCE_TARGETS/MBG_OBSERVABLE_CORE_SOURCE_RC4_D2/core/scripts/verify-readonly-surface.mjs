const baseUrl = (process.env.CORE_READONLY_API_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");

const requiredGets = [
  "/health",
  "/api/core/scenarios",
  "/api/core/status",
  "/api/core/computation-trace/latest",
  "/api/core/runtime/snapshot",
  "/api/core/runtime/status",
  "/api/core/self-truth/audit",
  "/api/core/live-stream/status",
  "/api/core/live-stream/health",
  "/api/core/live-stream/last-event",
  "/api/core/overview"
];

const forbiddenPosts = [
  "/order",
  "/trade/place",
  "/execution/testnet/place-guarded",
  "/market/tick",
  "/api/core/runtime/snapshot",
  "/api/core/self-truth/audit",
  "/api/core/live-stream/status",
  "/api/core/live-stream/health",
  "/api/core/live-stream/last-event",
  "/api/core/overview"
];

async function checkGet(path) {
  const response = await fetch(`${baseUrl}${path}`, { method: "GET", headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`GET ${path} expected 2xx, got ${response.status}`);
  }
  return { path, status: response.status };
}

async function checkPostClosed(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ forbidden: true })
  });

  if (response.status === 200) {
    throw new Error(`POST ${path} returned 200 OK; read-only boundary is OPEN`);
  }

  return { path, status: response.status, closed: response.status === 404 || response.status === 405 };
}

const getResults = [];
const postResults = [];

for (const path of requiredGets) {
  getResults.push(await checkGet(path));
}

for (const path of forbiddenPosts) {
  postResults.push(await checkPostClosed(path));
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  gets: getResults,
  forbiddenPosts: postResults
}, null, 2));
