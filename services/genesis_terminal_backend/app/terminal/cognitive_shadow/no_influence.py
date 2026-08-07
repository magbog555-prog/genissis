"""Runtime no-influence counter and forbidden-import scan helpers."""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Iterable

_PRODUCTION_INFLUENCE_CALLS = 0

FORBIDDEN_IMPORT_FRAGMENTS = (
    "broker",
    "order_dto",
    "execution",
    "position",
    "account_truth",
    "scenario",
    "candidate",
    "decision",
    "risk",
)

# Authorized Scenario product layer (WAVE-0 / WAVE-0.1) — not trading "scenario" modules.
_ALLOWED_SCENARIO_IMPORT_PREFIXES = (
    "app.terminal.cognitive_shadow.scenario",
    "app.terminal.cognitive_shadow.scenario_join",
)

# Allowlisted module path segments that are cognitive-local (not production influence).
_PACKAGE = Path(__file__).resolve().parent


def record_production_influence_call() -> None:
    """Would be invoked if cognitive attempted production influence — must stay unused."""
    global _PRODUCTION_INFLUENCE_CALLS
    _PRODUCTION_INFLUENCE_CALLS += 1


def production_influence_call_count() -> int:
    return _PRODUCTION_INFLUENCE_CALLS


def reset_production_influence_call_count() -> None:
    global _PRODUCTION_INFLUENCE_CALLS
    _PRODUCTION_INFLUENCE_CALLS = 0


def assert_no_influence() -> None:
    if _PRODUCTION_INFLUENCE_CALLS != 0:
        raise AssertionError(f"production_influence_calls={_PRODUCTION_INFLUENCE_CALLS}")


def scan_forbidden_imports(paths: Iterable[Path] | None = None) -> list[str]:
    """AST-scan cognitive_shadow package for forbidden broker/order/execution imports."""
    root = _PACKAGE
    targets = list(paths) if paths is not None else sorted(root.glob("*.py"))
    violations: list[str] = []
    for path in targets:
        if path.name == "no_influence.py":
            # This module mentions fragments as data strings only — still parse imports.
            pass
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            violations.append(f"{path}:syntax:{exc}")
            continue
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                names = [mod] + [f"{mod}.{a.name}" for a in node.names]
            for name in names:
                lower = name.lower()
                for frag in FORBIDDEN_IMPORT_FRAGMENTS:
                    if frag in lower.split("."):
                        if frag == "scenario" and any(
                            lower == p or lower.startswith(p + ".")
                            for p in _ALLOWED_SCENARIO_IMPORT_PREFIXES
                        ):
                            continue
                        # ignore mentions inside this scanner's constant definitions via imports only
                        violations.append(f"{path.name}:{name}")
    return violations


def influence_allowed_always_false() -> bool:
    return False
