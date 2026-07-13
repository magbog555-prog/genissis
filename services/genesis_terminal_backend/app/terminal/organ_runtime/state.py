"""Organ state store with compare-and-swap semantics."""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any


@dataclass
class OrganStateSnapshot:
    organ_id: str
    organ_version: str
    symbol: str
    revision: int
    payload: dict[str, Any]


@dataclass
class CASResult:
    ok: bool
    reason: str
    state: OrganStateSnapshot | None = None
    advanced: bool = False


@dataclass
class OrganStateStore:
    """In-process state store. CAS failure must not advance state."""

    _lock: RLock = field(default_factory=RLock, repr=False)
    _states: dict[tuple[str, str, str], OrganStateSnapshot] = field(default_factory=dict)
    _idempotency: dict[str, CASResult] = field(default_factory=dict)

    def get(self, organ_id: str, organ_version: str, symbol: str) -> OrganStateSnapshot | None:
        with self._lock:
            return self._states.get((organ_id, organ_version, symbol))

    def ensure(
        self, organ_id: str, organ_version: str, symbol: str, payload: dict[str, Any] | None = None
    ) -> OrganStateSnapshot:
        key = (organ_id, organ_version, symbol)
        with self._lock:
            existing = self._states.get(key)
            if existing is not None:
                return existing
            snap = OrganStateSnapshot(
                organ_id=organ_id,
                organ_version=organ_version,
                symbol=symbol,
                revision=0,
                payload=dict(payload or {}),
            )
            self._states[key] = snap
            return snap

    def cas_apply(
        self,
        *,
        organ_id: str,
        organ_version: str,
        symbol: str,
        expected_revision: int,
        new_payload: dict[str, Any],
        idempotency_key: str,
    ) -> CASResult:
        """
        Flow:
          idempotency pre-check → reservation → state computation → CAS → observe.
        """
        with self._lock:
            prior = self._idempotency.get(idempotency_key)
            if prior is not None:
                return prior

            key = (organ_id, organ_version, symbol)
            current = self._states.get(key)
            if current is None:
                current = OrganStateSnapshot(
                    organ_id=organ_id,
                    organ_version=organ_version,
                    symbol=symbol,
                    revision=0,
                    payload={},
                )
                self._states[key] = current

            # Reservation marker (same-process only).
            reservation = f"reserved:{idempotency_key}"
            _ = reservation

            if current.revision != expected_revision:
                result = CASResult(
                    ok=False,
                    reason="CAS_CONFLICT",
                    state=OrganStateSnapshot(
                        organ_id=current.organ_id,
                        organ_version=current.organ_version,
                        symbol=current.symbol,
                        revision=current.revision,
                        payload=dict(current.payload),
                    ),
                    advanced=False,
                )
                self._idempotency[idempotency_key] = result
                return result

            # State computation under lock, then CAS commit.
            advanced = OrganStateSnapshot(
                organ_id=organ_id,
                organ_version=organ_version,
                symbol=symbol,
                revision=current.revision + 1,
                payload=dict(new_payload),
            )
            self._states[key] = advanced
            result = CASResult(ok=True, reason="APPLIED", state=advanced, advanced=True)
            self._idempotency[idempotency_key] = result
            return result
