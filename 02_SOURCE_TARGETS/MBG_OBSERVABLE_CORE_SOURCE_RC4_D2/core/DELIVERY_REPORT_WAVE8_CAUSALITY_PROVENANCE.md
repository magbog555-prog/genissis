# Delivery Report — Wave 8 / Role 5 — Provenance in CausalityTrace

## Base

Canonical base: `mbg-core-v0.1-alpha6.zip`

Work area: CausalityTrace / trace extensions / observability.

## Goal

Extend `CausalityTrace` so the trace explains provenance as part of the causal path:

```text
event
→ metadata/provenance
→ transition
→ changed domains
→ trust
→ verdict
```

## Changed files

```text
core/trace/causality-trace.ts
tests/scenarios/wave8-causality-provenance.ts
package.json
DELIVERY_REPORT_WAVE8_CAUSALITY_PROVENANCE.md
```

## Trace model extension

`CausalityTrace` now includes:

```text
provenanceChain
metadataEvents
originRef
parentProvenanceIds
provenanceCompleteness
provenanceTraceSummary
```

New supporting types:

```text
MetadataEventReference
ProvenanceChainLink
ProvenanceCompleteness
ProvenanceTraceSummary
ProvenanceCompletenessStatus
```

The trace builder extracts provenance from explicit build input and from event/payload metadata fields where present:

```text
event.metadataEvents
payload.metadataEvents
payload.metadata.events
payload.provenance.metadataEvents
payload.provenance.originRef
payload.provenance.parentProvenanceIds
```

Missing provenance is represented as a gap:

```text
provenanceCompleteness.status = "missing"
gaps = ["origin_ref_missing", "metadata_events_missing"]
```

It is not modeled as corruption.

## Example trace JSON

```json
{
  "traceId": "trace:af7be90b5638197591cb1376",
  "eventId": "wave8-market-with-provenance",
  "eventType": "market.tick.received",
  "originRef": "operator:intake:wave8",
  "parentProvenanceIds": ["prov:parent:root"],
  "metadataEvents": [
    {
      "eventId": "metadata.provenance.1",
      "eventType": "metadata.provenance.recorded",
      "source": "core",
      "timestamp": "2026-01-01T00:00:00.000Z",
      "schemaVersion": "v1",
      "metadataType": "action_provenance",
      "originRef": "operator:intake:wave8",
      "parentProvenanceIds": ["prov:parent:root"],
      "payloadHash": "51cfed56f03e056506a48cf6ce147c8fa69eabbb92561e16fbeba5d6814b654b"
    }
  ],
  "provenanceCompleteness": {
    "status": "complete",
    "originPresent": true,
    "metadataEventsPresent": true,
    "parentLinksPresent": true,
    "gaps": []
  },
  "provenanceTraceSummary": {
    "status": "complete",
    "summary": "provenance complete from operator:intake:wave8; metadata events=1; parents=1",
    "originRef": "operator:intake:wave8",
    "metadataEventCount": 1,
    "parentProvenanceCount": 1,
    "gaps": []
  }
}
```

## Tests added

```text
tests/scenarios/wave8-causality-provenance.ts
```

New script:

```text
npm run test:wave8:causality-provenance
```

Covered scenarios:

```text
metadata event appears in CausalityTrace
action provenance is visible in trace
missing provenance is visible as a gap, not corruption
parent provenance chain is displayed
trace remains deterministic
trace does not mutate state
trace summary is UI-readable / observable
```

## Tests run

```text
npm run typecheck
PASS

npm test
PASS

npm run test:wave8:causality-provenance
PASS
```

## Semantic notes

- Trace layer remains an audit artifact.
- Trace does not mutate snapshot.
- Trace does not write domain events.
- Trace does not call exchange.
- Trace does not compute trust independently.
- Trace displays provenance attached to the event/metadata context.
- Provenance gaps are observable and machine-readable, but unknown provenance is not corruption.
- Deterministic trace id generation includes provenance identifiers and metadata event ids, but excludes `generatedAt`.

## How a human sees provenance in the Observable Core Machine

A human can open the causality trace and read:

```text
which event was processed
which metadata/provenance records were involved
where the action originated
which parent provenance ids led to it
whether provenance is complete, partial, or missing
which domains changed
whether trust changed
whether blockers changed
which permission/quarantine/hash-chain records are linked
```

The short fields for machine/UI display are:

```text
provenanceTraceSummary.status
provenanceTraceSummary.summary
provenanceCompleteness.gaps
metadataEvents[]
provenanceChain[]
```

## Known limitations

- This role does not introduce the canonical Metadata-as-Events reducer or event contract.
- This role does not create a second provenance store.
- This role does not change reducer semantics.
- This role does not change ActionGate.
- This role does not connect UI.
- This role does not make trace the source of truth.
- This role does not repair missing provenance.
- Full cross-role semantic merge with the Wave 8 metadata event contract is left to Role 8.
