# API_CONTRACT — Readonly core (`dev:readonly-api`)

Implementation: `core/core/ui-api/connected-readonly-core-api.ts`  
Base URL (local): `http://127.0.0.1:3011`

## Allowed GET endpoints (operator / tooling)

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/api/core/status` |
| GET | `/api/core/overview` |
| GET | `/api/core/live-stream/status` |
| GET | `/api/core/live-stream/health` |
| GET | `/api/core/live-stream/last-event` |
| GET | `/api/core/runtime/snapshot` |
| GET | `/api/core/runtime/status` |
| GET | `/api/core/self-truth/audit` |

Additional readonly GETs may exist for traces, scenarios, and runtime read-model slices (see source `RC1_PUBLIC_READONLY_ENDPOINTS`, `RC3_RUNTIME_READONLY_ENDPOINTS`, `RC4_LIVE_READONLY_ENDPOINTS`).

## POST / mutation policy

**POST trading and mutation endpoints are forbidden / closed** on this readonly surface.

The following must **not** accept a successful POST (expect **404** or **405**, never **200** with side effects):

- `POST /order`
- `POST /trade/place`
- `POST /execution/testnet/place-guarded`
- `POST /api/core/overview`
- `POST /api/core/live-stream/status`
- `POST /api/core/live-stream/health`
- `POST /api/core/live-stream/last-event`

Runtime verification: `npm run verify:readonly-surface` (requires core listening on 3011).  
Static guard: `connected-readonly-core-api.ts` registers **no** `router.post` / `app.post` handlers.

## Notes

- This contract describes the **readonly operator API** used by the RC4 workspace frontend in ApiAdapter mode.
- The full `runtime-api` application under `core/apps/runtime-api` is a separate, broader surface and is **not** the default for RC4-D acceptance.
