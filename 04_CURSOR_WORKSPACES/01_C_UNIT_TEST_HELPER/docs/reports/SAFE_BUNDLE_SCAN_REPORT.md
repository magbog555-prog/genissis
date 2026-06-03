# SAFE Bundle Scan Report — Sprint 2 v2

| Field | Value |
|-------|--------|
| **Date** | 2026-06-01 |
| **Artifact** | genesis-safe-readonly v1.0.0-sprint2 |
| **Tier** | OPERATOR |
| **Build** | 44 files (32 import closure + manifest includes) |
| **Scan tool** | scan-safe-bundle.mjs v2 (import-path aware) |
| **Machine output** | `reports/safe-bundle-scan.json` |

---

## Result summary

| Metric | v1 baseline | v2 (this run) |
|--------|-------------|---------------|
| Staged files | 32 | **44** |
| RED (blocking) | 2 | **0** |
| WARN | 22 | 23 |
| **Pass (RED gate)** | false | **true** |

---

## RED resolution (D-01)

Previous RED on `normalize-runtime-snapshot.ts` and `computation-trace-dto.ts` were **DTO string literals** (`binance`, `binance-like`) — not exchange module imports. Scan v2 classifies as `DTO_STRING_LITERAL` WARN.

See `DONOR_COUPLING_REGISTER_SPRINT2.md` §3.

---

## WARN interpretation (expected)

- **DOC_REFERENCE** — normative markdown  
- **NORMATIVE_TEXT** — kernel constitution forbidden lists  
- **VERIFY_FIXTURE** — verify-readonly-surface.mjs  
- **DTO_STRING_LITERAL** — provider format vocabulary  
- **SUBSTRING_NON_IMPORT** — non-import mentions in constitution / scripts  

WARN does **not** block OPERATOR tier RED gate.

---

## Honest status

```text
Bundle scan RED gate:     PASS (redCount === 0)
Physical proof closed:    PARTIAL (closure 32 TS modules; not full transitive graph)
NOTARY GREEN:             NOT CLAIMED
Sprint 2 CI injection:    PENDING (CI_NEGATIVE_PROOF.md)
```

---

*Does not modify Sprint 1 reports.*
