# Canonical Audit Checklist — MBG Core v0.1 alpha5

Role: 7 — Scenario Audit / Test Owner

Canonical base: `mbg-core-v0.1-alpha5`

Purpose: provide a canonical audit checklist for the alpha5/alpha5.1 package before any next-wave work begins.

This checklist is intentionally structural. It verifies package boundaries, expected Wave 1–5 surfaces, scripts, documents, and archive hygiene. It does not change runtime behavior and does not implement runtime architecture.

## Pass / fail checklist

| # | Check | Expected evidence |
|---:|---|---|
| 1 | No V1 inside the active core runtime | No V1 package/module is wired into package scripts or active runtime entry points. Historical text references are allowed only in reports/docs. |
| 2 | No V2 inside the active core runtime | No V2 package/module is wired into package scripts or active runtime entry points. Historical text references are allowed only in reports/docs. |
| 3 | No UI | No UI app/package is present or wired into scripts. |
| 4 | No strategy logic in active defaults | No strategy script/default runtime action is exposed by `package.json`. Any legacy/historical files must remain outside canonical trading authority. |
| 5 | No live trading defaults | No default script enables live trading or real order execution. |
| 6 | No `.env` with keys | No `.env`, `.env.local`, `.env.production`, or similar secret-bearing files are present in the package. |
| 7 | CoreTrustReport exists | `core/kernel/core-trust-report.ts` and `test:core:trust-report` exist. |
| 8 | Kernel Authority exists | `core/kernel/kernel-authority.ts` and `test:core:kernel-authority` exist. |
| 9 | ActionGate Verdict exists | `core/gates/src/action-gate.ts` and `test:core:action-gate-verdict` exist. |
| 10 | Recovery Planner exists | `core/recovery/recovery-planner.ts` and `test:core:recovery-planner` exist. |
| 11 | Quarantine exists | `core/quarantine/quarantine.ts` and `test:core:quarantine` exist. |
| 12 | Permission Ledger exists | `core/permissions/permission-ledger.ts` and `test:core:permission-ledger` exist. |
| 13 | ExchangeTruth exists | `test:core:exchange-truth` exists and ExchangeTruth delivery/integration documents are present. |
| 14 | Freshness Guard exists | `core/runtime/src/freshness.ts` and `test:core:freshness` exist. |
| 15 | HealthTruth exists | `test:core:health-truth` exists and Health Truth delivery/integration documents are present. |
| 16 | `package.json` description corresponds to alpha5 or alpha5.1 | Description contains `alpha5` or `alpha5.1`. |
| 17 | `npm run verify` exists | `scripts.verify` exists. |
| 18 | All key scripts exist | Core and Wave 2–5 scenario scripts exist. |
| 19 | No runtime data in archive except `.gitkeep` | `data/runtime` and `data/journal` contain no runtime artifacts other than `.gitkeep`. |
| 20 | Documents alpha1–alpha5 are present | Integration reports/patches and delivery reports for alpha1 through alpha5 are present. |

## Key scripts expected

```txt
verify
typecheck
test
test:core-constitution
test:core:cold-start
test:core:bootstrap
test:core:event-validation
test:core:idempotency
test:wave2:scenario-audit
test:core:exchange-truth
test:core:freshness
test:core:health-truth
test:wave3:scenario-audit
test:core:kernel-authority
test:core:trust-report
test:core:action-gate-verdict
test:wave4:scenario-audit
test:core:recovery-planner
test:core:quarantine
test:core:permission-ledger
test:wave5:scenario-audit
test:canonical-audit-checklist
```

## Audit command

```bash
npm run test:canonical-audit-checklist
```

## Interpretation

The automated test is deliberately not a full source-code security scanner. It checks stable package signals:

- file/module presence;
- script presence;
- forbidden default wiring;
- `.env`/secret file absence;
- runtime data hygiene;
- alpha1–alpha5 document presence.

Manual review is still required for any future change that reintroduces V1/V2, UI, strategy, live trading, real keys, or runtime mutation outside approved events.
