# MBG Wire Integration Report

| Field | Value |
|-------|--------|
| **Task ID** | AG01-WIRE-MBG-READONLY |
| **Owner GO** | `42_OWNER_GO_WIRE_AND_L2_HYBRID_UI_RU.md` § GO-WIRE |
| **Date** | 2026-06-01 |
| **Status** | **PASS** (core on 3011) |

---

## 1. Цель

Первый **живой** путь Genesis:

```text
MBG readonly API (127.0.0.1:3011)
  → tools/integration/mbg-readonly-to-observation.mjs
  → genesis.market-observation.v1
  → tests/fixtures/phase3/market-observation/mbg-wire-live-sample.json
```

---

## 2. Endpoints (readonly GET only)

| Path | Назначение |
|------|------------|
| `/health` | Проверка доступности core |
| `/api/core/live-stream/status` | Symbol, connection, trustState |
| `/api/core/live-stream/last-event` | Источник observation payload |
| `/api/core/overview` | overallState, executionSurface |

Источник: `02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2/API_CONTRACT.md`

---

## 3. Provenance (wire)

| Field | Value |
|-------|--------|
| `sourceKind` | `MBG_READONLY_API` |
| `ingestMode` | `LIVE_REST` |
| `derivation` | `MBG_READONLY_TO_OBSERVATION_V1` |
| `venue` | `MBG_READONLY_API` |

**Не** `OFFLINE_FIXTURE` — это намеренно для wire-слоя.

---

## 4. Команды

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
.\scripts\dev-readonly-safe.ps1   # core :3011
npm run verify:mbg-wire           # PASS если core up
```

Если core **выключен**: отчёт `status: YELLOW`, exit 0 (graceful skip).

---

## 5. Артефакты

| Файл | Описание |
|------|----------|
| `tools/integration/mbg-readonly-to-observation.mjs` | Adapter |
| `tools/verification/verify-mbg-wire.mjs` | Gate |
| `reports/mbg-wire-market-observation.json` | Machine report |
| `tests/fixtures/phase3/market-observation/mbg-wire-live-sample.json` | Sample on disk |

---

## 6. Ограничения (честно)

| Сигнал | Значение |
|--------|----------|
| Notary GREEN | **НЕ ЗАЯВЛЕН** |
| Execution | **ЗАПРЕЩЁН** |
| Keys / POST | **НЕТ** |
| Live trading | **НЕТ** |

MBG `executionSurface: closed` и `actionVerdict: prohibited` сохраняются в `wireMeta`.

---

*End of MBG_WIRE_INTEGRATION_REPORT.md*
