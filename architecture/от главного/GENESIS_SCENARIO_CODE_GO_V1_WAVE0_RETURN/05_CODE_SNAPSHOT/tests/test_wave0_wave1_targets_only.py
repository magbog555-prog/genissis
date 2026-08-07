"""WAVE-0 — wave1_target CORE-4 only; Range rejected."""

from __future__ import annotations

import pytest

from app.terminal.cognitive_shadow.scenario.evaluate.w1_4_compression_expansion import (
    W1_4_FORBIDDEN_PRODUCT_FIELDS,
    evaluate_w1_4,
)
from app.terminal.cognitive_shadow.scenario.models import ScenarioHypothesis, require_wave1_target
from app.terminal.cognitive_shadow.scenario.vocabulary import (
    RESERVE_TARGETS,
    WAVE1_TARGETS,
    LifecycleStatus,
    Wave1Target,
)
from tests.cognitive_shadow.family_assessment.assembly.sealed_constructions import (
    construct_all_unavailable_set,
)
from app.terminal.cognitive_shadow.scenario.binding import bind_sealed_fas


@pytest.mark.parametrize("target", sorted(WAVE1_TARGETS))
def test_core4_targets_accepted(target: str) -> None:
    assert require_wave1_target(target).value == target


@pytest.mark.parametrize(
    "bad",
    sorted(RESERVE_TARGETS) + ["Range...", "W1-Range", "range_rotation"],
)
def test_range_and_reserve_rejected(bad: str) -> None:
    with pytest.raises(ValueError):
        require_wave1_target(bad)


def test_hypothesis_rejects_range_wave1_target() -> None:
    with pytest.raises(ValueError):
        ScenarioHypothesis(
            hypothesis_id="schyp:bad",
            scenario_set_id="scset:x",
            wave1_target="Range Rotation / Reversion",  # type: ignore[arg-type]
            path_claim={"claim": "x"},
            formation_context_ref="scform:x",
            fas_binding_ref="fasbind:x",
            lifecycle_status=LifecycleStatus.LIVE_UNRESOLVED,
            evidence_relations=(),
            provenance_links=(),
            influence_allowed=False,
        )


def test_w1_4_never_requires_long_short_product_fields() -> None:
    fas = construct_all_unavailable_set()
    binding = bind_sealed_fas(fas)
    outcome = evaluate_w1_4(fas=fas, binding=binding)
    assert outcome.hypotheses == ()
    assert Wave1Target.W1_4.value == "W1-4"
    # Stub surface documents forbidden product fields without requiring them.
    assert "LONG" in W1_4_FORBIDDEN_PRODUCT_FIELDS
    assert "SHORT" in W1_4_FORBIDDEN_PRODUCT_FIELDS
