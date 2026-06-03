# SAFE_UNSAFE_SPLIT_INITIAL.md

## Genesis Foundation — Integrated SAFE / UNSAFE / DONOR / UNKNOWN Matrix

| Field | Value |
|-------|--------|
| **Stage** | 7 — SAFE/UNSAFE Matrix Review |
| **Author** | Genesis Foundation Lead Engineer (C Unit Test Helper) |
| **Date** | 2026-05-31 |
| **Source target** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **Scope config** | `tools/verification/foundation-scope.config.json` v1.0 INITIAL |
| **Method** | Synthesis of Stages 2–6 (no new scans, no MBG changes, no Notary) |

---

## 0. Purpose

This document is the **single integrated conclusion** of Foundation Lead's first technical pass. It merges:

| Stage | Artifact |
|-------|----------|
| 2 | `REPO_INVENTORY_INITIAL.md` — architectural inventory |
| 3 | `FOUNDATION_SCOPE_CONFIG_INITIAL.md` + `foundation-scope.config.json` |
| 4 | `route-inventory.json` — Route Scanner |
| 5 | `import-boundary-report.json` — Import Scanner |
| 6 | `env-inventory.json` + `SAFE_ENV_POLICY.md` — Env Scanner |

It answers: **what is proven, what is not, what blocks GREEN, and what other roles may consume next.**

---

## 1. Executive conclusion

MBG Observable Core RC4-D2 is a **dual-surface organism**:

- **SAFE operator surface** (readonly-api + connected-readonly-core-api + trust kernel organs) — **statically clean** on routes, direct UNSAFE imports, and forbidden env in SAFE.
- **UNSAFE lab surface** (runtime-api + exchange adapters + execution service) — **expected** execution capability; findings are **FINDING**, not foundation failure.

**Foundation technical gate (Stages 4–6 combined):**

```text
RED in SAFE (routes):    0
RED in SAFE (imports):   0
RED in SAFE (env):       0
─────────────────────────────
Combined RED in SAFE:    0   → static safe-surface gate PASS
```

**Overall attestation status:** **NOT GREEN** — YELLOW zones, UNSAFE findings, and unproven runtime boundaries remain. This document is **Foundation evidence**, not Notary GREEN.

---

## 2. What MBG is (organ-level, from Stage 2)

| Organ | Role | Scope class |
|-------|------|-------------|
| Trust kernel | kernel, gates, invariants, integrity, permissions, recovery, quarantine | **SAFE** |
| Readonly nervous system | readonly-api, connected-readonly-core-api | **SAFE** |
| Contracts / observable | contracts, observable, runtime-read-model | **SAFE** |
| Shared circulation | runtime-engine, journal, reducers, persistence | **DONOR** |
| Market sensors | live-stream, market-input | **DONOR** |
| Lab limbs | runtime-api, application/exchange, application/market, engine/execution | **UNSAFE** |
| Operator periphery | frontend, launcher, tests/scenarios | **DONOR** |

MBG ≠ Genesis. MBG = **honesty kernel candidate** + RC4-D observe-only packaging.

---

## 3. Territory map (Stage 3 constitution)

### 3.1 SAFE — ядро честности + readonly truth surface

```text
kernel · gates · invariants · integrity · permissions · recovery · quarantine
events · contracts · observable · runtime-read-model
apps/readonly-api · connected-readonly-core-api
governance docs · verify scripts
```

**Law:** SAFE violation = **RED**. Whole repository ≠ SAFE.

### 3.2 UNSAFE — execution limbs

```text
apps/runtime-api
application/exchange (binance-spot-testnet)
application/market (binance-live-market)
engine/execution (execution.service)
```

**Law:** UNSAFE violation = **FINDING** (documented, expected in lab).

### 3.3 DONOR — shared / legacy / operator

```text
core/runtime · system · domain · strategy · pnl · trace
live-stream · market-input · mock-scenarios
data · tests · frontend · launcher · patches · delivery reports
```

**Law:** DONOR violation = **DONOR_FINDING**.

### 3.4 UNKNOWN — fallback

```text
unknown_roots: ["**"]  →  YELLOW until classified
UNKNOWN never GREEN
```

**Scope gap (deferred):** `core/core/state/**` not in config v1.0 — imports show as UNKNOWN/YELLOW until next scope revision.

---

## 4. Cross-scanner evidence matrix

| Dimension | SAFE result | UNSAFE result | Gate |
|-----------|-------------|---------------|------|
| **Routes** (Stage 4) | 26 GET, 0 mutating | 97 routes, 17 execution FINDING | PASS |
| **Imports** (Stage 5) | 0 → UNSAFE direct | 5 FINDING (binance/exchange) | PASS |
| **Env** (Stage 6) | 0 forbidden secrets | 3 FINDING (BINANCE_*, EXECUTION_MODE) | PASS |
| **Combined RED in SAFE** | — | — | **0 — PASS** |

### 4.1 What the three scanners **prove** (static, repo-only)

| Claim | Evidence |
|-------|----------|
| Readonly API has **no POST/PUT/PATCH/DELETE** handlers in scanned SAFE files | Stage 4: `safeMutatingCount: 0` |
| SAFE does **not** import `application/exchange`, `application/market`, `engine/execution`, `runtime-api` | Stage 5: `redInSafe: []`, `safeDirectUnsafeOrForbidden: []` |
| SAFE does **not** reference forbidden exchange/execution env names | Stage 6: `redInSafeCount: 0` |
| Execution routes exist only in **UNSAFE** `runtime-api` | Stage 4: 17 FINDING on `/trade/place`, `/order`, `/execution/testnet/*`, etc. |
| Exchange secrets referenced only in **UNSAFE** code | Stage 6: FINDING in `binance-spot-testnet.ts`, `runtime-api` |

### 4.2 What is **not proven**

| Gap | Why it matters |
|-----|----------------|
| Runtime behavior without executing code | Static scan only |
| Transitive import depth > 1 hop | Only 1-hop SAFE→DONOR checked |
| Frontend `fetch` / local trust display | Not route-scanned; UI audit pending |
| Operator-local `.env` with real keys | Not in repo |
| Dynamic `import()` / `require(variable)` | Not detected |
| Build/bundle graph for readonly artifact | Not executed |
| `core/core/state/**` scope classification | Config gap → false UNKNOWN |
| Physical isolation of safe artifact from lab runtime | Architectural — YELLOW coupling |

---

## 5. Status ledger (RED / YELLOW / FINDING / DONOR_FINDING)

### 5.1 RED

```text
Count in SAFE: 0
```

No RED findings across routes, imports, or env in SAFE scope.

**Foundation rule satisfied:** SAFE violation = RED would block; none triggered.

---

### 5.2 YELLOW (blocks GREEN)

| Source | Count | Nature |
|--------|-------|--------|
| Import Scanner — SAFE → DONOR coupling | **19** | Architectural coupling, not direct execution import |
| Scope config — `core/core/state/**` | **~7 edges** | UNKNOWN classification until scope amended |
| Residual UNKNOWN paths | fallback `**` | Any unmapped file defaults YELLOW |

**Key YELLOW edges (operator path):**

| SAFE importer | DONOR dependency |
|---------------|------------------|
| `readonly-api/server.ts` | `live-market-stream` |
| `connected-readonly-core-api.ts` | `runtime-engine`, `live-stream`, `mock-scenarios` |
| `kernel/*`, `integrity/*`, `gates/*`, `recovery/*` | `runtime-engine`, `freshness`, `idempotency` |

**Meaning:** Route and env boundaries are clean; **shared runtime** prevents claiming full safe-artifact isolation.

**UNKNOWN never GREEN** — any YELLOW blocks GREEN attestation.

---

### 5.3 FINDING (UNSAFE — expected, not Sprint-1 failure)

| Scanner | Count | Examples |
|---------|-------|----------|
| Routes | **17** | `POST /trade/place`, `POST /order`, `POST /execution/testnet/place-guarded`, `POST /actions/dispatch` |
| Imports | **5** | `runtime-api` → `binance-spot-testnet`, `binance-live-market` |
| Env | **3** | `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `EXECUTION_MODE` in UNSAFE files |

All located in **UNSAFE** zone per scope config. **Documented lab capability.**

---

### 5.4 DONOR_FINDING

| Scanner | Count | Nature |
|---------|-------|--------|
| Imports | **6** | DONOR-scope files importing forbidden patterns (e.g. donor tests → execution paths) |

Not RED. Recorded for Evidence / architecture review.

---

### 5.5 GREEN (partial — scanner-level only)

| Scanner | SAFE GREEN | Notes |
|---------|------------|-------|
| Routes | 26 GET routes | Readonly surface route-clean |
| Imports | 41 GREEN edges | SAFE → SAFE/EXTERNAL npm |
| Env | 127 OK | No forbidden env in SAFE |

**Scanner GREEN ≠ Notary GREEN.** See §6.

---

## 6. What blocks GREEN

Foundation Lead **cannot** issue GREEN. These items block any future GREEN attestation:

| Blocker | Type | Owner |
|---------|------|-------|
| **19 SAFE → DONOR import couplings** | YELLOW | nVision architecture review |
| **UNKNOWN zones** (incl. `state/**` gap) | YELLOW | Scope config revision + owner |
| **17 UNSAFE execution routes** exist in same repo | FINDING | Isolation backlog; not fixed in Sprint 1 |
| **No runtime/live HTTP attestation** in Foundation pass | Unproven | Notary inputs after live verify |
| **No Evidence Matrix linkage** | Unproven | DO-178B C |
| **No transitive import proof to depth N** | Unproven | Import scanner v2 or manual review |
| **Frontend not scanned** | Unproven | nVision / future UI audit |
| **UNKNOWN never GREEN** policy | Policy | Permanent |

```text
Foundation static gate:     PASS (0 RED in SAFE)
Genesis attestation GREEN:  BLOCKED (YELLOW + unproven items)
```

---

## 7. First isolation priorities

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P1** | Treat `runtime-api` as **never** part of safe artifact entrypoint | `core dev` → runtime-api vs workspace `dev:core` → readonly |
| **P2** | Document readonly build must exclude UNSAFE roots from bundle | Import coupling via shared `runtime-engine` |
| **P3** | Keep exchange adapters physically outside safe deploy unit | FINDING confined to UNSAFE today |
| **P4** | Add `core/core/state/**` to scope config in next revision | Remove false UNKNOWN yellows |
| **P5** | nVision review of 19 SAFE→DONOR edges | Decide accept / isolate / refactor (future sprint) |

---

## 8. Forbidden actions until isolation

Until architecture review and isolation backlog progress:

```text
Do not declare MBG / readonly-api as Notary GREEN.
Do not use core/package.json "dev" as safe operator entry (→ runtime-api).
Do not merge UNSAFE FINDING into SAFE without scope reclassification + review.
Do not treat scanner GREEN as Notary GREEN.
Do not add forbidden env to SAFE zones.
Do not expand SAFE roots without owner approval.
Do not skip UNKNOWN → classification before production safe artifact.
```

---

## 9. Handoff package for other roles

### 9.1 Code Cloaker (Notary) — **wait, read-only inputs ready**

**May consume (source evidence, read-only):**

| Artifact | Use |
|----------|-----|
| `reports/route-inventory.json` | Route attestation input |
| `reports/import-boundary-report.json` | Import boundary evidence |
| `reports/env-inventory.json` | Secret/env evidence (values redacted) |
| `docs/architecture/SAFE_ENV_POLICY.md` | Env policy reference |
| This document | Integrated matrix |

**Not ready for Notary GREEN:** YELLOW couplings, no live verify, no evidenceRefs.

**Notary should expect:** CoreTrustAttestation **YELLOW or review required**, not GREEN, until owner + Evidence + nVision complete.

---

### 9.2 DO-178B C (Evidence)

**May consume:**

| Artifact | Traceability seed |
|----------|-------------------|
| All `reports/*.json` | Machine-readable evidence |
| `tests/negative/*.fixture.json` | Negative test expectations |
| Stage 4–6 reports | Risk → check mapping |
| `foundation-scope.config.json` | Scope rules as requirements source |

**Evidence gaps to fill:**

- Link each FINDING to requirement ID
- Negative fixtures not yet wired to CI `verify:foundation`
- Transitive import proof incomplete
- No runtime attestation artifact

---

### 9.3 StreamSets AI (Contracts)

**May consume:**

| Input | Use |
|-------|-----|
| SAFE / UNSAFE / DONOR boundaries (§3) | Contract package placement |
| Forbidden route/env patterns from scope config | Forbidden fields / semantics |
| Readonly GET surface (Stage 4) | OperatorReadModel boundary |

**Out of scope for contracts now:** ExecutionIntent runtime, Trade Card runtime.

---

### 9.4 nVision AI (Red Team)

**Must review:**

| Item | Question |
|------|----------|
| **19 SAFE → DONOR couplings** | Is shared `runtime-engine` acceptable shortcut? |
| Dual entrypoint (`dev` vs `dev:readonly-api`) | Bootstrap / operator risk |
| `live-stream` in readonly startup | Market connected ≠ trusted narrative |
| Frontend (unscanned) | Local trust / admission display |
| Whole-repo co-location of UNSAFE + SAFE | Supply-chain / deploy boundary |
| `core/core/state/**` scope gap | Classification drift |

**Deliverable expected from nVision:** derived review artifact only — no edits to Foundation source reports.

---

## 10. Scanner summary table (machine totals)

| Scanner | Files/items | RED | YELLOW | FINDING | DONOR_FINDING | GREEN/OK |
|---------|-------------|-----|--------|---------|---------------|----------|
| Routes | 123 routes | 0 | 0 | 17 | 0 | 106 |
| Imports | 311 edges | 0 | 19 | 5 | 6 | 281 |
| Env | 130 hits | 0 | 0 | 3 | 0 | 127 |

**Unified RED in SAFE across all scanners: 0**

---

## 11. Evidence index (Foundation Lead outputs)

```text
docs/reports/
  REPO_INVENTORY_INITIAL.md          (Stage 2)
  FOUNDATION_SCOPE_CONFIG_INITIAL.md (Stage 3)
  ROUTE_SCANNER_STAGE4_REPORT.md     (Stage 4)
  IMPORT_SCANNER_STAGE5_REPORT.md    (Stage 5)
  ENV_SCANNER_STAGE6_REPORT.md       (Stage 6)
  SAFE_UNSAFE_SPLIT_INITIAL.md       (Stage 7 — this file)

tools/verification/
  foundation-scope.config.json
  scan-routes.mjs
  scan-imports.mjs
  scan-env.mjs
  scope-match.mjs

reports/
  route-inventory.json
  import-boundary-report.json
  env-inventory.json
  env-inventory.md

docs/architecture/
  SAFE_ENV_POLICY.md

tests/negative/
  route-post-order.fixture.json
  unsafe-import.fixture.json
  exchange-secret.fixture.json
```

---

## 12. Limitations (explicit)

1. All scanners are **static** — no `npm install`, no server start, no live HTTP.
2. MBG source target **unchanged** throughout Stages 2–7.
3. Scope config v1.0 **not amended** mid-pipeline (`state/**` deferred).
4. This matrix is **Foundation Lead derived** — not Notary attestation.
5. Sprint 1 isolation **not executed** — inventory and proof only.

---

## 13. Stage 7 verdict

```text
SAFE_UNSAFE_SPLIT_INITIAL

STATUS:     COMPLETE
FOUNDATION STATIC GATE:  PASS (0 RED in SAFE)
NOTARY GREEN:            NOT CLAIMED
UNKNOWN NEVER GREEN:     ENFORCED
YELLOW COUPLINGS:        19 (documented)
UNSAFE FINDINGS:         25 total across scanners (expected)

READY FOR STAGE 8:       YES (handoff to other agents — after owner review)
```

**Recommended next step after owner GO on this matrix:**

1. nVision — architecture review of YELLOW couplings and dual entrypoint.
2. DO-178B C — Evidence Matrix from scanner JSON outputs.
3. Code Cloaker — first Notary read pass (YELLOW/review, not GREEN).
4. StreamSets — contract boundaries from §3 + scope config.

**Not yet:** Sprint 1 Review doc (`GENESIS_FOUNDATION_SPRINT_1_REVIEW.md`) — Stage 8 / closure.

---

## Version history

| Version | Date | Note |
|---------|------|------|
| 1.0 INITIAL | 2026-05-31 | Integrated matrix from Stages 2–6 |

---

*End of SAFE_UNSAFE_SPLIT_INITIAL.md*
