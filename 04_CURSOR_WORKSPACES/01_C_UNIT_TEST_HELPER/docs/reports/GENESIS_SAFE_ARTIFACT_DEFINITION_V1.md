# GENESIS SAFE ARTIFACT DEFINITION V1

| Field | Value |
|-------|--------|
| **Sprint** | 2 — Isolation & Evidence Hardening |
| **Deliverable** | O-01 (D-05) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Owner GO** | `18_OWNER_SIGNOFF_RECORD_RU.md` |
| **Status** | **DEFINITION V1** — not production deploy claim |
| **Machine manifest** | `tools/verification/genesis-safe-artifact.manifest.json` |

---

## 0. Purpose

Define **genesis-safe-readonly** as a **physical deployable unit** — not a scope label in markdown.

**Logical SAFE (Sprint 1):** «мы классифицировали пути и статически проверили labeled SAFE files».  
**Physical SAFE (Sprint 2):** «собранный артефакт **не содержит** execution/trade/testnet/signing и CI **ломается**, если содержит».

This document does **not** claim Notary GREEN or execution authorization.

---

## 1. Artifact identity

| Property | Value |
|----------|--------|
| **Name** | `genesis-safe-readonly` |
| **Version scheme** | `genesis-safe-readonly-v{semver}` tied to manifest `version` |
| **Build output** | `01_C_UNIT_TEST_HELPER/dist/genesis-safe-readonly/` |
| **Source (read-only)** | `SOURCE_TARGET_ROOT` env (see `tools/verification/GENESIS_PATHS.md`) |
| **Runtime entry (only)** | `core/apps/readonly-api/src/server.ts` |
| **Forbidden entry** | `core/apps/runtime-api/**`, `core dev` default script |

---

## 2. What the artifact IS

A **minimal readonly operator kernel package** containing:

- SAFE-classified core organs (kernel, gates, invariants, integrity, permissions, recovery, quarantine, events, contracts, observable, runtime-read-model)
- Readonly operator API (`apps/readonly-api`, `connected-readonly-core-api.ts`)
- Governance docs under `docs/**` (normative text)
- Verify scripts required for attestation (`verify-readonly-surface.mjs`, workspace verify scripts)
- **Only** dependencies required to **start readonly-api** and serve GET truth surfaces

The artifact **proves** operator truth **without** order placement, exchange signing, or testnet execution paths in the **bundle output**.

---

## 3. What the artifact IS NOT

- The full MBG repository  
- The lab / runtime-api stack  
- Frontend (DONOR — separate artifact class)  
- Market Data, Perception, Scenario, Admission, Execution layers (Genesis phases not started)  
- A claim of runtime safety without bundle scan JSON  
- Notary GREEN  

---

## 4. Inclusion rules (from scope v1.0)

**Include** paths matching `foundation-scope.config.json` → `safe_roots`:

```text
docs/**
core/CORE_*.md (listed in manifest)
core/apps/readonly-api/**
core/core/ui-api/connected-readonly-core-api.ts
core/core/kernel/**
core/core/gates/**
core/core/invariants/**
core/core/integrity/**
core/core/permissions/**
core/core/recovery/**
core/core/quarantine/**
core/core/events/**
core/core/contracts/**
core/core/observable/**
core/core/runtime-read-model/**
core/scripts/verify-readonly-surface.mjs
scripts/verify-*.mjs (workspace-level, if staged)
```

**Explicitly EXCLUDE** (never in bundle output):

```text
core/apps/runtime-api/**
core/application/exchange/**
core/application/market/**
core/engine/execution/**
frontend/**
launcher/**
All UNSAFE roots + donor_roots except transitive deps resolved under Tier policy (§6)
```

---

## 5. Forbidden content in bundle (machine-checkable)

Bundle scan **must fail** if output contains:

### 5.1 Routes / handlers

- HTTP POST handlers matching forbidden_route_patterns from scope config  
- Paths containing: `/trade`, `/order`, `/execution`, `/testnet`, `/place`, `/cancel`, `/dispatch`, `/intent`

### 5.2 Imports / modules

Any of `forbidden_imports_in_safe` from scope config, including:

```text
runtime-api, execution, exchange, binance, testnet, trading-runtime,
live-execution-bridge, order-router, application/exchange, engine/execution
```

### 5.3 Secrets / env

- Forbidden env **names** in staged `.env*` or source literals: `BINANCE_*`, `EXCHANGE_*`, `EXECUTION_MODE`, etc.

### 5.4 Files

- Any file under `apps/runtime-api/**`  
- Binance / exchange adapter implementations  

---

## 6. Tier policy (D-01 couplings) — P0.3 (AA-2)

Readonly-api **today** imports DONOR modules (e.g. `live-stream`, shared `runtime-engine` chain — 19 SAFE→DONOR couplings).

| Tier | Runnable? | Bundle contents | Import completeness | Attestation |
|------|-----------|-----------------|---------------------|-------------|
| **OPERATOR** | **Yes** (YELLOW) | Full readonly-api closure incl. documented DONOR deps | `verify:artifact-import-completeness` must **PASS** (all relative imports resolve) | Not GREEN — YELLOW operator path |
| **STRICT** | **No** (audit-only) | Excludes `core/core/live-stream/**` and `core/core/runtime/**` from staging | Must **PASS** P0.2 with `--strict`: no imports to runtime/live-stream; missing imports expected if graph incomplete | Audit subset — **not** demo-ready until STRICT build is intentionally complete |

```text
OPERATOR = runnable YELLOW (physical bundle + import proof, not Notary GREEN)
STRICT   = audit subset, NOT runnable until P0.2 PASS for declared STRICT graph
```

**Forbidden:** Claim STRICT is operator-ready; add `runtime/**` to STRICT bundle to “fix” import errors; claim GREEN.

**Owner D-01:** CONDITIONAL YES — `DONOR_COUPLING_REGISTER_SPRINT2.md` lists dispositions.

**Machine checks:**

- `reports/artifact-import-completeness.json` — P0.2  
- `reports/safe-bundle-scan.json` — forbidden pattern scan  

**Rule:** Tier must be **declared** in every bundle scan report. Tier upgrade ≠ GREEN.

---

## 7. Entrypoint policy (D-03)

| Script | Classification | Artifact |
|--------|----------------|----------|
| `npm run dev:readonly-api` (core) | **SAFE operator entry** | Allowed |
| `npm run dev:core` (root → readonly-api) | **SAFE** if documented | Allowed with rename to `dev:readonly-safe` |
| `npm run dev` (core → runtime-api) | **UNSAFE lab** | **Forbidden** for safe artifact ops |
| Proposed `dev:readonly-safe` | SAFE alias | Recommended |
| Proposed `dev:runtime-lab-unsafe` | UNSAFE alias | Rename of current `dev` |

**Operator rule:** safe artifact documentation **must not** reference `core dev` without `UNSAFE` warning.

---

## 8. Build pipeline (O-02)

```text
1. Read genesis-safe-artifact.manifest.json
2. Copy allowlisted paths from source_target → dist/genesis-safe-readonly/
3. Write build manifest (hashes, file count, tier)
4. Run scan-safe-bundle.mjs → reports/safe-bundle-scan.json
5. CI gate: violations.length === 0 for declared tier
```

**Tool:** `tools/verification/build-safe-artifact.mjs`  
**Scan:** `tools/verification/scan-safe-bundle.mjs`

---

## 9. Proof artifacts (required for Sprint 2 exit)

| Artifact | Path |
|----------|------|
| This definition | `docs/reports/GENESIS_SAFE_ARTIFACT_DEFINITION_V1.md` |
| Machine manifest | `tools/verification/genesis-safe-artifact.manifest.json` |
| Build output | `dist/genesis-safe-readonly/` |
| Scan JSON | `reports/safe-bundle-scan.json` |
| Scan report | `docs/reports/SAFE_BUNDLE_SCAN_REPORT.md` |
| CI negative proof | `docs/reports/CI_NEGATIVE_PROOF.md` |
| Coupling register | `docs/reports/DONOR_COUPLING_REGISTER_SPRINT2.md` (planned) |

---

## 10. Relationship to Sprint 1

| Sprint 1 claim | Sprint 2 extension |
|----------------|-------------------|
| 0 RED in SAFE (static) | 0 violations in **bundle output** |
| EM-010 MISSING | EM-010 → COMPLETE when scan passes |
| CR-12 ARCH_YELLOW | Mitigation path defined |
| Foundation PASS | **Not** equal to safe artifact PASS until O-03 green |

---

## 11. Explicit non-claims

```text
NOTARY GREEN:              NOT CLAIMED
EXECUTION AUTHORIZED:      NO
PRODUCTION DEPLOY SAFE:    NOT UNTIL OWNER + evidence closure
MARKET DATA READY:         NO
```

---

## 12. Approval

| Role | Status |
|------|--------|
| Agent 01 | DEFINITION V1 COMPLETE |
| Owner (D-05) | GO recorded 2026-06-01 |
| Agent 02 Notary | No attestation change in O-01 |

---

*Next: O-02 build-safe-artifact.mjs → O-03 bundle scan*
