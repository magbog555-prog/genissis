"""Scenario WAVE-0 concept types (pure structures; DTO/wire not frozen)."""

from __future__ import annotations

from dataclasses import dataclass, fields
from types import MappingProxyType
from typing import Any, Mapping

from app.terminal.cognitive_shadow.canonical_hash import canonical_json_bytes, sha256_hex
from app.terminal.cognitive_shadow.scenario.vocabulary import (
    RESERVE_TARGETS,
    WAVE1_TARGETS,
    EvidenceRelationKind,
    LifecycleStatus,
    ProvenanceRelationKind,
    Wave1Target,
)

_HEX = frozenset("0123456789abcdef")

_FORBIDDEN_FIELD_TOKENS = frozenset(
    {
        "long",
        "short",
        "entry",
        "stop",
        "target",
        "sizing",
        "score",
        "winner",
        "confidence",
        "probability",
        "vote",
        "risk",
        "capital",
        "execution",
        "admission",
        "setup",
    }
)


def _is_plain_str(value: object) -> bool:
    return type(value) is str


def _require_sha256(value: object, *, field_name: str) -> str:
    if not _is_plain_str(value):
        raise TypeError(f"{field_name} must be exact str")
    text = value
    if len(text) != 64 or any(c not in _HEX for c in text):
        raise ValueError(f"{field_name} must be lowercase 64-hex SHA-256")
    return text


def _reject_forbidden_fields(cls: type) -> None:
    for f in fields(cls):
        name = f.name.lower()
        # Explicit anti-collapse markers are allowed field names.
        if name in {"not_a_vote", "not_a_probability"}:
            continue
        segments = set(name.split("_"))
        for token in _FORBIDDEN_FIELD_TOKENS:
            if token in segments:
                # Allow wave1_target / path_claim / formation_* conceptual slots.
                if token == "target" and name == "wave1_target":
                    continue
                raise TypeError(f"forbidden field {f.name!r}")


def _freeze_json(value: Any) -> Any:
    if value is None:
        return None
    t = type(value)
    if t is bool or t is int or t is str:
        return value
    if t is float:
        raise TypeError("binary float forbidden")
    if t is dict:
        out: dict[str, Any] = {}
        for key in value.keys():
            if type(key) is not str:
                raise TypeError("JSON object key must be exact str")
            out[key] = _freeze_json(value[key])
        return MappingProxyType(out)
    if t is list or t is tuple:
        return tuple(_freeze_json(item) for item in value)
    raise TypeError(f"unsupported JSON type: {t!r}")


def _to_plain_json(value: Any) -> Any:
    if value is None:
        return None
    t = type(value)
    if t is bool or t is int or t is str:
        return value
    if t is float:
        raise TypeError("binary float forbidden")
    if t is dict:
        return {k: _to_plain_json(value[k]) for k in value.keys()}
    if isinstance(value, MappingProxyType):
        return {k: _to_plain_json(value[k]) for k in value.keys()}
    if t is tuple or t is list:
        return [_to_plain_json(item) for item in value]
    raise TypeError(f"unsupported JSON type: {t!r}")


def require_wave1_target(value: object) -> Wave1Target:
    if isinstance(value, Wave1Target):
        return value
    if not _is_plain_str(value):
        raise TypeError("wave1_target must be exact str or Wave1Target")
    if value in RESERVE_TARGETS or "range" in value.lower():
        raise ValueError(f"wave1_target reserve/forbidden: {value!r}")
    if value not in WAVE1_TARGETS:
        raise ValueError(f"wave1_target must be CORE-4 W1-1..W1-4, got {value!r}")
    return Wave1Target(value)


def domain_id(*, kind: str, preimage: Mapping[str, Any]) -> str:
    digest = sha256_hex(canonical_json_bytes({"kind": kind, **dict(preimage)}))
    return f"{kind}:{digest[:32]}"


@dataclass(frozen=True)
class FormationContext:
    """C4 — immutable formation-time meaning; rewrite forbidden."""

    formation_context_id: str
    formed_at_cycle: str
    formation_time_meaning: Mapping[str, Any]
    rewrite_forbidden: bool = True

    def __post_init__(self) -> None:
        _reject_forbidden_fields(FormationContext)
        if not _is_plain_str(self.formation_context_id):
            raise TypeError("formation_context_id must be exact str")
        if not _is_plain_str(self.formed_at_cycle):
            raise TypeError("formed_at_cycle must be exact str")
        if self.rewrite_forbidden is not True:
            raise ValueError("rewrite_forbidden must be permanently true")
        object.__setattr__(
            self, "formation_time_meaning", _freeze_json(dict(self.formation_time_meaning))
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "formation_context_id": self.formation_context_id,
            "formed_at_cycle": self.formed_at_cycle,
            "formation_time_meaning": _to_plain_json(self.formation_time_meaning),
            "rewrite_forbidden": True,
        }


@dataclass(frozen=True)
class EvidenceRelation:
    """C6 — evidence relation instance (not a vote / not a probability)."""

    evidence_relation_id: str
    relation_kind: EvidenceRelationKind
    hypothesis_ref: str
    evidence_ref: str
    not_a_vote: bool = True
    not_a_probability: bool = True

    def __post_init__(self) -> None:
        _reject_forbidden_fields(EvidenceRelation)
        if not _is_plain_str(self.evidence_relation_id):
            raise TypeError("evidence_relation_id must be exact str")
        if not isinstance(self.relation_kind, EvidenceRelationKind):
            raise TypeError("relation_kind must be EvidenceRelationKind")
        if not _is_plain_str(self.hypothesis_ref):
            raise TypeError("hypothesis_ref must be exact str")
        if not _is_plain_str(self.evidence_ref):
            raise TypeError("evidence_ref must be exact str")
        if self.not_a_vote is not True or self.not_a_probability is not True:
            raise ValueError("evidence relations are never votes or probabilities")

    def to_dict(self) -> dict[str, Any]:
        return {
            "evidence_relation_id": self.evidence_relation_id,
            "relation_kind": self.relation_kind.value,
            "hypothesis_ref": self.hypothesis_ref,
            "evidence_ref": self.evidence_ref,
            "not_a_vote": True,
            "not_a_probability": True,
        }


@dataclass(frozen=True)
class ProvenanceLink:
    """C9 — legacy provenance only; fuzzy joins forbidden."""

    provenance_link_id: str
    legacy_id: str
    relation_kind: ProvenanceRelationKind
    fuzzy_join: bool = False

    def __post_init__(self) -> None:
        if not _is_plain_str(self.provenance_link_id):
            raise TypeError("provenance_link_id must be exact str")
        if not _is_plain_str(self.legacy_id):
            raise TypeError("legacy_id must be exact str")
        if not isinstance(self.relation_kind, ProvenanceRelationKind):
            raise TypeError("relation_kind must be ProvenanceRelationKind")
        if self.fuzzy_join is not False:
            raise ValueError("fuzzy_join forbidden")

    def to_dict(self) -> dict[str, Any]:
        return {
            "provenance_link_id": self.provenance_link_id,
            "legacy_id": self.legacy_id,
            "relation_kind": self.relation_kind.value,
            "fuzzy_join": False,
        }


@dataclass(frozen=True)
class ScenarioHypothesis:
    """C1 — canonical Scenario unit."""

    hypothesis_id: str
    scenario_set_id: str
    wave1_target: Wave1Target
    path_claim: Mapping[str, Any]
    formation_context_ref: str
    fas_binding_ref: str
    lifecycle_status: LifecycleStatus
    evidence_relations: tuple[EvidenceRelation, ...]
    provenance_links: tuple[ProvenanceLink, ...]
    influence_allowed: bool = False

    def __post_init__(self) -> None:
        _reject_forbidden_fields(ScenarioHypothesis)
        if not _is_plain_str(self.hypothesis_id):
            raise TypeError("hypothesis_id must be exact str")
        if not _is_plain_str(self.scenario_set_id):
            raise TypeError("scenario_set_id must be exact str")
        object.__setattr__(self, "wave1_target", require_wave1_target(self.wave1_target))
        if not _is_plain_str(self.formation_context_ref):
            raise TypeError("formation_context_ref must be exact str")
        if not _is_plain_str(self.fas_binding_ref):
            raise TypeError("fas_binding_ref must be exact str")
        if not isinstance(self.lifecycle_status, LifecycleStatus):
            raise TypeError("lifecycle_status must be LifecycleStatus")
        if self.influence_allowed is not False:
            raise ValueError("influence_allowed must be permanently false")
        if type(self.evidence_relations) is not tuple:
            raise TypeError("evidence_relations must be tuple")
        if type(self.provenance_links) is not tuple:
            raise TypeError("provenance_links must be tuple")
        if not all(type(e) is EvidenceRelation for e in self.evidence_relations):
            raise TypeError("evidence_relations element type invalid")
        if not all(type(p) is ProvenanceLink for p in self.provenance_links):
            raise TypeError("provenance_links element type invalid")
        claim = _freeze_json(dict(self.path_claim))
        _assert_no_product_direction(claim)
        object.__setattr__(self, "path_claim", claim)

    def to_dict(self) -> dict[str, Any]:
        return {
            "hypothesis_id": self.hypothesis_id,
            "scenario_set_id": self.scenario_set_id,
            "wave1_target": self.wave1_target.value,
            "path_claim": _to_plain_json(self.path_claim),
            "formation_context_ref": self.formation_context_ref,
            "fas_binding_ref": self.fas_binding_ref,
            "lifecycle_status": self.lifecycle_status.value,
            "evidence_relations": [e.to_dict() for e in self.evidence_relations],
            "provenance_links": [p.to_dict() for p in self.provenance_links],
            "influence_allowed": False,
        }


@dataclass(frozen=True)
class ScenarioSet:
    """C2 — 0..N ScenarioHypothesis; empty is lawful and healthy."""

    scenario_set_id: str
    fas_binding_ref: str
    formation_head_cycle_ref: str
    formation_context_ref: str
    hypotheses: tuple[ScenarioHypothesis, ...]
    honesty: tuple[Mapping[str, Any], ...]
    influence_allowed: bool = False
    emptiness_lawful: bool = True
    schema_id: str = "scenario_set.wave0.v1"

    def __post_init__(self) -> None:
        _reject_forbidden_fields(ScenarioSet)
        if not _is_plain_str(self.scenario_set_id):
            raise TypeError("scenario_set_id must be exact str")
        if not _is_plain_str(self.fas_binding_ref):
            raise TypeError("fas_binding_ref must be exact str")
        if not _is_plain_str(self.formation_head_cycle_ref):
            raise TypeError("formation_head_cycle_ref must be exact str")
        if not _is_plain_str(self.formation_context_ref):
            raise TypeError("formation_context_ref must be exact str")
        if self.influence_allowed is not False:
            raise ValueError("influence_allowed must be permanently false")
        if self.emptiness_lawful is not True:
            raise ValueError("emptiness_lawful must remain true (C2)")
        if type(self.hypotheses) is not tuple:
            raise TypeError("hypotheses must be tuple")
        if not all(type(h) is ScenarioHypothesis for h in self.hypotheses):
            raise TypeError("hypotheses element type invalid")
        for h in self.hypotheses:
            if h.scenario_set_id != self.scenario_set_id:
                raise ValueError("hypothesis.scenario_set_id mismatch")
            if h.influence_allowed is not False:
                raise ValueError("hypothesis influence_allowed must be false")
            if h.fas_binding_ref != self.fas_binding_ref:
                raise ValueError("hypothesis fas_binding_ref mismatch")
        frozen_honesty = tuple(_freeze_json(dict(item)) for item in self.honesty)
        object.__setattr__(self, "honesty", frozen_honesty)

    @property
    def hypothesis_ids(self) -> tuple[str, ...]:
        return tuple(h.hypothesis_id for h in self.hypotheses)

    @property
    def is_empty(self) -> bool:
        return len(self.hypotheses) == 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_id": self.schema_id,
            "scenario_set_id": self.scenario_set_id,
            "fas_binding_ref": self.fas_binding_ref,
            "formation_head_cycle_ref": self.formation_head_cycle_ref,
            "formation_context_ref": self.formation_context_ref,
            "hypothesis_ids": list(self.hypothesis_ids),
            "hypotheses": [h.to_dict() for h in self.hypotheses],
            "honesty": [_to_plain_json(h) for h in self.honesty],
            "influence_allowed": False,
            "emptiness_lawful": True,
        }


def _assert_no_product_direction(claim: Any) -> None:
    """W1-4 / C10: path_claim must not encode LONG/SHORT product fields."""
    forbidden_keys = frozenset(
        {
            "long",
            "short",
            "long_short",
            "side",
            "direction",
            "entry",
            "stop",
            "take_profit",
            "target_2r",
            "two_r",
            "2r",
            "sizing",
            "trade_permission",
            "no_trade",
        }
    )
    stack: list[Any] = [claim]
    while stack:
        cur = stack.pop()
        if isinstance(cur, MappingProxyType) or type(cur) is dict:
            for k, v in cur.items():
                kl = str(k).lower()
                if kl in forbidden_keys or kl.startswith("long") or kl.startswith("short"):
                    raise ValueError(f"forbidden product direction field in path_claim: {k!r}")
                stack.append(v)
        elif type(cur) is tuple or type(cur) is list:
            stack.extend(cur)


__all__ = [
    "EvidenceRelation",
    "FormationContext",
    "ProvenanceLink",
    "ScenarioHypothesis",
    "ScenarioSet",
    "domain_id",
    "require_wave1_target",
]
