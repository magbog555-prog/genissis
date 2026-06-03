# RC4-A — Live Read-Only Backend Contracts

RC4-A adds backend/API DTO contracts for the first live read-only market stream.

This stage is backend/API/DTO only. It does not add execution, orders, trading buttons,
private API keys, signed endpoints, strategies, or automatic recovery.

## Core invariants

- Live connected does not mean TRUSTED.
- Fresh market data does not mean allowed.
- Market stream does not mean exchange proof.
- NO PROOF → NO ALLOW.
- executionSurface remains `closed`.
- actionVerdict remains `prohibited`.
- trustState remains `UNCERTAIN`.
- exchangeProofValid remains `false` until a separate proof layer exists.

## New DTOs

- `LiveMarketStreamDTO`
- `LiveMarketStreamEventDTO`
- `CoreOverviewDTO`

## New read-only endpoints

- `GET /api/core/live-stream/status`
- `GET /api/core/live-stream/health`
- `GET /api/core/live-stream/last-event`
- `GET /api/core/overview`

All POST requests to these endpoints must return 404 or 405.

## Default mode

`LIVE_STREAM_ENABLED=false`

The server starts normally without env configuration and reports:

- `connectionStatus=disconnected`
- `liveExchangeConnected=false`
- `exchangeProofStatus=missing`
- `exchangeProofValid=false`
- `executionSurface=closed`
- `actionVerdict=prohibited`
- `trustState=UNCERTAIN`

## Enabled mode

`LIVE_STREAM_ENABLED=true` may connect to a public read-only Binance stream.
No private keys, signed endpoints, account streams, order streams, or execution endpoints are used.
