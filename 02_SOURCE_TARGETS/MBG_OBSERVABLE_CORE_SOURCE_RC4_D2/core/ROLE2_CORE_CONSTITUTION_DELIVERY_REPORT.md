# Delivery Report — Role 2: Core Constitution

Package target: `mbg-core-v0.1-alpha1`  
Role: 2 — Core Constitution  
Status: accepted; prepared for Role 8 Integration Owner / Merge Engineer  
Scope: normative Trust Kernel constitution only

## 1. Delivered artifacts

1. `CORE_CONSTITUTION.md`
2. `core/kernel/kernel-constitution.ts`
3. `tests/scenarios/core-constitution.test.mjs`
4. `package.json` change for `npm run test:core-constitution`
5. `ROLE2_CORE_CONSTITUTION_DELIVERY_REPORT.md`

## 2. Changed files

### `CORE_CONSTITUTION.md`

Adds the normative MBG Core v0.1 constitution:

- authority boundary;
- kernel trust states;
- core terms;
- fifteen non-negotiable kernel laws;
- current/future module references per law;
- review rule;
- open questions.

Integration note included for Role 3 / Cold Start Unknown:

> Before Cold Start Unknown, PR35 started from `flat + clear`; in MBG Core v0.1 this is corrected to `unknown + blocked`.

### `core/kernel/kernel-constitution.ts`

Adds machine-readable constants for:

- `KERNEL_TRUST_STATE`;
- `KERNEL_AUTHORITY_EXCLUSION`;
- `CORE_LAW_ID`;
- `CORE_LAWS`;
- `CORE_REVIEW_RULE`.

This file is intentionally declarative. It does not change runtime behavior.

### `tests/scenarios/core-constitution.test.mjs`

Adds dependency-free Node.js checks that validate:

- all 15 law ids exist in the markdown document and constants file;
- all required kernel trust states exist;
- all required law phrases exist;
- required current/future module references exist;
- forbidden authority claims are not introduced;
- `CORE_LAWS` and `CORE_REVIEW_RULE` are exported.

### `package.json`

Adds one npm script:

```json
"test:core-constitution": "node tests/scenarios/core-constitution.test.mjs"
```

No existing scripts were removed or changed.

## 3. Added/changed npm scripts

Added:

```bash
npm run test:core-constitution
```

No other npm script was intentionally modified.

## 4. Verification commands and results

### Command

```bash
npm run test:core-constitution
```

### Result

```text
> genesis-v1-pr30-1-real-market-chaos-suite@1.0.1 test:core-constitution
> node tests/scenarios/core-constitution.test.mjs

✅ Core Constitution checks passed
```

### Direct command

```bash
node tests/scenarios/core-constitution.test.mjs
```

### Result

```text
✅ Core Constitution checks passed
```

## 5. Risks and limitations

1. This delivery is normative and declarative. It does not enforce the laws at runtime by itself.
2. Several module references are marked as future because the corresponding Trust Kernel components are expected from other task cards:
   - `core/kernel/kernel-authority.ts`;
   - `core/trust/core-trust-report.ts`;
   - event envelope validator;
   - replay verifier;
   - idempotency index.
3. `core/kernel/kernel-constitution.ts` exports constants but is not yet wired into reducers, gates, journal validation, replay, or runtime startup.
4. `CORE_CONSTITUTION.md` references existing PR35 modules where possible, but Role 8 may need to adjust paths after clean package integration.
5. The test checks textual and constant-level completeness. It does not prove runtime enforcement.

## 6. Intentionally not done

1. Did not connect V1.
2. Did not modify strategies.
3. Did not add Signal Layer.
4. Did not add Decision Engine.
5. Did not add UI.
6. Did not add trading logic.
7. Did not alter runtime startup behavior.
8. Did not implement Cold Start Unknown; this belongs to Role 3.
9. Did not implement replay verification.
10. Did not implement CoreTrustReport.
11. Did not implement event envelope validation.
12. Did not implement idempotency/deduplication.
13. Did not change ActionGate behavior.

## 7. Review principle preserved

The delivery strengthens provability by making the Trust Kernel laws explicit, testable at document/constant level, and mapped to current or future enforcement modules. It does not make the system more convenient by pretending unimplemented trust checks already exist.
