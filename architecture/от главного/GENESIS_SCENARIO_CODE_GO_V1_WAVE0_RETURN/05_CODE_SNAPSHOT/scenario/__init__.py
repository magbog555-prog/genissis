"""Scenario WAVE-0 — sealed FAS → ScenarioSet foundation (influence_allowed=false).

Library + unit tests only. No JOIN/runtime wire in WAVE-0.
Authority: OWNER_GO_SCENARIO_CODE_GO_V1 (WAVE-0).
"""

from __future__ import annotations

from app.terminal.cognitive_shadow.scenario.binding import FASBinding, bind_sealed_fas
from app.terminal.cognitive_shadow.scenario.honesty import WAVE0_GAP_CATALOG
from app.terminal.cognitive_shadow.scenario.models import (
    EvidenceRelation,
    FormationContext,
    ProvenanceLink,
    ScenarioHypothesis,
    ScenarioSet,
    require_wave1_target,
)
from app.terminal.cognitive_shadow.scenario.producer import produce_scenario_set_v1
from app.terminal.cognitive_shadow.scenario.vocabulary import (
    CORE4_TARGET_ORDER,
    EvidenceRelationKind,
    HonestyCode,
    LifecycleStatus,
    ProvenanceRelationKind,
    Wave1Target,
)

__all__ = [
    "CORE4_TARGET_ORDER",
    "EvidenceRelation",
    "EvidenceRelationKind",
    "FASBinding",
    "FormationContext",
    "HonestyCode",
    "LifecycleStatus",
    "ProvenanceLink",
    "ProvenanceRelationKind",
    "ScenarioHypothesis",
    "ScenarioSet",
    "WAVE0_GAP_CATALOG",
    "Wave1Target",
    "bind_sealed_fas",
    "produce_scenario_set_v1",
    "require_wave1_target",
]
