# B6 — почему CI красный и как исправить (2-й push)

## Что случилось

На GitHub Actions run **#1** — статус **Failure** (красный).

Причина: в первый push **не попала** папка:

```text
02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2
```

Без неё `verify:foundation` падает с ошибкой:

```text
SOURCE_TARGET_ROOT not found
```

Локально у вас на диске папка есть — поэтому на ПК всё PASS, а на GitHub — FAIL.

**Важно:** ссылку на **красный** run нельзя считать закрытием B6. Нужен **зелёный** run.

---

## Шаг 1 — добавить MBG в git (PowerShell)

```powershell
cd D:\genessis
git add 02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2
git status
```

Должны появиться файлы (без `node_modules` — они в `.gitignore`).

```powershell
git commit -m "B6: add MBG source target for CI verify:foundation"
git push origin main
```

---

## Шаг 2 — дождаться зелёного run

1. https://github.com/magbog555-prog/genissis/actions  
2. Новый run после push — **зелёная галочка**  
3. Скопировать ссылку вида `.../actions/runs/НОВЫЙ_ID`

---

## Шаг 3 — прикрепить только зелёный run

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run attach:github-actions-run -- --url "ССЫЛКА_НА_ЗЕЛЁНЫЙ_RUN" --conclusion success
npm run verify:b6-portability-closure
```

Ожидание: `"ok": true`.

---

## Если снова красный

На странице run кликните job **foundation-verify** → шаг с красным X → скопируйте последние строки лога сюда.
