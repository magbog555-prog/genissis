"""WAVE-0.1 WIRE — FAS → producer → attach → optional journal."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.terminal.cognitive_shadow.no_influence import (
    influence_allowed_always_false,
    scan_forbidden_imports,
)
from app.terminal.cognitive_shadow.scenario.models import ScenarioSet
from app.terminal.cognitive_shadow.scenario.vocabulary import HonestyCode
from app.terminal.cognitive_shadow.scenario_join import (
    attach_family_then_scenario_v0_1,
    attach_scenario_set_v0_1,
    evaluate_envelope_with_scenario_v0_1,
)
from app.terminal.cognitive_shadow.shadow_consumer import CognitiveEvaluationResult, evaluate_envelope
from app.terminal.cognitive_shadow.shadow_sink import ShadowSink
from tests.cognitive_shadow.family_assessment.assembly.sealed_constructions import (
    construct_all_unavailable_set,
    construct_f2_a01_set,
    envelope_for_unavailable,
)


def _result_with_fas(fas: object) -> CognitiveEvaluationResult:
    base = evaluate_envelope(envelope_for_unavailable())
    return CognitiveEvaluationResult(
        envelope=base.envelope,
        market_understanding=base.market_understanding,
        family_availability=base.family_availability,
        integrity_status=base.integrity_status,
        family_assessment_set=fas,
        scenario_set=None,
    )


def test_w001_fas_to_producer_attach() -> None:
    """W001 — FAS present → producer invoked → ScenarioSet on result."""
    fas = construct_all_unavailable_set()
    result = attach_scenario_set_v0_1(_result_with_fas(fas))
    assert result.family_assessment_set is fas
    assert result.scenario_set is not None
    assert type(result.scenario_set) is ScenarioSet
    assert result.scenario_set.influence_allowed is False


def test_w002_empty_set_lawful_after_wire() -> None:
    """W002 — empty ScenarioSet after wire is success."""
    fas = construct_all_unavailable_set()
    result = attach_scenario_set_v0_1(_result_with_fas(fas))
    sset = result.scenario_set
    assert type(sset) is ScenarioSet
    assert sset.is_empty is True
    assert sset.emptiness_lawful is True
    codes = {h["code"] for h in sset.honesty}
    assert codes == {HonestyCode.NOT_APPLICABLE.value}


def test_w003_influence_false_e2e() -> None:
    """W003 — influence_allowed false end-to-end on wire path."""
    assert influence_allowed_always_false() is False
    result = evaluate_envelope_with_scenario_v0_1(envelope_for_unavailable())
    assert result.envelope.influence_allowed is False
    if result.family_assessment_set is not None:
        assert result.family_assessment_set.influence_allowed is False  # type: ignore[union-attr]
    if result.scenario_set is not None:
        assert result.scenario_set.influence_allowed is False  # type: ignore[union-attr]


def test_w004_soft_fail_when_fas_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    """W004 — producer not called when FAS missing; scenario_set=None."""
    called = {"n": 0}

    def _boom(*_a: object, **_k: object) -> object:
        called["n"] += 1
        raise AssertionError("producer must not run without FAS")

    monkeypatch.setattr(
        "app.terminal.cognitive_shadow.scenario_join.produce_scenario_set_v1",
        _boom,
    )
    base = evaluate_envelope(envelope_for_unavailable())
    assert base.family_assessment_set is None
    wired = attach_scenario_set_v0_1(base)
    assert wired.scenario_set is None
    assert called["n"] == 0
    assert wired.envelope is base.envelope


def test_w005_journal_append_unit(tmp_path: Path) -> None:
    """W005 — publish=True appends ScenarioSet journal line."""
    fas = construct_all_unavailable_set()
    sink = ShadowSink(tmp_path)
    result = attach_scenario_set_v0_1(_result_with_fas(fas), sink=sink, publish=True)
    assert type(result.scenario_set) is ScenarioSet
    path = tmp_path / "scenario_set.jsonl"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert result.scenario_set.scenario_set_id in text
    assert '"record_type":"scenario_set"' in text
    assert '"influence_allowed":false' in text


def test_w006_detectors_still_gap_listed_inherit() -> None:
    """W006 — F2-anchored FAS still yields GAP_LISTED honesty (WAVE-0 stubs)."""
    fas = construct_f2_a01_set()
    result = attach_scenario_set_v0_1(_result_with_fas(fas))
    sset = result.scenario_set
    assert type(sset) is ScenarioSet
    assert sset.is_empty is True
    codes = {h["code"] for h in sset.honesty}
    assert codes == {HonestyCode.GAP_LISTED.value}
    assert all(h.get("gap_id") for h in sset.honesty)


def test_w005b_soft_gap_journal_when_fas_absent(tmp_path: Path) -> None:
    base = evaluate_envelope(envelope_for_unavailable())
    sink = ShadowSink(tmp_path)
    wired = attach_scenario_set_v0_1(
        base, sink=sink, publish=True, publish_soft_gaps=True
    )
    assert wired.scenario_set is None
    text = (tmp_path / "scenario_set.jsonl").read_text(encoding="utf-8")
    assert "SCENARIO_WIRE_FAS_ABSENT" in text


def test_chain_family_then_scenario_smoke() -> None:
    base = evaluate_envelope(envelope_for_unavailable())
    assert base.family_assessment_set is None
    wired = attach_family_then_scenario_v0_1(base)
    assert wired.family_assessment_set is not None
    assert type(wired.scenario_set) is ScenarioSet
    assert wired.scenario_set.is_empty is True


def test_producer_soft_fail_preserves_fas(monkeypatch: pytest.MonkeyPatch) -> None:
    fas = construct_all_unavailable_set()

    def _boom(*_a: object, **_k: object) -> object:
        raise RuntimeError("forced produce fail")

    monkeypatch.setattr(
        "app.terminal.cognitive_shadow.scenario_join.produce_scenario_set_v1",
        _boom,
    )
    wired = attach_scenario_set_v0_1(_result_with_fas(fas))
    assert wired.family_assessment_set is fas
    assert wired.scenario_set is None


def test_top_level_import_scan_allows_scenario_wire() -> None:
    root = Path(__file__).resolve().parents[3] / "app" / "terminal" / "cognitive_shadow"
    violations = scan_forbidden_imports(sorted(root.glob("*.py")))
    assert violations == []


def test_already_attached_scenario_republish(tmp_path: Path) -> None:
    fas = construct_all_unavailable_set()
    first = attach_scenario_set_v0_1(_result_with_fas(fas))
    sink = ShadowSink(tmp_path)
    second = attach_scenario_set_v0_1(first, sink=sink, publish=True)
    assert second.scenario_set is first.scenario_set
    assert (tmp_path / "scenario_set.jsonl").is_file()
