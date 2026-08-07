"""W1-3 Failed Break / Return — WAVE-0 stub."""

from __future__ import annotations

from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.scenario.binding import FASBinding
from app.terminal.cognitive_shadow.scenario.evaluate import Wave0EvalOutcome, wave0_stub_evaluate
from app.terminal.cognitive_shadow.scenario.vocabulary import Wave1Target


def evaluate_w1_3(*, fas: FamilyAssessmentSetV1, binding: FASBinding) -> Wave0EvalOutcome:
    return wave0_stub_evaluate(wave1_target=Wave1Target.W1_3, fas=fas, binding=binding)
