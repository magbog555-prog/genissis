"""OrganRuntime facade — RFC-0003 evaluation orchestration."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping
from uuid import uuid4

from .admission import AdmissionClass, AdmissionController
from .constants import (
    CRASH_RECOVERY_SUPPORTED,
    DEFAULT_EVALUATION_TIMEOUT_MS,
    INFLUENCE_ALLOWED_DEFAULT,
)
from .hashes import content_hash
from .instances import InstanceRegistry
from .models import (
    DeterminismConflictArtifact,
    LateResultArtifact,
    ObservationPresence,
    OrganEvaluationTerminalRecord,
    OrganObservation,
    TerminalReason,
)
from .observation_set import ObservationSetBuilder, SetClosedError
from .state import CASResult, OrganStateStore


EvalFn = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass
class EvaluationRequest:
    organ_id: str
    organ_version: str
    symbol: str
    cycle_id: str
    idempotency_key: str
    expected_revision: int
    market_input: dict[str, Any]
    admission_class: AdmissionClass = AdmissionClass.NORMAL
    timeout_ms: int = DEFAULT_EVALUATION_TIMEOUT_MS
    trader_language: str = ""
    simulate: str | None = None  # TIMEOUT | CANCELLED_BEFORE_START | LATE | CONFLICT


@dataclass
class EvaluationOutcome:
    kind: str
    observation: OrganObservation | None = None
    terminal: OrganEvaluationTerminalRecord | None = None
    late: LateResultArtifact | None = None
    conflict: DeterminismConflictArtifact | None = None
    cas: CASResult | None = None
    accepted_into_set: bool = False


@dataclass
class OrganRuntime:
    runtime_id: str = field(default_factory=lambda: f"rt-{uuid4()}")
    state: OrganStateStore = field(default_factory=OrganStateStore)
    instances: InstanceRegistry = field(default_factory=InstanceRegistry)
    admission: AdmissionController = field(default_factory=AdmissionController)
    now_ms: Callable[[], int] = field(default=lambda: 0)
    crash_recovery_supported: bool = CRASH_RECOVERY_SUPPORTED
    influence_allowed: bool = INFLUENCE_ALLOWED_DEFAULT
    _sets: dict[str, ObservationSetBuilder] = field(default_factory=dict)
    _completed_evals: dict[str, EvaluationOutcome] = field(default_factory=dict)
    _hash_registry: dict[tuple[str, str, str, str], str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.influence_allowed is not False:
            self.influence_allowed = False
        if self.crash_recovery_supported is not False:
            # Honesty bound — cannot claim cross-process recovery.
            self.crash_recovery_supported = False

    def open_set(
        self,
        *,
        set_id: str,
        symbol: str,
        expected_organs: tuple[str, ...],
        cycle_id: str,
    ) -> ObservationSetBuilder:
        builder = ObservationSetBuilder(
            set_id=set_id,
            symbol=symbol,
            expected_organs=expected_organs,
            runtime_id=self.runtime_id,
            cycle_id=cycle_id,
            created_at_ms=self.now_ms(),
        )
        self._sets[set_id] = builder
        return builder

    def get_set(self, set_id: str) -> ObservationSetBuilder:
        return self._sets[set_id]

    def evaluate(
        self,
        request: EvaluationRequest,
        *,
        eval_fn: EvalFn | None = None,
        set_id: str | None = None,
    ) -> EvaluationOutcome:
        # Idempotent replay of a completed evaluation.
        prior = self._completed_evals.get(request.idempotency_key)
        if prior is not None:
            return prior

        ts = self.now_ms()

        if request.simulate == "CANCELLED_BEFORE_START":
            terminal = OrganEvaluationTerminalRecord(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                reason=TerminalReason.CANCELLED_BEFORE_START,
                detail="cancelled before start",
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                created_at_ms=ts,
            )
            outcome = EvaluationOutcome(kind="terminal", terminal=terminal)
            self._attach_terminal(set_id, terminal, outcome)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        reject = self.admission.admit(
            request,
            admission_class=request.admission_class,
            now_ms=ts,
            organ_id=request.organ_id,
            organ_version=request.organ_version,
            symbol=request.symbol,
            runtime_id=self.runtime_id,
            cycle_id=request.cycle_id,
        )
        if reject is not None:
            outcome = EvaluationOutcome(kind="terminal", terminal=reject)
            self._attach_terminal(set_id, reject, outcome)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        # Pop admission slot (bounded work started).
        self.admission.pop()

        try:
            instance = self.instances.activate(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                runtime_id=self.runtime_id,
            )
        except RuntimeError as exc:
            terminal = OrganEvaluationTerminalRecord(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                reason=TerminalReason.OVERLOAD_REJECTED,
                detail=str(exc),
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                created_at_ms=ts,
            )
            outcome = EvaluationOutcome(kind="terminal", terminal=terminal)
            self._attach_terminal(set_id, terminal, outcome)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        if request.simulate == "TIMEOUT":
            terminal = OrganEvaluationTerminalRecord(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                reason=TerminalReason.TIMEOUT,
                detail=f"exceeded {request.timeout_ms}ms",
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                organ_instance_id=instance.organ_instance_id,
                created_at_ms=ts,
            )
            self.instances.complete(instance.organ_instance_id, terminated=True)
            outcome = EvaluationOutcome(kind="terminal", terminal=terminal)
            self._attach_terminal(set_id, terminal, outcome)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        # Successful path: compute → CAS → register observation.
        fn = eval_fn or self._default_eval
        computed = fn(dict(request.market_input))
        obs_payload = {
            "presence": computed.get("presence", ObservationPresence.PRESENT.value),
            "numeric_features": dict(computed.get("numeric_features") or {}),
            "semantic_profile": dict(computed.get("semantic_profile") or {}),
            "evidence_slot_refs": list(computed.get("evidence_slot_refs") or []),
        }
        machine_hash = content_hash(
            {
                "organ_id": request.organ_id,
                "organ_version": request.organ_version,
                "symbol": request.symbol,
                **obs_payload,
            }
        )

        hash_key = (request.organ_id, request.organ_version, request.symbol, request.cycle_id)
        prior_hash = self._hash_registry.get(hash_key)
        if request.simulate == "CONFLICT" or (prior_hash and prior_hash != machine_hash):
            conflict = DeterminismConflictArtifact(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                expected_hash=prior_hash or machine_hash,
                actual_hash=machine_hash if prior_hash else f"conflict-{machine_hash}",
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                organ_instance_id=instance.organ_instance_id,
                created_at_ms=ts,
            )
            terminal = OrganEvaluationTerminalRecord(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                reason=TerminalReason.DETERMINISM_CONFLICT,
                detail="hash mismatch",
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                organ_instance_id=instance.organ_instance_id,
                created_at_ms=ts,
            )
            self.instances.complete(instance.organ_instance_id, terminated=True)
            outcome = EvaluationOutcome(kind="conflict", terminal=terminal, conflict=conflict)
            self._attach_terminal(set_id, terminal, outcome)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        cas = self.state.cas_apply(
            organ_id=request.organ_id,
            organ_version=request.organ_version,
            symbol=request.symbol,
            expected_revision=request.expected_revision,
            new_payload={"last_hash": machine_hash, **obs_payload},
            idempotency_key=request.idempotency_key,
        )
        if not cas.ok:
            # CAS conflict: no state advance, no accepted Observation, no Set inclusion.
            self.instances.complete(instance.organ_instance_id, terminated=True)
            outcome = EvaluationOutcome(kind="cas_conflict", cas=cas, accepted_into_set=False)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        observation = OrganObservation(
            organ_id=request.organ_id,
            organ_version=request.organ_version,
            symbol=request.symbol,
            presence=ObservationPresence(obs_payload["presence"]),
            numeric_features=obs_payload["numeric_features"],
            semantic_profile=obs_payload["semantic_profile"],
            evidence_slot_refs=tuple(obs_payload["evidence_slot_refs"]),
            trader_language=request.trader_language,
            influence_allowed=False,
            runtime_id=self.runtime_id,
            cycle_id=request.cycle_id,
            organ_instance_id=instance.organ_instance_id,
            created_at_ms=ts,
        )

        if request.simulate == "LATE":
            late = LateResultArtifact(
                organ_id=request.organ_id,
                organ_version=request.organ_version,
                symbol=request.symbol,
                organ_instance_id=instance.organ_instance_id,
                late_payload_hash=machine_hash,
                runtime_id=self.runtime_id,
                cycle_id=request.cycle_id,
                created_at_ms=ts,
            )
            self.instances.complete(instance.organ_instance_id, terminated=True)
            outcome = EvaluationOutcome(kind="late", late=late, observation=None, accepted_into_set=False)
            self._completed_evals[request.idempotency_key] = outcome
            return outcome

        accepted = False
        if set_id is not None:
            builder = self._sets[set_id]
            try:
                builder.add_observation(observation)
                accepted = True
            except SetClosedError:
                accepted = False

        self._hash_registry[hash_key] = machine_hash
        self.instances.complete(instance.organ_instance_id)
        outcome = EvaluationOutcome(
            kind="observation",
            observation=observation,
            cas=cas,
            accepted_into_set=accepted,
        )
        self._completed_evals[request.idempotency_key] = outcome
        return outcome

    def _attach_terminal(
        self,
        set_id: str | None,
        terminal: OrganEvaluationTerminalRecord,
        outcome: EvaluationOutcome,
    ) -> None:
        if set_id is None:
            return
        builder = self._sets.get(set_id)
        if builder is None:
            return
        try:
            builder.add_terminal(terminal)
            outcome.accepted_into_set = True
        except SetClosedError:
            outcome.accepted_into_set = False

    @staticmethod
    def _default_eval(market_input: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "presence": ObservationPresence.PRESENT.value,
            "numeric_features": {"signal": float(market_input.get("signal", 1.0))},
            "semantic_profile": {"regime": str(market_input.get("regime", "neutral"))},
            "evidence_slot_refs": list(market_input.get("evidence_slot_refs") or ["slot-a"]),
        }
