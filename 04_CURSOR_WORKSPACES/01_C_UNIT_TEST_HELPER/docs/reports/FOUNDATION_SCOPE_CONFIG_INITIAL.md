# FOUNDATION_SCOPE_CONFIG_INITIAL.md

## Technical Constitution of Foundation Scope (MBG Observable Core RC4-D2)

| Field | Value |
|-------|--------|
| **Stage** | 3 — Foundation Scope Definition |
| **Author** | Genesis Foundation Lead Engineer (C Unit Test Helper) |
| **Date** | 2026-05-31 |
| **Based on** | `REPO_INVENTORY_INITIAL.md` (Stage 2, approved by owner GO) |
| **Machine config** | `tools/verification/foundation-scope.config.json` |
| **Source target** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **Method** | Formalization only — no scanners, no MBG edits, no code execution |

---

## 0. Purpose of this document

This is the **first technical constitution** of Genesis Foundation for the MBG source target.

It is not philosophy. It is not a file tree dump. It is the **map of the world** that every later agent and scanner will use:

```text
Here is SAFE territory.
Here is UNSAFE territory.
Here is DONOR territory.
Here is UNKNOWN (yellow) territory.
Here are the forbidden boundaries.
```

**Gate for Stage 4:** Route Scanner may start only after **review** of this document and `foundation-scope.config.json`.

---

## 1. Scope model (normative)

```text
SAFE violation      = RED
UNSAFE violation    = FINDING
DONOR violation     = DONOR_FINDING
UNKNOWN             = YELLOW
UNKNOWN never GREEN
```

**Matching priority:**

```text
SAFE > UNSAFE > DONOR > UNKNOWN
```

The fallback `unknown_roots: ["**"]` must **never** override an explicit root.

**Whole repository rule:** The entire MBG source target is **never** SAFE.

---

## 2. SAFE — ядро честности (100% classification)

### 2.1 Definition

**SAFE** — код и поверхности, которые **должны** соответствовать закону честного ядра Genesis:

- не отправляют order;
- не импортируют execution / exchange;
- не хранят exchange secrets;
- не обходят Kernel Authority и ActionGate;
- отдают истину через CoreTrustReport и readonly projections.

SAFE — это **не** «всё хорошее в репозитории». Это **узкий канонический контур**.

### 2.2 Organs classified as SAFE

| Organ | Path (under source target) | Role |
|-------|---------------------------|------|
| **Kernel** | `core/core/kernel/**` | Trust authority, core laws, CoreTrustReport |
| **Gates** | `core/core/gates/**` | ActionGate — fail-closed permission |
| **Invariants** | `core/core/invariants/**` | Invariant engine |
| **Integrity** | `core/core/integrity/**` | Hash chain, integrity report |
| **Permission ledger** | `core/core/permissions/**` | Records decisions; does not authorize alone |
| **Recovery** | `core/core/recovery/**` | Recovery planner (advisory) |
| **Quarantine** | `core/core/quarantine/**` | Isolates bad data |
| **Event validation** | `core/core/events/**` | Ingress validation |
| **Contracts (schemas)** | `core/core/contracts/**` | Events, actions, DTOs, snapshot normalization |
| **Observable read models** | `core/core/observable/**`, `core/core/runtime-read-model/**` | Read projections for operator truth |
| **Readonly operator API** | `core/apps/readonly-api/**`, `core/core/ui-api/connected-readonly-core-api.ts` | RC4-D accepted surface; POST closed |
| **Governance docs (target)** | `docs/**`, selected `core/CORE_*.md` | Normative architecture text |
| **Readonly boundary test** | `core/scripts/verify-readonly-surface.mjs` | Evidence that POST surface stays closed |
| **Workspace verify scripts** | `scripts/verify-*.mjs` | Acceptance gates (non-mutating when run as verify) |

### 2.3 What is intentionally NOT in SAFE

| Excluded | Why |
|----------|-----|
| `core/core/runtime/**` | Shared with lab runtime-api — **DONOR** |
| `core/core/live-stream/**` | Market sensor; dual role — **DONOR** |
| `core/core/market-input/**` | Genesis layer boundary unclear — **DONOR** until scan |
| `core/core/strategy/**`, `domain/**` | Trading semantics — **DONOR** |
| `frontend/**` | Periphery; may display trust — **DONOR** |
| Entire `core/` tree | Would falsely green whole repo |

### 2.4 SAFE behavioral contract (for scanners)

If a file matches SAFE roots, the following are **RED**:

- `POST /order`, `/trade/place`, `/execute`, `/execution/*`, `/dispatch`, `/reconcile/*` (mutating)
- import of `application/exchange`, `application/market`, `engine/execution`, `runtime-api`
- import path containing: `binance`, `testnet`, `execution`, `order-router`, `trading-runtime`
- env names: `BINANCE_SECRET_KEY`, `EXCHANGE_SECRET`, `EXECUTION_MODE=LIVE`, etc.

---

## 3. UNSAFE — исполнение и пути к order

### 3.1 Definition

**UNSAFE** — зоны, где **ожидаемо** присутствует execution capability, exchange adapters, testnet/live paths, или mutating lab API.

UNSAFE violation = **FINDING** (documented risk, not automatic Sprint-1 failure).

### 3.2 Organs classified as UNSAFE

| Organ | Path | Capability |
|-------|------|------------|
| **Runtime API (lab)** | `core/apps/runtime-api/**` | POST trade, testnet execution, dispatch, reconcile, stress tests |
| **Exchange adapter** | `core/application/exchange/**` | `binance-spot-testnet` — account, orders, signing |
| **Market adapter (live)** | `core/application/market/**` | `binance-live-market` — live connection status |
| **Execution service** | `core/engine/execution/**` | `ExecutionService.placeLimitBuy`, testnet orders |

### 3.3 Representative unsafe routes (static inventory reference)

These exist in `runtime-api` and define why this zone is UNSAFE:

```text
POST /trade/place
POST /trade/cancel
POST /execution/testnet/place-guarded
POST /execution/testnet/cancel-guarded
POST /actions/dispatch
POST /reconcile/order
POST /reconcile/position
```

### 3.4 UNSAFE policy for Foundation

- **Do not** merge UNSAFE findings as RED unless they appear **inside SAFE** roots.
- **Do not** refactor UNSAFE code in Sprint 1 without explicit approval.
- **Isolate** UNSAFE from future Genesis safe artifact builds.

---

## 4. DONOR — полезно для Genesis, не safe-core

### 4.1 Definition

**DONOR** — legacy, lab, shared runtime, operator packaging, and pre-Genesis modules that may inform future design but **are not** canonical safe-core.

DONOR violation = **DONOR_FINDING**.

### 4.2 Organs classified as DONOR

| Category | Paths | Why donor |
|----------|-------|-----------|
| **Shared circulation** | `core/core/runtime/**`, `core/core/system/**` | Powers both readonly and runtime-api |
| **Trading domain** | `core/core/domain/**` | Order FSM, position calc |
| **Strategy / PnL / trace** | `core/core/strategy/**`, `pnl/**`, `trace/**` | Pre-Genesis cognition, not Scenario/Admission |
| **Market sensors (dual)** | `core/core/live-stream/**`, `core/core/market-input/**` | Useful; not proven isolated as safe |
| **UI helpers** | `mock-scenarios.ts`, `observable-core-machine.ts`, `ui-api/index.ts` | Mock/lab paths |
| **Sample state** | `core/data/**` | Packaged runtime/journal samples |
| **Test harness** | `core/tests/**` | Drives unsafe routes in scenarios |
| **Operator periphery** | `frontend/**`, `launcher/**`, `*.ps1`, `*.cmd` | RC4 observe UI; not trust kernel |
| **Historical evidence** | `core/*.patch`, `core/DELIVERY_REPORT_*` | Audit trail |
| **Root operator docs** | `README.md`, `RUNBOOK.md`, `START_HERE.md`, RC4 reports | Read-only for humans; not executable safe-core |

### 4.3 Donor value for future Genesis

| Donor module | Potential Genesis use |
|--------------|----------------------|
| `runtime-engine` | Honesty circulation if physically isolated |
| `live-stream` (RO mode) | Market data sensor pattern |
| `market-input` | Ingress contracts for Market Data layer |
| `frontend` | Operator terminal precursor (observe-only) |
| `tests/scenarios` | Negative evidence patterns for Evidence role |

---

## 5. UNKNOWN — жёлтая зона (до сканеров)

### 5.1 Definition

**UNKNOWN** — paths not covered by explicit SAFE/UNSAFE/DONOR roots, or zones where **import/route/env graph** is not yet proven.

UNKNOWN = **YELLOW**. UNKNOWN **never GREEN**.

### 5.2 What remains UNKNOWN until Stage 4–6

| Item | Resolved by |
|------|-------------|
| Transitive imports: readonly-api → runtime-engine → ? | **Import Scanner** (Stage 5) |
| Full route surface on readonly vs accidental POST | **Route Scanner** (Stage 4) |
| Secret-bearing `.env` on operator machines | **Env Scanner** (Stage 6) |
| `frontend/src/main.jsx` local trust/admission display | UI audit + import scan |
| Build graph: is `strategy/**` linked from readonly bundle? | Import / build analysis |
| `core/core/system/**` mutation coupling | Import Scanner |
| Genesis layer: market-input vs perception boundary | Architecture review (nVision) |

### 5.3 UNKNOWN handling rule

Until reclassified by evidence:

1. Treat as **YELLOW** in reports.
2. **Do not** promote to SAFE without owner + architecture review.
3. If UNKNOWN contains forbidden pattern in production entrypoint → escalate toward **RED**.

---

## 6. CRITICAL RULES (technical constitution)

These rules bind **all Foundation agents** and **all scanners**. Config mirror: `critical_rules` in `foundation-scope.config.json`.

### 6.1 Boundary rules

| ID | Rule | Violation in SAFE |
|----|------|---------------------|
| R1 | **SAFE must not import UNSAFE** | RED |
| R2 | **SAFE must not import DONOR execution paths** (`application/exchange`, `engine/execution`, `runtime-api`) | RED |
| R3 | **SAFE must not contain execution path** (handlers that place orders or call exchange private API) | RED |
| R4 | **SAFE must not create or expose order routes** (POST/PUT/PATCH/DELETE on order/trade/execute) | RED |
| R5 | **SAFE must not depend on exchange adapter** (binance client, testnet SDK usage in safe artifact) | RED |
| R6 | **SAFE must not contain exchange secrets** (API keys, signing material) | RED |
| R7 | **Testnet inside SAFE = RED** (same execution path, different money) | RED |
| R8 | **Feature flag is not a boundary** (`EXECUTION_ENABLED=false` in safe code still RED) | RED |
| R9 | **UNKNOWN never GREEN** | YELLOW → blocks GREEN |
| R10 | **Whole repo never SAFE** | POLICY |

### 6.2 Genesis layer laws (context for scanners)

```text
market data ≠ perception
perception ≠ scenario
scenario ≠ admission
admission ≠ Trade Card
Trade Card ≠ ExecutionIntent
ExecutionIntent ≠ exchange order
```

Scanner findings that show layer collapse → report to nVision; SAFE violation if collapse is in SAFE roots.

### 6.3 Entrypoint policy (architectural)

| Entry | Classification |
|-------|----------------|
| Workspace `dev:core` → `dev:readonly-api` | **Accepted** operator path |
| Core package `dev` → `runtime-api` | **UNSAFE** — must not be default for safe artifact |
| If safe build uses `npm run dev` from core package | **RED** policy violation |

---

## 7. Map diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│  SOURCE TARGET: MBG_OBSERVABLE_CORE_SOURCE_RC4_D2               │
│  (entire tree = NOT SAFE)                                       │
├─────────────────────────────────────────────────────────────────┤
│  SAFE (honesty kernel + readonly truth surface)                 │
│    kernel · gates · invariants · integrity · permissions      │
│    recovery · quarantine · events · contracts                   │
│    observable · runtime-read-model · readonly-api · conn-RO   │
├─────────────────────────────────────────────────────────────────┤
│  UNSAFE (execution limbs)                                       │
│    runtime-api · application/exchange · application/market      │
│    engine/execution                                             │
├─────────────────────────────────────────────────────────────────┤
│  DONOR (shared / legacy / operator / tests)                     │
│    runtime · system · domain · strategy · live-stream           │
│    market-input · data · tests · frontend · launcher · docs*  │
├─────────────────────────────────────────────────────────────────┤
│  UNKNOWN (fallback **) — YELLOW until scanners                  │
│    unmapped paths · transitive imports · operator .env          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Relationship to `foundation-scope.config.json`

| Document section | JSON field |
|------------------|------------|
| SAFE list | `safe_roots` |
| UNSAFE list | `unsafe_roots` |
| DONOR list | `donor_roots` |
| UNKNOWN fallback | `unknown_roots` |
| Status rules | `rules` |
| Critical rules | `critical_rules` |
| Import patterns | `forbidden_imports_in_safe` |
| Route patterns | `forbidden_route_patterns_in_safe` |
| Env names | `forbidden_env_names_in_safe` |
| Entrypoint | `entrypoint_policy` |

**Path resolution:** All glob roots are relative to `source_target` in the JSON file.

---

## 9. What this enables (next stages)

| Stage | Uses scope config for |
|-------|----------------------|
| **4 — Route Scanner** | Classify each route: SAFE→RED, UNSAFE→FINDING, DONOR→DONOR_FINDING, UNKNOWN→YELLOW |
| **5 — Import Scanner** | `forbidden_imports_in_safe` |
| **6 — Env Scanner** | `forbidden_env_names_in_safe`, `[REDACTED]` only |
| **7 — SAFE/UNSAFE Matrix Review** | Consolidate into `SAFE_UNSAFE_SPLIT_INITIAL.md` |
| **8 — Handoff** | Notary, Evidence, Contracts, nVision consume machine reports |

**Explicitly not enabled yet:** scanner implementation, MBG modifications, dependency install, code execution.

---

## 10. Review checklist (for owner)

- [ ] SAFE roots are narrow enough (not whole `core/core/**`)
- [ ] UNSAFE covers all execution limbs found in inventory
- [ ] DONOR correctly holds shared `runtime-engine` and frontend
- [ ] UNKNOWN fallback understood as YELLOW, not SAFE
- [ ] Critical rules R1–R10 accepted
- [ ] Entrypoint policy (`dev` vs `dev:readonly-api`) acknowledged
- [ ] Approve `foundation-scope.config.json` as v1.0 INITIAL

**After approval:** GO Stage 4 — Route Scanner only (no import/env until route stage complete per pipeline discipline, unless owner batches — default: sequential).

---

## 11. Limitations

1. Scope derived from **static architectural inventory**, not executed scanners.
2. Transitive import boundaries are **declared**, not yet **proven**.
3. Config lives in **Foundation workspace**; MBG source target **unchanged**.
4. Reclassification requires owner decision + document version bump.

---

## 12. Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 INITIAL | 2026-05-31 | First formal scope constitution from REPO_INVENTORY_INITIAL |

---

*End of FOUNDATION_SCOPE_CONFIG_INITIAL.md*
