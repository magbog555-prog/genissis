# OWNER SEAL — NEGATIVE one-sided OOS exam (after night cut)

```yaml
status: SEALED_OOS_QUESTION
date: 2026-08-17
pack: 107
plate: 157
after: morning remeasure cut 2026-08-17T04:53:48.945Z
```

Ночь отрезала вчерашний POSITIVE. NEGATIVE стал односторонним кандидатом.  
Старый корпус **больше не экзамен**. Library / SHORT / Direction **не** открыты.

```text
POSITIVE directional claim = REJECTED_FOR_NOW
NEGATIVE directional claim = PROMISING_ONE_SIDED_CONTEXT_EVIDENCE
Direction = CLOSED
SHORT = NOT OPEN
Library = NOT OPEN
thresholds = FROZEN
```

## Development (used up)

```text
DEVELOPMENT_CUT = 2026-08-17T04:53:48.945Z
unique T <= cut = 27335
oriented T = 200
POSITIVE n_T = 143   future DOWN 63.1 vs UP 61.2  → claim dead
NEGATIVE n_T = 57    P(DOWN|NEGATIVE)=0.726 vs base 0.414
```

Эти 57 NEGATIVE = development evidence. Ими нельзя доказывать свежую одностороннюю гипотезу.

## Fresh OOS (named now, wall-clock STOP)

```text
BUFFER unused (not development, not exam):
  DEVELOPMENT_CUT < T < 2026-08-17T06:00:00.000Z

OOS_EXAM:
  2026-08-17T06:00:00.000Z  inclusive
  2026-08-17T16:00:00.000Z  exclusive

STOP = 16:00Z regardless of n
no new N-threshold
no extend-if-empty
```

Час 05Z сейчас пишется — в экзамен не входит (firewall).

## Killer question

На unique T внутри OOS, той же frozen таблицей:

> Сохраняется ли у `NEGATIVE_ORIENTED_GEOMETRY` enrichment будущего DOWN
> относительно **contemporaneous** base rate того же OOS-окна?

```text
P(DOWN | NEGATIVE, resolved, OOS)
  > P(DOWN | all unique T, resolved, OOS)
```

Вчерашние 41% / 73% в экзамен не переносятся.

## Exam codes (pinned before OOS ends)

```text
NO_EXAM_MATERIAL = zero NEGATIVE T in the named window
REPEAT           = NEGATIVE present AND enrichment vs OOS base
FAIL             = NEGATIVE present AND no enrichment

READY_FOR_LIBRARY_AUDIT = YES iff REPEAT
if FAIL: NEGATIVE as Direction evidence = CLOSED
if NO_EXAM_MATERIAL: do not auto-extend; Owner names the next session after STOP
```

POSITIVE в OOS можно показать как diagnostic, не как pass-условие.

## Unmoved

```text
20s · 12/15 · 10m G · MAD 0.25 · |mean(G)| 0.50
H=30m · origin=R · ε=10bps
POSITIVE ≠ LONG · NEGATIVE ≠ SHORT
PAPER_DISTANCE=10 · capital 0% · R:R N/A
KEEP RUNNING
```
