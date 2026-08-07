"""Readonly cognitive shadow consumer — sealed cycle artifacts only."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from app.terminal.cognitive_shadow.claim_registry import evaluate_all_claims
from app.terminal.cognitive_shadow.continuity import ContinuityPredecessorMap
from app.terminal.cognitive_shadow.family_availability import evaluate_family_availability
from app.terminal.cognitive_shadow.input_envelope import build_envelope_from_sealed
from app.terminal.cognitive_shadow.market_understanding import project_market_understanding
from app.terminal.cognitive_shadow.models import (
    CognitiveInputEnvelopeV1,
    FamilyAvailabilityProjection,
    MarketUnderstandingProjection,
)
from app.terminal.cognitive_shadow.no_influence import assert_no_influence, influence_allowed_always_false
from app.terminal.cognitive_shadow.source_binding import verify_binding_integrity


@dataclass(frozen=True)
class CognitiveEvaluationResult:
    envelope: CognitiveInputEnvelopeV1
    market_understanding: MarketUnderstandingProjection | None
    family_availability: FamilyAvailabilityProjection
    integrity_status: str
    # JOIN_001 / ASSEMBLY_001 attach point (None = not evaluated or global assembly fail)
    family_assessment_set: object | None = None
    # WAVE-0.1 Scenario wire (None = FAS missing, soft-fail, or not wired)
    scenario_set: object | None = None


def evaluate_envelope(
    envelope: CognitiveInputEnvelopeV1,
    *,
    previous_market_understanding: MarketUnderstandingProjection | None = None,
    predecessor_map: ContinuityPredecessorMap | None = None,
    validity_overrides: Mapping[str, bool] | None = None,
) -> CognitiveEvaluationResult:
    """Public API: evaluate sealed envelope → MarketUnderstanding + FamilyAvailability.

    Does not mutate BrainState or recompute organs.
    """
    assert_no_influence()
    assert influence_allowed_always_false() is False

    binding = verify_binding_integrity()
    integrity_status = binding.status if binding.blocked else (
        "BLOCKED_BY_INTEGRITY" if envelope.integrity_blocked else "COMPLETE"
    )

    previous = previous_market_understanding
    if predecessor_map is not None:
        previous = predecessor_map.get(envelope)

    mu = project_market_understanding(envelope, previous=previous)

    claims = evaluate_all_claims(envelope)
    fam = evaluate_family_availability(
        envelope,
        market_understanding=mu,
        claims=claims,
        integrity_blocked=(binding.blocked or envelope.integrity_blocked or envelope.influence_allowed),
        validity_overrides=validity_overrides,
    )

    if predecessor_map is not None and mu is not None and not envelope.integrity_blocked:
        predecessor_map.put(envelope, mu)

    return CognitiveEvaluationResult(
        envelope=envelope,
        market_understanding=mu,
        family_availability=fam,
        integrity_status=integrity_status,
        family_assessment_set=None,
    )


def consume_sealed_cycle(
    *,
    brain_state: Mapping[str, Any] | Any,
    observation_set: Mapping[str, Any] | Any,
    observations_by_organ: Mapping[str, Mapping[str, Any] | Any],
    run_id: str,
    session_id: str,
    venue: str,
    mode: str,
    previous_market_understanding: MarketUnderstandingProjection | None = None,
    predecessor_map: ContinuityPredecessorMap | None = None,
    process_boot_id: str | None = None,
    continuity_epoch_id: str | None = None,
    generation_sequence: int = 1,
    resolved_frame: Mapping[str, Any] | None = None,
) -> CognitiveEvaluationResult:
    """Build envelope from sealed artifacts then evaluate — zero organ recomputation."""
    envelope = build_envelope_from_sealed(
        brain_state=brain_state,
        observation_set=observation_set,
        observations_by_organ=observations_by_organ,
        run_id=run_id,
        session_id=session_id,
        venue=venue,
        mode=mode,
        process_boot_id=process_boot_id,
        continuity_epoch_id=continuity_epoch_id,
        generation_sequence=generation_sequence,
        resolved_frame=resolved_frame,
    )
    return evaluate_envelope(
        envelope,
        previous_market_understanding=previous_market_understanding,
        predecessor_map=predecessor_map,
    )
