"""WAVE-0 — influence_allowed frozen false."""

from __future__ import annotations

import pytest

from app.terminal.cognitive_shadow.no_influence import influence_allowed_always_false
from app.terminal.cognitive_shadow.scenario.models import ScenarioHypothesis, ScenarioSet
from app.terminal.cognitive_shadow.scenario.producer import produce_scenario_set_v1
from app.terminal.cognitive_shadow.scenario.vocabulary import LifecycleStatus, Wave1Target
from tests.cognitive_shadow.family_assessment.assembly.sealed_constructions import (
    construct_all_unavailable_set,
)


def test_influence_allowed_always_false_constant() -> None:
    assert influence_allowed_always_false() is False


def test_scenario_set_rejects_influence_true() -> None:
    with pytest.raises(ValueError, match="influence_allowed"):
        ScenarioSet(
            scenario_set_id="scset:x",
            fas_binding_ref="fasbind:x",
            formation_head_cycle_ref="cycle:x",
            formation_context_ref="scform:x",
            hypotheses=(),
            honesty=(),
            influence_allowed=True,  # type: ignore[arg-type]
        )


def test_hypothesis_rejects_influence_true() -> None:
    with pytest.raises(ValueError, match="influence_allowed"):
        ScenarioHypothesis(
            hypothesis_id="schyp:x",
            scenario_set_id="scset:x",
            wave1_target=Wave1Target.W1_1,
            path_claim={"claim": "x"},
            formation_context_ref="scform:x",
            fas_binding_ref="fasbind:x",
            lifecycle_status=LifecycleStatus.LIVE_UNRESOLVED,
            evidence_relations=(),
            provenance_links=(),
            influence_allowed=True,
        )


def test_producer_influence_false_on_all() -> None:
    fas = construct_all_unavailable_set()
    sset = produce_scenario_set_v1(fas)
    assert sset.influence_allowed is False
    assert all(h.influence_allowed is False for h in sset.hypotheses)
    assert fas.influence_allowed is False
