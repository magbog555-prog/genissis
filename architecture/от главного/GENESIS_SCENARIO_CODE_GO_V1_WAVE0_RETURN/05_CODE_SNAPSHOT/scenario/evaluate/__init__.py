"""CORE-4 WAVE-0 evaluator stubs — shared outcome type."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.scenario.binding import FASBinding, fas_has_semantic_anchor
from app.terminal.cognitive_shadow.scenario.honesty import (
    gap_for_target,
    honesty_gap_listed,
    honesty_not_applicable,
)
from app.terminal.cognitive_shadow.scenario.models import ScenarioHypothesis
from app.terminal.cognitive_shadow.scenario.vocabulary import Wave1Target


@dataclass(frozen=True)
class Wave0EvalOutcome:
    """WAVE-0 evaluator result: zero hypotheses + honest marker."""

    wave1_target: Wave1Target
    hypotheses: tuple[ScenarioHypothesis, ...]
    honesty: tuple[Mapping[str, Any], ...]

    def __post_init__(self) -> None:
        if self.hypotheses:
            raise ValueError("WAVE-0 stubs must not invent hypotheses")


def wave0_stub_evaluate(
    *,
    wave1_target: Wave1Target,
    fas: FamilyAssessmentSetV1,
    binding: FASBinding,
) -> Wave0EvalOutcome:
    """Honest WAVE-0 skeleton for one CORE-4 target.

    - No FAS semantic anchor → NOT_APPLICABLE + 0 hypotheses
    - Anchor present but detector not ready → GAP_LISTED + 0 hypotheses
    Never emits LONG/SHORT / entry / trade permission.
    """
    _ = binding  # formation-bound; stubs do not re-enter organs
    if not fas_has_semantic_anchor(fas):
        return Wave0EvalOutcome(
            wave1_target=wave1_target,
            hypotheses=(),
            honesty=(
                honesty_not_applicable(
                    wave1_target=wave1_target,
                    detail=(
                        f"{wave1_target.value}: sealed FAS has no semantic anchor "
                        "for a falsifiable path claim (WAVE-0 honesty)"
                    ),
                ),
            ),
        )
    gap = gap_for_target(wave1_target)
    return Wave0EvalOutcome(
        wave1_target=wave1_target,
        hypotheses=(),
        honesty=(
            honesty_gap_listed(
                wave1_target=wave1_target,
                gap_id=gap["gap_id"],
                detail=gap["detail"],
            ),
        ),
    )


__all__ = ["Wave0EvalOutcome", "wave0_stub_evaluate"]
