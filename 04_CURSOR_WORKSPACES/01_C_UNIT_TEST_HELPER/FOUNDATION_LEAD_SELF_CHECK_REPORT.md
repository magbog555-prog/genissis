# FOUNDATION LEAD SELF-CHECK REPORT

**Agent:** Cursor C Unit Test Helper — Genesis Foundation Lead Engineer  
**Date:** 2026-05-31  
**Task:** Self-check role initialization (no code, no MBG analysis, no artifacts beyond this report)  
**Control Pack:** `D:\genessis\01_CONTROL_PACK\GENESIS_FOUNDATION_CONTROL_PACK_CLEAN_V1`

---

## 1. ROLE UNDERSTANDING

### Кто я?

Я — **Genesis Foundation Lead Engineer** (роль Cursor: C Unit Test Helper). Я первый технический орган Genesis Foundation: не торговый бот, не Нотариус, не архитектор контрактов и не красная команда. Я превращаю архитектурные границы Genesis в **проверяемую структуру репозитория** — инвентаризацию, классификацию зон, scanner outputs, negative fixtures и технические отчёты.

### За что отвечаю?

- Первичная **инвентаризация** исходника (объект: MBG Observable Core source target).
- Классификация **SAFE / UNSAFE / DONOR / UNKNOWN**.
- `tools/verification/foundation-scope.config.json`.
- Scanner-ы: маршруты, импорты, окружение/секреты (только после review inventory).
- Machine-readable отчёты и negative fixtures.
- Технические отчёты Sprint 1 (`REPO_INVENTORY_INITIAL.md`, `SAFE_UNSAFE_SPLIT_INITIAL.md`, и др.).
- Подготовка входов для Нотариуса, Evidence, Contracts и Red Team (как **source technical evidence**, не как их решения).

### За что НЕ отвечаю?

- **Notary** — не выдаю CoreTrustAttestation, GREEN/YELLOW/RED доверия.
- **Evidence** — не строю Evidence Matrix, не доказываю safety claims.
- **Contracts** — не определяю канонический язык контрактов и forbidden fields.
- **Architecture Red Team** — не делаю architecture review и не снимаю RED findings.
- **Execution / Trading / Market Data** — не строю, не подключаю, не запускаю.
- **MBG Core, runtime-api, gate, replay, hash-chain, ledger** — не меняю без явного approval.
- Не принимаю финальные архитектурные решения о границах — фиксирую и классифицирую, решение за владельцем/review.

---

## 2. BOUNDARY CHECK

### Что мне разрешено делать?

| Область | Разрешено |
|--------|-----------|
| **Документация** | `docs/**`, `docs/reports/**`, `docs/architecture/**` |
| **Отчёты** | `reports/**` (JSON/MD) |
| **Verification tools** | `tools/**`, `tools/verification/**` |
| **Тесты границ** | `tests/boundary/**`, `tests/negative/**` |
| **Контракты (skeleton)** | `packages/contracts/**` |
| **Notary (skeleton only)** | `packages/notary/**` — только schemas, placeholders, report formats, documentation |
| **package.json** | Только секция `scripts` (verify:routes, verify:imports, verify:env, verify:foundation) |
| **Чтение** | Source target, control pack, чужие артефакты (read-only) |
| **Классификация** | SAFE / UNSAFE / DONOR / UNKNOWN по правилам scope config |

### Что мне запрещено делать?

| Область | Запрет |
|--------|--------|
| **Execution** | Создавать execution, order routes, exchange clients, live/testnet bridge, ExecutionIntent runtime, UI execution actions |
| **Trading** | Стратегии, сценарии, paper/live execution, кнопки торговли, Binance/биржи |
| **Market Data** | Рыночный движок, perception, scenario engine |
| **Risk Decisions** | Admission, trust, canExecute — не моя зона |
| **Notary Decisions** | GREEN/YELLOW/RED аттестация, объявление Notary готовым |
| **Evidence Decisions** | Claims без artifact, «почти доказано» |
| **Contract Decisions** | Канонические контракты, ReasonCodeRegistry как authority |
| **Forbidden zones** | `packages/mbg-core/**`, `core/**`, `apps/runtime-api/**`, `unsafe/**`, execution adapters, gate/replay/hash/ledger |
| **Dependencies** | No new dependencies, no version changes, no lockfile changes |
| **README/RUNBOOK** | Read-only на Sprint 1 |
| **Чужие source artifacts** | Не переписывать scanner outputs, Notary reports, Evidence Matrix других ролей |

### Особые границы (явно)

```text
Execution        — ЗАПРЕЩЕНО создавать и запускать
Trading          — ЗАПРЕЩЕНО
Market Data      — ЗАПРЕЩЕНО (позже этап Genesis, не Sprint 1)
Risk Decisions   — ЗАПРЕЩЕНО
Notary Decisions — ЗАПРЕЩЕНО (только skeleton inputs для будущего Notary)
Evidence Decisions — ЗАПРЕЩЕНО
Contract Decisions — ЗАПРЕЩЕНО (только границы для contracts package, не authority)
```

---

## 3. SAFE / UNSAFE MODEL

### SAFE

Зона, **явно классифицированная** как безопасный контур или кандидат на него: docs, verification tools, contracts skeleton, reports. Safe artifact **технически не должен уметь отправить order**.

```text
SAFE violation = RED
```

Примеры RED в SAFE: `POST /order`, import execution/exchange/binance, `BINANCE_SECRET_KEY` в safe-файле.

### UNSAFE

Зона execution, testnet, live bridge, exchange adapters, order routing. Наличие unsafe-кода здесь — ожидаемо; это **не провал Sprint 1**, а finding.

```text
UNSAFE violation = FINDING
```

### DONOR

Legacy / donor-код: источник идей, **не канонический safe**. Например `apps/runtime-api/**`, `legacy/**`, `trading-runtime/**`.

```text
DONOR violation = DONOR_FINDING
```

DONOR ≠ SAFE. DONOR finding ≠ RED.

### UNKNOWN

Зона **ещё не классифицирована**. Безопасность не доказана.

```text
UNKNOWN = YELLOW
UNKNOWN never GREEN
```

Приоритет классификации:

```text
SAFE > UNSAFE > DONOR > UNKNOWN
```

(`unknown_roots: ["**"]` — только fallback, не перекрывает явные roots.)

### Что делать при обнаружении UNKNOWN?

1. **Не** объявлять SAFE и **не** выдавать GREEN.
2. Зафиксировать как **YELLOW** в отчёте.
3. Указать путь, поверхность риска (routes/imports/env), limitations.
4. Если UNKNOWN попадает в safe artifact, имеет mutating route, secrets или execution imports → эскалация к **RED** / **STOP** и запрос решения владельца.
5. Продолжать инвентаризацию; классификацию UNKNOWN завершает review + обновление `foundation-scope.config.json`, не самовольное «догадалось safe».

---

## 4. FIRST MISSION UNDERSTANDING

После допуска к работе (GO от владельца после review этого self-check) первая **реальная** задача — **не scanner-ы**, а inventory.

### Пошагово

1. **Получить задачу** в формате TASK/CONTEXT/GOAL/ALLOWED FILES/FORBIDDEN FILES/ACCEPTANCE/REJECTION.
2. **Read-only обзор** source target `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2`:
   - структура директорий, entrypoints, `package.json` scripts;
   - поверхность routes, imports, env (без запуска кода, без установки зависимостей).
3. **Создать** `docs/reports/REPO_INVENTORY_INITIAL.md` в allowed zones workspace/target:
   - directory tree summary;
   - SAFE / UNSAFE / DONOR / UNKNOWN **кандидаты**;
   - первые риски (RED candidates, YELLOW unknowns);
   - proposal для `foundation-scope.config.json`;
   - limitations, next steps.
4. **Остановиться** — дождаться **manual review** inventory (запрет scanner-ов до review).
5. После approval — задача 2: `foundation-scope.config.json` + `FOUNDATION_SCOPE_CONFIG_INITIAL.md`, снова review.
6. Только после approval scope config — route/import/env scanners, negative fixtures, `SAFE_UNSAFE_SPLIT_INITIAL.md` по плану Sprint 1 (дни 3–7).

**Жёсткое правило:** `No scanner implementation before REPO_INVENTORY_INITIAL.md is completed and reviewed.`

---

## 5. EXPECTED OUTPUTS (Sprint 1)

| # | Артефакт | Назначение |
|---|----------|------------|
| 1 | `docs/reports/REPO_INVENTORY_INITIAL.md` | Первая карта репозитория |
| 2 | `tools/verification/foundation-scope.config.json` | Машиночитаемые safe/unsafe/donor/unknown roots |
| 3 | `docs/reports/FOUNDATION_SCOPE_CONFIG_INITIAL.md` | Пояснение scope config |
| 4 | `reports/route-inventory.json` | Карта маршрутов |
| 5 | `tools/verification/scan-routes.*` | Route scanner |
| 6 | `tests/negative/route-post-order.fixture.*` | Negative route tests |
| 7 | `reports/import-boundary-report.json` | Карта импортов |
| 8 | `tools/verification/scan-imports.*` | Import scanner |
| 9 | `tests/negative/unsafe-import.fixture.*` | Negative import tests |
| 10 | `reports/env-inventory.md` (+ JSON при необходимости) | Env/secrets inventory |
| 11 | `tools/verification/scan-env.*` | Env scanner |
| 12 | `tests/negative/exchange-secret.fixture.*` | Negative env tests |
| 13 | `docs/architecture/SAFE_ENV_POLICY.md` | Политика safe env |
| 14 | `docs/reports/SAFE_UNSAFE_SPLIT_INITIAL.md` | Итоговый split |
| 15 | `docs/reports/GENESIS_FOUNDATION_SPRINT_1_REVIEW.md` | Sprint 1 review |
| 16 | `npm run verify:foundation` (scripts в package.json) | Объединённая проверка |

Все secret values в отчётах — только `[REDACTED]`.

---

## 6. INTERACTION MODEL

### Code Cloaker (Notary)

| Направление | Содержание |
|-------------|------------|
| **Я → Notary** | `env-inventory`, route/import reports, safe/unsafe/donor/unknown map, redacted findings, negative test results |
| **Notary → я** | Требования к input reports; findings: secret in safe, secret not redacted, unsafe env in safe |
| **Граница** | Scanner output = raw technical evidence. Notary attestation = независимое решение. Я **не** выдаю GREEN/RED доверия. |

### DO-178B C (Evidence)

| Направление | Содержание |
|-------------|------------|
| **Я → Evidence** | Scanner reports, negative fixtures, risk→check mapping, finding statuses, limitations |
| **Evidence → я** | Gaps: нет trace risk→check, fixture не связан с rule, report не machine-readable |
| **Граница** | Я создаю **source evidence** для матрицы; Evidence создаёт derived EvidenceRef/Matrix. Я **не** выдаю «proven safety». |

### StreamSets AI (Contracts)

| Направление | Содержание |
|-------------|------------|
| **Я → Contracts** | `foundation-scope.config.json`, forbidden import rules, границы packages/contracts |
| **Contracts → я** | Contract boundaries, forbidden fields, canonical DTO names, versioning rules |
| **Граница** | Contracts = язык системы. Я = физические границы repo. Не подменяю Contract Architect. |

### nVision AI (Red Team)

| Направление | Содержание |
|-------------|------------|
| **Я → nVision** | Repo inventory, route/import/env reports, safe/unsafe split, YELLOW unknowns, RED risks |
| **nVision → я** | Attack paths, shortcut patterns, scope abuse, bypass scenarios, ARCH_RED flags |
| **Граница** | nVision создаёт **derived review only**, не исправляет мои отчёты. Я фиксирую «что найдено», nVision — «соответствует ли архитектуре». |

---

## 7. FAILURE CONDITIONS (обязан STOP и запросить решение владельца)

1. Задача без ALLOWED FILES / FORBIDDEN FILES / REJECTION CRITERIA → `STOP: TASK_SCOPE_INCOMPLETE`
2. Требуется изменить forbidden zone (`mbg-core`, `runtime-api`, `unsafe/**`, gate/replay/hash/ledger) → `STOP: FORBIDDEN_ZONE_CHANGE_REQUESTED`
3. Требуется dependency или lockfile change → `STOP: DEPENDENCY_CHANGE_REQUIRES_APPROVAL`
4. Требуется создать execution, exchange client, order route, live/testnet bridge → `STOP: GLOBAL_SAFETY_BOUNDARY_VIOLATION`
5. Задача требует scanner **до** review `REPO_INVENTORY_INITIAL.md` → `STOP: INVENTORY_REQUIRED_BEFORE_SCANNERS`
6. Обнаружен SAFE violation (order route, execution import, secret in safe) — фиксирую RED, **не** «чиню» production без approval
7. Требуется вывести secret value в отчёт → STOP, RED
8. Требуется объявить UNKNOWN как SAFE или GREEN → STOP, `ROLE_BOUNDARY_VIOLATION`
9. Требуется изменить чужой source artifact (Notary report, Evidence Matrix) → `STOP: SOURCE_ARTIFACT_READ_ONLY_VIOLATION`
10. Требуется объявить Notary готовым или выдать финальную аттестацию → STOP
11. Конфликт классификации scope (один path — ambiguous roots) → эскалация владельцу
12. UNKNOWN с execution surface используется production entrypoint → блокер до решения
13. Задача выходит за роль (рынок, сценарии, UI action, Binance) → `STOP: ROLE_BOUNDARY_VIOLATION`
14. Temporary shortcut / «только testnet» / «флаг выключен» как оправдание execution в safe → RED + STOP

---

## 8. MBG TARGET UNDERSTANDING

### Что такое `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2`?

Это **Source Target** — рабочий исходник **MBG Observable Core** (ядро честности Genesis), объект будущей инвентаризации и технического аудита Foundation Lead. Это **не** Control Pack (governance) и **не** весь Genesis.

```text
Control Pack  = роли, правила, спецификации
Source Target = MBG engine для inspect/inventory
Workspace     = D:\genessis
```

### Является ли объектом исследования?

**Да** — но только на этапе **read-only inventory** после допуска. Сейчас (self-check) я его **не анализирую**.

### Можно ли изменять этот объект?

**Нет** на Sprint 1 без отдельного письменного approval. Forbidden: `packages/mbg-core/**`, `core/**`, `apps/runtime-api/**`, execution adapters. Мои изменения — в `docs/**`, `reports/**`, `tools/verification/**`, `tests/negative/**` (в контексте задачи и allowed files).

### Можно ли запускать код?

**Нет** на этапе self-check и без явной задачи с COMMANDS TO RUN. Не устанавливаю зависимости, не запускаю runtime-api, не подключаю биржу. После допуска — только verify-скрипты из allowed tooling, когда они созданы и указаны в задаче.

---

## 9. FINAL VERDICT

### READY

**Почему READY, а не PARTIALLY_READY:**

- Роль, границы, модель SAFE/UNSAFE/DONOR/UNKNOWN, порядок inventory-before-scanners и первый артефакт (`REPO_INVENTORY_INITIAL.md`) понятны из Control Pack.
- Подтверждаю: не анализировал MBG, не менял код репозитория, не запускал код, не создавал Foundation-артефакты кроме этого отчёта.
- Нет blockers понимания; готов к review владельцем.

**Почему не NOT_READY:** нет пробелов в обязательных правилах; self-check не нарушен (нет предложений execution, Binance, изменения MBG Core).

**PARTIALLY_READY** был бы уместен, если бы не были загружены паспорт/план/knowledge — они загружены.

---

## SELF-CHECK EXECUTION LOG

```text
TASK COMPLETED: Self-check role initialization
FILES CREATED: FOUNDATION_LEAD_SELF_CHECK_REPORT.md (this file only)
FILES CHANGED: None (repository source target untouched)
FILES NOT TOUCHED: All MBG source, forbidden zones, package.json, lockfiles
INPUT ARTIFACTS USED: Control Pack documents (Context Brief, Global Rules, Role Passport,
  Sprint 1 Technical Execution Plan, All Knowledge, Launch Sequence, Source Target Pointer)
CHECKS RUN: None (no code execution)
MBG ANALYSIS: None (per task constraints)
DEPENDENCY CHANGES: None
LOCKFILE CHANGES: None
READY FOR REVIEW: YES
```

---

## FINAL RESPONSE BLOCK (required format)

```text
ROLE:
Foundation Lead Engineer

SELF-CHECK STATUS:
READY

BLOCKERS:
None for role understanding. Operational GO requires owner approval after review of this report.
All five agents' self-check is not required for this single-agent self-check task, but
Launch Sequence specifies Foundation Lead works first after collective GO.

FIRST ACTION AFTER APPROVAL:
Create docs/reports/REPO_INVENTORY_INITIAL.md for source target
D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2
(read-only inventory: directory structure, entrypoints, scripts, SAFE/UNSAFE/DONOR/UNKNOWN
candidates, first risks, foundation-scope.config.json proposal).
Do NOT implement scanners until REPO_INVENTORY_INITIAL.md is reviewed and approved.
```

---

*End of Foundation Lead Self-Check Report*
