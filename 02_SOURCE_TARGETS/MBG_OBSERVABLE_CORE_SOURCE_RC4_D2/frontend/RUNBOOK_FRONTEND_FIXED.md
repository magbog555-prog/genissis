# RUNBOOK_FRONTEND_FIXED

## Install
```bash
npm install
```

## Build
```bash
npm run build
```

## Start frontend
```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Optional connected Core check
Start Core on:

```text
http://localhost:3011
```

Expected read-only endpoints:

```text
http://localhost:3011/health
http://localhost:3011/api/core/scenarios
http://localhost:3011/api/core/status
http://localhost:3011/api/core/computation-trace/latest
http://localhost:3011/api/core/computation-trace/latest?scenario=HEALTHY_TRUSTED_READY
http://localhost:3011/api/core/trace/HEALTHY_TRUSTED_READY
http://localhost:3011/api/core/status/HEALTHY_TRUSTED_READY
```

## Browser acceptance
1. Open `http://localhost:5173`.
2. Confirm visible UI.
3. Confirm `#root` is not empty.
4. Switch MockAdapter / ApiAdapter.
5. Switch all scenarios.
6. Open each workspace tab.
7. Confirm no execution/trading controls.
