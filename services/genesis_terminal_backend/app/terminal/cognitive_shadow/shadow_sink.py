"""Append-only cognitive shadow journal / evidence sink."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Mapping

from app.terminal.cognitive_shadow.canonical_hash import canonical_json_bytes
from app.terminal.cognitive_shadow.no_influence import assert_no_influence, production_influence_call_count


class ShadowSink:
    """Append-only JSONL evidence sink. No network writes. No production influence."""

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._paths = {
            "envelopes": self.output_dir / "cognitive_input_envelopes.jsonl",
            "market_understanding": self.output_dir / "market_understanding.jsonl",
            "family_availability": self.output_dir / "family_availability.jsonl",
            "integrity": self.output_dir / "cognitive_integrity.jsonl",
            "meta": self.output_dir / "cognitive_shadow_meta.jsonl",
            "ops_cpu_rss": self.output_dir / "operational_cpu_rss_1s.jsonl",
            "ops_latency_queue": self.output_dir / "operational_latency_queue.jsonl",
            "ops_network": self.output_dir / "operational_network.jsonl",
            "continuity": self.output_dir / "continuity_lineage.jsonl",
            "vector_results": self.output_dir / "cognitive_vector_results.jsonl",
            "family_assessment_set": self.output_dir / "family_assessment_set.jsonl",
            "scenario_set": self.output_dir / "scenario_set.jsonl",
        }
        self.records_written = 0

    def _append(self, key: str, record: Mapping[str, Any]) -> None:
        assert_no_influence()
        path = self._paths[key]
        line = json.dumps(dict(record), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        with self._lock:
            with path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
            self.records_written += 1

    def append_envelope(self, record: Mapping[str, Any]) -> None:
        self._append("envelopes", record)

    def append_market_understanding(self, record: Mapping[str, Any]) -> None:
        self._append("market_understanding", record)

    def append_family_availability(self, record: Mapping[str, Any]) -> None:
        self._append("family_availability", record)

    def append_integrity(self, record: Mapping[str, Any]) -> None:
        self._append("integrity", record)

    def append_meta(self, record: Mapping[str, Any]) -> None:
        self._append("meta", record)

    def append_cpu_rss_sample(self, record: Mapping[str, Any]) -> None:
        self._append("ops_cpu_rss", record)

    def append_latency_queue_sample(self, record: Mapping[str, Any]) -> None:
        self._append("ops_latency_queue", record)

    def append_network_sample(self, record: Mapping[str, Any]) -> None:
        self._append("ops_network", record)

    def append_continuity(self, record: Mapping[str, Any]) -> None:
        self._append("continuity", record)

    def append_vector_result(self, record: Mapping[str, Any]) -> None:
        self._append("vector_results", record)

    def append_family_assessment_set(self, record: Mapping[str, Any]) -> None:
        """ASSEMBLY_001: one complete FamilyAssessmentSet journal line."""
        self._append("family_assessment_set", record)

    def append_scenario_set(self, record: Mapping[str, Any]) -> None:
        """WAVE-0.1: one ScenarioSet (or soft-fail) journal line — readonly evidence."""
        self._append("scenario_set", record)

    def write_non_influence_proof(self) -> Path:
        proof = {
            "production_influence_calls": production_influence_call_count(),
            "output_sink": "APPEND_ONLY_JOURNAL_EVIDENCE_ONLY",
            "network_writes": False,
        }
        path = self.output_dir / "non_influence_proof.json"
        path.write_bytes(canonical_json_bytes(proof))
        return path

    def write_operational_summary(self, summary: Mapping[str, Any]) -> Path:
        path = self.output_dir / "operational_summary.json"
        path.write_text(json.dumps(dict(summary), indent=2, sort_keys=True), encoding="utf-8")
        return path
