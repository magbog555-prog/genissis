"""RFC-0003 Organ Runtime Layer.

Scope: Organ Runtime only.
influence_allowed is always False at this layer.
CRASH_RECOVERY_SUPPORTED is False (same-process recovery only).
"""

from .constants import CRASH_RECOVERY_SUPPORTED, INFLUENCE_ALLOWED_DEFAULT
from .models import (
    LateResultArtifact,
    OrganEvaluationTerminalRecord,
    OrganObservation,
    OrganObservationSet,
    TerminalReason,
)
from .runtime import OrganRuntime

__all__ = [
    "CRASH_RECOVERY_SUPPORTED",
    "INFLUENCE_ALLOWED_DEFAULT",
    "LateResultArtifact",
    "OrganEvaluationTerminalRecord",
    "OrganObservation",
    "OrganObservationSet",
    "OrganRuntime",
    "TerminalReason",
]
