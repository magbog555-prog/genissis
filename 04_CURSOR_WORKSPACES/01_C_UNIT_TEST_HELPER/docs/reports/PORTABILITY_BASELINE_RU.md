# B6 — Portability baseline (BASELINE_V1)

| Поле | Значение |
|------|----------|
| **Track** | Genesis Track B — B6 |
| **Статус** | **BASELINE_V1** (минимальное доказательство воспроизводимости) |
| **Не является** | ARCH_GREEN, полным CI, clean-install в контейнере |
| **Отчёт** | `reports/portability-baseline.json` |
| **CI path (документирован)** | `reports/portability-baseline-ci.json` — job `genesis-foundation-verify`; статус `DOCUMENTED_NOT_EXECUTED` |
| **Вторая машина (Option A)** | `05_REPORTS_AND_MANIFESTS/portability-second-host-instructions.md` |
| **Скрипт** | `tools/verification/verify-portability-baseline.mjs` |

---

## Что доказывает baseline

На одной машине (и при повторе на второй) фиксируются:

- платформа (`os`, `arch`, release);
- версия Node;
- результат `npm run verify:foundation` в дочернем процессе;
- метка времени и `pass: true/false`.

Это **не** заменяет GitHub Actions и **не** подтверждает переносимость platform-native зависимостей вне Foundation workspace.

---

## Предусловия (перед запуском)

1. **Node.js** — LTS (18+ или 20+). На второй машине желательно ту же major/minor, что в первом отчёте (`nodeVersion` в JSON).
2. **Установка зависимостей**
   - если есть `package-lock.json` в корне workspace → `npm ci`;
   - сейчас lock-файла нет: workspace verification-only, без npm-зависимостей в `package.json`.
3. **Пути (при необходимости)**
   - `GENESIS_ROOT` — корень репозитория Genesis, если не дефолт;
   - `SOURCE_TARGET_ROOT` — каталог MBG source target (см. `tools/verification/GENESIS_PATHS.md`).
4. Клон должен содержать `02_SOURCE_TARGETS/...` (или задан `SOURCE_TARGET_ROOT`), иначе `verify:foundation` упадёт на build/scan.

---

## Запуск на этой машине

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run verify:portability-baseline
```

Ожидание: exit code `0`, в `reports/portability-baseline.json` поле `"pass": true`, если `verify:foundation` проходит.

---

## Повтор на второй машине

1. Склонировать тот же коммит/ветку Genesis (или синхронизировать `01_C_UNIT_TEST_HELPER` + `02_SOURCE_TARGETS`).
2. Установить Node той же линейки, что в эталонном отчёте.
3. При появлении `package-lock.json` — выполнить `npm ci` в каталоге workspace.
4. При другом расположении репо задать переменные окружения из раздела «Предусловия».
5. Запустить `npm run verify:portability-baseline`.
6. Сравнить новый `reports/portability-baseline.json` с первым:
   - `pass` оба `true` → baseline воспроизведён на уровне B6 v1;
   - расхождение `pass` или платформы → зафиксировать в audit/blocker matrix, **не** объявлять ARCH_GREEN.

---

## Интерпретация JSON

| Поле | Смысл |
|------|--------|
| `tier` | Всегда `BASELINE_V1` |
| `archGreen` | Всегда `false` |
| `fullCi` | Всегда `false` |
| `foundation.pass` | Итог `verify:foundation` |
| `prerequisites` | Задокументированные шаги install/Node/env |

---

## Ограничения (явно)

- Скрипт **не** запускает `npm ci` автоматически — только документирует требование.
- Скрипт **не** поднимает серверы и **не** гоняет phase3 slices — только foundation aggregate.
- Для Audit3 board: B6 закрывается на **BASELINE_V1** при наличии machine JSON + опциональном втором прогоне; полный CI portability — отдельная задача.
