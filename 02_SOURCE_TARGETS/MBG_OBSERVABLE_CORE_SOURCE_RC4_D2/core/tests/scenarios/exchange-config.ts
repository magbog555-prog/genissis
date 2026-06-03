import "dotenv/config";
import { binanceSpotTestnet } from "../../application/exchange/src/binance-spot-testnet.js";

console.log(JSON.stringify(binanceSpotTestnet.status(), null, 2));
