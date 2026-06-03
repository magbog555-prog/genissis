# RUNBOOK — Observable Core (RC4-D)

## Run core only (readonly API)

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-core.ps1
```

Equivalent:

```bash
npm run dev:core
```

Listens on **127.0.0.1:3011** (see `core` `dev:readonly-api`).

## Run frontend only

```powershell
powershell -ExecutionPolicy Bypass -File .\start-frontend.ps1
```

Equivalent:

```bash
npm run dev:frontend
```

Default dev URL: **http://localhost:5173**

## Run everything together

**Double-click (operator):** from repo root run **`START_APP.cmd`** — resolves **3011** conflicts with confirmation, opens **core** and **frontend** in **separate** PowerShell windows, then opens the browser on **http://localhost:5173**. To stop: **`STOP_APP.cmd`**.

**Launcher folder:** `launcher\START_ALL.cmd` opens core and frontend in two windows (each runs the same `start-core.ps1` / `start-frontend.ps1` scripts).

**PowerShell (developer):** `.\start-all.ps1` — same idea via `Start-Process`.

1. Core first, then frontend (frontend expects core for ApiAdapter mode).

## Health checks

**Core**

```bash
curl -s http://127.0.0.1:3011/health
```

Expect JSON with service descriptor fields (read-only).

**Frontend**

Open `http://localhost:5173` — header should load; switch **MockAdapter** / **ApiAdapter** as needed. ApiAdapter requires core on 3011.

## Verify frontend build (no dev server)

```bash
npm run build:frontend
```

## localStorage layout (RC4-C)

- **Key:** `mbg.rc4c.layout.v1`
- **Schema:** `rc4-c-layout-v1`

Stores: `openTabs`, `activeTabId`, `panels` (positions, sizes, `visible`, `collapsed`, `z`), theme/settings blob, `compactMode`, `language`, `workspaceMode`, `adapterMode`, `selectedScenario`, `resetMode: 'manual-only'`.

Inspect in browser DevTools → Application → Local Storage → your origin.

## Reset layout (manual only)

Use the in-app control **↻ Reset layout** (or the documented hotkey). This clears the RC4-C bundle and reapplies defaults — **not** triggered automatically on reload.

## EADDRINUSE / port 3011 in use

Node may print **EADDRINUSE** if something already listens on **3011**. Prefer the operator flow instead of treating that stack trace as the main instruction:

1. **`start-core.ps1`** now runs a **RC4-D2 preflight**: if **3011** is busy, you see **«Порт 3011 занят. Вероятно, уже запущен старый core.»**, listed **PID(s)**, and **`[1]`** stop old core / **`[2]`** cancel. Nothing is killed until you choose **`[1]`** (which calls **`stop-core-port.ps1`**).
2. Double-click **`launcher\STOP_CORE_PORT.cmd`** or run `powershell -ExecutionPolicy Bypass -File .\stop-core-port.ps1` to free **3011** only.
3. Run **`STOP_APP.cmd`**, **`launcher\STOP_ALL.cmd`**, or `.\stop-all.ps1` to stop **3011** and **5173** listeners.
4. Restart **`START_APP.cmd`** or `.\start-core.ps1`.

Advanced: `netstat -ano | findstr :3011` → note PID → `taskkill /PID <pid> /F` (only if you know the process is safe to end).

## Automated verification

```bash
npm run verify:rc4-d
```

Spins up readonly API briefly for `verify:readonly-surface` (POST boundary). See `scripts/verify-rc4-d.mjs`.
