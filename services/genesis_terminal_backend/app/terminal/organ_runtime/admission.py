"""Admission / backpressure for Organ Runtime evaluations."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from threading import RLock
from typing import Any, Deque

from .constants import DEFAULT_QUEUE_BOUND
from .models import OrganEvaluationTerminalRecord, TerminalReason


class AdmissionClass(str, Enum):
    DECISION = "DECISION"
    NORMAL = "NORMAL"
    STALE = "STALE"


@dataclass(order=True)
class QueuedEvaluation:
    priority: int
    enqueued_at_ms: int
    request: Any = field(compare=False)


@dataclass
class AdmissionController:
    bound: int = DEFAULT_QUEUE_BOUND
    _lock: RLock = field(default_factory=RLock, repr=False)
    _queue: Deque[QueuedEvaluation] = field(default_factory=deque)
    rejected_stale: int = 0
    rejected_overload: int = 0

    @staticmethod
    def _priority(admission_class: AdmissionClass) -> int:
        # Lower number = higher priority.
        if admission_class == AdmissionClass.DECISION:
            return 0
        if admission_class == AdmissionClass.NORMAL:
            return 10
        return 100

    def admit(
        self,
        request: Any,
        *,
        admission_class: AdmissionClass,
        now_ms: int,
        organ_id: str,
        organ_version: str,
        symbol: str,
        runtime_id: str,
        cycle_id: str,
        organ_instance_id: str = "",
    ) -> OrganEvaluationTerminalRecord | None:
        """Return terminal record on reject; None if admitted."""
        with self._lock:
            if admission_class == AdmissionClass.STALE:
                self.rejected_stale += 1
                return OrganEvaluationTerminalRecord(
                    organ_id=organ_id,
                    organ_version=organ_version,
                    symbol=symbol,
                    reason=TerminalReason.OVERLOAD_REJECTED,
                    detail="STALE_REJECTED",
                    runtime_id=runtime_id,
                    cycle_id=cycle_id,
                    organ_instance_id=organ_instance_id,
                    created_at_ms=now_ms,
                )

            if len(self._queue) >= self.bound and admission_class != AdmissionClass.DECISION:
                self.rejected_overload += 1
                return OrganEvaluationTerminalRecord(
                    organ_id=organ_id,
                    organ_version=organ_version,
                    symbol=symbol,
                    reason=TerminalReason.OVERLOAD_REJECTED,
                    detail="QUEUE_BOUND_EXCEEDED",
                    runtime_id=runtime_id,
                    cycle_id=cycle_id,
                    organ_instance_id=organ_instance_id,
                    created_at_ms=now_ms,
                )

            item = QueuedEvaluation(
                priority=self._priority(admission_class),
                enqueued_at_ms=now_ms,
                request=request,
            )
            if admission_class == AdmissionClass.DECISION:
                self._queue.appendleft(item)
            else:
                self._queue.append(item)
            return None

    def pop(self) -> QueuedEvaluation | None:
        with self._lock:
            if not self._queue:
                return None
            return self._queue.popleft()

    def depth(self) -> int:
        with self._lock:
            return len(self._queue)
