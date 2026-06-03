# REPO_INVENTORY_INITIAL.md

## MBG Architectural Inventory (Genesis Foundation Sprint 1)

| Field | Value |
|-------|--------|
| **Document role** | First architectural / logical / functional inventory |
| **Author role** | Genesis Foundation Lead Engineer (C Unit Test Helper) |
| **Date** | 2026-05-31 |
| **Source target (read-only)** | `D:\genessis\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |
| **Artifact location** | `D:\genessis\04_CURSOR_WORKSPACES\C_UNIT_TEST_HELPER\docs\reports\` |
| **Method** | Static read-only inspection (no code run, no `npm install`, no edits to source target) |
| **Genesis framing** | MBG = safe-core / honesty kernel candidate; Genesis = wider system around MBG |

---

## Executive summary

MBG Observable Core RC4-D2 is **not a trading bot release**. It is a **living organism** packaged as a workspace: a **Trust Kernel** (ядро честности), a **readonly operator nervous system** (observe-only), and a **parallel mutation-capable runtime** (testnet / lab surface) that coexists in the same tree but is **not** the RC4-D acceptance path.

The organism has a **strong heart** (kernel authority, gates, replay, invariants, permission ledger) and a **deliberately closed operator face** (readonly API + RC4 frontend). It also carries **latent execution limbs** (runtime-api, exchange adapters, execution service) that must be classified as **UNSAFE / DONOR**, never as SAFE.

**Inventory verdict at this stage:** suitable for Foundation scope config and scanners **after owner review** of this document. **UNKNOWN zones remain** (import graph from readonly path into shared runtime-engine; strategy modules inside `core/core`; exact Genesis isolation boundary).

---

## 1. What is MBG?

### 1.1 Definition (architectural)

**MBG (Observable Core)** — это реализация **ядра честности Genesis v0.1**: система, которая:

- хранит истину состояния через **event journal + deterministic reducers + replay**;
- оценивает доверие через **Kernel Authority** и **CoreTrustReport**;
- запрещает действия через **ActionGate** по принципу **NO PROOF → NO ALLOW**;
- отделяет **наблюдение** от **исполнения** на уровне задуманного RC4-D operator surface.

MBG **≠ Genesis целиком**. Genesis — будущая система с рынком, perception, scenario, admission, Trade Card, paper/live bridge. MBG даёт **фундамент честности**, на который Genesis должен опираться.

### 1.2 What this package actually is (functional)

| Layer | Identity |
|-------|----------|
| **Product line** | `mbg-observable-core-workspace-rc4-d-final-acceptance` |
| **Core engine** | `mbg-core-v0.1-alpha10` inside `core/` |
| **Operator mode (accepted)** | Observe-only: readonly API `:3011` + Vite frontend `:5173` |
| **Lab mode (present, not accepted path)** | Full `runtime-api` with POST trading/testnet/scenario routes |
| **Packaging** | Verification scripts, launchers, acceptance reports (RC4-D2) |

### 1.3 Organ metaphor (living system)

```text
                    ┌─────────────────────────────────────┐
                    │   OPERATOR SENSES (frontend)        │
                    │   GET-only · mock or ApiAdapter     │
                    └──────────────┬──────────────────────┘
                                   │ read
                    ┌──────────────▼──────────────────────┐
                    │   READONLY NERVOUS SYSTEM           │
                    │   apps/readonly-api                 │
                    │   connected-readonly-core-api       │
                    │   executionSurface: closed          │
                    └──────────────┬──────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
┌────────▼────────┐    ┌───────────▼──────────┐   ┌─────────▼─────────┐
│ HEART (kernel)  │    │ CIRCULATION          │   │ SENSORS (market)  │
│ trust, gates,   │◄──►│ runtime-engine,      │   │ market-input,     │
│ invariants,     │    │ journal, reducers,   │   │ live-stream (RO)  │
│ ledger, replay  │    │ persistence          │   └───────────────────┘
└────────┬────────┘    └───────────┬──────────┘
         │                         │
         │              ┌──────────▼──────────┐
         │              │ LIMBS (UNSAFE)      │
         │              │ runtime-api POST    │
         │              │ exchange testnet    │
         │              │ execution.service   │
         │              └─────────────────────┘
         │
         └─► Future Genesis organs (mostly absent): Perception, Scenario,
             Admission, Trade Card, Paper/Live Bridge, Notary, Evidence
```

### 1.4 Declared vs observed truth

| Declared (docs) | Observed (structure) | Gap |
|-----------------|----------------------|-----|
| RC4-D observe-only, no execution on operator surface | `readonly-api` + `connected-readonly-core-api` — no `router.post` | **Aligned** for acceptance path |
| README: Binance/API keys/execution not connected (RC3 lineage) | `application/exchange`, `runtime-api` import testnet client | **Dual truth**: operator path closed; **lab path open** |
| `npm run dev` in core → `runtime-api` | Workspace `dev:core` → `dev:readonly-api` | **Important**: workspace default favors readonly; core package default favors **unsafe** |
| NO PROOF → NO ALLOW | Self-truth audit endpoint, semantic hardening tests | **Present** as design + tests |
| Not certified for live trading | `execution/testnet/place-guarded`, `trade/place` exist | **Explicit non-goal** for RC4-D, **present in codebase** |

---

## 2. Subsystems map (organs of the organism)

### 2.1 Core Trust Kernel (ядро) — **present, substantial**

**Purpose:** Canonical trust evaluation; only authority for `trustState`; fail-closed ActionGate.

| Module path | Function |
|-------------|----------|
| `core/core/kernel/` | Kernel authority, core laws, trust states (TRUSTED…PANIC) |
| `core/core/kernel/core-trust-report.ts` | Aggregated CoreTrustReport |
| `core/core/gates/src/action-gate.ts` | Action permission gate |
| `core/core/invariants/engine.invariants.ts` | Global invariant engine |
| `core/core/integrity/` | Snapshot hash chain, integrity report |
| `core/core/permissions/permission-ledger.ts` | Decision ledger (records, not authorizes alone) |
| `core/core/recovery/recovery-planner.ts` | Recovery advice (not auto-execute) |
| `core/core/quarantine/quarantine.ts` | Bad data isolation |
| `core/core/events/validate-domain-event.ts` | Event ingress validation |

**Constitution:** `core/CORE_CONSTITUTION.md` — normative laws; explicitly excludes strategy/UI/V1 from authority.

**Growth point:** Kernel is the **foundation of future Genesis** — must stay isolated from execution imports.

**Risk:** Same tree hosts `runtime-engine` that powers both readonly and runtime-api; trust kernel logic is not physically separate from lab runtime in deployment sense.

---

### 2.2 Runtime circulation (journal, replay, state) — **present**

| Module path | Function |
|-------------|----------|
| `core/core/runtime/src/runtime-engine.ts` | Central runtime orchestration |
| `core/core/system/journal.ts`, `state-hash.ts` | Journal + hashing |
| `core/core/transitions/src/reducers.ts` | Deterministic reducers |
| `core/core/runtime/src/persistence.ts`, `idempotency.ts`, `freshness.ts` | Persistence, idempotency, freshness |
| `core/core/domain/order.fsm.ts`, `position.calc.ts` | Order/position domain logic |
| `core/data/runtime/` | Sample event/transition segments (packaged state) |

**Growth point:** Replay and hash-chain are **Genesis honesty infrastructure**.

**Risk:** `data/runtime` in repo may bias audits; self-truth audit uses isolated snapshot (documented in `docs/CORE_SELF_TRUTH_AUDIT.md`).

---

### 2.3 Contracts & DTO language — **present (partial vs future Genesis)**

| Module path | Function |
|-------------|----------|
| `core/core/contracts/src/events.ts`, `actions.ts` | Domain events & action schemas (Zod) |
| `core/core/contracts/ui/` | UI DTOs, computation trace, normalization |
| `core/core/contracts/runtime-snapshot.ts` | Runtime snapshot contract |
| `frontend/src/contracts/` | Frontend-side contract mirrors |

**Absent vs Genesis Contract Architect scope:** ReasonCodeRegistry, StateVocabulary, AdmissionDecision, TradeCardContract, ExecutionIntent boundary package under `packages/contracts/**` (Genesis Foundation target layout).

---

### 2.4 Observable / read models — **present**

| Module path | Function |
|-------------|----------|
| `core/core/runtime-read-model/runtime-read-model-adapter.ts` | Runtime → read model |
| `core/core/observable/observable-read-models.ts` | Observable projections |
| `core/core/ui-api/observable-core-machine.ts` | Observable state machine |
| `core/core/ui-api/mock-scenarios.ts` | Mock scenarios for UI |

**Functional role:** Translates internal truth into **operator-visible** snapshots without granting execution.

---

### 2.5 Readonly operator API (accepted surface) — **present**

| Entry | Port | Role |
|-------|------|------|
| `core/apps/readonly-api/src/server.ts` | 3011 | Starts connected readonly app |
| `core/core/ui-api/connected-readonly-core-api.ts` | — | GET-only routes; `RC1_POST_SURFACE = "closed"` |

**Documented GET surface:** `API_CONTRACT.md`, `SAFETY_BOUNDARY.md` — health, core status, overview, live-stream, runtime snapshot, self-truth audit.

**Functional behavior:** Binds to `runtimeEngine` read state; may start `liveReadOnlyMarketStream` (public WS, readonly DTO defaults).

---

### 2.6 Live market stream (sensor, readonly mode) — **present**

| Module | Role |
|--------|------|
| `core/core/live-stream/live-market-stream.ts` | Binance public WS; DTO forces `executionSurface: closed`, `exchangeProofValid: false`, `trustState: UNCERTAIN` |
| `core/application/market/src/binance-live-market.ts` | Live market status helper (used by runtime-api) |

**Classification note:** Market **ingest** exists on readonly path; it is **not** exchange proof and **not** permission to trade (documented invariants).

---

### 2.7 Market input (ingress contracts) — **present**

| Module | Role |
|--------|------|
| `core/core/market-input/` | Types, validation, sequence guard |

**Genesis gap:** Full **Market Data layer** (feeds, normalization fleet) — not built; only core ingress contracts.

---

### 2.8 Strategy / metadata (cognitive precursor, not scenario engine) — **present, limited**

| Module | Role |
|--------|------|
| `core/core/strategy/` | Registry, metadata enricher, simple.strategy, hypothesis registry |
| `core/core/pnl/pnl-engine.ts` | PnL computation |
| `core/core/trace/causality-trace.ts` | Causality trace |

**Absent:** Scenario engine, admission, Trade Card as Genesis layers.

---

### 2.9 Runtime API (lab / donor body) — **present, high capability**

| Entry | Default script | Role |
|-------|----------------|------|
| `core/apps/runtime-api/src/app.ts` | `npm run dev` → runtime-api | Large Express surface |

**Observed POST families (non-exhaustive, static grep):**

- Trading: `/trade/place`, `/trade/cancel`, `/reconcile/order`, `/reconcile/position`
- Execution: `/execution/testnet/place-guarded`, `/execution/testnet/cancel-guarded`, `/execution/guard/evaluate`, `/execution/reconcile/auto`
- Actions: `/actions/evaluate`, `/actions/dispatch`
- Market/signals: `/market/tick`, `/signals`
- Debug/scenario/tests: extensive `/tests/run/*`, `/debug/*`, `/scenario/*`

**Imports:** `binance-spot-testnet`, `binance-live-market`, `runtimeEngine` mutation paths.

**Functional truth:** This is a **test harness + integration runtime**, not the RC4 operator product.

---

### 2.10 Application adapters (exchange limbs) — **present, small**

| Path | Role |
|------|------|
| `core/application/exchange/src/binance-spot-testnet.ts` | Testnet account, orders, signing path |
| `core/application/market/src/binance-live-market.ts` | Live market connection status |

**Dependencies:** `ws`, `node-fetch` in core `package.json` — network-capable.

---

### 2.11 Engine execution service — **present**

| Path | Role |
|------|------|
| `core/engine/execution/execution.service.ts` | `placeLimitBuy`, testnet via `binanceSpotTestnet` |

**Absent as separate tree:** `unsafe/**`, `live-execution-bridge/**` at workspace root — capabilities are **inside `core/`** instead.

---

### 2.12 Frontend operator terminal — **present (periphery)**

| Path | Role |
|------|------|
| `frontend/src/main.jsx` | Large operator UI (workspaces, panels) |
| `frontend/src/adapters/apiAdapter.js` | **GET-only** `fetch` to readonly API |
| Mock mode | `mock-scenarios` / MockAdapter — no backend |

**Declared:** Footer states POST/PUT/PATCH/DELETE closed; no execution controls (RC4-D).

**Risk:** UI computes display trust labels — must remain **presentation of backend DTOs** only (ongoing UX_DEBT / semantic label work).

---

### 2.13 Verification & acceptance harness — **present**

| Path | Role |
|------|------|
| `scripts/verify-rc4-d.mjs` (+ 13 siblings) | Workspace-level gates |
| `core/scripts/verify-readonly-surface.mjs` | POST boundary check on 3011 |
| `core/tests/scenarios/` | Extensive scenario test suite (waves 2–10b) |
| `core/tests/self-truth/`, `semantic-hardening/`, `live-stream/` | Targeted audits |
| Root + core delivery reports | Wave/RC acceptance evidence |

**Functional role:** This is the organism's **immune system documentation** — proves boundaries when run (not run in this inventory).

---

### 2.14 Operations / launcher — **present**

| Path | Role |
|------|------|
| `launcher/*.cmd`, `start-*.ps1`, `STOP_APP.cmd` | Operator launch without manual PowerShell |
| `rc4-d2-port-util.ps1`, `stop-core-port.ps1` | Port 3011 preflight |

---

## 3. Presence matrix (Genesis-relevant capabilities)

| Capability / organ | In MBG? | Where | Maturity |
|--------------------|---------|-------|----------|
| Trust kernel | Yes | `core/core/kernel`, gates, invariants | **Strong** |
| Event journal + replay | Yes | runtime-engine, journal, reducers | **Strong** |
| ActionGate | Yes | `action-gate.ts` | **Strong** |
| Permission ledger | Yes | `permission-ledger.ts` | **Present** |
| Quarantine / recovery planner | Yes | dedicated modules | **Present** |
| Readonly operator API | Yes | readonly-api + connected API | **RC4-D accepted** |
| Self-truth audit | Yes | GET `/api/core/self-truth/audit` | **Present** |
| Live public market stream (RO) | Yes | live-market-stream | **RC4-A** |
| Market input contracts | Yes | market-input/ | **Partial** |
| Full market data layer | No | — | **Absent** |
| Perception | No | — | **Absent** |
| Scenario engine (Genesis) | No | mock scenarios only | **Stub** |
| Admission | No | — | **Absent** |
| Trade Card | No | — | **Absent** |
| ExecutionIntent (Genesis contract) | No | actions/events only | **Partial / internal** |
| Paper execution lab | Partial | runtime test routes | **Lab only** |
| Live execution bridge | Partial | testnet routes + execution.service | **UNSAFE, not product** |
| Notary (Genesis) | No | — | **Absent** (external role) |
| Evidence matrix | No | — | **Absent** (external role) |
| Contract registry (Genesis) | No | — | **Absent** as Foundation package |
| Operator terminal (Genesis) | Partial | frontend observe-only | **RC4-D** |
| V1 bridge | Documented only | `V1_BRIDGE_PRECONDITIONS` (wave 6 report) | **Not connected** |

---

## 4. Entrypoints & operational surfaces (what actually runs)

| Script / launcher | Target | Classification |
|-------------------|--------|----------------|
| Workspace `dev:core` | `core run dev:readonly-api` | **SAFE path candidate** |
| Core `dev` | `apps/runtime-api/src/server.ts` | **UNSAFE** |
| Core `dev:readonly-api` | readonly server | **SAFE path candidate** |
| Workspace `verify:rc4-d` | Full acceptance chain | Verification (read-only when not installing) |
| `START_APP.cmd` | core + frontend | Operator observe-only |
| Core `verify` | Massive test battery + runtime reset | Lab / CI |

**Critical finding:** Two hearts on one package — **default `dev` in core package points to runtime-api (UNSAFE)**. Workspace wrapper steers operators to readonly. Genesis must treat **default entrypoint policy** as architectural risk.

---

## 5. Environment surface (names only, no values)

| File | Notable variables (presence) |
|------|------------------------------|
| `.env.example` (root) | `LIVE_STREAM_*`, Binance public WS URL, `LIVE_STREAM_ENABLED=false` |
| `core/.env.example` | `CORE_READONLY_API_PORT`, `CORE_READONLY_API_HOST`, same live stream block |
| `frontend/.env.example` | (exists — not fully expanded in this pass) |

**No `BINANCE_SECRET_KEY` in shipped examples** on readonly path — good for RC4-D demo.

**Risk:** Runtime-api / testnet likely expects secrets via env at runtime (not inventoried in examples) — **UNKNOWN** until env scan task.

---

## 6. SAFE / UNSAFE / DONOR / UNKNOWN classification

> **Rule:** Entire repository is **not** SAFE. Priority: `SAFE > UNSAFE > DONOR > UNKNOWN`.

### 6.1 SAFE candidates (intended safe contour or verification-only)

*Candidates only — subject to scope config review and import/route scanners.*

| Zone | Rationale |
|------|-----------|
| `core/apps/readonly-api/**` | Accepted operator server; POST closed by contract |
| `core/core/ui-api/connected-readonly-core-api.ts` | Explicit closed POST surface; GET read models |
| `core/core/kernel/**`, `gates/**`, `invariants/**`, `integrity/**` | Trust laws implementation |
| `core/core/permissions/**`, `recovery/**`, `quarantine/**` | Honesty support organs |
| `core/core/contracts/**` (types/schemas) | Contract language (still needs forbidden-field scan) |
| `core/core/observable/**`, `runtime-read-model/**` | Read projections |
| Workspace `docs/**` (target docs) | Architecture contracts, self-truth audit spec |
| `scripts/verify-*.mjs`, `core/scripts/verify-readonly-surface.mjs` | Verification tooling |
| `core/tests/self-truth/**`, `tests/semantic-hardening/**` | Boundary tests |

**YELLOW note:** Readonly server imports `runtimeEngine` + `liveReadOnlyMarketStream` — safe **behavior** depends on runtime-engine not exposing mutation routes on same process (readonly app uses separate entry — OK at app level; shared code path = review).

### 6.2 UNSAFE (execution-capable or testnet)

| Zone | Rationale |
|------|-----------|
| `core/apps/runtime-api/**` | POST trade, testnet execution, dispatch, reconcile |
| `core/application/exchange/**` | Binance spot testnet client |
| `core/application/market/**` | Live market (also used by runtime-api) |
| `core/engine/execution/**` | Order placement service |
| Core `package.json` script `"dev"` → runtime-api | Default unsafe entry |

**Expected scanner posture:** FINDING in UNSAFE, not Sprint-1 failure.

### 6.3 DONOR (legacy / lab / shared runtime)

| Zone | Rationale |
|------|-----------|
| `core/core/runtime/**` | Shared engine — readonly + lab |
| `core/core/strategy/**`, `pnl/**`, `trace/**` | Pre-Genesis strategy metadata |
| `core/core/live-stream/**` | Used by readonly (RO) and conceptually market — dual role |
| `core/core/domain/**` | Order/position domain tied to trading semantics |
| `core/data/**` | Packaged runtime samples |
| `frontend/**` | Operator UI — observe-only product, rich UI debt |
| `core/tests/scenarios/**` | Lab tests driving unsafe routes |
| `core/*-integration.patch`, `DELIVERY_REPORT_*` | Historical evidence |
| `launcher/**`, `*.ps1` | Ops helpers |

### 6.4 UNKNOWN (requires scanners + owner decisions)

| Zone | Why unknown |
|------|-------------|
| `core/core/system/**` | Coupling to runtime-engine mutations |
| `core/core/market-input/**` | Boundary between market data vs perception (Genesis law) |
| `core/core/ui-api/index.ts`, mocks | Mock vs connected mode switching at runtime |
| Import graph: readonly → runtime-engine → ? | Full transitive forbidden imports |
| `frontend/src/main.jsx` (size/complexity) | Local trust/admission display logic — needs UI audit |
| Whether `strategy/**` is linked from readonly build | Build graph not executed |
| Secret-bearing `.env` (non-example) | Not present in tree; operator-local **UNKNOWN** |

---

## 7. Per-subsystem risk register

| Subsystem | Risk level | Risk description | Genesis impact |
|-----------|------------|------------------|----------------|
| Trust kernel | Low (internal) | Regression if MBG Core touched without review | Breaks entire Genesis honesty |
| Readonly API | Medium | Drift: POST added to connected API | False operator safety |
| Live stream | Medium | "Connected" confused with trust/proof | Violates NO PROOF → NO ALLOW narrative |
| Runtime-engine (shared) | High | Single engine serves RO + lab | Hidden coupling |
| runtime-api | High | Full testnet/order surface | Shortcut to execution if default dev wrong |
| Exchange testnet adapter | High | Signing + orders if secrets present | UNSAFE must stay isolated |
| execution.service | High | Direct placeLimitBuy | Must never enter safe artifact |
| Frontend | Medium | UX may imply permission | UI must not compute canExecute |
| Default npm scripts | High | `core dev` → runtime-api | Operator/bootstrap risk |
| Packaged `data/runtime` | Low | Stale state in audits | Self-truth isolation mitigates |
| Verification harness | Low | Not run = false confidence | Evidence gap until CI |

---

## 8. What Genesis will need later (growth map)

From Context Brief — organs **not** in MBG or only stubbed:

```text
Market Data        → partial (market-input, live-stream RO)
Perception         → absent
Scenario           → mock only
Admission          → absent
Trade Card         → absent
Memory             → absent
Paper Execution    → lab routes only (not Genesis paper lab)
Operator Terminal  → RC4 observe UI (not action terminal)
Live Bridge        → testnet inside core (must be isolated)
Notary             → Genesis role (Code Cloaker)
Evidence           → Genesis role (DO-178B C)
Contracts          → Genesis packages/contracts (skeleton TBD)
Architecture RT    → nVision
```

**MBG as foundation:** Provides kernel, gates, replay, readonly truth surface, and verification culture. Genesis must **wrap** MBG without turning safe-core into executor.

---

## 9. Declared but missing / mismatched

| Declared | Reality |
|----------|---------|
| "No execution on operator surface" | True for readonly-api; **false** for runtime-api in same repo |
| "No Binance" (RC3 README lineage) | Public WS + testnet adapter code **present** |
| Separate `unsafe/**` tree (Foundation config template) | Capabilities live **inside `core/`** |
| `packages/notary/**`, `packages/contracts/**` (Genesis layout) | **Not in source target** — Foundation outputs go to future workspace layout |
| Full Genesis layer stack | **Mostly absent** by design at this RC |

---

## 10. File-level directory index (supporting, not primary)

```text
MBG_OBSERVABLE_CORE_SOURCE_RC4_D2/
├── core/                 # MBG Core v0.1 engine (~primary organism)
│   ├── core/             # Trust kernel, runtime, contracts, UI API
│   ├── apps/             # readonly-api (RO) + runtime-api (UNSAFE)
│   ├── application/      # exchange + market adapters (UNSAFE)
│   ├── engine/execution/ # execution.service (UNSAFE)
│   ├── tests/            # scenario + audit tests
│   ├── data/             # sample runtime/journal
│   └── [governance md]   # CORE_CONSTITUTION, API maps, waves
├── frontend/             # Operator UI (DONOR/product periphery)
├── docs/                 # RC3/4 architecture docs (SAFE candidate)
├── scripts/              # Workspace verify scripts
├── launcher/             # CMD launchers
└── [root ops + RC4 reports]
```

**Approximate scale:** ~282 files under source target (glob count); core TypeScript organism is dense in `core/core/` and `core/apps/runtime-api/`.

---

## 11. Proposal: `foundation-scope.config.json` (initial)

> For owner review — not finalized until this inventory is approved.

```json
{
  "version": "1.0-proposal",
  "source_target": "D:/genessis/02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2",
  "safe_roots": [
    "docs/**",
    "core/apps/readonly-api/**",
    "core/core/ui-api/connected-readonly-core-api.ts",
    "core/core/kernel/**",
    "core/core/gates/**",
    "core/core/invariants/**",
    "core/core/integrity/**",
    "core/core/permissions/**",
    "core/core/recovery/**",
    "core/core/quarantine/**",
    "core/core/contracts/**",
    "core/core/observable/**",
    "core/core/runtime-read-model/**",
    "core/scripts/verify-readonly-surface.mjs",
    "scripts/verify-*.mjs"
  ],
  "unsafe_roots": [
    "core/apps/runtime-api/**",
    "core/application/exchange/**",
    "core/application/market/**",
    "core/engine/execution/**"
  ],
  "donor_roots": [
    "core/core/runtime/**",
    "core/core/strategy/**",
    "core/core/domain/**",
    "core/core/live-stream/**",
    "core/core/market-input/**",
    "core/core/pnl/**",
    "core/core/trace/**",
    "core/core/system/**",
    "core/core/ui-api/mock-scenarios.ts",
    "core/data/**",
    "core/tests/**",
    "frontend/**",
    "launcher/**",
    "core/DELIVERY_REPORT_*",
    "core/*.patch"
  ],
  "unknown_roots": ["**"],
  "rules": {
    "safe_violation_status": "RED",
    "unsafe_violation_status": "FINDING",
    "donor_violation_status": "DONOR_FINDING",
    "unknown_status": "YELLOW",
    "unknown_can_be_green": false
  },
  "notes": [
    "Whole repo must NOT be declared SAFE",
    "core/package.json dev script points to runtime-api — policy risk",
    "live-stream under donor until RO-only import path proven"
  ]
}
```

---

## 12. Limitations of this inventory

1. **No code execution** — presence of routes/imports verified statically; runtime behavior not observed.
2. **No dependency install** — transitive dependency graph not resolved.
3. **No secret scan** — only `.env.example` read; no secret values reported.
4. **Import boundary** — transitive analysis deferred to `scan-imports` after scope approval.
5. **Frontend logic** — 2000+ line `main.jsx` not line-audited; classified UNKNOWN for local trust computation.
6. **Artifact location** — report stored in Foundation workspace, not inside source target (source target unchanged).

---

## 13. Recommended next steps (after owner review)

| Step | Owner action | Foundation Lead action (when approved) |
|------|--------------|----------------------------------------|
| 1 | Review this architectural inventory | — |
| 2 | Approve / amend SAFE/UNSAFE/DONOR/UNKNOWN | Update classification |
| 3 | GO scope config | Create `tools/verification/foundation-scope.config.json` + `FOUNDATION_SCOPE_CONFIG_INITIAL.md` |
| 4 | GO scanners | Route → import → env inventory (still read-only analysis + tooling in allowed dirs) |
| 5 | Parallel | nVision review; Notary waits for scanner outputs; Evidence waits for artifacts |

**Formal gate:** `No scanner implementation before REPO_INVENTORY_INITIAL.md is completed and reviewed.`

---

## 14. Inventory completion statement

MBG is architecturally understood as a **dual-surface organism**: an **honesty kernel + readonly operator nervous system** (Genesis-safe direction) coexisting with a **mutation-capable lab runtime** (must remain UNSAFE/DONOR). File count alone is insufficient; the system's **organs, growth points, and risks** are mapped above for Genesis Foundation.

---

*End of REPO_INVENTORY_INITIAL.md*
