# MBG Observable Core — START HERE (RC4-D)

Observe-only operator workspace: **no execution**, **no trading buttons**, **no API keys**, **no signed endpoints** in this surface.

## Ports

| Surface | URL |
|--------|-----|
| Core (readonly API) | `http://127.0.0.1:3011` |
| Frontend (Vite) | `http://localhost:5173` |

If **3011** is already in use, see **«Если порт 3011 занят»** below — do not rely on a raw **EADDRINUSE** stack trace as the primary signal; use the port helpers or launcher shortcuts.

## Как запустить без PowerShell (двойной клик)

1. Откройте папку проекта (корень репозитория).
2. Дважды нажмите **`START_APP.cmd`**.
3. Если порт **3011** занят, появится запрос: остановить старый core или отменить запуск (процесс **не** завершается автоматически без подтверждения).
4. Дождитесь отдельных окон **core** и **frontend** и открытия браузера на **http://localhost:5173** (если браузер не открылся — откройте ссылку вручную).
5. Чтобы остановить сервисы, дважды нажмите **`STOP_APP.cmd`** (или `launcher\STOP_ALL.cmd`).

Дополнительные ярлыки в папке **`launcher\`**: `START_CORE.cmd`, `START_FRONTEND.cmd`, `START_ALL.cmd`, `STOP_CORE_PORT.cmd`, `VERIFY_ALL.cmd`.

## Если порт 3011 занят

1. Запустите **`launcher\STOP_CORE_PORT.cmd`** (двойной клик), **или** выполните в PowerShell: `powershell -ExecutionPolicy Bypass -File .\stop-core-port.ps1`
2. Либо используйте **`STOP_APP.cmd`** / **`launcher\STOP_ALL.cmd`**, чтобы освободить **3011** и **5173**.
3. Затем снова запустите **`START_APP.cmd`** или `.\start-core.ps1`.

Сообщение для оператора: **«Порт 3011 занят. Вероятно, уже запущен старый core.»** — с выводом PID и выбором `[1]` остановить / `[2]` отменить (см. `start-core.ps1`).

## First-time setup (step by step)

1. **Install dependencies**

   ```bash
   npm run install:all
   ```

2. **Run the RC4-D verification gate** (core tests, RC4 chains, launcher checks, semantic labels, frontend checks, live readonly POST boundary, build, docs, acceptance scripts)

   ```bash
   npm run verify:rc4-d
   ```

3. **Start core** (readonly API on 3011)

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-core.ps1
   ```

4. **Start frontend** (in a second terminal)

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-frontend.ps1
   ```

5. **Open the UI**

   [http://localhost:5173](http://localhost:5173)

6. **Stop everything**

   ```powershell
   .\stop-all.ps1
   ```

## What to read next

- `RUNBOOK.md` — run, health checks, layout / localStorage, EADDRINUSE / port 3011
- `API_CONTRACT.md` — allowed GET routes on the readonly core
- `SAFETY_BOUNDARY.md` — invariants and forbidden capabilities
- `RC4_FINAL_ACCEPTANCE_REPORT.md` — acceptance scope and how to verify
- `UX_DEBT.md` — known UI / i18n follow-ups

## Release packaging

When verification is green, archive this directory as:

`MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D_FINAL_ACCEPTANCE.zip`

RC4-D2 launch / port preflight accepted artifact (optional name):

`MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D2_LAUNCH_PORT_PREFLIGHT_ACCEPTED.zip`
