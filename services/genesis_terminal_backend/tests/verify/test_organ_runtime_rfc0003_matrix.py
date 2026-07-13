"""Parametrized matrix cases for RFC-0003 architect review vectors."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.terminal.organ_runtime import OrganRuntime
from app.terminal.organ_runtime.admission import AdmissionClass
from app.terminal.organ_runtime.models import ObservationPresence, OrganObservation, TerminalReason
from app.terminal.organ_runtime.runtime import EvaluationRequest


def _rt(rid: str = "m") -> OrganRuntime:
    clock = {"t": 100}

    def now() -> int:
        clock["t"] += 1
        return clock["t"]

    return OrganRuntime(runtime_id=rid, now_ms=now)


def _req(**kwargs) -> EvaluationRequest:
    base = dict(
        organ_id="pulse",
        organ_version="1.0.0",
        symbol="BTCUSDT",
        cycle_id="c",
        idempotency_key="k",
        expected_revision=0,
        market_input={"signal": 1.0, "regime": "n"},
    )
    base.update(kwargs)
    return EvaluationRequest(**base)


@pytest.mark.parametrize("presence", list(ObservationPresence))
def test_observation_presence_variants(presence: ObservationPresence):
    rt = _rt(f"p-{presence.value}")
    out = rt.evaluate(
        _req(idempotency_key=f"p-{presence.value}"),
        eval_fn=lambda _m: {
            "presence": presence.value,
            "numeric_features": {"signal": 1.0},
            "semantic_profile": {"regime": "n"},
            "evidence_slot_refs": [],
        },
    )
    assert out.observation is not None
    assert out.observation.presence == presence
    assert out.observation.influence_allowed is False


@pytest.mark.parametrize(
    "runtime_id,cycle_id,instance_note,language",
    [
        ("rt-1", "c-1", "i-1", "en-A"),
        ("rt-2", "c-2", "i-2", "ru-Б"),
        ("rt-3", "c-3", "i-3", ""),
        ("rt-9", "c-9", "i-9", " altogether different wording "),
    ],
)
def test_hash_matrix_identity_surfaces(runtime_id, cycle_id, instance_note, language):
    base = dict(
        organ_id="pulse",
        organ_version="1.0.0",
        symbol="BTCUSDT",
        presence=ObservationPresence.PRESENT,
        numeric_features={"signal": 1.0},
        semantic_profile={"regime": "n"},
        evidence_slot_refs=("e1",),
    )
    ref = OrganObservation(**base, runtime_id="rt-0", cycle_id="c-0", organ_instance_id="i-0", trader_language="base")
    other = OrganObservation(
        **base,
        runtime_id=runtime_id,
        cycle_id=cycle_id,
        organ_instance_id=instance_note,
        trader_language=language,
    )
    assert ref.observation_content_hash == other.observation_content_hash


@pytest.mark.parametrize("symbol", ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"])
def test_cas_conflict_per_symbol(symbol: str):
    rt = _rt(f"cas-{symbol}")
    a = rt.evaluate(_req(symbol=symbol, idempotency_key=f"a-{symbol}", expected_revision=0))
    b = rt.evaluate(_req(symbol=symbol, idempotency_key=f"b-{symbol}", expected_revision=0))
    assert a.cas and a.cas.ok
    assert b.kind == "cas_conflict"
    assert b.cas and b.cas.advanced is False
    assert b.observation is None


@pytest.mark.parametrize(
    "simulate,reason",
    [
        ("TIMEOUT", TerminalReason.TIMEOUT),
        ("CANCELLED_BEFORE_START", TerminalReason.CANCELLED_BEFORE_START),
        ("CONFLICT", TerminalReason.DETERMINISM_CONFLICT),
    ],
)
@pytest.mark.parametrize("organ_id", ["pulse", "echo", "shadow", "guard"])
def test_terminal_matrix_no_market_obs(simulate, reason, organ_id):
    rt = _rt(f"t-{organ_id}-{simulate}")
    out = rt.evaluate(_req(organ_id=organ_id, idempotency_key=f"{organ_id}-{simulate}", simulate=simulate))
    assert out.observation is None
    assert out.terminal is not None
    assert out.terminal.reason == reason


@pytest.mark.parametrize("bound", [1, 2, 3])
def test_overload_matrix(bound: int):
    from app.terminal.organ_runtime.admission import QueuedEvaluation

    rt = _rt(f"ov-{bound}")
    rt.admission.bound = bound
    for i in range(bound):
        rt.admission._queue.append(QueuedEvaluation(priority=10, enqueued_at_ms=i, request=object()))
    out = rt.evaluate(_req(idempotency_key=f"ov-{bound}"))
    assert out.terminal is not None
    assert out.terminal.reason == TerminalReason.OVERLOAD_REJECTED


@pytest.mark.parametrize("n", range(8))
def test_idempotent_replay_matrix(n: int):
    rt = _rt(f"idem-{n}")
    key = f"same-{n}"
    first = rt.evaluate(_req(idempotency_key=key))
    second = rt.evaluate(_req(idempotency_key=key))
    assert first.observation.observation_content_hash == second.observation.observation_content_hash
    assert first.observation.organ_instance_id == second.observation.organ_instance_id


@pytest.mark.parametrize("order", [("pulse", "echo"), ("echo", "pulse"), ("pulse", "echo", "guard"), ("guard", "pulse", "echo")])
def test_set_hash_order_matrix(order):
    def run(rid: str) -> str:
        rt = _rt(rid)
        b = rt.open_set(set_id="s", symbol="BTCUSDT", expected_organs=tuple(sorted(order)), cycle_id="cx")
        for organ_id in order:
            rt.evaluate(_req(organ_id=organ_id, idempotency_key=f"{rid}-{organ_id}"), set_id="s")
        return b.close().observation_set_content_hash

    assert run("A-" + "-".join(order)) == run("B-" + "-".join(order))


@pytest.mark.parametrize("admission_class", [AdmissionClass.STALE, AdmissionClass.NORMAL, AdmissionClass.DECISION])
def test_admission_class_paths(admission_class: AdmissionClass):
    from app.terminal.organ_runtime.admission import QueuedEvaluation

    rt = _rt(f"adm-{admission_class.value}")
    if admission_class == AdmissionClass.NORMAL:
        rt.admission.bound = 1
        rt.admission._queue.append(QueuedEvaluation(priority=10, enqueued_at_ms=1, request=object()))
    out = rt.evaluate(_req(idempotency_key=f"adm-{admission_class.value}", admission_class=admission_class))
    if admission_class == AdmissionClass.STALE:
        assert out.terminal is not None
    elif admission_class == AdmissionClass.NORMAL:
        assert out.terminal is not None
    else:
        assert out.kind == "observation"
