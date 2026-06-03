# B6 — GitHub Actions CI (пошагово)

**Цель:** `portability-baseline-ci-run.json` с `runMode: GITHUB_ACTIONS` и реальным `githubActionsUrl`.

**Текущий блокер:** `D:\genessis` не был git-репозиторием — без push workflow не запустится в облаке.

---

## Шаг 1 — Git в Genesis (один раз)

```powershell
cd D:\genessis
git init
git add .gitignore .github/workflows/genesis-foundation-verify.yml
git add 04_CURSOR_WORKSPACES/01_C_UNIT_TEST_HELPER
git add 05_REPORTS_AND_MANIFESTS/B6_GITHUB_CI_SETUP_RU.md
# при необходимости: git add 02_SOURCE_TARGETS ... (см. .gitignore)
git commit -m "B6: add genesis-foundation-verify workflow and foundation verify"
```

Или полный первый коммит (если готовы выложить весь проект):

```powershell
git add -A
git status
git commit -m "Genesis foundation workspace + B6 CI workflow"
```

---

## Шаг 2 — Репозиторий на GitHub

1. GitHub → **New repository** (private рекомендуется).
2. Без README/license (уже есть локально).

```powershell
git remote add origin https://github.com/<ORG>/<REPO>.git
git branch -M main
git push -u origin main
```

---

## Шаг 3 — Запуск workflow

1. GitHub → **Actions** → `genesis-foundation-verify`.
2. **Run workflow** (workflow_dispatch) или дождаться push на `main`.
3. Дождаться зелёного job `foundation-verify`.

---

## Шаг 4 — Proof на диске

**Вариант A — артефакт CI**

1. Открыть успешный run → **Artifacts** → `portability-baseline-ci-run`.
2. Скопировать JSON в:
   `04_CURSOR_WORKSPACES/01_C_UNIT_TEST_HELPER/reports/portability-baseline-ci-run.json`

**Вариант B — URL вручную**

Скопировать URL run (вид `.../actions/runs/12345678`):

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run attach:github-actions-run -- --url "https://github.com/<ORG>/<REPO>/actions/runs/<ID>"
```

---

## Шаг 5 — Проверка gate

```powershell
npm run verify:b6-portability-closure
```

Ожидание: `pass: true`, `tier: CI_GITHUB_ACTIONS_EXECUTED`.

---

## Альтернатива без GitHub

Second host: `portability-second-host-instructions.md` → `05_REPORTS_AND_MANIFESTS/portability-second-host-result.json`

```powershell
npm run verify:b6-portability-closure
```

---

## Политика

```text
NOTARY GREEN = NO
ARCH_GREEN = BLOCKED until B6 gate pass + Owner audit request
```

Локальный `LOCAL_CI_SIMULATION` **не** закрывает auditor bundle gate — только подготовка.
