"""W1-4 Compression → Expansion (direction-neutral) — WAVE-0 stub.

Law: must never require or emit LONG/SHORT product fields.
"""

from __future__ import annotations

from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.scenario.binding import FASBinding
from app.terminal.cognitive_shadow.scenario.evaluate import Wave0EvalOutcome, wave0_stub_evaluate
from app.terminal.cognitive_shadow.scenario.vocabulary import Wave1Target

# Explicit: W1-4 product surface has no directional trade fields.
W1_4_FORBIDDEN_PRODUCT_FIELDS: frozenset[str] = frozenset(
    {"LONG", "SHORT", "long", "short", "long_short", "side", "entry", "stop", "2R"}
)


def evaluate_w1_4(*, fas: FamilyAssessmentSetV1, binding: FASBinding) -> Wave0EvalOutcome:
    """Direction-neutral stub — silence (0 hypotheses) rather than directional prophecy."""
    outcome = wave0_stub_evaluate(wave1_target=Wave1Target.W1_4, fas=fas, binding=binding)
    for h in outcome.hypotheses:
        keys = set(str(k).lower() for k in h.path_claim.keys())
        if keys & {f.lower() for f in W1_4_FORBIDDEN_PRODUCT_FIELDS}:
            raise AssertionError("W1-4 must not carry LONG/SHORT product fields")
    return outcome
