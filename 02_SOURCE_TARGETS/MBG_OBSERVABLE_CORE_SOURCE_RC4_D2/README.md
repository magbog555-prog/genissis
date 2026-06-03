# MBG Observable Core Workspace RC3

RC3 builds on RC2 HOTFIX1 and adds the Real Runtime Read-Model Adapter.

## Status

```text
RuntimeSnapshot: enabled
RuntimeReadModelAdapter: enabled
Runtime source: runtime-stub in packaged RC3
Read-only boundary: closed
Binance/API keys/execution: not connected
```

## Main commands

```bash
npm run install:all
npm run verify:rc3
npm run dev:core
npm run dev:frontend
```

## Core API

```text
http://localhost:3011
```

## Frontend

```text
http://localhost:5173
```

See:

```text
START_HERE.md
SAFETY_BOUNDARY.md
API_CONTRACT.md
docs/DTO_NORMALIZATION.md
docs/RUNTIME_READMODEL.md
BOOT_REPORT.md
```


## RC3 HOTFIX1 Runtime Source Honesty

RC3 HOTFIX1 binds the runtime read-model endpoints to actual `runtimeEngine` read state when `CORE_RUNTIME_SOURCE=runtime-engine` or when the default runtime-engine source is available.

Supported runtime source modes:

- `runtime-engine`
- `runtime-stub`
- `runtime-unavailable`

The API must never report `runtime-engine` while using stub data.

This remains read-only:
- no Binance
- no API keys
- no market stream ingest
- no order placement
- no execution endpoints


---

## RC3.5 Core Self-Truth Audit

RC3.5 is built from `MBG_OBSERVABLE_CORE_WORKSPACE_RC3_REAL_RUNTIME_READMODEL_HOTFIX1`.

RC3.5 does not include RC4 market ingest. It checks the Core before external market sensors are attached.

Main invariant:

```text
NO PROOF → NO ALLOW
```

RC3.5 does:
- keep RC3 runtime read-model API alive
- add self-truth tests
- add `GET /api/core/self-truth/audit`
- prove missing/unknown/malformed data leads to `UNCERTAIN` and `prohibited`
- keep the read-only boundary closed

RC3.5 does not:
- connect Binance
- ingest market streams
- use API keys
- enable execution
- expose trading POST endpoints


## RC3.5 Semantic Hardening

Operator-facing labels are Russian. Technical JSON fields remain stable DTO/debug fields. This package does not connect execution or Binance private API.


## RC4-A — Live Read-Only Backend Contracts

RC4-A starts from frozen RC3.5 Semantic Hardening and adds backend/API DTO contracts for
a public read-only market stream and the Core Overview DTO.

No execution is connected. No orders are added. No trading buttons are added.
The stream is observation only.

New endpoints:

```text
GET /api/core/live-stream/status
GET /api/core/live-stream/health
GET /api/core/live-stream/last-event
GET /api/core/overview
```

Safety invariant:

```text
Live connected ≠ TRUSTED
Fresh data ≠ allowed
Market stream ≠ exchange proof
NO PROOF → NO ALLOW
```


---

## RC4-B Frontend Panels

Status: RC4-B candidate.

Added frontend panels:
- 00 Пульт ядра / Core Overview
- 17 Живой поток / Live Market Stream

RC4-B uses RC4-A backend/API DTO contracts:
- GET /api/core/overview
- GET /api/core/live-stream/status
- GET /api/core/live-stream/health
- GET /api/core/live-stream/last-event

Safety invariants preserved:
- live connected does not imply TRUSTED
- fresh market data does not imply allowed
- exchangeProofValid remains false without proof-layer
- executionSurface remains closed
- dangerous POST endpoints remain closed

Browser path status: HOLD until manually verified in user's browser.


## RC4-C Layout Persistence

Frontend layout is saved in browser `localStorage` with schema `rc4-c-layout-v1` and key `mbg.rc4c.layout.v1`.

Saved state includes open tabs, active tab, tab order, panel positions, panel sizes, collapsed/visible state, compact mode, RU language and visual theme settings.

The layout is reset only by the manual **Сбросить раскладку** action. Content and raw JSON must scroll inside fixed windows.


Status: `RC4-C LAYOUT PERSISTENCE CANDIDATE`.
