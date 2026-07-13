"""OrganObservationSet lifecycle: OPEN → CLOSING → CLOSED."""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock

from .models import (
    OrganEvaluationTerminalRecord,
    OrganObservation,
    OrganObservationSet,
    SetLifecycle,
)


class SetClosedError(RuntimeError):
    pass


@dataclass
class ObservationSetBuilder:
    set_id: str
    symbol: str
    expected_organs: tuple[str, ...]
    runtime_id: str = ""
    cycle_id: str = ""
    created_at_ms: int = 0
    _lock: RLock = field(default_factory=RLock, repr=False)
    _lifecycle: SetLifecycle = SetLifecycle.OPEN
    _observations: list[OrganObservation] = field(default_factory=list)
    _terminals: list[OrganEvaluationTerminalRecord] = field(default_factory=list)
    _optional_shadow_missing: list[str] = field(default_factory=list)

    @property
    def lifecycle(self) -> SetLifecycle:
        return self._lifecycle

    def add_observation(self, observation: OrganObservation) -> None:
        with self._lock:
            if self._lifecycle != SetLifecycle.OPEN:
                raise SetClosedError("cannot add observation after CLOSING/CLOSED")
            self._observations.append(observation)

    def add_terminal(self, terminal: OrganEvaluationTerminalRecord) -> None:
        with self._lock:
            if self._lifecycle == SetLifecycle.CLOSED:
                raise SetClosedError("cannot add terminal after CLOSED")
            self._terminals.append(terminal)

    def mark_optional_shadow_missing(self, organ_id: str) -> None:
        with self._lock:
            if self._lifecycle == SetLifecycle.CLOSED:
                raise SetClosedError("cannot mutate after CLOSED")
            if organ_id not in self._optional_shadow_missing:
                self._optional_shadow_missing.append(organ_id)

    def begin_closing(self) -> None:
        with self._lock:
            if self._lifecycle == SetLifecycle.CLOSED:
                raise SetClosedError("already CLOSED")
            self._lifecycle = SetLifecycle.CLOSING

    def close(self) -> OrganObservationSet:
        with self._lock:
            self._lifecycle = SetLifecycle.CLOSED
            return OrganObservationSet(
                set_id=self.set_id,
                symbol=self.symbol,
                lifecycle=SetLifecycle.CLOSED,
                expected_organs=self.expected_organs,
                observations=tuple(self._observations),
                terminal_records=tuple(self._terminals),
                optional_shadow_missing=tuple(self._optional_shadow_missing),
                runtime_id=self.runtime_id,
                cycle_id=self.cycle_id,
                created_at_ms=self.created_at_ms,
            )

    def snapshot(self) -> OrganObservationSet:
        with self._lock:
            return OrganObservationSet(
                set_id=self.set_id,
                symbol=self.symbol,
                lifecycle=self._lifecycle,
                expected_organs=self.expected_organs,
                observations=tuple(self._observations),
                terminal_records=tuple(self._terminals),
                optional_shadow_missing=tuple(self._optional_shadow_missing),
                runtime_id=self.runtime_id,
                cycle_id=self.cycle_id,
                created_at_ms=self.created_at_ms,
            )
