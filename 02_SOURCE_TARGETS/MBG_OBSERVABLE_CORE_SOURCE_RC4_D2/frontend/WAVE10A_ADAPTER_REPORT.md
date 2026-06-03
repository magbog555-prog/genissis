# Observable Core Machine v0.7.7 — Wave 10A Mock Adapter Integration

## Цель

Wave 10A добавляет mock-adapter layer без переписывания workspace.

Принцип:

```text
mock scenario -> canonical ComputationTrace DTO -> UI blocks
```

UI не считает trust, permission, gate verdict или tradingAllowed. Все значения приходят из canonical DTO, который сейчас имитируется adapter layer.

## Что добавлено

- `src/adapters/mockAdapter.js`
  - scenario switching
  - canonical DTO builder
  - deterministic scenario output
  - provenance indicators
  - market integrity indicators
  - replay/revision indicators

## Поддержанные сценарии

- `BASE_UNCERTAIN_DENY`
- `HEALTHY_TRUSTED_READY`
- `MARKET_INPUT_STALE_DENY`
- `GAP_DETECTED`
- `RECOVERY_ONLY`

## Проверка

```bash
npm install
npm run dev
npm run build
```

`npm run build` проверен: проходит.

## Что не трогали

- workspace windows
- workspace tabs
- named layouts
- floating window architecture
- focus/click-to-front
- compact mode
- theme/font/color settings
- block visibility composer

## Read-only safety

В этой версии нет Core mutation:

- no POST/PUT/PATCH/DELETE Core calls
- no buy/sell controls
- no execution controls
- no trust calculation
- no permission calculation
- no gate calculation
- no websocket authority

## Следующий шаг

Заменить `buildCanonicalTrace(baseTrace, scenarioId)` на real API adapter:

```text
Core API response -> canonical ComputationTrace DTO -> same UI blocks
```
