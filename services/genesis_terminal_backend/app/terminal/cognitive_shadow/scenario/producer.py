"""Producer — sealed FamilyAssessmentSet → ScenarioSet (WAVE-0 orchestration)."""

from __future__ import annotations

from typing import Callable

from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.scenario.binding import FASBinding, bind_sealed_fas
from app.terminal.cognitive_shadow.scenario.evaluate import Wave0EvalOutcome
from app.terminal.cognitive_shadow.scenario.evaluate.w1_1_liquidity_reclaim import evaluate_w1_1
from app.terminal.cognitive_shadow.scenario.evaluate.w1_2_continuation import evaluate_w1_2
from app.terminal.cognitive_shadow.scenario.evaluate.w1_3_failed_break import evaluate_w1_3
from app.terminal.cognitive_shadow.scenario.evaluate.w1_4_compression_expansion import evaluate_w1_4
from app.terminal.cognitive_shadow.scenario.models import FormationContext, ScenarioSet, domain_id
from app.terminal.cognitive_shadow.scenario.vocabulary import CORE4_TARGET_ORDER, Wave1Target

EvaluatorFn = Callable[..., Wave0EvalOutcome]

_CORE4_EVALUATORS: tuple[tuple[Wave1Target, EvaluatorFn], ...] = (
    (Wave1Target.W1_1, evaluate_w1_1),
    (Wave1Target.W1_2, evaluate_w1_2),
    (Wave1Target.W1_3, evaluate_w1_3),
    (Wave1Target.W1_4, evaluate_w1_4),
)


def produce_scenario_set_v1(fas: FamilyAssessmentSetV1) -> ScenarioSet:
    """Deterministic WAVE-0 producer: FAS → ScenarioSet (0..N; empty lawful).

    Does not re-run organs, F1–F6 evaluators, or vote across families.
    influence_allowed remains false.
    """
    if type(fas) is not FamilyAssessmentSetV1:
        raise TypeError("fas must be FamilyAssessmentSetV1")
    if fas.influence_allowed is not False:
        raise ValueError("producer requires sealed FAS with influence_allowed=false")

    binding = bind_sealed_fas(fas)
    formation = _formation_context(fas, binding)
    scenario_set_id = domain_id(
        kind="scset",
        preimage={
            "fas_id": binding.fas_id,
            "assembly_content_hash": binding.assembly_content_hash,
            "formation_context_id": formation.formation_context_id,
            "wave": "WAVE-0",
            "targets": [t.value for t in CORE4_TARGET_ORDER],
        },
    )

    hypotheses = []
    honesty: list[dict] = []
    for _target, fn in _CORE4_EVALUATORS:
        outcome = fn(fas=fas, binding=binding)
        hypotheses.extend(outcome.hypotheses)
        honesty.extend(dict(h) for h in outcome.honesty)

    return ScenarioSet(
        scenario_set_id=scenario_set_id,
        fas_binding_ref=binding.fas_binding_id,
        formation_head_cycle_ref=binding.formation_head_cycle_ref,
        formation_context_ref=formation.formation_context_id,
        hypotheses=tuple(hypotheses),
        honesty=tuple(honesty),
        influence_allowed=False,
        emptiness_lawful=True,
    )


def _formation_context(fas: FamilyAssessmentSetV1, binding: FASBinding) -> FormationContext:
    meaning = {
        "layer": "scenario_wave0",
        "fas_id": binding.fas_id,
        "assembly_content_hash": binding.assembly_content_hash,
        "input_envelope_id": fas.input_envelope_id,
        "market_understanding_id": fas.market_understanding_id,
        "family_availability_id": fas.family_availability_id,
        "replay_identity": fas.replay_identity,
        "evaluation_order": list(fas.evaluation_order),
        "slot_summaries": [
            {
                "family_id": s.family_id,
                "evaluation_state": s.evaluation_state,
                "availability_state": s.availability_state,
                "result_identity": s.result_identity,
            }
            for s in fas.family_slots
        ],
        "influence_allowed": False,
        "rewrite_forbidden": True,
    }
    ctx_id = domain_id(
        kind="scform",
        preimage={
            "fas_id": binding.fas_id,
            "assembly_content_hash": binding.assembly_content_hash,
            "cycle": binding.formation_head_cycle_ref,
        },
    )
    return FormationContext(
        formation_context_id=ctx_id,
        formed_at_cycle=binding.formation_head_cycle_ref,
        formation_time_meaning=meaning,
        rewrite_forbidden=True,
    )


__all__ = ["produce_scenario_set_v1"]
