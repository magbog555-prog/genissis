"""WAVE-0.1 WIRE — sealed FAS on cognitive result → ScenarioSet attach + optional journal.

Mirrors JOIN_001 soft-join style (assembly_join.attach_family_assessment_set_v1):
  - influence_allowed remains permanently false
  - empty ScenarioSet is success
  - FAS absent / producer error → scenario_set=None (organs + FAS continue)
  - detectors remain WAVE-0 stubs (GAP_LISTED inherited)
"""

from __future__ import annotations

from typing import Any, Mapping

from app.terminal.cognitive_shadow.assembly_join import (
    attach_family_assessment_set_v1,
    evaluate_envelope_with_assembly_v1,
)
from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.no_influence import assert_no_influence, influence_allowed_always_false
from app.terminal.cognitive_shadow.scenario.models import ScenarioSet
from app.terminal.cognitive_shadow.scenario.producer import produce_scenario_set_v1
from app.terminal.cognitive_shadow.scenario.shadow_publish import (
    ScenarioShadowPublishError,
    append_scenario_set_v0_1,
    append_scenario_soft_gap_v0_1,
)
from app.terminal.cognitive_shadow.shadow_consumer import CognitiveEvaluationResult


def _copy_result(
    result: CognitiveEvaluationResult,
    *,
    scenario_set: object | None,
) -> CognitiveEvaluationResult:
    return CognitiveEvaluationResult(
        envelope=result.envelope,
        market_understanding=result.market_understanding,
        family_availability=result.family_availability,
        integrity_status=result.integrity_status,
        family_assessment_set=result.family_assessment_set,
        scenario_set=scenario_set,
    )


def attach_scenario_set_v0_1(
    result: CognitiveEvaluationResult,
    *,
    sink: object | None = None,
    publish: bool = False,
    publish_soft_gaps: bool = False,
) -> CognitiveEvaluationResult:
    """Attach ScenarioSet after FamilyAssessmentSet (WAVE-0.1 soft wire).

    Producer runs only when FAS is present and influence_allowed is False.
    Empty ScenarioSet is a lawful success. Soft-fail leaves scenario_set=None.
    """
    assert_no_influence()
    if influence_allowed_always_false() is not False:
        return _copy_result(result, scenario_set=None)

    if result.scenario_set is not None:
        if publish and sink is not None and type(result.scenario_set) is ScenarioSet:
            try:
                append_scenario_set_v0_1(sink=sink, scenario_set=result.scenario_set)
            except ScenarioShadowPublishError:
                # Journal failure must not unwind an already-attached lawful set.
                pass
        return result

    fas = result.family_assessment_set
    if fas is None:
        if publish and publish_soft_gaps and sink is not None:
            try:
                append_scenario_soft_gap_v0_1(
                    sink=sink,
                    gap_code="SCENARIO_WIRE_FAS_ABSENT",
                    detail="producer not called: FamilyAssessmentSet missing on result",
                    fas_id=None,
                )
            except ScenarioShadowPublishError:
                pass
        return _copy_result(result, scenario_set=None)

    if type(fas) is not FamilyAssessmentSetV1:
        if publish and publish_soft_gaps and sink is not None:
            try:
                append_scenario_soft_gap_v0_1(
                    sink=sink,
                    gap_code="SCENARIO_WIRE_FAS_TYPE_INVALID",
                    detail="family_assessment_set is not FamilyAssessmentSetV1",
                    fas_id=None,
                )
            except ScenarioShadowPublishError:
                pass
        return _copy_result(result, scenario_set=None)

    if fas.influence_allowed is not False:
        return _copy_result(result, scenario_set=None)

    try:
        scenario_set = produce_scenario_set_v1(fas)
    except Exception as exc:
        if publish and publish_soft_gaps and sink is not None:
            try:
                append_scenario_soft_gap_v0_1(
                    sink=sink,
                    gap_code="SCENARIO_WIRE_PRODUCE_SOFT_FAIL",
                    detail=type(exc).__name__,
                    fas_id=getattr(fas, "assembly_id", None),
                )
            except ScenarioShadowPublishError:
                pass
        return _copy_result(result, scenario_set=None)

    if type(scenario_set) is not ScenarioSet:
        return _copy_result(result, scenario_set=None)
    if scenario_set.influence_allowed is not False:
        return _copy_result(result, scenario_set=None)

    if publish and sink is not None:
        try:
            append_scenario_set_v0_1(sink=sink, scenario_set=scenario_set)
        except ScenarioShadowPublishError:
            # Soft journal: keep attached set even if append fails.
            pass

    return _copy_result(result, scenario_set=scenario_set)


def evaluate_envelope_with_scenario_v0_1(
    envelope: object,
    *,
    previous_market_understanding: object | None = None,
    predecessor_map: object | None = None,
    validity_overrides: Mapping[str, bool] | None = None,
    replay_bundles: Mapping[str, Any] | None = None,
    authority_bindings: object | None = None,
    sink: object | None = None,
    publish: bool = False,
    publish_soft_gaps: bool = False,
) -> CognitiveEvaluationResult:
    """Sealed envelope → Assembly FAS → ScenarioSet (WAVE-0.1 wire chain)."""
    with_fas = evaluate_envelope_with_assembly_v1(
        envelope,
        previous_market_understanding=previous_market_understanding,
        predecessor_map=predecessor_map,
        validity_overrides=validity_overrides,
        replay_bundles=replay_bundles,
        authority_bindings=authority_bindings,
        sink=sink,
        publish=publish,
    )
    return attach_scenario_set_v0_1(
        with_fas,
        sink=sink,
        publish=publish,
        publish_soft_gaps=publish_soft_gaps,
    )


def attach_family_then_scenario_v0_1(
    result: CognitiveEvaluationResult,
    *,
    replay_bundles: Mapping[str, Any] | None = None,
    authority_bindings: object | None = None,
    sink: object | None = None,
    publish: bool = False,
    publish_soft_gaps: bool = False,
) -> CognitiveEvaluationResult:
    """Attach FAS (if needed) then Scenario — for results that only have envelope/MU/FA."""
    with_fas = attach_family_assessment_set_v1(
        result,
        replay_bundles=replay_bundles,
        authority_bindings=authority_bindings,
        sink=sink,
        publish=publish,
    )
    return attach_scenario_set_v0_1(
        with_fas,
        sink=sink,
        publish=publish,
        publish_soft_gaps=publish_soft_gaps,
    )


__all__ = [
    "attach_family_then_scenario_v0_1",
    "attach_scenario_set_v0_1",
    "evaluate_envelope_with_scenario_v0_1",
]
