# Delivery Report — Wave 9 / Role 5 — Market Input Integrity in CausalityTrace

## Base

`mbg-core-v0.1-alpha7.zip`

## Scope

Role 5 — Causality / Trace.

The change extends `CausalityTrace` so market input integrity is visible in the trace without making trace a source of truth.

## Changed files

- `core/trace/causality-trace.ts`
- `tests/scenarios/wave9-market-input-causality.ts`
- `package.json`
- `DELIVERY_REPORT_WAVE9_MARKET_INPUT_CAUSALITY.md`

## Trace model changes

`CausalityTrace` now exposes:

- `marketInputObservation`
- `validationResult`
- `sequenceStatus`
- `gapStatus`
- `duplicateStatus`
- `freshnessStatus`
- `provenanceRef`
- `payloadHash`
- `checksumStatus`
- `marketInputIntegritySummary`

## Added tests

- `tests/scenarios/wave9-market-input-causality.ts`

Script:

```bash
npm run test:wave9:market-input-causality
```

Covered scenarios:

1. valid market input visible in trace;
2. rejected input visible in trace;
3. gap visible in trace;
4. duplicate visible in trace;
5. stale visible in trace;
6. missing provenance visible as gap/issue, not corruption;
7. trace remains deterministic;
8. trace does not mutate state.

## Commands run

```bash
npm run typecheck
npm test
npm run test:wave9:market-input-causality
```

Results:

```text
npm run typecheck — PASS
npm test — PASS
npm run test:wave9:market-input-causality — PASS
```

## Example trace JSON

```json
{
  "traceId": "trace:db5fbdf43a656f9515c83375",
  "eventId": "wave9-market-valid-1",
  "marketInputObservation": {
    "eventId": "wave9-market-valid-1",
    "eventType": "market.tick.received",
    "source": "market-sim",
    "symbol": "BTCUSDT",
    "provider": "market-sim",
    "timestamp": "2026-01-01T00:00:01.000Z",
    "price": 101,
    "bid": 100,
    "ask": 102,
    "volume": 3,
    "sequence": 10
  },
  "validationResult": {
    "status": "passed",
    "issues": []
  },
  "sequenceStatus": "ordered",
  "gapStatus": "none",
  "duplicateStatus": "none",
  "freshnessStatus": "fresh",
  "provenanceRef": "market-observation:sim:1",
  "payloadHash": "sha256:test-payload",
  "checksumStatus": "valid",
  "marketInputIntegritySummary": {
    "applicable": true,
    "status": "valid",
    "summary": "market input market.tick.received valid; validation=passed; sequence=ordered; gap=none; duplicate=none; freshness=fresh; checksum=valid; provenance=present; snapshotMutated=true",
    "issues": [],
    "snapshotMutated": true,
    "trustChanged": false,
    "verdictAffected": true
  }
}
```

## Observability note

A human reading the Observable Core Machine can now see, inside the causality trace:

`market observation → validation → sequence/gap/duplicate/freshness/checksum → provenance → snapshot change → trust/verdict effect`.

Missing provenance is represented as an observable issue/gap, not as corruption.

## Semantic notes

- Trace remains read-only.
- Trace does not mutate snapshot.
- Trace does not write events.
- Trace does not compute trust independently.
- Trace does not create a second market input store.
- Unknown/missing market input is not treated as corruption.
- Existing provenance fields from Wave 8 remain intact.

## Known limitations

- This role does not implement market input reducers or event contracts.
- This role does not implement sequence/gap detection authority; it displays supplied integrity facts or derives conservative trace-level summaries.
- This role does not change ActionGate.
- This role does not connect V1/V2, websocket, exchange API, UI, execution, or live trading.
