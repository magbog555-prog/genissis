import "dotenv/config";

async function main() {
  const baseUrl = process.env.RUNTIME_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/tests/run/position-reconcile-check`, { method: "POST" });
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!body.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
