"""Deep-freeze helpers for nested Organ Runtime structures."""

from __future__ import annotations

from types import MappingProxyType
from typing import Any, Mapping


class FrozenMutationError(TypeError):
    """Raised when a caller attempts to mutate a frozen nested structure."""


class _FrozenList(tuple):
    """Immutable sequence that rejects item assignment/mutation APIs."""

    def __repr__(self) -> str:  # pragma: no cover - repr sugar
        return f"FrozenList{tuple.__repr__(self)}"


def deep_freeze(value: Any) -> Any:
    """Recursively freeze mappings/lists into immutable views."""
    if isinstance(value, MappingProxyType) or isinstance(value, _FrozenList):
        return value
    if isinstance(value, Mapping):
        return MappingProxyType({k: deep_freeze(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return _FrozenList(deep_freeze(v) for v in value)
    if isinstance(value, set):
        return frozenset(deep_freeze(v) for v in value)
    return value


def assert_nested_immutable(container: Any, path: str = "root") -> None:
    """Attempt nested mutations; raise FrozenMutationError if mutation succeeds."""
    if isinstance(container, Mapping):
        try:
            container["__mutation_probe__"] = True  # type: ignore[index]
        except TypeError as exc:
            # Expected for MappingProxyType / frozen pydantic models via wrappers.
            _ = exc
        else:
            raise FrozenMutationError(f"mapping at {path} accepted mutation")
        for key, child in container.items():
            assert_nested_immutable(child, f"{path}.{key}")
        return

    if isinstance(container, (list, tuple)):
        if isinstance(container, list):
            raise FrozenMutationError(f"list at {path} is mutable")
        for idx, child in enumerate(container):
            assert_nested_immutable(child, f"{path}[{idx}]")
