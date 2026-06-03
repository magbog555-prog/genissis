# BOOT_REPORT (RC4-D)

## Workspace identity

- **Phase:** RC4-D — final verification, documentation, acceptance hardening  
- **Package:** `mbg-observable-core-workspace-rc4-d-final-acceptance` (`package.json`)

## Processes

| Process | Entry | Port |
|---------|--------|------|
| Readonly core API | `core` → `npm run dev:readonly-api` → `apps/readonly-api/src/server.ts` | **3011** |
| Frontend | `frontend` → Vite dev or `npm run build` | **5173** (dev default) |

## RC4-D2 — launch without typing PowerShell

- **Root:** `START_APP.cmd` / `STOP_APP.cmd` — double-click orchestration (separate windows for core + frontend; port **3011** preflight with operator confirmation before killing a PID).
- **Folder `launcher\`:** `START_CORE.cmd`, `START_FRONTEND.cmd`, `START_ALL.cmd`, `STOP_ALL.cmd`, `STOP_CORE_PORT.cmd`, `VERIFY_ALL.cmd` — thin wrappers around the same `*.ps1` scripts and `npm run verify:rc4-d`.
- **Scripts:** `start-core.ps1` (preflight **3011**), `stop-core-port.ps1`, `rc4-d2-port-util.ps1` (shared `netstat` parsing).

## Persistence (frontend)

- **localStorage key:** `mbg.rc4c.layout.v1`  
- **Schema version string:** `rc4-c-layout-v1`  
- **Reset:** manual only (`resetMode: 'manual-only'` in saved blob)

## Verification entrypoints

| Command | Role |
|---------|------|
| `npm run verify:rc4-d` | Full RC4-D gate (see `scripts/verify-rc4-d.mjs`) |
| `npm run verify:launchers` | RC4-D2 — `START_APP.cmd`, `launcher\*.cmd`, `stop-core-port.ps1`, docs cross-checks (`scripts/verify-launchers.mjs`) |
| `npm run verify:docs` | Required markdown present + `START_HERE` checklist strings |
| `npm run verify:final-acceptance` | Static safety + report wording checks |

## Constraints (unchanged from RC4-C)

No execution UI, no trading buttons, no API keys in repo scripts, no signed endpoints on readonly surface, no relaxation of safety logic without a new gated phase.
