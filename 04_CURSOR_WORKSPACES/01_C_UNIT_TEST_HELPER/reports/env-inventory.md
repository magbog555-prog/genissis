# Env Inventory (Genesis Foundation)

Generated: 2026-06-03T07:06:54.925Z
Source: `D:/genessis/02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2`

## Summary

| Metric | Value |
|--------|-------|
| Files scanned | 150 |
| Total env references | 130 |
| RED in SAFE | 0 |
| Foundation gate | PASS |

## Forbidden names (SAFE policy)

- `BINANCE_API_KEY`
- `BINANCE_SECRET_KEY`
- `BINANCE_SECRET`
- `EXCHANGE_API_KEY`
- `EXCHANGE_SECRET`
- `TESTNET_KEY`
- `LIVE_KEY`
- `API_SECRET`
- `PRIVATE_KEY`
- `ORDER_ENDPOINT`
- `TRADING_ENDPOINT`
- `EXECUTION_MODE`

## RED in SAFE

_None._

## Violations by scope

### FINDING

- `BINANCE_API_KEY` — `core/application/exchange/src/binance-spot-testnet.ts`:76 — scope: UNSAFE — value: `[REDACTED]`
- `BINANCE_API_SECRET` — `core/application/exchange/src/binance-spot-testnet.ts`:77 — scope: UNSAFE — value: `[REDACTED]`
- `EXECUTION_MODE` — `core/apps/runtime-api/src/app.ts`:712 — scope: UNSAFE — value: `[REDACTED]`

## SAFE operator env (allowed references)

- `CORE_READONLY_API_PORT` in `core/apps/readonly-api/src/server.ts` = [REDACTED]
- `PORT` in `core/apps/readonly-api/src/server.ts` = [REDACTED]
- `CORE_READONLY_API_HOST` in `core/apps/readonly-api/src/server.ts` = [REDACTED]
- `MBG_EVENT_FUTURE_TOLERANCE_MS` in `core/core/events/validate-domain-event.ts` = [REDACTED]
- `CORE_RUNTIME_SOURCE` in `core/core/ui-api/connected-readonly-core-api.ts` = [REDACTED]
- `CORE_READONLY_API_BASE_URL` in `core/scripts/verify-readonly-surface.mjs` = [REDACTED]

---

_All secret/forbidden values redacted as [REDACTED]._
