# GENESIS Research Methodology v1

**ID:** `GENESIS_RESEARCH_METHODOLOGY_v1`  
**Type:** Platform methodology (NOT an RFC)  
**Status:** `DRAFT_FOR_USE` under Owner ALLOW_RESEARCH  
**Production influence:** `NOT AUTHORIZED by this document`

## Purpose

Define one evidentiary path for any new knowledge — from book, article, observation, or experiment — before it can become part of the digital trader.

## Canonical cycle

```text
Book / article / idea / live observation
        ↓
Concept Registry
        ↓
Research Hypothesis
        ↓
Prototype (offline / offline-sim)
        ↓
Shadow Observation
        ↓
Impact Study
        ↓
Admission Review
        ↓
Production Rule   ← only after explicit Admission + separate code/runtime auth
```

## Stage contracts

### 1. Concept Registry
- Capture definition, class, sources, crowd exposure, commercialization level.
- Evidence class starts as `LITERATURE_CLAIM` or `INTERNAL_HYPOTHESIS`.
- `production_influence = false`.

### 2. Research Hypothesis
- Must state testable claim, required organs/data, falsifiers.
- Must declare look-ahead / overfitting / survivorship risks.
- Must not invent Scenario gates or LONG/SHORT rules.

### 3. Prototype
- Local/offline implementation or notebook-grade probe.
- No Producer / Decision wiring.
- Deterministic fixtures preferred.

### 4. Shadow Observation
- Read-only against GENESIS Frame / organ streams where available.
- No order intent, no Candidate authority.

### 5. Impact Study
- Compare with / without feature under declared windows and costs (fees/funding/slippage assumptions explicit).
- Report integrity failures separately from alpha narratives.

### 6. Admission Review
- Dual review as required by current GENESIS governance.
- Explicit reject / hold / admit.
- Literature alone cannot admit.

### 7. Production Rule
- Requires Admission **and** separate runtime/code authorization.
- RFC-0005 and later layers remain fenced until opened by Owner.

## Mapping onto existing foundations

| Layer | Role |
|---|---|
| `architecture/books` | Raw library + catalog |
| `architecture/books/knowledge_base` | Concepts, organ/family reverse maps, crowd map |
| `architecture/research_platform` | Methodology + Owner stamps |
| Cognitive Model / Organ Passports | Normative ask/observe contracts (unchanged by literature) |
| Backend / Brain / Runtime | Consume only admitted artifacts under separate auth |

## Reuse of algorithm literature (ALLOW_RESEARCH)

Allowed research questions:

- How to structure backtests
- How to fight overfitting
- How to design research pipelines
- How to validate hypotheses
- How to think about observer state/continuity
- How to evaluate model quality honestly

Forbidden by default:

- Copying vendor/book bot code into GENESIS runtime
- Treating encyclopedia strategies as edges
- Setting `production_influence=true` from books

## Commercial safety

- No full-book redistribution in research packages
- Short compliant notes / REFERENCE_ONLY citations
- Copyright status remains UNKNOWN until legal verification

## Final doctrine

```text
Литературная идея
  → исследовательская гипотеза
    → тест на данных GENESIS
      → статистика
        → Admission
          → только потом Production Rule
```

Never the reverse.

**СКАЛЬПЕЛЬ, НЕ ПЛАСТЫРЬ.**
