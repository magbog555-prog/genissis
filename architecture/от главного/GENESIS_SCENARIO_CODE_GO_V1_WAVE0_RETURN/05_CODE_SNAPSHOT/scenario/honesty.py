"""WAVE-0 honesty helpers — GAP / UNAVAILABLE / NOT_APPLICABLE (no fake certainty)."""

from __future__ import annotations

from typing import Any, Mapping

from app.terminal.cognitive_shadow.scenario.vocabulary import HonestyCode, Wave1Target

# Stable GAP catalog for WAVE-0 stubs (detectors not implemented).
WAVE0_GAP_CATALOG: tuple[dict[str, str], ...] = (
    {
        "gap_id": "SCENARIO_WAVE0_GAP_W1_1_DETECTOR",
        "wave1_target": Wave1Target.W1_1.value,
        "detail": "W1-1 Liquidity Event→Reclaim/Return detector not implemented in WAVE-0",
    },
    {
        "gap_id": "SCENARIO_WAVE0_GAP_W1_2_DETECTOR",
        "wave1_target": Wave1Target.W1_2.value,
        "detail": "W1-2 Continuation/Follow-Through detector not implemented in WAVE-0",
    },
    {
        "gap_id": "SCENARIO_WAVE0_GAP_W1_3_DETECTOR",
        "wave1_target": Wave1Target.W1_3.value,
        "detail": "W1-3 Failed Break/Return detector not implemented in WAVE-0",
    },
    {
        "gap_id": "SCENARIO_WAVE0_GAP_W1_4_DETECTOR",
        "wave1_target": Wave1Target.W1_4.value,
        "detail": "W1-4 Compression→Expansion detector not implemented in WAVE-0",
    },
)


def honesty_not_applicable(*, wave1_target: Wave1Target, detail: str) -> dict[str, Any]:
    return {
        "code": HonestyCode.NOT_APPLICABLE.value,
        "wave1_target": wave1_target.value,
        "detail": detail,
        "gap_id": None,
        "emits_hypotheses": 0,
    }


def honesty_unavailable(*, wave1_target: Wave1Target, detail: str) -> dict[str, Any]:
    return {
        "code": HonestyCode.UNAVAILABLE.value,
        "wave1_target": wave1_target.value,
        "detail": detail,
        "gap_id": None,
        "emits_hypotheses": 0,
    }


def honesty_gap_listed(
    *,
    wave1_target: Wave1Target,
    gap_id: str,
    detail: str,
) -> dict[str, Any]:
    return {
        "code": HonestyCode.GAP_LISTED.value,
        "wave1_target": wave1_target.value,
        "detail": detail,
        "gap_id": gap_id,
        "emits_hypotheses": 0,
    }


def gap_for_target(wave1_target: Wave1Target) -> Mapping[str, str]:
    for row in WAVE0_GAP_CATALOG:
        if row["wave1_target"] == wave1_target.value:
            return row
    raise KeyError(f"no WAVE-0 gap row for {wave1_target}")


__all__ = [
    "WAVE0_GAP_CATALOG",
    "gap_for_target",
    "honesty_gap_listed",
    "honesty_not_applicable",
    "honesty_unavailable",
]
