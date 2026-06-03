# SOURCE TARGET PREPARED REPORT

**Prepared:** 2026-05-31  
**Role:** Genesis Folder 0 Auditor & Clean Infrastructure Organizer  
**Purpose:** Prepare MBG Observable Core as a separate research target for Foundation Lead (C Unit Test Helper)

---

## 1. Source archive path

```
D:\GENESIS_FOUNDATION_CONTROL_PACK_QUARANTINE_V1\ZIP_ARCHIVES\MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D2_LAUNCH_PORT_PREFLIGHT_ACCEPTED.zip
```

**Note:** Archive copy was restored to quarantine from original `D:\0\` (quarantine copy was missing after prior session). Original at `D:\0\MBG_OBSERVABLE_CORE_WORKSPACE_RC4_D2_LAUNCH_PORT_PREFLIGHT_ACCEPTED.zip` was **not deleted**.

Archive size: ~7.0 MB (7,302,569 bytes).

---

## 2. Extracted target path

```
D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2
```

Extraction method: `Expand-Archive` (read-only unpack). No post-extract edits.

---

## 3. Top-level folder tree

```
D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\
├── core\                    (MBG core engine, apps, tests, patches)
├── frontend\                (operator UI, src, package.json)
├── docs\                    (runtime/audit contract docs)
├── scripts\                 (verify-*.mjs verification scripts)
├── launcher\                (START/STOP/VERIFY cmd launchers)
├── .env.example
├── README.md
├── START_HERE.md
├── RUNBOOK.md
├── SAFETY_BOUNDARY.md
├── BOOT_REPORT.md
├── OPERATOR_ACCEPTANCE_REPORT.md
├── API_CONTRACT.md
├── package.json
├── start-all.ps1 / stop-all.ps1 / verify-all.ps1
├── start-app.ps1 / start-core.ps1 / start-frontend.ps1
├── START_APP.cmd / STOP_APP.cmd
└── RC4_*_REPORT.md, SEMANTIC_HARDENING_REPORT.md, UX_DEBT.md, ...
```

---

## 4. Key files found

| Expected file | Status | Path |
|---|---|---|
| README.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\README.md` |
| START_HERE.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\START_HERE.md` |
| RUNBOOK.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\RUNBOOK.md` |
| SAFETY_BOUNDARY.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\SAFETY_BOUNDARY.md` |
| BOOT_REPORT.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\BOOT_REPORT.md` |
| OPERATOR_ACCEPTANCE_REPORT.md | **FOUND** | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2\OPERATOR_ACCEPTANCE_REPORT.md` |

Additional governance/acceptance docs at root: `API_CONTRACT.md`, `RC4_FINAL_ACCEPTANCE_REPORT.md`, multiple RC4 hotfix reports.

---

## 5. Key folders found

| Expected folder | Status | Notes |
|---|---|---|
| core | **FOUND** | Subdirs: `application`, `apps`, `core`, `data`, `engine`, `scripts`, `tests`; includes `CORE_CONSTITUTION.md`, integration patches |
| frontend | **FOUND** | Subdirs: `src`, `screenshots`; has own `package.json`, `package-lock.json` |
| docs | **FOUND** | 4 docs: self-truth audit, DTO normalization, RC4 backend contracts, runtime readmodel |
| scripts | **FOUND** | 14 `verify-*.mjs` scripts (not executed) |
| launcher | **FOUND** | 6 CMD launchers (START/STOP/VERIFY) |

---

## 6. Confirm no files modified

**Confirmed.** Only action performed was archive extraction. No file contents edited. No renames inside source target. `package.json` and lockfiles untouched.

---

## 7. Confirm no code executed

**Confirmed.** No npm install, no node scripts, no PS1/CMD launchers run, no Binance connection, no live bridge.

---

## 8. Confirm ready for Foundation Lead inventory

**YES**

Foundation Lead (C Unit Test Helper) can begin read-only inventory against:

```
D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2
```

Recommended first reads (per launch sequence):

1. `START_HERE.md`
2. `SAFETY_BOUNDARY.md`
3. `README.md` + `RUNBOOK.md`
4. `core\CORE_CONSTITUTION.md` (inside core tree)
5. `BOOT_REPORT.md` + `OPERATOR_ACCEPTANCE_REPORT.md`

Pointer from Control Pack:

```
D:\GENESIS_FOUNDATION_CONTROL_PACK_CLEAN_V1\11_FOUNDATION_OUTPUTS\SOURCE_TARGET_POINTER.md
```

---

## Separation model

| Layer | Path | Role |
|---|---|---|
| Raw chaos | `D:\0` | Untouched source archive of everything |
| Control Pack | `D:\GENESIS_FOUNDATION_CONTROL_PACK_CLEAN_V1` | Governance, roles, specs, starter packs |
| Source Target | `D:\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` | MBG engine to inspect |
| Quarantine | `D:\GENESIS_FOUNDATION_CONTROL_PACK_QUARANTINE_V1` | Archive preserved; not mixed with Control Pack |

---

*End of report.*
