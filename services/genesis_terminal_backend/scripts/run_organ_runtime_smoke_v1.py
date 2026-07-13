#!/usr/bin/env python3
"""RFC-0003 Organ Runtime smoke v1 — frozen acceptance gate."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.terminal.organ_runtime import CRASH_RECOVERY_SUPPORTED, OrganRuntime
from app.terminal.organ_runtime.runtime import EvaluationRequest


def main() -> int:
    clock = {"t": 1000}

    def now() -> int:
        clock["t"] += 1
        return clock["t"]

    rt = OrganRuntime(runtime_id="smoke-rt", now_ms=now)
    assert rt.crash_recovery_supported is False
    assert CRASH_RECOVERY_SUPPORTED is False

    builder = rt.open_set(
        set_id="smoke-set",
        symbol="ETHUSDT",
        expected_organs=("pulse",),
        cycle_id="smoke-cycle",
    )
    ok = rt.evaluate(
        EvaluationRequest(
            organ_id="pulse",
            organ_version="1.0.0",
            symbol="ETHUSDT",
            cycle_id="smoke-cycle",
            idempotency_key="smoke-ok",
            expected_revision=0,
            market_input={"signal": 0.5, "regime": "range"},
        ),
        set_id="smoke-set",
    )
    timeout = rt.evaluate(
        EvaluationRequest(
            organ_id="pulse",
            organ_version="1.0.0",
            symbol="ETHUSDT",
            cycle_id="smoke-cycle",
            idempotency_key="smoke-timeout",
            expected_revision=1,
            market_input={"signal": 0.5},
            simulate="TIMEOUT",
        ),
        set_id="smoke-set",
    )
    builder.begin_closing()
    closed = builder.close()

    report = {
        "smoke": "organ_runtime_v1",
        "status": "CLOSED",
        "frozen": True,
        "crash_recovery_supported": CRASH_RECOVERY_SUPPORTED,
        "influence_allowed": False,
        "observation_ok": ok.kind == "observation",
        "timeout_is_terminal": timeout.terminal is not None
        and timeout.observation is None
        and timeout.terminal.reason.value == "TIMEOUT",
        "set_lifecycle": closed.lifecycle.value,
        "observation_set_content_hash": closed.observation_set_content_hash,
        "observations": len(closed.observations),
        "terminal_records": len(closed.terminal_records),
    }
    print(json.dumps(report, indent=2, sort_keys=True))
    if not (
        report["observation_ok"]
        and report["timeout_is_terminal"]
        and report["set_lifecycle"] == "CLOSED"
        and report["frozen"]
    ):
        return 1
    print("SMOKE_CLOSED_FROZEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
