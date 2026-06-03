# SEMANTIC HARDENING REPORT — RC3.5

## Status
Candidate build for operator clarity polish.

## Исправления
- `exchangeTruth: known` больше не используется как операторское подтверждение.
- Добавлен `exchangeTruth.status` и `exchangeTruth.proof`.
- Разделены `mock`, `providerFormat`, `sourceMode`, `liveExchangeConnected`.
- Разделены локальная provenance-цепочка и доказательство биржи.
- Свежесть market data отделена от exchange truth.
- Разделены system recovery и trust recovery/operator hints.
- Hash помечен как demo/non-cryptographic там, где нет crypto-proof.
- Counters/revisions подписаны в semantic DTO.
- Snapshot blocking reasons расширены списками before/after.
- Failure Matrix переименована в операторские поля.
- Frontend сохраняет safeStringify, rawSummary и circular guard.
- Добавлен верхний блок `Правда для оператора`.

## Safety
- Execution не подключён.
- Binance private API не подключён.
- API keys не нужны.
- POST execution/order endpoints закрыты.


## DTO Contract Hotfix — Recovery / Failure Matrix

- RecoveryHintDTO raw contract now includes `systemRecoveryRequired`, `trustRecoverySuggested`, `trustRecoveryReason`, `autoRecoveryEnabled`, and machine-safe recovery hints.
- Ambiguous `hints: ["no recovery required"]` is forbidden for RC3.5 semantic hardening.
- FailureVisualizationDTO raw contract now uses `renderGuardTriggered`, `renderFallbackActive`, `adapterMode`, `dataMode`, `finalSafetyState`, and `executionSurface`.
- `verify:semantic-hardening` now fails if RecoveryHintDTO or FailureVisualizationDTO falls back to the old ambiguous contract.


## FailureMatrixDTO Raw Contract Hotfix

- FailureVisualizationDTO raw contract now uses `blocks` inside the DTO instead of exposing a bare `[{ block, state }]` array.
- Required raw fields: `renderGuardTriggered`, `renderFallbackActive`, `adapterMode`, `dataMode`, `finalSafetyState`, `executionSurface`, `severity`, and `blocks`.
- `verify:semantic-hardening` now fails if a FailureVisualizationDTO is missing `blocks` or uses ambiguous `matrix`/bare array form.
- Russian UI labels fixed: `Защита рендера сработала: нет`, `Fallback-режим активен: нет`.

## FailureMatrixDTO Final Raw Renderer Hotfix

- Failure Matrix raw JSON renderer now receives and renders the full `FailureMatrixDTO` object, not `FailureMatrixDTO.blocks`.
- Required raw fields are enforced at live endpoint verification: `dto`, `scenario`, `renderGuardTriggered`, `renderFallbackActive`, `adapterMode`, `dataMode`, `finalSafetyState`, `executionSurface`, `severity`, and `blocks`.
- `verify:semantic-hardening` now fails if the raw Failure Matrix DTO is a bare array.
