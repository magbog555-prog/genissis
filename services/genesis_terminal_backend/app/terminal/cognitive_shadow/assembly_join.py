"""JOIN_001 — sealed cognitive result → FamilyAssessmentSet (Assembly_001).

Does not recompute organs. influence_allowed remains permanently false.
Global Assembly failure leaves family_assessment_set=None (soft) so organ/shadow cycles continue.
"""

from __future__ import annotations

from typing import Any, Mapping

from app.terminal.cognitive_shadow.family_assessment.assembly.coordinator import (
    evaluate_family_assessment_set_v1,
)
from app.terminal.cognitive_shadow.family_assessment.assembly.errors import AssemblyError
from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.family_assessment.assembly.shadow_publish import (
    append_family_assessment_set_v1,
)
from app.terminal.cognitive_shadow.family_assessment.authority import verify_frozen_family_authority
from app.terminal.cognitive_shadow.family_assessment.evidence import (
    FamilyEvidenceError,
    build_family_evidence_context,
)
from app.terminal.cognitive_shadow.no_influence import assert_no_influence, influence_allowed_always_false
from app.terminal.cognitive_shadow.shadow_consumer import (
    CognitiveEvaluationResult,
    consume_sealed_cycle,
    evaluate_envelope,
)


def _result_with_fas(
    result: CognitiveEvaluationResult,
    *,
    family_assessment_set: object | None,
) -> CognitiveEvaluationResult:
    return CognitiveEvaluationResult(
        envelope=result.envelope,
        market_understanding=result.market_understanding,
        family_availability=result.family_availability,
        integrity_status=result.integrity_status,
        family_assessment_set=family_assessment_set,
        scenario_set=result.scenario_set,
    )


def attach_family_assessment_set_v1(
    result: CognitiveEvaluationResult,
    *,
    replay_bundles: Mapping[str, Any] | None = None,
    authority_bindings: object | None = None,
    sink: object | None = None,
    publish: bool = False,
) -> CognitiveEvaluationResult:
    """Attach Assembly set to an existing cognitive evaluation (JOIN_001).

    On AssemblyError / FamilyEvidenceError: returns result with family_assessment_set=None
    (soft join — envelope/MU/FA already valid).
    """
    assert_no_influence()
    if influence_allowed_always_false() is not False:
        return _result_with_fas(result, family_assessment_set=None)
    if result.family_assessment_set is not None:
        # Already attached — optional re-publish only
        if publish and sink is not None:
            append_family_assessment_set_v1(sink=sink, assessment_set=result.family_assessment_set)
        return result

    try:
        evidence = build_family_evidence_context(result.envelope)
        auth = authority_bindings if authority_bindings is not None else verify_frozen_family_authority()
        assessment_set = evaluate_family_assessment_set_v1(
            envelope=result.envelope,
            market_understanding=result.market_understanding,
            family_availability=result.family_availability,
            evidence_context=evidence,
            replay_bundles=dict(replay_bundles or {}),
            authority_bindings=auth,
        )
        if type(assessment_set) is not FamilyAssessmentSetV1:
            return _result_with_fas(result, family_assessment_set=None)
        if assessment_set.influence_allowed is not False:
            return _result_with_fas(result, family_assessment_set=None)
        if publish and sink is not None:
            append_family_assessment_set_v1(sink=sink, assessment_set=assessment_set)
        return _result_with_fas(result, family_assessment_set=assessment_set)
    except (AssemblyError, FamilyEvidenceError):
        return _result_with_fas(result, family_assessment_set=None)


def evaluate_envelope_with_assembly_v1(
    envelope: object,
    *,
    previous_market_understanding: object | None = None,
    predecessor_map: object | None = None,
    validity_overrides: Mapping[str, bool] | None = None,
    replay_bundles: Mapping[str, Any] | None = None,
    authority_bindings: object | None = None,
    sink: object | None = None,
    publish: bool = False,
) -> CognitiveEvaluationResult:
    base = evaluate_envelope(
        envelope,  # type: ignore[arg-type]
        previous_market_understanding=previous_market_understanding,  # type: ignore[arg-type]
        predecessor_map=predecessor_map,  # type: ignore[arg-type]
        validity_overrides=validity_overrides,
    )
    return attach_family_assessment_set_v1(
        base,
        replay_bundles=replay_bundles,
        authority_bindings=authority_bindings,
        sink=sink,
        publish=publish,
    )


def consume_sealed_cycle_with_assembly_v1(
    *,
    brain_state: Mapping[str, Any] | Any,
    observation_set: Mapping[str, Any] | Any,
    observations_by_organ: Mapping[str, Mapping[str, Any] | Any],
    run_id: str,
    session_id: str,
    venue: str,
    mode: str,
    previous_market_understanding: object | None = None,
    predecessor_map: object | None = None,
    process_boot_id: str | None = None,
    continuity_epoch_id: str | None = None,
    generation_sequence: int = 1,
    resolved_frame: Mapping[str, Any] | None = None,
    replay_bundles: Mapping[str, Any] | None = None,
    authority_bindings: object | None = None,
    sink: object | None = None,
    publish: bool = False,
) -> CognitiveEvaluationResult:
    """Sealed organs → thinking → FamilyAssessmentSet (zero organ recompute)."""
    base = consume_sealed_cycle(
        brain_state=brain_state,
        observation_set=observation_set,
        observations_by_organ=observations_by_organ,
        run_id=run_id,
        session_id=session_id,
        venue=venue,
        mode=mode,
        previous_market_understanding=previous_market_understanding,  # type: ignore[arg-type]
        predecessor_map=predecessor_map,  # type: ignore[arg-type]
        process_boot_id=process_boot_id,
        continuity_epoch_id=continuity_epoch_id,
        generation_sequence=generation_sequence,
        resolved_frame=resolved_frame,
    )
    return attach_family_assessment_set_v1(
        base,
        replay_bundles=replay_bundles,
        authority_bindings=authority_bindings,
        sink=sink,
        publish=publish,
    )
