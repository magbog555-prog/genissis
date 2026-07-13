"""Single ACTIVE instance rule per organ_id + version + symbol + runtime."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from threading import RLock
from uuid import uuid4


class InstanceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    TERMINATED = "TERMINATED"


@dataclass
class OrganInstance:
    organ_instance_id: str
    organ_id: str
    organ_version: str
    symbol: str
    runtime_id: str
    status: InstanceStatus


@dataclass
class InstanceRegistry:
    _lock: RLock = field(default_factory=RLock, repr=False)
    _active: dict[tuple[str, str, str, str], OrganInstance] = field(default_factory=dict)
    _by_id: dict[str, OrganInstance] = field(default_factory=dict)

    def _key(
        self, organ_id: str, organ_version: str, symbol: str, runtime_id: str
    ) -> tuple[str, str, str, str]:
        return (organ_id, organ_version, symbol, runtime_id)

    def activate(
        self, *, organ_id: str, organ_version: str, symbol: str, runtime_id: str
    ) -> OrganInstance:
        key = self._key(organ_id, organ_version, symbol, runtime_id)
        with self._lock:
            existing = self._active.get(key)
            if existing is not None and existing.status == InstanceStatus.ACTIVE:
                raise RuntimeError(
                    "ACTIVE_INSTANCE_EXISTS:"
                    f"{organ_id}/{organ_version}/{symbol}/{runtime_id}"
                )
            inst = OrganInstance(
                organ_instance_id=str(uuid4()),
                organ_id=organ_id,
                organ_version=organ_version,
                symbol=symbol,
                runtime_id=runtime_id,
                status=InstanceStatus.ACTIVE,
            )
            self._active[key] = inst
            self._by_id[inst.organ_instance_id] = inst
            return inst

    def complete(self, organ_instance_id: str, *, terminated: bool = False) -> None:
        with self._lock:
            inst = self._by_id.get(organ_instance_id)
            if inst is None:
                return
            inst.status = InstanceStatus.TERMINATED if terminated else InstanceStatus.COMPLETED
            key = self._key(inst.organ_id, inst.organ_version, inst.symbol, inst.runtime_id)
            active = self._active.get(key)
            if active and active.organ_instance_id == organ_instance_id:
                del self._active[key]

    def get_active(
        self, *, organ_id: str, organ_version: str, symbol: str, runtime_id: str
    ) -> OrganInstance | None:
        with self._lock:
            return self._active.get(self._key(organ_id, organ_version, symbol, runtime_id))
