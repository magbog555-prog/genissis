"""RFC-0003 Organ Runtime verification suite.

Independent evidence for Backend Architect source review.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.terminal.organ_runtime import (  # noqa: E402
    CRASH_RECOVERY_SUPPORTED,
    INFLUENCE_ALLOWED_DEFAULT,
    OrganRuntime,
)
from app.terminal.organ_runtime.admission import AdmissionClass  # noqa: E402
from app.terminal.organ_runtime.freeze import FrozenMutationError, assert_nested_immutable  # noqa: E402
from app.terminal.organ_runtime.models import (  # noqa: E402
    ObservationPresence,
    OrganObservation,
    SetLifecycle,
    TerminalReason,
)
from app.terminal.organ_runtime.observation_set import SetClosedError  # noqa: E402
from app.terminal.organ_runtime.runtime import EvaluationRequest  # noqa: E402


@pytest.fixture
def rt() -> OrganRuntime:
    clock = {"t": 1_700_000_000_000}

    def now() -> int:
        clock["t"] += 1
        return clock["t"]

    return OrganRuntime(runtime_id="rt-test-1", now_ms=now)


def _req(**kwargs) -> EvaluationRequest:
    base = dict(
        organ_id="pulse",
        organ_version="1.0.0",
        symbol="BTCUSDT",
        cycle_id="cycle-1",
        idempotency_key="idem-1",
        expected_revision=0,
        market_input={"signal": 1.5, "regime": "trend"},
    )
    base.update(kwargs)
    return EvaluationRequest(**base)


# ---------------------------------------------------------------------------
# Honesty / scope constants
# ---------------------------------------------------------------------------


def test_crash_recovery_honesty_bound():
    assert CRASH_RECOVERY_SUPPORTED is False
    runtime = OrganRuntime()
    assert runtime.crash_recovery_supported is False


def test_influence_allowed_always_false(rt: OrganRuntime):
    assert INFLUENCE_ALLOWED_DEFAULT is False
    out = rt.evaluate(_req())
    assert out.observation is not None
    assert out.observation.influence_allowed is False


# ---------------------------------------------------------------------------
# Successful observation
# ---------------------------------------------------------------------------


def test_successful_organ_observation(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-1",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    out = rt.evaluate(_req(), set_id="set-1")
    assert out.kind == "observation"
    assert out.observation is not None
    assert out.observation.presence == ObservationPresence.PRESENT
    assert out.accepted_into_set is True
    snap = builder.snapshot()
    assert len(snap.observations) == 1


# ---------------------------------------------------------------------------
# Timeout / cancel / overload — TerminalRecord, never market Observation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "simulate,reason",
    [
        ("TIMEOUT", TerminalReason.TIMEOUT),
        ("CANCELLED_BEFORE_START", TerminalReason.CANCELLED_BEFORE_START),
    ],
)
def test_terminal_reasons_are_not_market_observations(rt: OrganRuntime, simulate, reason):
    builder = rt.open_set(
        set_id="set-term",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    out = rt.evaluate(_req(simulate=simulate, idempotency_key=f"idem-{simulate}"), set_id="set-term")
    assert out.kind == "terminal"
    assert out.observation is None
    assert out.terminal is not None
    assert out.terminal.reason == reason
    # Must not mint PRESENT/ABSENT/UNKNOWN as Observation.
    snap = builder.snapshot()
    assert snap.observations == ()
    assert len(snap.terminal_records) == 1


def test_overload_rejected_terminal(rt: OrganRuntime):
    rt.admission.bound = 1
    # Fill queue with a normal item without consuming via evaluate path:
    # first request admitted+popped in evaluate; we force overload by pre-filling.
    from app.terminal.organ_runtime.admission import QueuedEvaluation

    rt.admission._queue.append(QueuedEvaluation(priority=10, enqueued_at_ms=1, request=object()))
    out = rt.evaluate(_req(idempotency_key="idem-overload", admission_class=AdmissionClass.NORMAL))
    assert out.terminal is not None
    assert out.terminal.reason == TerminalReason.OVERLOAD_REJECTED
    assert out.observation is None


def test_stale_rejected_no_delayed_market_observation(rt: OrganRuntime):
    out = rt.evaluate(
        _req(idempotency_key="idem-stale", admission_class=AdmissionClass.STALE)
    )
    assert out.terminal is not None
    assert out.terminal.reason == TerminalReason.OVERLOAD_REJECTED
    assert out.terminal.detail == "STALE_REJECTED"
    assert out.observation is None


# ---------------------------------------------------------------------------
# Late result + determinism conflict artifacts
# ---------------------------------------------------------------------------


def test_late_result_artifact(rt: OrganRuntime):
    out = rt.evaluate(_req(simulate="LATE", idempotency_key="idem-late"))
    assert out.kind == "late"
    assert out.late is not None
    assert out.accepted_into_set is False
    assert out.observation is None


def test_determinism_conflict_artifact(rt: OrganRuntime):
    out = rt.evaluate(_req(simulate="CONFLICT", idempotency_key="idem-conflict"))
    assert out.kind == "conflict"
    assert out.conflict is not None
    assert out.terminal is not None
    assert out.terminal.reason == TerminalReason.DETERMINISM_CONFLICT


# ---------------------------------------------------------------------------
# Set closure
# ---------------------------------------------------------------------------


def test_set_open_closing_closed_and_no_add_after_closing(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-close",
        symbol="BTCUSDT",
        expected_organs=("pulse", "shadow"),
        cycle_id="cycle-1",
    )
    assert builder.lifecycle == SetLifecycle.OPEN
    rt.evaluate(_req(idempotency_key="idem-close-1"), set_id="set-close")
    builder.begin_closing()
    assert builder.lifecycle == SetLifecycle.CLOSING
    with pytest.raises(SetClosedError):
        builder.add_observation(
            OrganObservation(
                organ_id="pulse",
                organ_version="1.0.0",
                symbol="BTCUSDT",
                presence=ObservationPresence.PRESENT,
            )
        )
    builder.mark_optional_shadow_missing("shadow")
    closed = builder.close()
    assert closed.lifecycle == SetLifecycle.CLOSED
    assert "shadow" in closed.optional_shadow_missing
    assert closed.observation_set_content_hash


def test_closed_set_with_timeout(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-to",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    rt.evaluate(_req(simulate="TIMEOUT", idempotency_key="idem-to"), set_id="set-to")
    builder.begin_closing()
    closed = builder.close()
    assert closed.lifecycle == SetLifecycle.CLOSED
    assert len(closed.terminal_records) == 1
    assert closed.terminal_records[0].reason == TerminalReason.TIMEOUT
    assert closed.observations == ()


# ---------------------------------------------------------------------------
# State CAS
# ---------------------------------------------------------------------------


def test_cas_conflict_does_not_advance_or_accept_observation(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-cas",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    first = rt.evaluate(_req(idempotency_key="idem-cas-1", expected_revision=0), set_id="set-cas")
    assert first.cas is not None and first.cas.ok
    assert first.accepted_into_set is True

    second = rt.evaluate(
        _req(idempotency_key="idem-cas-2", expected_revision=0),  # stale revision
        set_id="set-cas",
    )
    assert second.kind == "cas_conflict"
    assert second.cas is not None
    assert second.cas.ok is False
    assert second.cas.advanced is False
    assert second.observation is None
    assert second.accepted_into_set is False
    # Only first observation in set.
    assert len(builder.snapshot().observations) == 1
    # State revision unchanged by conflict path (still 1 from first apply).
    snap = rt.state.get("pulse", "1.0.0", "BTCUSDT")
    assert snap is not None
    assert snap.revision == 1


def test_duplicate_evaluation_idempotent_replay(rt: OrganRuntime):
    first = rt.evaluate(_req(idempotency_key="idem-dup"))
    second = rt.evaluate(_req(idempotency_key="idem-dup"))
    assert first.kind == second.kind == "observation"
    assert first.observation is not None and second.observation is not None
    assert first.observation.organ_instance_id == second.observation.organ_instance_id
    assert first.observation.observation_content_hash == second.observation.observation_content_hash


# ---------------------------------------------------------------------------
# Single ACTIVE instance
# ---------------------------------------------------------------------------


def test_one_active_instance_per_organ_version_symbol_runtime(rt: OrganRuntime):
    from app.terminal.organ_runtime.instances import InstanceStatus

    a = rt.instances.activate(
        organ_id="pulse", organ_version="1.0.0", symbol="BTCUSDT", runtime_id=rt.runtime_id
    )
    assert a.status == InstanceStatus.ACTIVE
    with pytest.raises(RuntimeError, match="ACTIVE_INSTANCE_EXISTS"):
        rt.instances.activate(
            organ_id="pulse", organ_version="1.0.0", symbol="BTCUSDT", runtime_id=rt.runtime_id
        )
    rt.instances.complete(a.organ_instance_id)
    b = rt.instances.activate(
        organ_id="pulse", organ_version="1.0.0", symbol="BTCUSDT", runtime_id=rt.runtime_id
    )
    assert b.organ_instance_id != a.organ_instance_id


# ---------------------------------------------------------------------------
# Deep freeze
# ---------------------------------------------------------------------------


def test_deep_freeze_nested_mutation_raises(rt: OrganRuntime):
    out = rt.evaluate(_req(idempotency_key="idem-freeze"))
    obs = out.observation
    assert obs is not None
    with pytest.raises(TypeError):
        obs.numeric_features["signal"] = 99.0  # type: ignore[index]
    with pytest.raises(TypeError):
        obs.semantic_profile["regime"] = "hacked"  # type: ignore[index]
    # Immutable maps pass the probe; mutable lists must fail it.
    assert_nested_immutable(obs.numeric_features, "numeric_features")
    assert_nested_immutable(obs.semantic_profile, "semantic_profile")
    with pytest.raises(FrozenMutationError):
        assert_nested_immutable(["mutable"], "bad")


def test_set_nested_collections_frozen(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-frz",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    rt.evaluate(_req(idempotency_key="idem-frz"), set_id="set-frz")
    closed = builder.close()
    with pytest.raises(TypeError):
        closed.observations[0].numeric_features["x"] = 1  # type: ignore[index]
    with pytest.raises(Exception):
        closed.expected_organs = ("nope",)  # type: ignore[misc]
    assert len(closed.observations) == 1
    assert len(closed.terminal_records) == 0


# ---------------------------------------------------------------------------
# Hash determinism independence
# ---------------------------------------------------------------------------


def test_content_hash_independent_of_runtime_cycle_instance_language():
    base = dict(
        organ_id="pulse",
        organ_version="1.0.0",
        symbol="BTCUSDT",
        presence=ObservationPresence.PRESENT,
        numeric_features={"signal": 1.5},
        semantic_profile={"regime": "trend"},
        evidence_slot_refs=("slot-a",),
    )
    a = OrganObservation(
        **base,
        runtime_id="rt-A",
        cycle_id="c1",
        organ_instance_id="i1",
        trader_language="bullish impulse",
        created_at_ms=1,
    )
    b = OrganObservation(
        **base,
        runtime_id="rt-B",
        cycle_id="c2",
        organ_instance_id="i2",
        trader_language="совсем другая формулировка",
        created_at_ms=999,
    )
    assert a.observation_content_hash == b.observation_content_hash


def test_observation_set_hash_independent_of_runtime_and_completion_order(rt: OrganRuntime):
    def build(runtime_id: str, order: list[str]) -> str:
        local = OrganRuntime(runtime_id=runtime_id, now_ms=rt.now_ms)
        builder = local.open_set(
            set_id="set-h",
            symbol="BTCUSDT",
            expected_organs=("pulse", "echo"),
            cycle_id=f"cycle-{runtime_id}",
        )
        for organ_id in order:
            local.evaluate(
                _req(
                    organ_id=organ_id,
                    idempotency_key=f"{runtime_id}-{organ_id}",
                    cycle_id=f"cycle-{runtime_id}",
                    trader_language=f"lang-{runtime_id}",
                ),
                set_id="set-h",
            )
        return builder.close().observation_set_content_hash

    h1 = build("rt-X", ["pulse", "echo"])
    h2 = build("rt-Y", ["echo", "pulse"])
    assert h1 == h2


# ---------------------------------------------------------------------------
# Decision priority / backpressure
# ---------------------------------------------------------------------------


def test_decision_priority_bypasses_full_queue(rt: OrganRuntime):
    rt.admission.bound = 1
    from app.terminal.organ_runtime.admission import QueuedEvaluation

    rt.admission._queue.append(QueuedEvaluation(priority=10, enqueued_at_ms=1, request=object()))
    rejected = rt.evaluate(_req(idempotency_key="n1", admission_class=AdmissionClass.NORMAL))
    assert rejected.terminal is not None
    accepted = rt.evaluate(_req(idempotency_key="d1", admission_class=AdmissionClass.DECISION))
    assert accepted.kind == "observation"


def test_same_process_recovery_flag_documented(rt: OrganRuntime):
    assert rt.crash_recovery_supported is False


def test_timeout_never_emits_presence_enum_values(rt: OrganRuntime):
    out = rt.evaluate(_req(simulate="TIMEOUT", idempotency_key="idem-no-presence"))
    assert out.terminal is not None
    dumped = out.terminal.model_dump()
    assert "presence" not in dumped
    assert out.observation is None


def test_closing_allows_terminal_but_not_observation(rt: OrganRuntime):
    builder = rt.open_set(
        set_id="set-closing-term",
        symbol="BTCUSDT",
        expected_organs=("pulse",),
        cycle_id="cycle-1",
    )
    builder.begin_closing()
    terminal_out = rt.evaluate(
        _req(simulate="TIMEOUT", idempotency_key="idem-closing-term"),
        set_id="set-closing-term",
    )
    assert terminal_out.accepted_into_set is True
    with pytest.raises(SetClosedError):
        builder.add_observation(
            OrganObservation(
                organ_id="pulse",
                organ_version="1.0.0",
                symbol="BTCUSDT",
                presence=ObservationPresence.PRESENT,
            )
        )


def test_evidence_slot_refs_are_immutable_tuple(rt: OrganRuntime):
    out = rt.evaluate(_req(idempotency_key="idem-refs"))
    assert out.observation is not None
    assert isinstance(out.observation.evidence_slot_refs, tuple)
    with pytest.raises(Exception):
        out.observation.evidence_slot_refs += ("x",)  # type: ignore[misc]
