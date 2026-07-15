# CURSOR TASK — GENESIS TRADER KNOWLEDGE BASE & REVERSE ARCHITECTURE MAP v1

**Task ID:** `GENESIS-KNOWLEDGE-BASE-REVERSE-MAP-v1`  
**Mode:** `LIBRARY RESEARCH / KNOWLEDGE ENGINEERING`  
**Repository source of truth:** `D:\genessis`  
**Library source of truth:** `D:\genessis\architecture\books`  
**Primary output:** official knowledge base of the digital trader  
**Trading code changes:** `FORBIDDEN`  
**Producer / C7 / MW1 / Brain / Risk / Execution changes:** `FORBIDDEN`  
**RFC-0005:** `NOT OPEN`  
**Long live runs:** `NOT AUTHORIZED`

---

# 0. Mission

Transform the existing books library from a human-oriented PDF archive into a structured, traceable and commercially safe knowledge base for GENESIS.

The output must answer in reverse:

```text
GENESIS organ / thinking family / future scenario
→ what market questions it asks
→ what concepts support those questions
→ which books / chapters / authors support those concepts
→ what is common public knowledge
→ what is crowded / widely known
→ what can become an algorithmic hypothesis
→ what must be tested before becoming a system rule
```

The knowledge base must support two parallel purposes:

1. **Engineering support**
   - help build organs 5–15;
   - help build thinking families;
   - reveal reusable formulas, algorithms, bot architectures and research methods.

2. **Trader cognition**
   - become the future educational memory of the digital trader;
   - allow GENESIS to understand the theoretical origin of each market concept;
   - preserve the difference between market observation, public doctrine, hypothesis and proven internal edge.

---

# 1. Critical commercial and legal boundary

Most books are copyrighted commercial works.

The system must not:

- redistribute full books;
- copy long passages;
- publish extracted chapters;
- expose copyrighted text in product UI;
- train or fine-tune a commercial model on full copyrighted works without legal approval;
- claim ownership of public concepts;
- reproduce proprietary formulas verbatim when licensing is unclear.

The system may:

- store local metadata;
- store short compliant quotations where legally allowed;
- create original summaries;
- create concept maps;
- create citations to book/page/chapter;
- extract general ideas and hypotheses;
- compare public concepts with internal evidence;
- create independently implemented algorithms based on publicly described methods;
- preserve source provenance.

Mandatory doctrine:

```text
BOOK KNOWLEDGE
≠ PROVEN EDGE
≠ PRODUCTION RULE
```

A public trading concept is only a research prior.

---

# 2. Commercial-awareness law

The knowledge base must explicitly track that public information is available to many market participants.

For every concept, add:

```text
crowd_exposure:
  LOW
  MEDIUM
  HIGH
  VERY_HIGH
  UNKNOWN
```

And:

```text
commercialization_level:
  ACADEMIC
  PROFESSIONAL
  RETAIL_MAINSTREAM
  VENDOR_POPULAR
  UNKNOWN
```

Interpretation:

- a concept widely described in retail literature may still be useful as market context;
- it must not automatically be treated as an edge;
- its value may come from:
  - better timing;
  - superior data;
  - execution;
  - cross-organ confirmation;
  - regime filtering;
  - risk discipline;
  - faster or more honest implementation;
  - understanding how the crowd acts on the same concept.

Add for each concept:

```text
crowd_behavior_implication
possible_crowding_risk
possible_second_order_use
```

Example:

```text
Public breakout doctrine:
  crowd behavior:
    many traders place stop entries above visible levels

  second-order use:
    study liquidity concentration, false breakouts,
    sweep behavior and post-break execution
```

The goal is not to reject popular knowledge.

The goal is to understand:

```text
what the crowd knows
what the crowd expects
where the crowd acts
how that changes order flow
```

---

# 3. Existing inputs

Use:

```text
D:\genessis\architecture\books\README.md
D:\genessis\architecture\books\catalog\library.json
D:\genessis\architecture\books\catalog\library.csv
D:\genessis\architecture\books\catalog\ARCHITECT_MAP.md
```

Preserve the existing library taxonomy and catalog.

Do not rename or move books in this task unless a separate correction manifest is produced and Owner approves it.

---

# 4. Required top-level outputs

Create:

```text
D:\genessis\architecture\books\knowledge_base\
```

With:

```text
00_governance/
01_sources/
02_concepts/
03_organs/
04_thinking_families/
05_algorithms_bots/
06_research_hypotheses/
07_crowd_map/
08_evidence_and_citations/
09_tools_and_automation/
10_reports/
```

Main deliverables:

```text
GENESIS_KNOWLEDGE_BASE_CHARTER_v1.md
GENESIS_REVERSE_ARCHITECTURE_MAP_v1.md
GENESIS_ORGAN_KNOWLEDGE_MAP_v1.md
GENESIS_THINKING_FAMILY_KNOWLEDGE_MAP_v1.md
GENESIS_ALGORITHMS_AND_BOTS_REUSE_REPORT_v1.md
GENESIS_CROWD_KNOWLEDGE_AND_SECOND_ORDER_MAP_v1.md
GENESIS_KNOWLEDGE_GAPS_REPORT_v1.md
GENESIS_LIBRARY_PRIORITY_READING_v1.md
```

Machine-readable outputs:

```text
knowledge_sources.json
knowledge_concepts.json
organ_knowledge_links.json
thinking_family_knowledge_links.json
algorithm_candidates.json
research_hypotheses.json
crowd_exposure_map.json
citation_index.json
```

---

# 5. Source registry

For every book create or enrich a source record:

```json
{
  "source_id": "B042",
  "author": "",
  "title": "",
  "category": "",
  "relative_path": "",
  "format": "pdf",
  "language": "",
  "copyright_status": "UNKNOWN",
  "commercial_source": true,
  "text_extractable": true,
  "ocr_required": false,
  "core_priority": "P1|P2|P3|REFERENCE",
  "relevance": {
    "organs": [],
    "thinking_families": [],
    "algorithms": [],
    "risk": [],
    "research": []
  },
  "crowd_exposure": "LOW|MEDIUM|HIGH|VERY_HIGH|UNKNOWN",
  "notes": ""
}
```

Do not invent copyright status.

Use `UNKNOWN` where not verified.

---

# 6. Concept registry

Create a canonical concept schema:

```json
{
  "concept_id": "KC-...",
  "name_ru": "",
  "name_en": "",
  "definition_original": "",
  "concept_class": "OBSERVATION|INTERPRETATION|METHOD|RISK|EXECUTION|RESEARCH|PSYCHOLOGY",
  "source_refs": [
    {
      "source_id": "",
      "chapter": "",
      "page": "",
      "citation_type": "SUMMARY|SHORT_QUOTE|REFERENCE_ONLY"
    }
  ],
  "related_organs": [],
  "related_families": [],
  "algorithmizable": true,
  "required_data": [],
  "crowd_exposure": "",
  "commercialization_level": "",
  "known_limitations": [],
  "contradictions": [],
  "internal_status": "LITERATURE_ONLY|RESEARCH_CANDIDATE|TESTED|REJECTED|ADMITTED",
  "production_influence": false
}
```

Key rule:

```text
No concept enters production influence from literature alone.
```

---

# 7. Reverse map by 15 organs

Build one detailed knowledge dossier for each organ:

```text
03_organs/01_chart_price_structure.md
03_organs/02_dom_order_book.md
03_organs/03_tape_executed_trades.md
03_organs/04_spread_entry_cost.md
03_organs/05_volatility.md
03_organs/06_liquidity.md
03_organs/07_tempo.md
03_organs/08_impulse_quality.md
03_organs/09_market_context.md
03_organs/10_exhaustion.md
03_organs/11_correlation.md
03_organs/12_news_events.md
03_organs/13_funding.md
03_organs/14_open_interest.md
03_organs/15_session_profile.md
```

For every organ include:

```text
1. Purpose
2. Market question
3. What it observes
4. What it must not infer
5. Primary data
6. Derived data
7. Time horizon
8. Dependencies
9. Public literature concepts
10. Relevant books
11. Algorithms/formulas found
12. Bot implementations found
13. Crowd exposure
14. Typical retail interpretation
15. Possible second-order use
16. Research hypotheses
17. Required tests
18. Known contradictions in literature
19. Internal GENESIS contracts
20. Gaps
```

Mandatory examples:

## DOM

Separate:

```text
visible liquidity
replenishment
queue behavior
book imbalance
```

from:

```text
absorption
```

Absorption requires cross-organ relation with Tape.

## Spread

Separate:

```text
quoted entry cost
```

from:

```text
slippage
market impact
```

These belong to liquidity/execution modeling.

## Tempo

Document whether formulas derive from:

```text
Tape
DOM update rate
candle formation
```

And mark shared-source dependency.

## Market Context

Treat as integrative.

List every dependency.

---

# 8. Reverse map by 8 thinking families

Create:

```text
04_thinking_families/01_trend_continuation.md
04_thinking_families/02_reversal.md
04_thinking_families/03_breakout.md
04_thinking_families/04_liquidity_sweep.md
04_thinking_families/05_return_to_range.md
04_thinking_families/06_news_impulse_mode.md
04_thinking_families/07_session_open.md
04_thinking_families/08_manipulation_false_breakout.md
```

For each family include:

```text
1. Cognitive purpose
2. Market questions
3. Required analysis domains
4. Supporting organs
5. Contextual organs
6. Optional research organs
7. Public literature basis
8. Known retail doctrine
9. Crowd behavior created by that doctrine
10. Common traps
11. Contradictory schools
12. Candidate algorithms
13. Data requirements
14. Time-horizon requirements
15. Research hypotheses
16. No-trade / insufficient-evidence conditions
17. What is NOT a scenario yet
18. What future scenario contracts would need
```

Use role classes:

```text
ANALYSIS_REQUIRED
ANALYSIS_SUPPORTING
CONTEXTUAL
OPTIONAL_RESEARCH
```

Do not create LONG/SHORT rules.

Do not create scenario gates.

---

# 9. Special priority: algorithms, bots and system-building books

This is a dedicated workstream.

Search the catalog for:

```text
algorithm
bot
robot
automated
system
programming
machine learning
data mining
backtest
optimization
portfolio
execution
market microstructure
order book
high frequency
statistical
quantitative
```

Prioritize:

```text
Pardo
Kurguzkin
Katz
LeBeau & Lucas
Lopez de Prado
Data Mining
programming/quant books
bot/automation materials
```

Create:

```text
05_algorithms_bots/ALGORITHM_SOURCE_INVENTORY.md
05_algorithms_bots/BOT_ARCHITECTURE_REUSE_MATRIX.md
05_algorithms_bots/RESEARCH_METHODS_REUSE_MATRIX.md
05_algorithms_bots/ANTI_PATTERNS_AND_OBSOLETE_METHODS.md
```

For every algorithmic source extract:

```text
problem solved
required inputs
formula or pseudocode summary
assumptions
time complexity if relevant
state/memory requirements
backtest method
look-ahead risk
survivorship risk
overfitting risk
execution assumptions
market-specific limitations
possible GENESIS reuse
current relevance
obsolete elements
```

Do not directly copy old bot code into GENESIS.

Classify reuse:

```text
REUSE_CONCEPT
REUSE_RESEARCH_METHOD
REUSE_DATA_MODEL
REUSE_TEST_METHOD
ADAPT_WITH_REVIEW
DO_NOT_REUSE
```

---

# 10. Immediate engineering value report

Create:

```text
05_algorithms_bots/WHAT_CAN_HELP_GENESIS_NOW_v1.md
```

The report must answer:

```text
1. Which library methods can help current Sensory Rollout?
2. Which methods can help define Volatility organ?
3. Which methods can help Liquidity organ?
4. Which methods can help Tempo organ?
5. Which methods can help observer continuity and state?
6. Which methods can help backtesting and admission?
7. Which methods can help avoid overfitting?
8. Which methods can help later execution?
9. Which methods are outdated or unsuitable for crypto microstructure?
10. Which methods require data GENESIS does not yet possess?
```

Output must distinguish:

```text
USE NOW
USE DURING ORGAN DESIGN
USE DURING RESEARCH
USE LATER
DO NOT USE
```

---

# 11. Crowd knowledge map

Create:

```text
07_crowd_map/GENESIS_CROWD_KNOWLEDGE_MAP_v1.md
```

For major public concepts:

```text
support/resistance
breakout
moving averages
RSI
candlesticks
Elliott
Fibonacci
Wyckoff
VSA
Market Profile
order-book imbalance
funding extremes
open-interest growth
news breakout
session opening range
```

Document:

```text
how widely known
how retail applies it
where crowd orders may cluster
what false certainty it creates
what market microstructure may result
how GENESIS may use it as context
what cannot be assumed
```

Key doctrine:

```text
Public knowledge can be useful as a map of participant behavior,
not necessarily as direct edge.
```

---

# 12. Evidence classes

Every extracted statement must have one class:

```text
LITERATURE_CLAIM
MULTI_SOURCE_CONSENSUS
CONTRADICTED_IN_LITERATURE
INTERNAL_HYPOTHESIS
INTERNAL_TESTED_RESULT
INTERNAL_ADMITTED_RULE
```

Never merge these classes.

Example:

```text
“Volume confirms price”
```

must remain:

```text
LITERATURE_CLAIM
```

until tested under GENESIS data and contracts.

---

# 13. Conflict map

Create:

```text
02_concepts/LITERATURE_CONTRADICTIONS.md
```

Examples:

```text
trend following vs mean reversion
efficient markets vs behavioral inefficiency
Elliott determinism vs probabilistic modeling
fixed patterns vs regime dependence
indicator confirmation vs microstructure evidence
discretionary interpretation vs deterministic rules
```

For every contradiction:

```text
school A
school B
shared assumptions
different assumptions
which data could adjudicate
what GENESIS should not hardcode
research path
```

---

# 14. Reading priority

Create a practical reading order.

## Priority 1 — Core now

Expected candidates:

```text
Dalton
Wyckoff
Tom Williams
Pardo
Kurguzkin
Vince
Grant
Taleb
Lopez de Prado
```

## Priority 2 — Organ design

Examples:

```text
LeBeau & Lucas
volatility books
derivatives/options books
order-book/microstructure sources
```

## Priority 3 — Context modules

```text
Murphy
Schwager TA
Nison
macro
crypto
session/profile
```

## Priority 4 — Historical/cultural only

```text
market wizards
biographies
fiction-like books
retail compilations
```

For each selected book:

```text
why read
what to extract
which organ/family benefits
what not to copy
```

---

# 15. Unknown scan

`Ispoved.pdf` remains unidentified.

Do not OCR unless necessary.

Create:

```text
01_sources/UNIDENTIFIED_SOURCE_REPORT.md
```

Include:

```text
path
page count
file size
available metadata
manual-review requirement
possible category
status
```

Do not guess title or author.

---

# 16. Automation

Create or extend tools under:

```text
D:\genessis\architecture\books\catalog\
```

Allowed tools:

```text
build-knowledge-index.py
validate-knowledge-links.py
export-organ-map.py
export-family-map.py
search-knowledge.ps1
```

Requirements:

- no internet dependency;
- no modification of source PDFs;
- deterministic output;
- UTF-8;
- stable IDs;
- validation of missing paths;
- duplicate concept detection;
- broken citation detection;
- no secret collection;
- no full-text redistribution.

---

# 17. Validation rules

Build validators for:

```text
every concept has source or INTERNAL_HYPOTHESIS status
every source path exists
every organ link points to valid organ
every family link points to valid family
every citation has source_id
no production_influence=true from literature-only source
no copyrighted long quote
no duplicate concept_id
no broken file path
no secret/token pattern
```

---

# 18. Required reports

Create:

```text
10_reports/GENESIS_KNOWLEDGE_BASE_COMPLETION_REPORT_v1.md
10_reports/GENESIS_KNOWLEDGE_BASE_GAPS_v1.md
10_reports/GENESIS_LIBRARY_COMMERCIAL_SAFETY_REPORT_v1.md
10_reports/GENESIS_ALGORITHMIC_REUSE_PRIORITY_v1.md
10_reports/GENESIS_ORGAN_AND_FAMILY_COVERAGE_MATRIX_v1.md
```

Coverage matrix:

```text
organ/family
sources count
concepts count
algorithm candidates
contradictions
crowd exposure
research readiness
gaps
```

---

# 19. Package

Deliver:

```text
D:\genessis\architecture\handoff\
GENESIS_TRADER_KNOWLEDGE_BASE_DISCOVERY_AND_REVERSE_MAP_v1.zip
```

Root files:

```text
README.md
MANIFEST.md
CHECKSUMS.sha256
EXECUTIVE_SUMMARY.md
OWNER_DECISION_CARD.md
```

Include:

- all new knowledge-base files;
- tools;
- validation outputs;
- source index;
- reports;
- no books/PDFs themselves;
- no copyrighted full text;
- no secrets.

---

# 20. Owner decision card

Create:

```text
OWNER_DECISION

GENESIS_KNOWLEDGE_BASE_v1:
  ACCEPT | REWORK | HOLD

REVERSE_ORGAN_MAP:
  ACCEPT | REWORK | HOLD

REVERSE_THINKING_FAMILY_MAP:
  ACCEPT | REWORK | HOLD

ALGORITHMS_AND_BOTS_REUSE:
  ALLOW_RESEARCH | HOLD

COMMERCIAL_SAFETY:
  PASS | REWORK

PRODUCTION_INFLUENCE:
  NOT AUTHORIZED
```

---

# 21. Hard prohibitions

Do not:

- modify trading code;
- open RFC-0005;
- create scenarios;
- create LONG/SHORT rules;
- change Cognitive Model;
- change Organ passports;
- add production thresholds;
- claim literature as proof;
- train a model on full books;
- publish copyrighted text;
- delete books without manifest and Owner approval;
- fabricate page references;
- fabricate algorithms;
- treat popular concepts as edge.

---

# 22. Final success condition

The task succeeds when GENESIS has:

```text
one source registry
one concept registry
one reverse map by 15 organs
one reverse map by 8 thinking families
one algorithm/bot reuse inventory
one crowd knowledge map
one contradiction map
one research-hypothesis queue
one commercial-safety boundary
```

Final doctrine:

> The library must teach GENESIS what the market literature says, what the crowd likely believes, what can be formalized, and what still requires independent proof.

**СКАЛЬПЕЛЬ, НЕ ПЛАСТЫРЬ.**
