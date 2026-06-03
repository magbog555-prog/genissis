# Portable paths (P0.1)

| Variable | Purpose | Default |
|----------|---------|---------|
| `GENESIS_ROOT` | Repository root | Two levels above this workspace |
| `SOURCE_TARGET_ROOT` | MBG read-only source target | `$GENESIS_ROOT/02_SOURCE_TARGETS/MBG_OBSERVABLE_CORE_SOURCE_RC4_D2` |

All verification scripts resolve paths via `genesis-paths.mjs`.

Example (PowerShell):

```powershell
$env:GENESIS_ROOT = "E:\clone\genessis"
$env:SOURCE_TARGET_ROOT = "$env:GENESIS_ROOT\02_SOURCE_TARGETS\MBG_OBSERVABLE_CORE_SOURCE_RC4_D2"
npm run verify:foundation
```
