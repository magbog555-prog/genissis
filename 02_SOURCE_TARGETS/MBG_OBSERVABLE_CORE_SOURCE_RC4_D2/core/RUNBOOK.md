# MBG Core v0.1 Runbook

This package is a clean PR35-based core baseline for **MBG Core v0.1 — Trust Kernel Hardening**.

Scope constraints:

- V1 is not connected.
- Signal Layer, Decision Engine, strategies, UI, and trading logic are not extended here.
- This package should strengthen verifiable core behavior and must not create false confidence about runtime state.

## 1. Install dependencies

```bash
npm install
```

Use the committed `package-lock.json` as the dependency authority.

## 2. Run the runtime API

```bash
npm run dev
```

Default server entrypoint:

```bash
apps/runtime-api/src/server.ts
```

The API starts without requiring live keys for the core/runtime scenarios.

## 3. Run tests

Primary smoke/core gate test:

```bash
npm run test
```

Additional scenario tests that remain in this clean package can be run explicitly, for example:

```bash
npm run test:persistence
npm run test:position
npm run test:recovery
```

## 4. Check TypeScript types

```bash
npm run typecheck
```

This runs:

```bash
tsc --noEmit
```

## 5. Reset runtime state

Runtime data is intentionally not shipped in the clean package.

To reset local runtime state after running the API or scenarios:

```bash
rm -rf data/runtime data/journal
mkdir -p data/runtime/events data/runtime/transitions data/journal
touch data/journal/.gitkeep
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force data/runtime, data/journal -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force data/runtime/events, data/runtime/transitions, data/journal
New-Item -ItemType File -Force data/journal/.gitkeep
```

## 6. Get health

With the API running:

```bash
curl http://localhost:3000/health
```

Review rule: treat health as a runtime diagnostic, not as proof that the core is trusted for trading actions.

## 7. Get snapshot

```bash
curl http://localhost:3000/state
```

The snapshot is the current local runtime state. Do not infer exchange truth from it unless an explicit reconciliation path has proved it.

## 8. Get permissions

```bash
curl http://localhost:3000/permissions
```

Permissions are the approved way to inspect whether the current snapshot allows or blocks actions.

## 9. If the core is blocked

When permissions deny actions or the system reports blocked/degraded state:

1. Do not bypass `ActionGate`.
2. Read `/permissions` and `/state` first.
3. Check runtime diagnostics/invariants if available.
4. Reset local runtime state only for local development/test recovery.
5. For real recovery, prefer explicit reconcile/read-only recovery paths over manual state edits.
6. Do not mark the core as trusted solely because the process is alive.

## 10. No secrets

Do not commit `.env`, live keys, production artifacts, runtime journals, snapshots, or local archives.


## Follow-up scripts for integration owner

The Role 1 follow-up adds safe package-level helpers without changing core runtime architecture.

```bash
npm run verify
npm run reset:runtime
npm run core:status
npm run replay:check
```

### `npm run verify`

Runs the accepted baseline checks:

```bash
npm run reset:runtime && npm run typecheck && npm run test
```

### `npm run reset:runtime`

Clears local runtime state:

```bash
npm run reset:runtime
```

This removes and recreates empty local folders:

- `data/runtime`
- `data/journal`

Runtime data is intentionally not shipped in the clean package archive.

### `npm run core:status`

Prints a local runtime view without starting the API:

```bash
npm run core:status
```

The command uses `PERSISTENCE_ENABLED=false` so it does not create or depend on persisted state.

### `npm run replay:check`

Runs the existing replay check helper:

```bash
npm run replay:check
```

Note: this uses the existing runtime persistence path. It may create empty local `data/runtime` folders during execution. These folders are local runtime artifacts and must not be committed or shipped.

## `.env.example` status

`.env.example` is intentionally not included in this clean package. The current PR35 baseline still contains live/testnet adapter code paths, so an ambiguous example configuration could create false confidence or encourage accidental operator setup before trust hardening is complete.

A safe config example should be added later only if it:

- contains no real keys;
- defaults to mock/offline or dry-run behavior;
- clearly states that V1, strategies, Signal Layer, Decision Engine, UI, and trading logic are out of scope for Core v0.1 alpha;
- documents fail-closed expectations.
