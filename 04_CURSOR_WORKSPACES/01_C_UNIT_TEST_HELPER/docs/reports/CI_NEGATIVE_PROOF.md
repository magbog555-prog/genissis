# CI NEGATIVE PROOF — Sprint 2 (Complete)

| Field | Value |
|-------|--------|
| **Deliverable** | O-04 (D-10) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Status** | **COMPLETE** |

---

## 0. What is wired

| Component | Path | Role |
|-----------|------|------|
| Workspace `package.json` | `01_C_UNIT_TEST_HELPER/package.json` | `verify:foundation`, `verify:negatives` |
| Aggregate runner | `tools/verification/verify-foundation.mjs` | 8 sequential gates, no servers |
| Negative verifier | `tools/verification/verify-negatives.mjs` | Fixture parity + injection proof |
| Machine proof JSON | `reports/ci-negative-proof.json` | PASS record |
| Sprint 1 scanners | `scan-routes.mjs`, `scan-imports.mjs`, `scan-env.mjs` | Static repo scans |
| Safe build + scan | `build-safe-artifact.mjs`, `scan-safe-bundle.mjs` | Physical artifact proof |
| Entrypoint gate | `entrypoint-check.mjs` | D-03 policy |
| Negative fixtures | `tests/negative/*.fixture.json` | Wired in `verify:negatives` |

---

## 1. Proof executed

### 1.1 Fixture parity (13 cases)

All route / import / env fixture expectations **PASS** against scanner reports or synthetic classifier parity.

Source: `reports/ci-negative-proof.json` → `fixtureParity.pass: true`

### 1.2 Intentional bundle injection → scan FAIL

| Step | Result |
|------|--------|
| Copy `dist/genesis-safe-readonly` to temp dir | OK |
| Inject `core/core/__ci_injection_probe.ts` with forbidden import | OK |
| Run `scan-safe-bundle.mjs --bundle-root <temp> --no-write-report` | **exit 1** |
| `redCount` | **3** |
| Temp dir removed | OK |

Injected import: `../../application/exchange/src/binance-spot-testnet.js`

**Interpretation:** CI gate **detects** execution-path leakage into safe bundle.

---

## 2. Aggregate behavior

```powershell
cd D:\genessis\04_CURSOR_WORKSPACES\01_C_UNIT_TEST_HELPER
npm run verify:foundation
```

**Steps (8):** entrypoint → routes → imports → env → closure → build → bundle scan → **verify:negatives**

**Exit 0 when:** all steps pass including injection proof on clean bundle.

**STRICT tier:**

```powershell
npm run verify:foundation:strict
```

Build + scan use `--strict`; negatives step unchanged (injection proof is tier-agnostic).

---

## 3. Proof run log (2026-06-01)

```text
[verify:foundation] verify:negatives: PASS
injectionProof.scanExitCode: 1
injectionProof.redCount: 3
injectionProof.scanPass: false
ci-negative-proof.pass: true
```

---

## 4. Honest limits

- Notary GREEN **not** claimed.
- No GitHub Actions YAML in Foundation workspace (Owner Platform may wire `npm run verify:foundation`).
- MBG `dev` entrypoint rename still **YELLOW** — await Owner GO.
- Injection proof uses **temp copy** — does not mutate production bundle on disk.

---

```text
CI WIRING:        COMPLETE
INJECTION PROOF:  COMPLETE (redCount 3 on probe)
FIXTURE PARITY:   COMPLETE (13/13)
NOTARY GREEN:     NO
```

---

*Does not modify Sprint 1 reports.*
