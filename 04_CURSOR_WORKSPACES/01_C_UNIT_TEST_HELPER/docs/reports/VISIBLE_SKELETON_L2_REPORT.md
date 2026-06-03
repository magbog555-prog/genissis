# Visible Skeleton L2 Lab Panel Report

| Field | Value |
|-------|--------|
| **Task ID** | AG01-VISIBLE-SKELETON-L2 |
| **Owner GO** | `42_OWNER_GO_WIRE_AND_L2_HYBRID_UI_RU.md` § GO-L2 |
| **Date** | 2026-06-01 |
| **Status** | **DELIVERED** |

---

## 1. Цель

Read-only **Genesis Lab Panel** в браузере — владелец видит рост организма без «только JSON». **Не** замена MBG frontend.

---

## 2. Запуск

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run lab:panel
```

**URL:** `http://127.0.0.1:5199/lab/genesis-lab-panel/index.html`  
(корень `/` редиректит на panel)

Порт: `GENESIS_LAB_PANEL_PORT` (default **5199**)

---

## 3. Секции panel

| # | Секция | Источник данных |
|---|--------|-----------------|
| 1 | Core / Wire | `reports/mbg-wire-market-observation.json` |
| 2 | Offline chain (ETH) | perception / selector / scenario fixtures |
| 3 | Trust | `genesis-system-status-board.json` |
| 4 | Layers table | board JSON |
| 5 | Links | MBG UI :5173, core :3011, verify commands |

---

## 4. i18n

- `lab/genesis-lab-panel/i18n/ru.json`
- `lab/genesis-lab-panel/i18n/en.json`
- Toggle **RU / EN** (localStorage)

Banner: **Notary YELLOW — not GREEN** (без fake green branding).

---

## 5. Гибрид UI (Owner law)

| Слой | Решение |
|------|---------|
| MBG donor UI | Остаётся для operator UX (`START_APP.cmd` → :5173) |
| Genesis Lab L2 | Visibility / organism growth |
| Decision engine | Genesis contracts + wire (не UI) |

---

## 6. Forbidden (соблюдено)

- Buy/Sell — **нет**
- `canExecute` — **нет**
- Notary GREEN branding — **нет**
- Замена MBG frontend repo — **нет**

---

*End of VISIBLE_SKELETON_L2_REPORT.md*
