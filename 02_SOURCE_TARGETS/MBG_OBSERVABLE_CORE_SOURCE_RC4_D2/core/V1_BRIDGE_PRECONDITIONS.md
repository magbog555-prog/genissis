# V1 Bridge Preconditions

## Status

This document defines **preconditions for a future V1 bridge** into MBG Core v0.1.

This is **not** a V1 integration. It does not add V1 code, folders, adapters, UI, strategy logic, live trading, exchange keys, or automatic action execution.

The first V1 bridge is limited to **market observation**. V1 may become a provider of market data observations only after the conditions below are satisfied.

## Core Principle

V1 is first a **market observation provider**, not a decision authority.

V1 may submit observations about the market. It must not compute core trust, bypass ActionGate, create orders directly, or send strategy/decision/signal commands into the core.

The core trust chain remains:

```text
state snapshot + evidence
→ Kernel Authority
→ CoreTrustReport
→ ActionGate Verdict v2
→ Permission Ledger audit record
→ optional Recovery Planner recommendation
```

V1 may provide evidence. V1 does not own the trust conclusion.

## 1. What V1 May Send First

The first acceptable future input from V1 is a market observation event.

The initial bridge may allow V1 to provide:

- `market tick` — a market tick observation;
- `book ticker` — best bid / best ask observation;
- `source` / `provider` — the identity of the data source;
- `timestamp` — the observation timestamp;
- `sequence`, if available — source sequence number or monotonic ordering key;
- `freshness metadata` — information needed by Freshness Guard to determine whether the observation is fresh, stale, unknown, or invalid.

The first bridge must be read-only from the perspective of trading intent. It may only add validated market evidence into the core event path.

## 2. Events V1 May Produce

Future V1 bridge events must be explicitly scoped as observation events.

Permitted first-class future event categories:

```text
market.tick.observed
market.book_ticker.observed
```

A V1 market observation event should include at minimum:

```text
eventId
eventType
schemaVersion
timestamp
source
provider
symbol
observedAt
receivedAt
freshnessMetadata
```

If provided by the upstream source, it may also include:

```text
sequence
bid
ask
bidSize
askSize
lastPrice
volume
exchangeTimestamp
```

All fields must pass core event validation before the event is eligible for idempotency checks, journal append, reducer application, or trust evaluation.

## 3. Events V1 Must Not Produce

The first bridge must not allow V1 to produce any event that expresses intent, strategy, execution, or trust authority.

Forbidden first inputs include:

```text
signal
decision
order intention
strategy command
direct trade action
```

Forbidden future event categories for the first bridge include:

```text
signal.received
decision.proposed
decision.approved
order.intent.created
order.create.requested
order.submitted
trade.action.requested
strategy.command.received
kernel.trust.overridden
core.trust.set
permission.granted
```

If such an event appears through a future V1 bridge, it must be rejected before canonical journal append and before any state mutation.

## 4. Checks Before Accepting a V1 Event

A V1 event must pass the same core pipeline as every other external event. V1 does not receive a privileged path.

Required pre-acceptance checks:

1. **Schema validation** — the event must match an allowed core event schema.
2. **Source/provider validation** — `source` and `provider` must be present, explicit, and non-ambiguous.
3. **Event type allowlist** — the first bridge may only allow market observation event types.
4. **Timestamp validation** — required timestamps must be parseable, non-empty, and compatible with Freshness Guard.
5. **Freshness metadata validation** — enough metadata must exist to determine freshness or to mark freshness as unknown.
6. **Idempotency check** — duplicate `eventId` must not mutate state twice.
7. **Sequence/key idempotency**, if available — duplicate provider sequence/report keys must not create duplicate observations.
8. **Quarantine on bad data** — malformed or forbidden bridge input must not enter the canonical journal.
9. **No direct action execution** — accepted observations do not themselves create orders, decisions, or trade actions.
10. **Auditability** — rejects and permission decisions must remain explainable through diagnostics, Permission Ledger, Quarantine, or future audit artifacts as appropriate.

The intended event path is:

```text
V1 observation candidate
→ bridge boundary validation
→ core event validation
→ idempotency
→ canonical journal append
→ reducer, if accepted
→ Kernel Authority observes evidence
→ CoreTrustReport
→ ActionGate Verdict v2 for any requested action
```

## 5. Source and Provider Requirements

V1 must identify itself and the upstream data provider explicitly.

Recommended semantics:

```text
source = "v1_bridge"
provider = "<upstream-provider-name>"
```

If V1 aggregates multiple upstream feeds, it must not collapse them into an anonymous source. It must preserve the provider identity needed for audit, freshness, idempotency, and conflict diagnosis.

A valid future V1 observation should make it possible to answer:

```text
Who sent this event?
Which upstream provider produced the market data?
When was it observed?
When was it received by the core boundary?
What sequence or provider key identifies it, if any?
Can this observation be evaluated for freshness?
```

If those questions cannot be answered, the event must be rejected or marked insufficient according to the core validation and quarantine rules.

## 6. Freshness Requirements

V1 does not decide whether data is fresh enough for trading. V1 provides timestamps and metadata so the core Freshness Guard can decide.

V1 must provide:

```text
observedAt or exchangeTimestamp
receivedAt
provider
source
symbol
sequence, if available
freshnessMetadata
```

Freshness Guard remains the canonical evaluator for states such as:

```text
fresh
stale
unknown
conflicting
```

If V1 cannot provide enough timing information, the correct outcome is not fake freshness. The correct outcome is `unknown` or rejection, depending on the future event schema and core validator.

V1 must not convert unknown freshness to fresh. Unknown is safer than fake true.

## 7. Why V1 Does Not Compute Trust

Trust is computed by the MBG Core trust chain, not by V1.

V1 may supply market evidence. Kernel Authority evaluates the complete core evidence set and produces canonical trust state through CoreTrustReport.

V1 must not set or override:

```text
kernelTrustState
CoreTrustReport.trusted
exchangeTruth status
freshness status
health truth status
ActionGate allowed
```

Any future field from V1 claiming that the core is trusted must be ignored or rejected unless it is explicitly defined as raw provider metadata and not as a core trust conclusion.

## 8. Why V1 Does Not Bypass ActionGate

ActionGate is the only component that returns the action verdict.

V1 must not call trading execution directly, mark actions as allowed, or bypass the gate by producing a lower-level order/trade event.

The action path remains:

```text
requested action
→ ActionGate Verdict v2
→ Permission Ledger audit record
→ execution boundary only if allowed by the gate
```

A V1 observation may influence future evidence, but it cannot authorize an action.

## 9. Why V1 Does Not Create Orders Directly

The first bridge is not an execution bridge.

V1 must not create:

```text
order intent
order request
order submit
trade execution request
position mutation
PnL mutation
```

Orders require a future, separately approved action path that preserves:

```text
Kernel Authority
CoreTrustReport
ActionGate Verdict v2
Permission Ledger
Recovery/Quarantine safety rules
```

Direct order creation from V1 would violate the trust kernel boundary because it would mix observation with decision and execution.

## 10. Why the First Bridge Is Market Observation

Market observation is the safest first bridge because it introduces evidence without introducing intent.

It lets the core test future V1 connectivity while preserving all existing laws:

```text
V1 provides market facts.
Core validates events.
Freshness Guard evaluates staleness.
Kernel Authority evaluates trust.
ActionGate decides actions.
Permission Ledger records decisions.
No strategy, decision, signal, or order path is introduced.
```

This keeps V1 outside the decision loop until the core has proven that external observations can be validated, deduplicated, audited, and safely ignored when stale, unknown, malformed, or conflicting.

## Non-Goals for Wave 6

This document intentionally does not:

- connect V1;
- add V1 folders;
- add adapters;
- implement a bridge runtime;
- implement UI;
- add strategy logic;
- enable live trading;
- add real exchange keys;
- add new order paths;
- add Signal Layer;
- add Decision Engine;
- let V1 compute trust;
- let V1 bypass ActionGate.

## Acceptance Checklist for a Future V1 Bridge

A future V1 bridge may only be considered after these are true:

```text
[ ] V1 sends only allowlisted market observation events.
[ ] V1 includes explicit source/provider identity.
[ ] V1 includes timestamps and freshness metadata.
[ ] V1 events pass core event validation.
[ ] Duplicate eventId does not mutate state twice.
[ ] Duplicate provider sequence/report keys are safe, if present.
[ ] Invalid or forbidden V1 input is rejected or quarantined outside the canonical journal.
[ ] V1 never emits signal/decision/order/strategy/trade action events as first inputs.
[ ] V1 never sets kernelTrustState or CoreTrustReport.
[ ] V1 never bypasses ActionGate.
[ ] V1 never creates orders directly.
[ ] Permission Ledger can audit any resulting allow/deny decisions.
```

## Summary Law

```text
V1 may become a provider of market observations.
V1 must not become a provider of trust, decisions, strategy, permissions, or orders.
```
