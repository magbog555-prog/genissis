import "dotenv/config";

import { createConnectedReadOnlyCoreApiApp } from "../../../core/ui-api/connected-readonly-core-api.js";
import { liveReadOnlyMarketStream } from "../../../core/live-stream/live-market-stream.js";

const port = Number(process.env.CORE_READONLY_API_PORT ?? process.env.PORT ?? 3011);
const host = process.env.CORE_READONLY_API_HOST ?? "127.0.0.1";

const app = createConnectedReadOnlyCoreApiApp();
void liveReadOnlyMarketStream.start();

app.listen(port, host, () => {
  console.log(
    JSON.stringify({
      ok: true,
      service: "mbg-core-connected-readonly-api",
      readOnly: true,
      host,
      port,
      url: `http://${host}:${port}`
    })
  );
});
