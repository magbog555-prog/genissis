const seconds = Number(process.env.SECONDS ?? 60);
const tickMs = Number(process.env.TICK_MS ?? 250);
const signalEvery = Number(process.env.SIGNAL_EVERY ?? 5);
const orderEvery = Number(process.env.ORDER_EVERY ?? 10);

const url = `http://localhost:3000/tests/run/stateful-live-loop-observed?seconds=${seconds}&tickMs=${tickMs}&signalEvery=${signalEvery}&orderEvery=${orderEvery}`;

const response = await fetch(url, { method: "POST" });
const json = await response.json();

console.log(JSON.stringify(json, null, 2));

if (!json.ok) {
  process.exitCode = 1;
}
