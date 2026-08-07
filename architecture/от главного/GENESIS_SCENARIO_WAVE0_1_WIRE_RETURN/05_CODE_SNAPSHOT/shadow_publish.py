"""WAVE-0.1 — publish ScenarioSet through ShadowSink (readonly; no influence)."""

from __future__ import annotations

from typing import Any, Mapping, Protocol

from app.terminal.cognitive_shadow.no_influence import assert_no_influence, influence_allowed_always_false
from app.terminal.cognitive_shadow.scenario.models import ScenarioSet


class ScenarioShadowPublishError(Exception):
    """Typed soft-publish failure (callers may treat as soft-join)."""

    def __init__(self, *, stage: str, detail: str) -> None:
        self.stage = stage
        self.detail = detail
        super().__init__(f"scenario_shadow:{stage}:{detail}")


class _SinkLike(Protocol):
    def append_scenario_set(self, record: dict[str, Any]) -> None: ...


def append_scenario_set_v0_1(*, sink: object, scenario_set: ScenarioSet) -> None:
    """Explicit publication: one complete ScenarioSet journal line."""
    assert_no_influence()
    if influence_allowed_always_false() is not False:
        raise ScenarioShadowPublishError(stage="shadow_append", detail="influence law violated")
    if type(scenario_set) is not ScenarioSet:
        raise ScenarioShadowPublishError(
            stage="shadow_append",
            detail="scenario_set must be ScenarioSet",
        )
    if scenario_set.influence_allowed is not False:
        raise ScenarioShadowPublishError(
            stage="shadow_append",
            detail="scenario_set influence_allowed must be false",
        )
    append = getattr(sink, "append_scenario_set", None)
    if append is None or not callable(append):
        raise ScenarioShadowPublishError(
            stage="shadow_append",
            detail="sink missing append_scenario_set",
        )
    try:
        append(scenario_set.journal_record())
    except ScenarioShadowPublishError:
        raise
    except Exception as exc:
        raise ScenarioShadowPublishError(
            stage="shadow_append",
            detail=type(exc).__name__,
        ) from exc


def append_scenario_soft_gap_v0_1(
    *,
    sink: object,
    gap_code: str,
    detail: str,
    fas_id: str | None = None,
) -> None:
    """Readonly honesty line when Scenario soft-joins to None (FAS absent / produce fail)."""
    assert_no_influence()
    append = getattr(sink, "append_scenario_set", None)
    if append is None or not callable(append):
        raise ScenarioShadowPublishError(
            stage="shadow_append_gap",
            detail="sink missing append_scenario_set",
        )
    record: dict[str, Any] = {
        "record_type": "scenario_set_soft_gap",
        "schema_id": "scenario_set.wave0_1.soft_gap.v1",
        "gap_code": gap_code,
        "detail": detail,
        "fas_id": fas_id,
        "influence_allowed": False,
        "scenario_set": None,
    }
    try:
        append(record)
    except Exception as exc:
        raise ScenarioShadowPublishError(
            stage="shadow_append_gap",
            detail=type(exc).__name__,
        ) from exc


__all__ = [
    "ScenarioShadowPublishError",
    "append_scenario_set_v0_1",
    "append_scenario_soft_gap_v0_1",
]
