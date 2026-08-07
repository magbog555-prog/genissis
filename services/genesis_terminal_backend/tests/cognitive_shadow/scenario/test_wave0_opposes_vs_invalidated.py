"""WAVE-0 — C8: OPPOSES ≠ INVALIDATED (distinct vocabularies)."""

from __future__ import annotations

from app.terminal.cognitive_shadow.scenario.models import EvidenceRelation
from app.terminal.cognitive_shadow.scenario.vocabulary import (
    EvidenceRelationKind,
    LifecycleStatus,
)


def test_opposes_is_not_invalidated() -> None:
    assert EvidenceRelationKind.OPPOSES != LifecycleStatus.INVALIDATED
    assert EvidenceRelationKind.OPPOSES.value != LifecycleStatus.INVALIDATED.value
    assert type(EvidenceRelationKind.OPPOSES) is not type(LifecycleStatus.INVALIDATED)


def test_unknown_is_not_unavailable() -> None:
    assert EvidenceRelationKind.UNKNOWN != EvidenceRelationKind.UNAVAILABLE
    assert EvidenceRelationKind.UNKNOWN.value != EvidenceRelationKind.UNAVAILABLE.value


def test_expired_is_not_invalidated() -> None:
    assert LifecycleStatus.EXPIRED != LifecycleStatus.INVALIDATED


def test_evidence_relation_opposes_does_not_imply_lifecycle() -> None:
    rel = EvidenceRelation(
        evidence_relation_id="scer:1",
        relation_kind=EvidenceRelationKind.OPPOSES,
        hypothesis_ref="schyp:1",
        evidence_ref="ev:1",
    )
    assert rel.relation_kind is EvidenceRelationKind.OPPOSES
    assert rel.relation_kind is not LifecycleStatus.INVALIDATED
    assert rel.not_a_vote is True
    assert rel.not_a_probability is True
