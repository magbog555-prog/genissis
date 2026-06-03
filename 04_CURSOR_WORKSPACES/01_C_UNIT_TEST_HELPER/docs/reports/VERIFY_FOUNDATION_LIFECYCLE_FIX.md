# VERIFY FOUNDATION LIFECYCLE FIX

| Field | Value |
|-------|--------|
| **Deliverable** | O-06 (D-10) |
| **Author** | Agent 01 — Foundation Lead |
| **Date** | 2026-06-01 |
| **Status** | **DOCUMENTED** — Sprint 2 verify aggregate does not spawn servers |

---

## 0. Problem (Sprint 1 gap)

Foundation `verify:*` scripts and MBG scenarios may **start HTTP servers** without guaranteed teardown → **ghost processes** on developer machines (EM-018 / Notary NEGATIVE_CI).

---

## 1. Sprint 2 policy

| Rule | Implementation |
|------|----------------|
| **No server in aggregate** | `verify-foundation.mjs` runs scanners + build + bundle scan + entrypoint check only |
| **Read-only scans** | `scan-routes`, `scan-imports`, `scan-env` — file walk, no `listen()` |
| **Build/scan** | Copy + regex scan — no network |
| **Long-running dev** | Only via explicit `scripts/dev-readonly-safe.ps1` — **outside** `verify:foundation` |

---

## 2. Operator / CI guidance

```text
npm run verify:foundation   # safe — no servers
.\scripts\dev-readonly-safe.ps1   # starts readonly-api — operator must Ctrl+C
```

**CI:** use `verify:foundation` only; do not chain `npm run dev` in same job without job teardown.

---

## 3. Future work (if Owner GO)

- Wrap MBG `verify:readonly-surface` with spawn timeout + `taskkill` / PID file on Windows  
- Add `verify:readonly-surface:ci` in Foundation workspace that runs healthcheck + guaranteed teardown  

Not implemented in Sprint 2 pass 1 — documented to avoid false “CI complete” claim.

---

## 4. Verdict

```text
GHOST PROCESS RISK IN AGGREGATE:  MITIGATED (no spawn in verify:foundation)
MBG SCENARIO SERVERS:            OUT OF SCOPE — explicit scripts only
NOTARY GREEN:                    NOT CLAIMED
```

---

*Does not modify MBG verify scripts.*
