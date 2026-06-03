# ENV_SCANNER_STAGE6_REPORT.md

## Stage 6 — Env / Secrets Scanner (env only)

| Field | Value |
|-------|--------|
| **Stage** | 6 — Env Scanner |
| **Date** | 2026-05-31 |
| **Scope config** | `foundation-scope.config.json` v1.0 (unchanged per owner directive) |
| **Source target** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **MBG modified** | No |
| **Route / Import scanners** | Not re-run |

---

## 1. Deliverables

| Artifact | Path |
|----------|------|
| Env scanner | `tools/verification/scan-env.mjs` |
| JSON report | `reports/env-inventory.json` |
| Markdown report | `reports/env-inventory.md` |
| Safe env policy | `docs/architecture/SAFE_ENV_POLICY.md` |
| Negative fixture | `tests/negative/exchange-secret.fixture.json` |

**Run command:**

```bash
node tools/verification/scan-env.mjs
```

**Gate:** exit `0` when `redInSafeCount === 0`. Current run: **PASS**.

---

## 2. Executive verdict

```text
RED in SAFE:           0   ← foundation gate PASS
FINDING (UNSAFE):      3   ← expected testnet/execution env refs
Forbidden in SAFE:     0
Secret values printed: 0   ← all [REDACTED]
```

**Answer:** SAFE operator contour does **not** reference `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `EXCHANGE_SECRET`, `EXECUTION_MODE`, `ORDER_ENDPOINT`, or other forbidden execution secrets in shipped SAFE files or `.env.example` for readonly path.

---

## 3. Summary (machine)

| Metric | Value |
|--------|-------|
| Files scanned | 149 |
| Env references / assignments | 130 |
| Violations | 3 |
| RED in SAFE | **0** |
| FINDING | 3 |
| YELLOW | 0 |
| OK | 127 |

---

## 4. FINDING — expected UNSAFE references

| Env name | File | Scope |
|----------|------|-------|
| `BINANCE_API_KEY` | `core/application/exchange/src/binance-spot-testnet.ts:76` | UNSAFE |
| `BINANCE_API_SECRET` | `core/application/exchange/src/binance-spot-testnet.ts:77` | UNSAFE |
| `EXECUTION_MODE` | `core/apps/runtime-api/src/app.ts:712` | UNSAFE |

All reported values: **`[REDACTED]`** (names only shown).

Per constitution: **FINDING in UNSAFE**, not foundation failure.

---

## 5. SAFE surface (readonly + kernel env refs)

### 5.1 Shipped `.env.example` (no forbidden keys)

| File | Forbidden keys? |
|------|-----------------|
| `.env.example` (root) | No — only `LIVE_STREAM_*` public config |
| `core/.env.example` | No — `CORE_READONLY_API_*` + `LIVE_STREAM_*` |
| `frontend/.env.example` | No — `VITE_CORE_API_BASE_URL` only |

No `BINANCE_API_KEY` / `BINANCE_SECRET` in example files.

### 5.2 SAFE code references (non-forbidden)

| File | Variables |
|------|-----------|
| `apps/readonly-api/src/server.ts` | `CORE_READONLY_API_PORT`, `CORE_READONLY_API_HOST`, `PORT` |
| `ui-api/connected-readonly-core-api.ts` | `CORE_RUNTIME_SOURCE` |
| `events/validate-domain-event.ts` | `MBG_EVENT_FUTURE_TOLERANCE_MS` |

No forbidden env token in SAFE scope.

---

## 6. Three-stage proof (Routes + Imports + Env)

| Check | Stage | SAFE result |
|-------|-------|-------------|
| POST /order in safe | 4 Routes | 0 RED |
| Import binance/exchange in safe | 5 Imports | 0 RED |
| BINANCE_* / EXECUTION_MODE in safe | 6 Env | 0 RED |

**Combined:** Operator readonly surface is clean on all three static dimensions scanned so far.

**Remaining yellow (Stage 5):** SAFE → DONOR import coupling (19) — for nVision / Notary, not env.

---

## 7. Redaction compliance

Scanner and reports enforce:

- Forbidden env → value `[REDACTED]`
- `process.env` code hits → value `[REDACTED]`
- Names containing KEY/SECRET/TOKEN → value `[REDACTED]`

No real secret values from source target were written to Foundation artifacts.

---

## 8. Limitations

1. Operator-local `.env` (gitignored) not visible — scan is repository-only.
2. Runtime-injected env not observed without executing code.
3. `BINANCE_API_SECRET` matched via `API_SECRET` / `BINANCE_SECRET` token rules.
4. `core/core/state/**` scope unchanged (owner: fix in later scope revision).

---

## 9. Gate for Stage 7

| Criterion | Status |
|-----------|--------|
| `env-inventory.json` + `.md` | YES |
| `SAFE_ENV_POLICY.md` | YES |
| `redInSafeCount === 0` | YES |
| No secret values in output | YES |
| MBG unchanged | YES |
| Scope config unchanged | YES |

**Next:** Stage 7 — SAFE/UNSAFE Matrix Review (`SAFE_UNSAFE_SPLIT_INITIAL.md` synthesis).

---

*End of ENV_SCANNER_STAGE6_REPORT.md*
