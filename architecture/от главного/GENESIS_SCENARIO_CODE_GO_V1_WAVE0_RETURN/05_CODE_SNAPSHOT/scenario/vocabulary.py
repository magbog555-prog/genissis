"""Scenario WAVE-0 vocabulary locked to SCENARIO_CANON_V1 (C6/C7/C12)."""

from __future__ import annotations

from enum import StrEnum


class EvidenceRelationKind(StrEnum):
    """C6 — evidence→hypothesis relations (not votes, not probabilities)."""

    SUPPORTS = "SUPPORTS"
    OPPOSES = "OPPOSES"
    UNKNOWN = "UNKNOWN"
    UNAVAILABLE = "UNAVAILABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class LifecycleStatus(StrEnum):
    """C7 — hypothesis lifecycle (not trade stop/timeout)."""

    LIVE_SUPPORTED = "LIVE_SUPPORTED"
    LIVE_CONTESTED = "LIVE_CONTESTED"
    LIVE_UNRESOLVED = "LIVE_UNRESOLVED"
    INVALIDATED = "INVALIDATED"
    EXPIRED = "EXPIRED"


class Wave1Target(StrEnum):
    """C12 CORE-4 wave-1 targets only. Range is reserve — not admitted here."""

    W1_1 = "W1-1"
    W1_2 = "W1-2"
    W1_3 = "W1-3"
    W1_4 = "W1-4"


class ProvenanceRelationKind(StrEnum):
    """C9 — legacy ID relation; fuzzy joins forbidden."""

    EXACT = "EXACT"
    PARTIAL = "PARTIAL"
    ANALOG = "ANALOG"
    NONE = "NONE"


class HonestyCode(StrEnum):
    """WAVE-0 honesty markers for stubs / missing anchors."""

    NOT_APPLICABLE = "NOT_APPLICABLE"
    UNAVAILABLE = "UNAVAILABLE"
    GAP_LISTED = "GAP_LISTED"


# C8: OPPOSES≠INVALIDATED, UNKNOWN≠UNAVAILABLE, EXPIRED≠INVALIDATED
# (enforced by distinct enum types / members; see tests).

WAVE1_TARGETS: frozenset[str] = frozenset(t.value for t in Wave1Target)

# Reserve (C12) — may exist as labels elsewhere; never as wave1_target.
RESERVE_TARGETS: frozenset[str] = frozenset(
    {
        "Range",
        "Range Rotation",
        "Range Rotation / Reversion",
        "W1-5",
        "RANGE",
    }
)

CORE4_TARGET_ORDER: tuple[Wave1Target, ...] = (
    Wave1Target.W1_1,
    Wave1Target.W1_2,
    Wave1Target.W1_3,
    Wave1Target.W1_4,
)
