#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate GENESIS knowledge_base integrity. No network. UTF-8."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

KB = Path(r"D:\genessis\architecture\books\knowledge_base")
BOOKS = Path(r"D:\genessis\architecture\books")
# High-confidence credential leakage only (avoid false positives on book titles like "Secrets").
SECRET_RE = re.compile(
    r"(api[_-]?key\s*[:=]\s*\S{8,}|password\s*[:=]\s*\S{6,}|"
    r"bearer\s+[a-z0-9\-_\.]{20,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----|"
    r"sk_live_[a-z0-9]{10,})",
    re.I,
)

ORGANS = {
    "chart_structure", "dom_order_book", "tape_executed_trades", "spread_entry_cost",
    "volatility", "liquidity", "market_tempo", "impulse_quality", "market_context",
    "exhaustion", "cross_symbol_correlation", "news_events", "funding", "open_interest",
    "session_profile",
}
FAMILIES = {
    "trend_continuation", "reversal", "breakout", "liquidity_sweep", "return_to_range",
    "news_impulse_mode", "session_open", "false_break_failed_follow_through",
}


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def main() -> int:
    errors = []
    warnings = []

    sources = load(KB / "01_sources" / "knowledge_sources.json")["items"]
    concepts = load(KB / "02_concepts" / "knowledge_concepts.json")["items"]
    organs = load(KB / "03_organs" / "organ_knowledge_links.json")["items"]
    families = load(KB / "04_thinking_families" / "thinking_family_knowledge_links.json")["items"]
    citations = load(KB / "08_evidence_and_citations" / "citation_index.json")["items"]
    algs = load(KB / "05_algorithms_bots" / "algorithm_candidates.json")["items"]
    hyps = load(KB / "06_research_hypotheses" / "research_hypotheses.json")["items"]

    source_ids = {s["source_id"] for s in sources}
    concept_ids = []
    for c in concepts:
        if c["concept_id"] in concept_ids:
            errors.append(f"duplicate concept_id {c['concept_id']}")
        concept_ids.append(c["concept_id"])
    concept_id_set = set(concept_ids)

    for s in sources:
        rel = BOOKS / s["relative_path"].replace("/", "\\")
        if not rel.exists():
            errors.append(f"missing path {s['source_id']} {s['relative_path']}")
        if s.get("production_influence") is True:
            errors.append(f"source production_influence true {s['source_id']}")

    for c in concepts:
        if c.get("production_influence") is True and c.get("internal_status") == "LITERATURE_ONLY":
            errors.append(f"literature-only production_influence {c['concept_id']}")
        if c.get("production_influence") is True:
            errors.append(f"production_influence true on concept {c['concept_id']}")
        if not c.get("source_refs") and c.get("internal_status") != "INTERNAL_HYPOTHESIS":
            # allow empty only for pure internal — none expected
            errors.append(f"concept missing sources {c['concept_id']}")
        for ref in c.get("source_refs") or []:
            if ref["source_id"] not in source_ids:
                errors.append(f"bad source_id in concept {c['concept_id']}: {ref['source_id']}")
            if ref.get("citation_type") not in {"SUMMARY", "SHORT_QUOTE", "REFERENCE_ONLY"}:
                errors.append(f"bad citation_type {c['concept_id']}")
            # long quote guard: definition length soft check
        if len(c.get("definition_original") or "") > 1200:
            warnings.append(f"long definition {c['concept_id']}")
        for o in c.get("related_organs") or []:
            if o not in ORGANS:
                errors.append(f"bad organ {o} on {c['concept_id']}")
        for f in c.get("related_families") or []:
            if f not in FAMILIES:
                errors.append(f"bad family {f} on {c['concept_id']}")

    for o in organs:
        if o["organ_id"] not in ORGANS:
            errors.append(f"unknown organ link {o['organ_id']}")
        dossier = KB / o["dossier"]
        if not dossier.exists():
            errors.append(f"missing organ dossier {o['dossier']}")

    for f in families:
        if f["family_id"] not in FAMILIES:
            errors.append(f"unknown family link {f['family_id']}")
        if not (KB / f["dossier"]).exists():
            errors.append(f"missing family dossier {f['dossier']}")

    for cite in citations:
        if cite["source_id"] not in source_ids:
            errors.append(f"broken citation source {cite}")
        if cite["concept_id"] not in concept_id_set:
            errors.append(f"broken citation concept {cite}")

    # secret scan on md/json under kb
    for p in KB.rglob("*"):
        if p.suffix.lower() not in {".md", ".json", ".ps1", ".py", ".txt"}:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if SECRET_RE.search(text):
            errors.append(f"secret-like pattern {p}")

    for a in algs:
        if a.get("production_influence") is True:
            errors.append(f"alg production_influence {a['algorithm_id']}")
    for h in hyps:
        if h.get("production_influence") is True:
            errors.append(f"hyp production_influence {h['hypothesis_id']}")

    report = {
        "ok": not errors,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings,
        "counts": {
            "sources": len(sources),
            "concepts": len(concepts),
            "organs": len(organs),
            "families": len(families),
            "citations": len(citations),
            "algorithms": len(algs),
            "hypotheses": len(hyps),
        },
    }
    out = KB / "10_reports" / "validation_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
