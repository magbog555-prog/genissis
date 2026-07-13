"""Frozen Pydantic models for RFC-0003 Organ Runtime."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .constants import INFLUENCE_ALLOWED_DEFAULT
from .freeze import deep_freeze
from .hashes import content_hash


class TerminalReason(str, Enum):
    TIMEOUT = "TIMEOUT"
    CANCELLED_BEFORE_START = "CANCELLED_BEFORE_START"
    OVERLOAD_REJECTED = "OVERLOAD_REJECTED"
    DETERMINISM_CONFLICT = "DETERMINISM_CONFLICT"
    LATE_RESULT = "LATE_RESULT"


class ObservationPresence(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNKNOWN = "UNKNOWN"


class SetLifecycle(str, Enum):
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"


class _FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class OrganObservation(_FrozenModel):
    """Market observation produced only by a successful evaluation."""

    organ_id: str
    organ_version: str
    symbol: str
    presence: ObservationPresence
    numeric_features: Any = Field(default_factory=dict)
    semantic_profile: Any = Field(default_factory=dict)
    evidence_slot_refs: tuple[str, ...] = ()
    trader_language: str = ""
    influence_allowed: bool = INFLUENCE_ALLOWED_DEFAULT
    # Identity / scheduling surfaces — excluded from content hash.
    runtime_id: str = ""
    cycle_id: str = ""
    organ_instance_id: str = ""
    created_at_ms: int = 0

    @model_validator(mode="after")
    def _freeze_and_bound(self) -> OrganObservation:
        object.__setattr__(self, "numeric_features", deep_freeze(dict(self.numeric_features or {})))
        object.__setattr__(self, "semantic_profile", deep_freeze(dict(self.semantic_profile or {})))
        object.__setattr__(self, "evidence_slot_refs", tuple(self.evidence_slot_refs or ()))
        if self.influence_allowed is not False:
            object.__setattr__(self, "influence_allowed", False)
        return self

    def content_payload(self) -> dict[str, Any]:
        return {
            "organ_id": self.organ_id,
            "organ_version": self.organ_version,
            "symbol": self.symbol,
            "presence": self.presence.value,
            "numeric_features": dict(self.numeric_features),
            "semantic_profile": dict(self.semantic_profile),
            "evidence_slot_refs": list(self.evidence_slot_refs),
        }

    @property
    def observation_content_hash(self) -> str:
        return content_hash(self.content_payload())


class OrganEvaluationTerminalRecord(_FrozenModel):
    """Non-market terminal outcome (timeout/cancel/overload/conflict)."""

    organ_id: str
    organ_version: str
    symbol: str
    reason: TerminalReason
    detail: str = ""
    runtime_id: str = ""
    cycle_id: str = ""
    organ_instance_id: str = ""
    created_at_ms: int = 0
    influence_allowed: bool = False

    @model_validator(mode="after")
    def _no_market_presence(self) -> OrganEvaluationTerminalRecord:
        # Contract: timeout/cancel never mint PRESENT/ABSENT/UNKNOWN Observation.
        if self.influence_allowed is not False:
            object.__setattr__(self, "influence_allowed", False)
        return self


class LateResultArtifact(_FrozenModel):
    organ_id: str
    organ_version: str
    symbol: str
    organ_instance_id: str
    late_payload_hash: str
    runtime_id: str = ""
    cycle_id: str = ""
    created_at_ms: int = 0


class DeterminismConflictArtifact(_FrozenModel):
    organ_id: str
    organ_version: str
    symbol: str
    expected_hash: str
    actual_hash: str
    runtime_id: str = ""
    cycle_id: str = ""
    organ_instance_id: str = ""
    created_at_ms: int = 0


class OrganObservationSet(_FrozenModel):
    set_id: str
    symbol: str
    lifecycle: SetLifecycle
    expected_organs: tuple[str, ...] = ()
    observations: tuple[OrganObservation, ...] = ()
    terminal_records: tuple[OrganEvaluationTerminalRecord, ...] = ()
    optional_shadow_missing: tuple[str, ...] = ()
    runtime_id: str = ""
    cycle_id: str = ""
    created_at_ms: int = 0

    @field_validator("expected_organs", "optional_shadow_missing", mode="before")
    @classmethod
    def _tuple_str(cls, value: Any) -> tuple[str, ...]:
        return tuple(value or ())

    @field_validator("observations", "terminal_records", mode="before")
    @classmethod
    def _tuple_models(cls, value: Any) -> tuple[Any, ...]:
        return tuple(value or ())

    def content_payload(self) -> dict[str, Any]:
        observations = sorted(
            (o.content_payload() for o in self.observations),
            key=lambda o: (o["organ_id"], o["organ_version"], o["symbol"]),
        )
        terminals = sorted(
            (
                {
                    "organ_id": t.organ_id,
                    "organ_version": t.organ_version,
                    "symbol": t.symbol,
                    "reason": t.reason.value,
                    "detail": t.detail,
                }
                for t in self.terminal_records
            ),
            key=lambda t: (t["organ_id"], t["reason"], t["detail"]),
        )
        return {
            "symbol": self.symbol,
            "lifecycle": self.lifecycle.value,
            "expected_organs": sorted(self.expected_organs),
            "observations": observations,
            "terminal_records": terminals,
            "optional_shadow_missing": sorted(self.optional_shadow_missing),
        }

    @property
    def observation_set_content_hash(self) -> str:
        return content_hash(self.content_payload())


ArtifactKind = Literal[
    "observation",
    "terminal_record",
    "late_result",
    "determinism_conflict",
    "observation_set",
]
