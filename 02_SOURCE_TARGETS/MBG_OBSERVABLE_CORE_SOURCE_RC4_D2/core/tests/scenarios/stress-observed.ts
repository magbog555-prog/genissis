const seconds = Number(process.env.SECONDS ?? 60);
const url = `http://localhost:3000/tests/run/synthetic-live-loop-observed?seconds=${seconds}&tickMs=250`;

const response = await fetch(url, { method: "POST" });
const json = await response.json();

console.log(JSON.stringify(json, null, 2));

if (!json.ok) {
  process.exitCode = 1;
}
