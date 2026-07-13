#!/usr/bin/env python3
"""Generate RFC-0003 acceptance JSONL samples (mandatory evidence set)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.terminal.organ_runtime import OrganRuntime
from app.terminal.organ_runtime.admission import AdmissionClass, QueuedEvaluation
from app.terminal.organ_runtime.runtime import EvaluationRequest

OUT_DIR = ROOT / "acceptance_samples"
SAMPLES = {
    "organ_observation_samples.jsonl": [],
    "organ_terminal_record_samples.jsonl": [],
    "late_result_artifact_samples.jsonl": [],
    "determinism_conflict_artifact_samples.jsonl": [],
    "organ_observation_set_samples.jsonl": [],
    "cas_and_idempotency_samples.jsonl": [],
}


def _dump(model) -> dict:
    from types import MappingProxyType

    if hasattr(model, "model_dump"):
        data = model.model_dump(mode="python")

        def convert(value):
            if isinstance(value, MappingProxyType):
                return {k: convert(v) for k, v in value.items()}
            if isinstance(value, tuple):
                return [convert(v) for v in value]
            if isinstance(value, dict):
                return {k: convert(v) for k, v in value.items()}
            if hasattr(value, "value") and not isinstance(value, (str, bytes)):
                try:
                    return value.value
                except Exception:
                    return value
            return value

        data = convert(data)
        if hasattr(model, "observation_content_hash"):
            data["observation_content_hash"] = model.observation_content_hash
        if hasattr(model, "observation_set_content_hash"):
            data["observation_set_content_hash"] = model.observation_set_content_hash
        return data
    if hasattr(model, "__dict__"):
        return {k: v for k, v in model.__dict__.items() if not k.startswith("_")}
    return {"value": str(model)}


def _req(**kwargs) -> EvaluationRequest:
    base = dict(
        organ_id="pulse",
        organ_version="1.0.0",
        symbol="BTCUSDT",
        cycle_id="cycle-accept-1",
        idempotency_key="idem",
        expected_revision=0,
        market_input={"signal": 2.0, "regime": "impulse", "evidence_slot_refs": ["e1"]},
        trader_language="impulse confirmation",
    )
    base.update(kwargs)
    return EvaluationRequest(**base)


def main() -> int:
    clock = {"t": 1_715_000_000_000}

    def now() -> int:
        clock["t"] += 10
        return clock["t"]

    rt = OrganRuntime(runtime_id="rt-accept-1", now_ms=now)

    # 1. Successful OrganObservation
    b1 = rt.open_set(set_id="set-ok", symbol="BTCUSDT", expected_organs=("pulse",), cycle_id="c-ok")
    ok = rt.evaluate(_req(idempotency_key="idem-ok"), set_id="set-ok")
    SAMPLES["organ_observation_samples.jsonl"].append(
        {"sample": "successful_organ_observation", **_dump(ok.observation)}
    )

    # 2. TIMEOUT TerminalRecord
    b2 = rt.open_set(set_id="set-to", symbol="BTCUSDT", expected_organs=("pulse",), cycle_id="c-to")
    to = rt.evaluate(_req(idempotency_key="idem-to", simulate="TIMEOUT"), set_id="set-to")
    SAMPLES["organ_terminal_record_samples.jsonl"].append(
        {"sample": "timeout_terminal_record", **_dump(to.terminal)}
    )

    # 3. CANCELLED_BEFORE_START
    cancel = rt.evaluate(_req(idempotency_key="idem-cancel", simulate="CANCELLED_BEFORE_START"))
    SAMPLES["organ_terminal_record_samples.jsonl"].append(
        {"sample": "cancelled_before_start_terminal_record", **_dump(cancel.terminal)}
    )

    # 4. OVERLOAD_REJECTED
    rt.admission.bound = 1
    rt.admission._queue.append(QueuedEvaluation(priority=10, enqueued_at_ms=1, request=object()))
    overload = rt.evaluate(_req(idempotency_key="idem-overload"))
    SAMPLES["organ_terminal_record_samples.jsonl"].append(
        {"sample": "overload_rejected_terminal_record", **_dump(overload.terminal)}
    )
    rt.admission._queue.clear()
    rt.admission.bound = 64

    # 5. LateResultArtifact (fresh runtime — avoid CAS pollution)
    rt_late = OrganRuntime(runtime_id="rt-late", now_ms=now)
    late = rt_late.evaluate(_req(idempotency_key="idem-late", simulate="LATE"))
    assert late.late is not None, late
    SAMPLES["late_result_artifact_samples.jsonl"].append(
        {"sample": "late_result_artifact", **_dump(late.late)}
    )

    # 6. DETERMINISM_CONFLICT artifact
    rt_conf = OrganRuntime(runtime_id="rt-conflict", now_ms=now)
    conflict = rt_conf.evaluate(_req(idempotency_key="idem-conflict", simulate="CONFLICT"))
    assert conflict.conflict is not None, conflict
    SAMPLES["determinism_conflict_artifact_samples.jsonl"].append(
        {
            "sample": "determinism_conflict_artifact",
            "artifact": _dump(conflict.conflict),
            "terminal": _dump(conflict.terminal),
        }
    )

    # 7. CLOSED Set with timeout
    b2.begin_closing()
    closed_timeout = b2.close()
    SAMPLES["organ_observation_set_samples.jsonl"].append(
        {"sample": "closed_set_with_timeout", **_dump(closed_timeout)}
    )

    # 8. CLOSED Set with optional-shadow missing
    b_shadow = rt.open_set(
        set_id="set-shadow",
        symbol="BTCUSDT",
        expected_organs=("pulse", "shadow"),
        cycle_id="c-shadow",
    )
    rt.evaluate(_req(idempotency_key="idem-shadow-pulse"), set_id="set-shadow")
    b_shadow.mark_optional_shadow_missing("shadow")
    b_shadow.begin_closing()
    closed_shadow = b_shadow.close()
    SAMPLES["organ_observation_set_samples.jsonl"].append(
        {"sample": "closed_set_with_optional_shadow_missing", **_dump(closed_shadow)}
    )

    # also keep successful closed set reference
    b1.begin_closing()
    SAMPLES["organ_observation_set_samples.jsonl"].append(
        {"sample": "closed_set_successful", **_dump(b1.close())}
    )

    # 9. State CAS conflict with unchanged state
    rt2 = OrganRuntime(runtime_id="rt-cas", now_ms=now)
    first = rt2.evaluate(_req(idempotency_key="cas-1", expected_revision=0))
    conflict_cas = rt2.evaluate(_req(idempotency_key="cas-2", expected_revision=0))
    state = rt2.state.get("pulse", "1.0.0", "BTCUSDT")
    SAMPLES["cas_and_idempotency_samples.jsonl"].append(
        {
            "sample": "state_cas_conflict_unchanged_state",
            "first_ok": first.cas.ok if first.cas else None,
            "conflict_ok": conflict_cas.cas.ok if conflict_cas.cas else None,
            "conflict_advanced": conflict_cas.cas.advanced if conflict_cas.cas else None,
            "accepted_observation": conflict_cas.observation is not None,
            "accepted_into_set": conflict_cas.accepted_into_set,
            "state_revision": state.revision if state else None,
        }
    )

    # 10. Duplicate evaluation idempotent replay
    rt3 = OrganRuntime(runtime_id="rt-idem", now_ms=now)
    a = rt3.evaluate(_req(idempotency_key="same-key"))
    b = rt3.evaluate(_req(idempotency_key="same-key"))
    SAMPLES["cas_and_idempotency_samples.jsonl"].append(
        {
            "sample": "duplicate_evaluation_idempotent_replay",
            "first_instance": a.observation.organ_instance_id if a.observation else None,
            "second_instance": b.observation.organ_instance_id if b.observation else None,
            "same_hash": (
                a.observation.observation_content_hash == b.observation.observation_content_hash
                if a.observation and b.observation
                else False
            ),
            "first_hash": a.observation.observation_content_hash if a.observation else None,
        }
    )

    # Stale rejection evidence (extra, related to backpressure)
    stale = rt.evaluate(_req(idempotency_key="idem-stale", admission_class=AdmissionClass.STALE))
    SAMPLES["organ_terminal_record_samples.jsonl"].append(
        {"sample": "stale_rejected_terminal_record", **_dump(stale.terminal)}
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, rows in SAMPLES.items():
        path = OUT_DIR / name
        with path.open("w", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=True, sort_keys=True) + "\n")
        manifest.append({"file": name, "rows": len(rows)})
        print(f"wrote {path} ({len(rows)} rows)")

    (OUT_DIR / "MANIFEST.json").write_text(
        json.dumps(
            {
                "rfc": "RFC-0003",
                "package": "acceptance_samples",
                "required_samples": [
                    "Successful OrganObservation",
                    "TIMEOUT TerminalRecord",
                    "CANCELLED_BEFORE_START TerminalRecord",
                    "OVERLOAD_REJECTED TerminalRecord",
                    "LateResultArtifact",
                    "DETERMINISM_CONFLICT artifact",
                    "CLOSED Set with timeout",
                    "CLOSED Set with optional-shadow missing",
                    "State CAS conflict with unchanged state",
                    "Duplicate evaluation idempotent replay",
                ],
                "files": manifest,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
