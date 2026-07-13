"""Deterministic content hashing for Organ Runtime artifacts."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from .constants import CONTENT_HASH_EXCLUDED_FIELDS


def _canonicalize(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            str(k): _canonicalize(v)
            for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))
            if str(k) not in CONTENT_HASH_EXCLUDED_FIELDS
        }
    if isinstance(value, (list, tuple)):
        return [_canonicalize(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if hasattr(value, "model_dump"):
        return _canonicalize(value.model_dump(mode="python"))
    return str(value)


def content_hash(payload: Mapping[str, Any] | Any) -> str:
    """SHA-256 over canonical JSON with identity/scheduling fields stripped."""
    if hasattr(payload, "model_dump"):
        data = payload.model_dump(mode="python")
    else:
        data = dict(payload)
    canonical = _canonicalize(data)
    encoded = json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
