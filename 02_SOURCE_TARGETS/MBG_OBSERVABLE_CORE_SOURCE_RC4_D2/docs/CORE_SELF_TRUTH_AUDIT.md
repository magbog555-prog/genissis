# Core Self-Truth Audit — RC3.5

RC3.5 checks the honesty of the Core without external market sensors.

The goal is to prove that the Core does not invent market truth, does not allow action without proof, and does not mask `unknown` as `trusted`.

## Rule

```text
NO PROOF → NO ALLOW
```

In RC3.5:

- no Binance
- no market ingest
- no API keys
- no execution
- no trading buttons
- no POST order/execution endpoints

## Invariants

- Missing market input blocks action.
- Missing exchange truth blocks action.
- Runtime unavailable blocks action.
- Runtime stub is never reported as runtime-engine.
- Missing kernelAuthority blocks action.
- Missing ActionGate blocks action.
- Missing/unknown permissionLedger blocks action.
- Malformed/null/empty RuntimeSnapshot input becomes UNCERTAIN/prohibited.
- Raw `allowed` never passes without proof.
- Read-only mode cannot expose execution surface.

## Audit endpoint

```text
GET /api/core/self-truth/audit
```

This endpoint is read-only and reports the invariant status.

Dangerous POSTs must remain closed:

```text
POST /order
POST /market/tick
POST /trade/place
POST /execution/*
POST /api/core/runtime/snapshot
POST /api/core/self-truth/audit
```


## Clean Self-Truth Mode — HOTFIX1

The self-truth audit endpoint must not reuse recovered runtime persistence state.

Reason:

```text
[persistence] recovered ...
```

may contain historical `exchangeTruth.status = present`, which is valid for ordinary runtime recovery but invalid for a clean self-truth audit.

Therefore:

```text
GET /api/core/self-truth/audit
```

uses an isolated in-memory clean audit snapshot.

The audit snapshot intentionally has:

```text
runtimeSource = runtime-stub
marketInput = absent
exchangeTruth = absent
trust = UNCERTAIN
verdict = prohibited
persistence = ignored-for-audit
```

This proves the core invariant independently of restored runtime state:

```text
NO PROOF → NO ALLOW
```


## HOTFIX2 UI-Safe RuntimeSnapshot

`RuntimeSnapshot.raw` must not be exposed to the frontend.

Reason:

```text
raw runtime objects can contain circular references
```

UI-facing DTOs use:

```json
{
  "rawSummary": {
    "present": true,
    "omittedForUiSafety": true,
    "reason": "circular_or_large_runtime_object"
  }
}
```

Frontend rendering uses `safeStringify`, so any circular object is displayed as `[Circular]` instead of crashing the UI.
