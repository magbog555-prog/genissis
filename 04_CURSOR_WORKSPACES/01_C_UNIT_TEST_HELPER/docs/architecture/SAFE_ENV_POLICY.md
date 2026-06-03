# SAFE_ENV_POLICY.md

## Genesis Foundation — Safe environment policy (MBG source target)

| Field | Value |
|-------|--------|
| **Version** | 1.0 INITIAL |
| **Date** | 2026-05-31 |
| **Scope config** | `tools/verification/foundation-scope.config.json` |
| **Evidence** | `reports/env-inventory.json` (Stage 6) |

---

## 1. Purpose

Define which environment variables may appear in **SAFE** zones of MBG Observable Core, and how secrets are reported.

**Operator mantra:** NO PROOF → NO ALLOW  
**Reporting mantra:** NO SECRET VALUES IN REPORTS → only `[REDACTED]`

---

## 2. Forbidden in SAFE (RED if found)

If any of these names appear in a **SAFE-classified file** or **SAFE `.env` surface**:

```text
BINANCE_API_KEY
BINANCE_SECRET_KEY
BINANCE_SECRET
BINANCE_API_SECRET
EXCHANGE_API_KEY
EXCHANGE_SECRET
TESTNET_KEY
LIVE_KEY
API_SECRET
PRIVATE_KEY
ORDER_ENDPOINT
TRADING_ENDPOINT
EXECUTION_MODE
```

**Scanner rule:** `SAFE_FORBIDDEN_ENV` → status **RED**.

---

## 3. Allowed in SAFE (RC4-D readonly operator path)

Observed **clean** references (Stage 6 scan, no RED):

| Variable | Role |
|----------|------|
| `CORE_READONLY_API_PORT` | Readonly API bind port |
| `CORE_READONLY_API_HOST` | Readonly API bind host |
| `PORT` | Fallback port |
| `CORE_RUNTIME_SOURCE` | Runtime read-model source mode |
| `LIVE_STREAM_*` | Public market stream config (no API keys in shipped `.env.example`) |

**Note:** `LIVE_STREAM_URL` points to **public** Binance WS — not exchange proof, not execution permission.

---

## 4. Expected in UNSAFE (FINDING, not RED)

Forbidden env names in **UNSAFE** zones are **documented findings**:

- `BINANCE_API_KEY`, `BINANCE_API_SECRET` in `application/exchange/**`
- `EXECUTION_MODE` in `runtime-api/**`

This is expected lab/testnet capability; must not leak into SAFE artifact builds.

---

## 5. Secret redaction

| Context | Report output |
|---------|---------------|
| Forbidden env name | Name visible, value `[REDACTED]` |
| Name contains SECRET/KEY/TOKEN/PRIVATE | Value `[REDACTED]` |
| Code `process.env.*` reference | Value `[REDACTED]` |
| Shipped `.env` with real secrets | Must not exist in source target archive |

---

## 6. Operator machine env

Local operator `.env` (not in repo) may contain testnet keys for lab use.

**Policy:**

- Keys never committed to SAFE zones.
- Keys never printed in Foundation reports.
- RC4-D acceptance path does not require keys in `readonly-api` startup.

---

## 7. Gate

```text
foundation env gate PASS  ⇔  redInSafeCount === 0
```

Stage 6 result: **PASS** (0 RED in SAFE).

---

*End of SAFE_ENV_POLICY.md*
