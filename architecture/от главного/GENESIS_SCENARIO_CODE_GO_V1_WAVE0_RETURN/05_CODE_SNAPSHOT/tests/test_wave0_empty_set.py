"""WAVE-0 — empty ScenarioSet is lawful (C2)."""

from __future__ import annotations

from app.terminal.cognitive_shadow.scenario.models import ScenarioSet
from app.terminal.cognitive_shadow.scenario.vocabulary import HonestyCode


def test_empty_scenario_set_is_valid() -> None:
    sset = ScenarioSet(
        scenario_set_id="scset:empty_wave0_fixture",
        fas_binding_ref="fasbind:fixture",
        formation_head_cycle_ref="cycle:fixture",
        formation_context_ref="scform:fixture",
        hypotheses=(),
        honesty=(
            {
                "code": HonestyCode.NOT_APPLICABLE.value,
                "wave1_target": "W1-1",
                "detail": "empty fixture",
                "gap_id": None,
                "emits_hypotheses": 0,
            },
        ),
        influence_allowed=False,
        emptiness_lawful=True,
    )
    assert sset.is_empty is True
    assert sset.hypothesis_ids == ()
    assert sset.emptiness_lawful is True
    assert sset.influence_allowed is False
    payload = sset.to_dict()
    assert payload["hypotheses"] == []
    assert payload["emptiness_lawful"] is True
