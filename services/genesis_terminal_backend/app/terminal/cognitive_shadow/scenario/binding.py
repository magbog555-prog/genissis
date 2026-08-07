"""FASBinding — sealed FamilyAssessmentSet → Scenario formation link (C5)."""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping

from app.terminal.cognitive_shadow.family_assessment.assembly.models import FamilyAssessmentSetV1
from app.terminal.cognitive_shadow.scenario.models import domain_id


@dataclass(frozen=True)
class FASBinding:
    """Link of Scenario formation to one sealed FamilyAssessmentSet."""

    fas_binding_id: str
    fas_id: str
    assembly_content_hash: str
    used_family_claim_refs: tuple[Mapping[str, Any], ...]
    claim_evidence_provenance_refs: tuple[Mapping[str, Any], ...]
    formation_head_cycle_ref: str
    head_sealed: bool = True

    def __post_init__(self) -> None:
        if type(self.fas_binding_id) is not str or not self.fas_binding_id:
            raise TypeError("fas_binding_id must be non-empty str")
        if type(self.fas_id) is not str or not self.fas_id:
            raise TypeError("fas_id must be non-empty str")
        if type(self.assembly_content_hash) is not str or len(self.assembly_content_hash) != 64:
            raise TypeError("assembly_content_hash must be 64-hex str")
        if self.head_sealed is not True:
            raise ValueError("head_sealed must be true (Scenario reads sealed FAS only)")
        if type(self.formation_head_cycle_ref) is not str or not self.formation_head_cycle_ref:
            raise TypeError("formation_head_cycle_ref must be non-empty str")
        claims = tuple(MappingProxyType(dict(c)) for c in self.used_family_claim_refs)
        prov = tuple(MappingProxyType(dict(p)) for p in self.claim_evidence_provenance_refs)
        object.__setattr__(self, "used_family_claim_refs", claims)
        object.__setattr__(self, "claim_evidence_provenance_refs", prov)

    def to_dict(self) -> dict[str, Any]:
        return {
            "fas_binding_id": self.fas_binding_id,
            "fas_id": self.fas_id,
            "assembly_content_hash": self.assembly_content_hash,
            "used_family_claim_refs": [dict(c) for c in self.used_family_claim_refs],
            "claim_evidence_provenance_refs": [dict(p) for p in self.claim_evidence_provenance_refs],
            "formation_head_cycle_ref": self.formation_head_cycle_ref,
            "head_sealed": True,
        }


def bind_sealed_fas(fas: FamilyAssessmentSetV1) -> FASBinding:
    """Build FASBinding from a sealed FamilyAssessmentSetV1 (read-only; no organ re-run)."""
    if type(fas) is not FamilyAssessmentSetV1:
        raise TypeError("fas must be FamilyAssessmentSetV1")
    if fas.influence_allowed is not False:
        raise ValueError("sealed FAS must have influence_allowed=false")

    used_claims: list[dict[str, Any]] = []
    provenance: list[dict[str, Any]] = []
    for slot in fas.family_slots:
        claim_ref = {
            "family_id": slot.family_id,
            "availability_state": slot.availability_state,
            "evaluation_state": slot.evaluation_state,
            "result_identity": slot.result_identity,
            "record_identity": slot.record_identity,
            "slot_content_hash": slot.slot_content_hash,
        }
        used_claims.append(claim_ref)
        provenance.append(
            {
                "family_id": slot.family_id,
                "authority_binding_identity": slot.authority_binding.candidate_sha256,
                "result_identity": slot.result_identity,
                "record_identity": slot.record_identity,
                "local_failure_present": slot.local_failure is not None,
            }
        )

    lineage = dict(fas.lineage) if fas.lineage is not None else {}
    cycle_ref = (
        str(lineage.get("runtime_cycle_id"))
        if lineage.get("runtime_cycle_id")
        else fas.input_envelope_id
    )

    binding_id = domain_id(
        kind="fasbind",
        preimage={
            "fas_id": fas.assembly_id,
            "assembly_content_hash": fas.assembly_content_hash,
            "input_envelope_id": fas.input_envelope_id,
        },
    )
    return FASBinding(
        fas_binding_id=binding_id,
        fas_id=fas.assembly_id,
        assembly_content_hash=fas.assembly_content_hash,
        used_family_claim_refs=tuple(used_claims),
        claim_evidence_provenance_refs=tuple(provenance),
        formation_head_cycle_ref=cycle_ref,
        head_sealed=True,
    )


def fas_has_semantic_anchor(fas: FamilyAssessmentSetV1) -> bool:
    """True when at least one family slot carries a non-empty evaluated claim identity.

    WAVE-0 uses this only to choose NOT_APPLICABLE vs GAP_LISTED honesty —
    never to invent detectors or path claims.
    """
    for slot in fas.family_slots:
        if slot.evaluation_state == "UNAVAILABLE":
            continue
        if slot.result_identity or slot.record_identity:
            return True
        if slot.evaluation_state in {
            "SUPPORTED",
            "CONTRADICTED",
            "UNKNOWN",
            "NOT_COMPARABLE",
            "EVALUATED",
        }:
            return True
    return False


__all__ = [
    "FASBinding",
    "bind_sealed_fas",
    "fas_has_semantic_anchor",
]
