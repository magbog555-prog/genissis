# Mission Control L3 Lab Panel Report

## 1. Goal

Owner gets a single `Mission Control` screen in `lab/genesis-lab-panel` with dense read-only visibility of the decision organism.
Execution remains blocked: `executionAllowed=false`, `notaryGreenClaimed=false`, `liveIngestion=false`.

## 2. Launch

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run lab:mission
```

- Base URL: `http://127.0.0.1:5199/lab/genesis-lab-panel/index.html`
- Direct Mission URL: `http://127.0.0.1:5199/lab/genesis-lab-panel/index.html?view=mission-control`
- L2 URL: `http://127.0.0.1:5199/lab/genesis-lab-panel/index.html?view=l2`

## 3. Mission Control Blocks

1. `System Health`
   - Operator tier, notary status, and policy flags.
   - Shows `executionAllowed`, `liveIngestion`, `notaryGreenClaimed`.

2. `Agent Flow Board (01..05)`
   - AG01..AG05 statuses: `queued`, `in-progress`, `done`.
   - Derived from existing reports (`mbg-wire`, slices 3..6).

3. `Decision Pipeline live summary`
   - `Obs -> Perception -> Selector -> Scenario -> Admission -> Card -> Paper -> History`.
   - Displays current IDs and pass-aware status coloring from reports + fixtures.

4. `ProfitOps panel`
   - Paper-only metrics: `winrate`, `expectancy`, `pnl`, `drawdown`.
   - Computed from slice 8/9 reports and trade-history fixture values.

5. `Money Flow panel`
   - Simulated flow: successful paper trades -> paper PnL ledger -> virtual wallet.
   - Includes wallet start/delta/end values; no real wallet integration.

6. `Risk Guardrails panel`
   - Execution surface state, read-only flag, notary green gate, risk budget, mode.
   - Confirms guardrails are enforced and execution stays closed.

## 4. Data Sources

- `/data/board.json`
- `reports/mbg-wire-market-observation.json`
- `reports/perception-offline-slice3.json`
- `reports/selector-offline-slice4.json`
- `reports/scenario-offline-slice5.json`
- `reports/admission-offline-slice6.json`
- `reports/trade-card-offline-slice7.json`
- `reports/paper-execution-offline-slice8.json`
- `reports/trade-history-offline-slice9.json`
- `reports/visibility-runtime-alignment-slice10.json`
- `reports/owner-operating-views-slice11.json`
- `tests/fixtures/phase3/*` (read-only snapshots for IDs and paper metrics)

## 5. i18n

- RU/EN keys expanded in:
  - `lab/genesis-lab-panel/i18n/ru.json`
  - `lab/genesis-lab-panel/i18n/en.json`
- View selector and all Mission Control blocks are localized.

## 6. Constraints

- No live trading unlock.
- No real execution wiring.
- No fake green path.
- `executionAllowed` must stay `false` (preserved).
