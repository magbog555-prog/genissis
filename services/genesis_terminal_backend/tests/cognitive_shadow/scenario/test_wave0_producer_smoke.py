"""WAVE-0 — producer smoke: sealed FAS → legal ScenarioSet; no organ re-run imports."""

from __future__ import annotations

import ast
from pathlib import Path

from app.terminal.cognitive_shadow.scenario.binding import bind_sealed_fas
from app.terminal.cognitive_shadow.scenario.honesty import WAVE0_GAP_CATALOG
from app.terminal.cognitive_shadow.scenario.producer import produce_scenario_set_v1
from app.terminal.cognitive_shadow.scenario.vocabulary import (
    CORE4_TARGET_ORDER,
    HonestyCode,
    Wave1Target,
)
from tests.cognitive_shadow.family_assessment.assembly.sealed_constructions import (
    construct_all_unavailable_set,
    construct_f2_a01_set,
)

_SCENARIO_ROOT = (
    Path(__file__).resolve().parents[3]
    / "app"
    / "terminal"
    / "cognitive_shadow"
    / "scenario"
)

_FORBIDDEN_IMPORT_FRAGMENTS = (
    "family_assessment.evaluators",
    "shadow_consumer",
    "broker",
    "execution",
    "order_dto",
    "admission",
    "decision",
    "risk",
)


def test_producer_all_unavailable_fas_empty_not_applicable() -> None:
    fas = construct_all_unavailable_set()
    binding = bind_sealed_fas(fas)
    assert binding.head_sealed is True
    assert binding.fas_id == fas.assembly_id

    sset = produce_scenario_set_v1(fas)
    assert sset.is_empty is True
    assert sset.influence_allowed is False
    assert sset.fas_binding_ref == binding.fas_binding_id
    assert len(sset.honesty) == 4
    codes = {h["code"] for h in sset.honesty}
    assert codes == {HonestyCode.NOT_APPLICABLE.value}
    targets = {h["wave1_target"] for h in sset.honesty}
    assert targets == {t.value for t in CORE4_TARGET_ORDER}


def test_producer_f2_a01_fas_gap_listed_empty() -> None:
    fas = construct_f2_a01_set()
    sset = produce_scenario_set_v1(fas)
    assert sset.is_empty is True
    assert sset.influence_allowed is False
    assert len(sset.honesty) == 4
    codes = {h["code"] for h in sset.honesty}
    assert codes == {HonestyCode.GAP_LISTED.value}
    gap_ids = {h["gap_id"] for h in sset.honesty}
    catalog_ids = {row["gap_id"] for row in WAVE0_GAP_CATALOG}
    assert gap_ids == catalog_ids
    assert Wave1Target.W1_4.value in {h["wave1_target"] for h in sset.honesty}


def test_scenario_package_has_no_organ_rerun_imports() -> None:
    violations: list[str] = []
    for path in sorted(_SCENARIO_ROOT.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                names = [mod] + [f"{mod}.{a.name}" for a in node.names]
            for name in names:
                lower = name.lower()
                for frag in _FORBIDDEN_IMPORT_FRAGMENTS:
                    if frag in lower:
                        violations.append(f"{path.name}:{name}")
    assert violations == []
