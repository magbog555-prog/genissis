"""RFC-0003 Organ Runtime constants and honesty bounds."""

from __future__ import annotations

# Honest recovery boundary: same-process only. No cross-process crash recovery.
CRASH_RECOVERY_SUPPORTED: bool = False

# Organ Runtime never grants influence in RFC-0003.
INFLUENCE_ALLOWED_DEFAULT: bool = False

# Content hash must ignore identity / scheduling / language surfaces.
CONTENT_HASH_EXCLUDED_FIELDS: frozenset[str] = frozenset(
    {
        "runtime_id",
        "cycle_id",
        "organ_instance_id",
        "timestamps",
        "created_at_ms",
        "completed_at_ms",
        "deadline_state",
        "admission_state",
        "selection_class",
        "influence_allowed",
        "trader_language",
        "language_wording",
    }
)

DEFAULT_QUEUE_BOUND: int = 64
DEFAULT_EVALUATION_TIMEOUT_MS: int = 50
