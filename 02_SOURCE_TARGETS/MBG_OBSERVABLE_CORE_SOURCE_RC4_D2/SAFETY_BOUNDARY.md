# SAFETY_BOUNDARY

## Operator mantra

**NO PROOF → NO ALLOW**

## Hard boundaries (this workspace / readonly surface)

| Rule | Meaning |
|------|--------|
| **OBSERVE_ONLY** | UI and API are for observation and audit, not live execution control. |
| **READ_ONLY** | No state-changing HTTP surface on the readonly core app. |
| **NO EXECUTION** | No execution/trading controls in the RC4 operator UI contract. |
| **NO ORDERS** | No order placement or cancel paths on the readonly API. |
| **NO API KEYS** | No API keys shipped or required for the readonly demo path. |
| **NO SIGNED ENDPOINTS** | No signed exchange calls on the readonly operator surface. |
| **NO AUTO RECOVERY** | No autonomous recovery that could change trading posture without explicit out-of-band policy (not exposed here). |

## Semantic invariants (verification targets)

- `executionSurface` remains **closed** in observe-only scenarios presented to the operator UI.
- `actionVerdict` / gate posture remains **prohibited** when exchange proof is absent (see trace DTOs and runtime snapshot normalizer — **do not relax** without a new safety phase).
- **Trust** must not read as **TRUSTED** without exchange proof in the canonical read model for this product line.
- **Live connected ≠ trusted** — WebSocket or REST “connected” is not permission to trade.
- **Fresh market data ≠ permission** — tick freshness is not exchange proof.
- Dangerous **POST** routes on the readonly surface stay **closed** (404/405).
- **readOnly: true** on live-stream DTO defaults where applicable.

## RC4 lineage

RC4-D does **not** change RC4-A/B/C safety logic; it adds verification, documentation, and acceptance packaging only.
