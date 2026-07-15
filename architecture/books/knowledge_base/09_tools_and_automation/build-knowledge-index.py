#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GENESIS Knowledge Base builder — LIBRARY RESEARCH / KNOWLEDGE ENGINEERING only.
No trading code. No PDF full-text extraction. Deterministic UTF-8 outputs.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"D:\genessis")
BOOKS = ROOT / "architecture" / "books"
CATALOG = BOOKS / "catalog"
KB = BOOKS / "knowledge_base"
LIBRARY_JSON = CATALOG / "library.json"

ORGANS = [
    ("01_chart_price_structure", "chart_structure", "PRIMARY", "INDEPENDENT_ROOT"),
    ("02_dom_order_book", "dom_order_book", "PRIMARY", "INDEPENDENT_ROOT"),
    ("03_tape_executed_trades", "tape_executed_trades", "PRIMARY", "INDEPENDENT_ROOT"),
    ("04_spread_entry_cost", "spread_entry_cost", "PRIMARY", "INDEPENDENT_ROOT"),
    ("05_volatility", "volatility", "PRIMARY", "INDEPENDENT_ROOT"),
    ("06_liquidity", "liquidity", "PRIMARY", "INDEPENDENT_ROOT"),
    ("07_tempo", "market_tempo", "DERIVED", "DERIVED_FROM_DECLARED_PARENTS"),
    ("08_impulse_quality", "impulse_quality", "DERIVED", "DERIVED_FROM_DECLARED_PARENTS"),
    ("09_market_context", "market_context", "DERIVED", "DERIVED_FROM_DECLARED_PARENTS"),
    ("10_exhaustion", "exhaustion", "DERIVED", "DERIVED_FROM_DECLARED_PARENTS"),
    ("11_correlation", "cross_symbol_correlation", "CROSS_SYMBOL", "CROSS_CONTEXT_ONLY"),
    ("12_news_events", "news_events", "PRIMARY", "INDEPENDENT_ROOT"),
    ("13_funding", "funding", "PRIMARY", "INDEPENDENT_ROOT"),
    ("14_open_interest", "open_interest", "PRIMARY", "INDEPENDENT_ROOT"),
    ("15_session_profile", "session_profile", "PRIMARY", "INDEPENDENT_ROOT"),
]

FAMILIES = [
    ("01_trend_continuation", "trend_continuation", "Trend Continuation"),
    ("02_reversal", "reversal", "Reversal"),
    ("03_breakout", "breakout", "Breakout"),
    ("04_liquidity_sweep", "liquidity_sweep", "Liquidity Sweep"),
    ("05_return_to_range", "return_to_range", "Range Return"),
    ("06_news_impulse_mode", "news_impulse_mode", "Event Acceleration"),
    ("07_session_open", "session_open", "Session Open"),
    ("08_manipulation_false_breakout", "false_break_failed_follow_through", "False Break / Failed Follow-Through"),
]

# Author/title keywords → priority + relevance hints (literature priors only)
PRIORITY_HINTS = [
    (r"Dalton|Markets in Profile|footprint|Razum nad rynkami", "P1",
     ["chart_structure", "session_profile", "liquidity"], ["session_open", "breakout", "liquidity_sweep"], ["auction"], ["risk"], ["research"]),
    (r"Wyckoff|Hutson", "P1",
     ["chart_structure", "liquidity", "tape_executed_trades"], ["trend_continuation", "reversal", "liquidity_sweep"], ["structure"], ["risk"], ["research"]),
    (r"Williams Tom|Hozyaeva|VSA", "P1",
     ["tape_executed_trades", "chart_structure", "liquidity"], ["trend_continuation", "reversal", "false_break_failed_follow_through"], ["vsa"], ["risk"], ["research"]),
    (r"Pardo", "P1",
     ["market_context"], ["trend_continuation", "breakout"], ["systems", "backtest"], ["risk"], ["research", "overfitting"]),
    (r"Kurguzkin", "P1",
     ["chart_structure", "market_context"], ["trend_continuation", "breakout", "return_to_range"], ["systems"], ["risk"], ["research"]),
    (r"Vince", "P1",
     ["volatility", "liquidity"], [], ["money_management"], ["risk", "capital"], ["research"]),
    (r"Grant Kenneth|Trading Risk", "P1",
     ["volatility", "liquidity", "spread_entry_cost"], [], ["risk"], ["risk"], ["research"]),
    (r"Taleb", "P1",
     ["volatility", "market_context"], [], ["epistemology"], ["risk"], ["research"]),
    (r"Lopez de Prado|Prado|AFML|algoritmy dlya biznesa", "P1",
     ["market_context", "volatility"], [], ["ml", "meta_labeling"], ["risk"], ["research", "overfitting", "feature_hygiene"]),
    (r"LeBeau|Lucas|Kompyuternyy analiz", "P2",
     ["chart_structure", "volatility", "impulse_quality"], ["trend_continuation", "reversal"], ["indicators", "systems"], ["risk"], ["research"]),
    (r"Katz|McCormick|Entsiklopediya torgovyh strategiy", "P2",
     ["chart_structure", "market_context"], ["trend_continuation", "breakout", "return_to_range"], ["strategies_catalog"], ["risk"], ["research"]),
    (r"Connolly|volatilnost|Chekulaev.*volatil|Burenin|options", "P2",
     ["volatility", "funding", "open_interest"], [], ["volatility", "derivatives"], ["risk"], ["research"]),
    (r"Murphy|Schwager.*Tehanaliz|Nison|Bollinger|Colby|DeMark", "P3",
     ["chart_structure", "session_profile"], ["trend_continuation", "breakout", "reversal"], ["ta_toolkit"], [], ["research"]),
    (r"Frost|Prechter|Elliott|Fibonacc|Fisher R", "P3",
     ["chart_structure"], ["trend_continuation", "reversal"], ["geometry"], [], ["research"]),
    (r"Tharp|Elder", "P3",
     ["market_context", "impulse_quality"], ["trend_continuation"], ["process"], ["risk"], ["research"]),
    (r"Bitcoin|DeFi|Antonopoulos|crypto|ICO", "P3",
     ["funding", "open_interest", "news_events"], ["news_impulse_mode"], ["crypto"], [], ["research"]),
    (r"Data Mining", "REFERENCE",
     ["market_context"], [], ["datamining"], [], ["research"]),
    (r"Schwager.*Magi|Wizards|Lefevre|Livermore", "REFERENCE",
     [], [], ["narrative"], [], []),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def match_priority(item: dict) -> tuple:
    blob = " ".join([
        str(item.get("author") or ""),
        str(item.get("title") or ""),
        str(item.get("relative_path") or ""),
        " ".join(item.get("tags") or []),
    ])
    for pat, pri, organs, fams, algs, risk, research in PRIORITY_HINTS:
        if re.search(pat, blob, re.I):
            return pri, organs, fams, algs, risk, research
    return "REFERENCE", [], [], [], [], []


def crowd_for_priority(pri: str) -> str:
    return {
        "P1": "HIGH",
        "P2": "HIGH",
        "P3": "VERY_HIGH",
        "REFERENCE": "MEDIUM",
    }.get(pri, "UNKNOWN")


def ensure_dirs():
    for sub in [
        "00_governance", "01_sources", "02_concepts", "03_organs",
        "04_thinking_families", "05_algorithms_bots", "06_research_hypotheses",
        "07_crowd_map", "08_evidence_and_citations", "09_tools_and_automation",
        "10_reports",
    ]:
        (KB / sub).mkdir(parents=True, exist_ok=True)


def load_library() -> dict:
    return json.loads(LIBRARY_JSON.read_text(encoding="utf-8-sig"))


def build_sources(lib: dict) -> list:
    sources = []
    for item in lib["items"]:
        pri, organs, fams, algs, risk, research = match_priority(item)
        abs_path = item.get("absolute_path") or str(BOOKS / item["relative_path"].replace("/", "\\"))
        exists = Path(abs_path).exists()
        fmt = (item.get("format") or "").lower()
        ocr = fmt in {"pdf", "djvu"} and "scan" in " ".join(item.get("tags") or [])
        # text extractable unknown without probing; conservative
        text_extractable = fmt in {"pdf", "fb2", "docx"} and "unidentified" not in (item.get("tags") or [])
        if "unidentified" in (item.get("tags") or []) or "scan" in (item.get("tags") or []):
            text_extractable = False
            ocr = True
        sources.append({
            "source_id": item["id"],
            "author": item.get("author") or "",
            "title": item.get("title") or "",
            "category": item.get("category") or "",
            "relative_path": item.get("relative_path") or "",
            "absolute_path": abs_path,
            "path_exists": exists,
            "format": fmt,
            "language": "ru_or_mixed",
            "copyright_status": "UNKNOWN",
            "commercial_source": True,
            "text_extractable": text_extractable,
            "ocr_required": ocr,
            "core_priority": pri,
            "size_mb": item.get("size_mb"),
            "relevance": {
                "organs": organs,
                "thinking_families": fams,
                "algorithms": algs,
                "risk": risk,
                "research": research,
            },
            "crowd_exposure": crowd_for_priority(pri),
            "notes": item.get("notes") or "",
            "evidence_class_default": "LITERATURE_CLAIM",
            "production_influence": False,
        })
    return sources


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def concept(cid, name_ru, name_en, definition, klass, sources, organs, fams,
            algo, data, crowd, commerce, limitations, contradictions=None,
            status="LITERATURE_ONLY"):
    return {
        "concept_id": cid,
        "name_ru": name_ru,
        "name_en": name_en,
        "definition_original": definition,
        "concept_class": klass,
        "source_refs": [
            {"source_id": s, "chapter": "", "page": "", "citation_type": "REFERENCE_ONLY"}
            for s in sources
        ],
        "related_organs": organs,
        "related_families": fams,
        "algorithmizable": algo,
        "required_data": data,
        "crowd_exposure": crowd,
        "commercialization_level": commerce,
        "known_limitations": limitations,
        "contradictions": contradictions or [],
        "internal_status": status,
        "production_influence": False,
        "evidence_class": "LITERATURE_CLAIM",
        "crowd_behavior_implication": "",
        "possible_crowding_risk": "",
        "possible_second_order_use": "",
    }


def find_source_ids(sources, *patterns) -> list:
    ids = []
    for s in sources:
        blob = f"{s['author']} {s['title']} {s['relative_path']}"
        for p in patterns:
            if re.search(p, blob, re.I):
                ids.append(s["source_id"])
                break
    return ids


def build_concepts(sources: list) -> list:
    sid = lambda *p: find_source_ids(sources, *p)
    concepts = []

    def add(c):
        # enrich crowd fields generically by exposure
        if c["crowd_exposure"] in ("HIGH", "VERY_HIGH"):
            c["crowd_behavior_implication"] = (
                "Many participants may act on similar cues; expect clustered entries/stops around popular levels."
            )
            c["possible_crowding_risk"] = (
                "Crowded entries can convert a classic setup into liquidity for opposing flow."
            )
            c["possible_second_order_use"] = (
                "Use as map of expected crowd behavior and stop density, not as automatic edge."
            )
        else:
            c["crowd_behavior_implication"] = "Lower retail saturation; still not proof of edge."
            c["possible_crowding_risk"] = "UNKNOWN"
            c["possible_second_order_use"] = "Possible specialist/professional context cue."
        concepts.append(c)

    add(concept(
        "KC-AUCTION-VALUE-AREA", "Value Area / география сессии", "Session value area",
        "Literature claim: auction markets distribute around accepted value and reject price outside it.",
        "OBSERVATION", sid(r"Dalton"),
        ["session_profile", "chart_structure", "market_context"],
        ["session_open", "return_to_range", "breakout"],
        True, ["OHLC", "volume_profile_or_TPO", "session_clock"],
        "HIGH", "PROFESSIONAL",
        ["Requires correct session definition; crypto sessions may differ from cash futures."]
    ))
    add(concept(
        "KC-VSA-EFFORT-RESULT", "Effort vs Result (VSA)", "Effort versus result",
        "Literature claim: volume effort vs price result can flag absorption or lack of interest.",
        "INTERPRETATION", sid(r"Williams Tom|Hozyaeva"),
        ["tape_executed_trades", "chart_structure"],
        ["reversal", "false_break_failed_follow_through", "trend_continuation"],
        True, ["volume", "price_bar", "preferably tick/tape"],
        "HIGH", "PROFESSIONAL",
        ["Subjective without defined thresholds; must not invent actor intent."]
    ))
    add(concept(
        "KC-WYCKOFF-PHASES", "Фазы Wyckoff", "Wyckoff market phases",
        "Literature claim: accumulation/markup/distribution/markdown as structural participation phases.",
        "METHOD", sid(r"Wyckoff|Hutson"),
        ["chart_structure", "liquidity", "tape_executed_trades"],
        ["trend_continuation", "reversal", "liquidity_sweep"],
        True, ["OHLC", "volume", "multi_bar_window"],
        "HIGH", "PROFESSIONAL",
        ["Phase labels are interpretive; crypto 24/7 regime can blur classical phase windows."]
    ))
    add(concept(
        "KC-BOOK-IMBALANCE", "Дисбаланс стакана", "Order book imbalance",
        "Literature/microstructure claim: resting size asymmetry near touch may precede short-horizon moves.",
        "OBSERVATION", sid(r"Dalton|footprint|Hozyaeva"),
        ["dom_order_book", "liquidity"],
        ["breakout", "liquidity_sweep", "false_break_failed_follow_through"],
        True, ["L2_depth", "top_of_book"],
        "MEDIUM", "PROFESSIONAL",
        ["Visible liquidity ≠ intent; spoof/cancel risk; must not equal absorption alone."]
    ))
    add(concept(
        "KC-ABSORPTION", "Абсорбция", "Absorption",
        "Requires relation of resting/pressure cues with executed tape; not a DOM-only fact.",
        "INTERPRETATION", sid(r"Williams Tom|Hozyaeva|Wyckoff|Hutson"),
        ["dom_order_book", "tape_executed_trades"],
        ["reversal", "false_break_failed_follow_through"],
        True, ["L2_depth", "trades"],
        "MEDIUM", "PROFESSIONAL",
        ["GENESIS fence: absorption is cross-organ; DOM alone insufficient."]
    ))
    add(concept(
        "KC-SPREAD-COST", "Котируемая стоимость входа", "Quoted entry cost / spread",
        "Top-of-book bid-ask width as immediate entry cost fact.",
        "EXECUTION", sid(r"Grant|Vince|Burenin"),
        ["spread_entry_cost"],
        ["breakout", "session_open", "news_impulse_mode"],
        True, ["best_bid", "best_ask"],
        "MEDIUM", "PROFESSIONAL",
        ["Spread ≠ slippage; impact is liquidity/execution modeling."]
    ))
    add(concept(
        "KC-VOL-REGIME", "Режим волатильности", "Volatility regime",
        "Amplitude expand/compress/extreme as regime observation from variance/range facts.",
        "OBSERVATION", sid(r"Connolly|Chekulaev|Grant|Lopez de Prado"),
        ["volatility", "market_context"],
        ["trend_continuation", "breakout", "news_impulse_mode"],
        True, ["returns_or_range", "window"],
        "HIGH", "PROFESSIONAL",
        ["Amplitude ≠ direction; should gate later research, not invent signals."]
    ))
    add(concept(
        "KC-SUPPORT-RESISTANCE", "Поддержка / сопротивление", "Support and resistance",
        "Popular doctrine of levels where price historically reacted.",
        "INTERPRETATION", sid(r"Murphy|Schwager|Nison"),
        ["chart_structure"],
        ["breakout", "return_to_range", "false_break_failed_follow_through"],
        True, ["OHLC"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Definition instability; hindsight bias; crowded stops around visible levels."]
    ))
    add(concept(
        "KC-BREAKOUT-DOCTRINE", "Доктрина пробоя", "Breakout doctrine",
        "Retail/professional claim: leave a range with follow-through after level breach.",
        "METHOD", sid(r"Murphy|Schwager|Katz|Kurguzkin"),
        ["chart_structure", "tape_executed_trades", "liquidity"],
        ["breakout", "false_break_failed_follow_through"],
        True, ["OHLC", "volume_or_tape"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["False breaks common; crowded stop entries above levels."]
    ))
    add(concept(
        "KC-MA-CROSS", "Пересечения скользящих средних", "Moving average crossovers",
        "Classic lagging trend filter widely taught in retail TA.",
        "METHOD", sid(r"Murphy|Colby|LeBeau"),
        ["chart_structure"],
        ["trend_continuation"],
        True, ["OHLC"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Lag; whipsaw in ranges; not microstructure evidence."]
    ))
    add(concept(
        "KC-RSI", "RSI", "Relative Strength Index",
        "Oscillator of momentum used for overbought/oversold narratives.",
        "METHOD", sid(r"Murphy|Colby|LeBeau"),
        ["chart_structure", "impulse_quality"],
        ["reversal", "return_to_range"],
        True, ["OHLC"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Threshold folklore; contradicts trend regimes without context."]
    ))
    add(concept(
        "KC-CANDLES", "Японские свечи", "Candlestick patterns",
        "Pattern language for bar psychology/geometry.",
        "INTERPRETATION", sid(r"Nison|Morris|Safin"),
        ["chart_structure"],
        ["reversal", "trend_continuation"],
        True, ["OHLC"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Low specificity alone; needs participation context."]
    ))
    add(concept(
        "KC-ELLIOTT", "Волны Эллиотта", "Elliott Wave",
        "Deterministic-style wave labeling school.",
        "INTERPRETATION", sid(r"Frost|Prechter|Elliott|Safonov"),
        ["chart_structure"],
        ["trend_continuation", "reversal"],
        False, ["OHLC"],
        "HIGH", "RETAIL_MAINSTREAM",
        ["Label indeterminacy; conflicts with probabilistic modeling."]
    ))
    add(concept(
        "KC-FIB", "Уровни Фибоначчи", "Fibonacci retracements",
        "Proportion-based level overlays popular in retail.",
        "METHOD", sid(r"Fisher|Fibonacc"),
        ["chart_structure"],
        ["return_to_range", "reversal"],
        True, ["OHLC", "swing_anchors"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Anchor subjectivity; crowd clustering around round Fibs."]
    ))
    add(concept(
        "KC-FUNDING-EXTREME", "Экстремумы funding", "Funding extremes",
        "Perpetual futures funding as crowd positioning tax signal in crypto literature.",
        "OBSERVATION", sid(r"Bitcoin|DeFi|Antonopoulos|How to DeFi"),
        ["funding", "open_interest", "market_context"],
        ["news_impulse_mode", "reversal"],
        True, ["funding_rate", "instrument_type"],
        "HIGH", "VENDOR_POPULAR",
        ["Not available on all instruments; not a local book aggression fact."]
    ))
    add(concept(
        "KC-OI-PRICE", "OI + цена", "Open interest with price",
        "Claim: OI change + price direction classifies positioning regimes.",
        "INTERPRETATION", sid(r"Burenin|Bitcoin|DeFi"),
        ["open_interest", "chart_structure"],
        ["trend_continuation", "reversal"],
        True, ["open_interest", "price"],
        "HIGH", "PROFESSIONAL",
        ["Reporting lag; exchange-specific definitions."]
    ))
    add(concept(
        "KC-OPENING-RANGE", "Opening range", "Session opening range",
        "Early session high/low as reference for day structure.",
        "METHOD", sid(r"Dalton|session|Tharp"),
        ["session_profile", "chart_structure"],
        ["session_open", "breakout", "return_to_range"],
        True, ["session_clock", "OHLC"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Crypto 24/7 needs explicit session contract."]
    ))
    add(concept(
        "KC-SYSTEM-WALKFORWARD", "Walk-forward / out-of-sample", "Walk-forward validation",
        "Research method: optimize in-sample, validate out-of-sample, roll forward.",
        "RESEARCH", sid(r"Pardo|Lopez de Prado|Katz"),
        ["market_context"],
        [],
        True, ["historical_series", "split_protocol"],
        "MEDIUM", "PROFESSIONAL",
        ["Does not eliminate all overfitting; protocol details matter."]
    ))
    add(concept(
        "KC-AFFML-FEATURE-HYGIENE", "Гигиена признаков (AFML)", "Feature hygiene / purged CV",
        "Lopez de Prado research doctrine: label leakage, purged/embargoed CV, meta-labeling.",
        "RESEARCH", sid(r"Lopez de Prado|Prado"),
        ["market_context", "volatility"],
        [],
        True, ["labeled_events", "feature_matrix"],
        "MEDIUM", "ACADEMIC",
        ["Requires careful event labeling; not a turnkey strategy."]
    ))
    add(concept(
        "KC-POSITION-SIZING", "Размер позиции / fraction", "Position sizing / capital fraction",
        "Vince et al.: sizing as primary survival/growth control.",
        "RISK", sid(r"Vince|Tharp|Grant"),
        ["volatility", "liquidity", "spread_entry_cost"],
        [],
        True, ["equity", "risk_per_trade", "volatility_estimate"],
        "HIGH", "PROFESSIONAL",
        ["Aggressive optimal-f folklore can be ruinous; literature ≠ admitted risk rule."]
    ))
    add(concept(
        "KC-NEWS-IMPULSE", "Импульс новости", "News impulse",
        "Public claim: scheduled/unscheduled news compresses decision time and widens spreads.",
        "OBSERVATION", sid(r"Schwager|Taleb|Bitcoin"),
        ["news_events", "volatility", "spread_entry_cost", "tempo"],
        ["news_impulse_mode"],
        True, ["event_calendar", "quotes", "trades"],
        "VERY_HIGH", "RETAIL_MAINSTREAM",
        ["Headline alone must not authorize Scenario; integrity of event binding required."]
    ))

    # fill tempo organ id correctly in last concept
    for c in concepts:
        c["related_organs"] = [
            ("market_tempo" if o == "tempo" else o) for o in c["related_organs"]
        ]
    return concepts


def build_algorithms(sources: list) -> list:
    def src(*p):
        return find_source_ids(sources, *p)

    def row(**kw):
        kw.setdefault("production_influence", False)
        kw.setdefault("evidence_class", "LITERATURE_CLAIM")
        return kw

    return [
        row(
            algorithm_id="ALG-PARDO-WALKFORWARD",
            name="Walk-forward system validation (Pardo)",
            source_ids=src(r"Pardo"),
            problem_solved="Reduce naive in-sample curve fitting when testing rule systems",
            required_inputs=["historical OHLCV", "parameter grid", "objective function", "IS/OOS windows"],
            formula_or_pseudocode_summary="Split chronology → optimize IS → freeze → test OOS → roll window → aggregate OOS",
            assumptions=["Stationarity soft enough for chosen windows", "Objective matches risk reality"],
            look_ahead_risk="HIGH if features use future bars",
            survivorship_risk="MEDIUM",
            overfitting_risk="HIGH without embargo and reality costs",
            execution_assumptions=["Fills at modeled prices unless costs injected"],
            market_specific_limitations=["Crypto 24/7 session; fee/funding models needed"],
            possible_genesis_reuse="REUSE_TEST_METHOD",
            current_relevance="HIGH for admission research",
            obsolete_elements=["Ignoring fees; optimizing Sharpe alone"],
            use_now_class="USE DURING RESEARCH",
        ),
        row(
            algorithm_id="ALG-KURGUZKIN-SYSTEM-SPEC",
            name="Mechanical system specification habit (Kurguzkin)",
            source_ids=src(r"Kurguzkin"),
            problem_solved="Force explicit rules/hypotheses instead of discretionary folklore",
            required_inputs=["rule language", "entry/exit/risk statements", "market universe"],
            formula_or_pseudocode_summary="Declare hypothesis → observable conditions → actions → invalidation → log",
            assumptions=["Rules are evaluable on available sensors"],
            look_ahead_risk="MEDIUM",
            survivorship_risk="MEDIUM",
            overfitting_risk="HIGH if endless retuning",
            execution_assumptions=["Rules are not yet production gates"],
            market_specific_limitations=["Must map to GENESIS organs, not candle folklore only"],
            possible_genesis_reuse="REUSE_CONCEPT",
            current_relevance="HIGH for organ/family question design hygiene",
            obsolete_elements=["Treating discretionary commentary as deterministic code"],
            use_now_class="USE DURING ORGAN DESIGN",
        ),
        row(
            algorithm_id="ALG-KATZ-STRATEGY-CATALOG",
            name="Strategy catalog / combinatorial testing ideas (Katz)",
            source_ids=src(r"Katz|Entsiklopediya torgovyh strategiy"),
            problem_solved="Enumerate public strategy skeletons for research priors",
            required_inputs=["feature library", "entry/exit templates"],
            formula_or_pseudocode_summary="Catalog template families → parameterize → batch backtest with controls",
            assumptions=["Templates are priors, not edges"],
            look_ahead_risk="HIGH",
            survivorship_risk="HIGH",
            overfitting_risk="VERY_HIGH if mass-tested without multiple-testing control",
            execution_assumptions=["Often optimistic in older literature"],
            market_specific_limitations=["Many equity/futures assumptions; crypto microstructure different"],
            possible_genesis_reuse="ADAPT_WITH_REVIEW",
            current_relevance="MEDIUM as prior catalog only",
            obsolete_elements=["Claiming catalog winner is production rule"],
            use_now_class="USE DURING RESEARCH",
        ),
        row(
            algorithm_id="ALG-LEBEAU-INDICATOR-FEATURES",
            name="Indicator feature construction (LeBeau & Lucas)",
            source_ids=src(r"LeBeau|Lucas"),
            problem_solved="Translate classic indicators into computable features",
            required_inputs=["OHLC", "indicator definitions"],
            formula_or_pseudocode_summary="Define indicator → window → normalize → treat as feature, not signal",
            assumptions=["Bar series enough"],
            look_ahead_risk="MEDIUM",
            survivorship_risk="LOW",
            overfitting_risk="HIGH with indicator shopping",
            execution_assumptions=["N/A at observation stage"],
            market_specific_limitations=["Lags vs tape/DOM reality"],
            possible_genesis_reuse="REUSE_DATA_MODEL",
            current_relevance="MEDIUM for feature labs under AFML hygiene",
            obsolete_elements=["Retail ‘magic settings’"],
            use_now_class="USE DURING RESEARCH",
        ),
        row(
            algorithm_id="ALG-PRADO-PURGED-CV",
            name="Purged/embargoed CV + meta-labeling (Lopez de Prado)",
            source_ids=src(r"Lopez de Prado|Prado"),
            problem_solved="Honest ML validation on overlapping financial labels",
            required_inputs=["event labels", "features", "t1 horizons", "CV folds"],
            formula_or_pseudocode_summary="Purge overlapping labels → embargo → CV → optional meta-label model on primary side",
            assumptions=["Events/labels defined without leakage"],
            look_ahead_risk="CRITICAL if t1 wrong",
            survivorship_risk="MEDIUM",
            overfitting_risk="HIGH but reduced vs naive CV",
            execution_assumptions=["Prediction ≠ fillable edge"],
            market_specific_limitations=["Needs GENESIS event model; crypto funding/OI features optional"],
            possible_genesis_reuse="REUSE_RESEARCH_METHOD",
            current_relevance="VERY HIGH",
            obsolete_elements=["IID assumptions on returns"],
            use_now_class="USE DURING RESEARCH",
        ),
        row(
            algorithm_id="ALG-DATAMINING-GENERIC",
            name="Generic data-mining cookbook (large scan)",
            source_ids=src(r"Data Mining"),
            problem_solved="Broad ML/pattern mining techniques reference",
            required_inputs=["tabular/sequence datasets"],
            formula_or_pseudocode_summary="REFERENCE ONLY — no specific formula admitted without extraction review",
            assumptions=["UNKNOWN until targeted chapter review"],
            look_ahead_risk="UNKNOWN",
            survivorship_risk="UNKNOWN",
            overfitting_risk="VERY_HIGH if applied naively to markets",
            execution_assumptions=["UNKNOWN"],
            market_specific_limitations=["Not market-microstructure specific; 328MB scan friction"],
            possible_genesis_reuse="ADAPT_WITH_REVIEW",
            current_relevance="LOW until selective extraction",
            obsolete_elements=["Likely many generic DM methods unsuitable as trading rules"],
            use_now_class="USE LATER",
        ),
        row(
            algorithm_id="ALG-VINCE-SIZING",
            name="Capital fraction / money management mathematics (Vince)",
            source_ids=src(r"Vince"),
            problem_solved="Relate bet size to equity path risk",
            required_inputs=["return distribution or trade P&L series"],
            formula_or_pseudocode_summary="Estimate growth/risk criterion → choose fraction ≪ aggressive optimal folklore",
            assumptions=["Historical trade stats meaningful"],
            look_ahead_risk="LOW at sizing layer",
            survivorship_risk="MEDIUM",
            overfitting_risk="HIGH if fit on small samples",
            execution_assumptions=["Assumes positions can be sized continuously"],
            market_specific_limitations=["Crypto leverage/funding change effective fraction"],
            possible_genesis_reuse="REUSE_CONCEPT",
            current_relevance="HIGH as research prior for risk organ design — NOT risk passport change",
            obsolete_elements=["Blind optimal-f max"],
            use_now_class="USE DURING ORGAN DESIGN",
        ),
        row(
            algorithm_id="ALG-ROBOT-CHEBOTAREV",
            name="Exchange robot patterns (Chebotarev RU market)",
            source_ids=src(r"Chebotarev|robot"),
            problem_solved="Local historical bot architecture patterns on RF equities",
            required_inputs=["exchange APIs of era", "signals"],
            formula_or_pseudocode_summary="REFERENCE — venue-specific automation patterns; do not port blindly",
            assumptions=["Older venue microstructure"],
            look_ahead_risk="UNKNOWN",
            survivorship_risk="HIGH",
            overfitting_risk="HIGH",
            execution_assumptions=["Legacy exchange constraints"],
            market_specific_limitations=["Not crypto; APIs obsolete"],
            possible_genesis_reuse="DO_NOT_REUSE",
            current_relevance="LOW as code; LOW-MED as cautionary history",
            obsolete_elements=["Venue-specific robot code"],
            use_now_class="DO NOT USE",
        ),
    ]


def organ_template(file_stem, organ_id, organ_class, indep, sources, concepts, algs) -> str:
    rel = [s for s in sources if organ_id in s["relevance"]["organs"]]
    crel = [c for c in concepts if organ_id in c["related_organs"]]
    # special fences
    fence = ""
    if organ_id == "dom_order_book":
        fence = """
## Mandatory fence (DOM)

Separate as DOM facts:
- visible liquidity
- replenishment
- queue behavior
- book imbalance

Do **not** treat as DOM-only:
- absorption → requires Tape cross-relation (`KC-ABSORPTION`)
"""
    if organ_id == "spread_entry_cost":
        fence = """
## Mandatory fence (Spread)

Spread organ observes **quoted entry cost**.

Not this organ alone:
- slippage
- market impact

Those belong to liquidity/execution modeling research.
"""
    if organ_id == "market_tempo":
        fence = """
## Shared-source dependency (Tempo)

`market_tempo` is DERIVED. Document formula origin carefully:

Possible parent sources in literature/practice:
- Tape event density
- DOM update rate (optional research)
- Candle/bar formation pace (chart)

Mark shared-source dependency; Tempo must not inflate independent confirmation of parents.
"""
    if organ_id == "market_context":
        fence = """
## Integrative dependencies

`market_context` depends on declared parents (passport):
- chart_structure
- session_profile
- optional news_events (EXTERNAL_EVENT refs)
- optional cross_symbol_correlation (CrossSymbolContextRecord)

List every dependency explicitly in any future design. No silent imports.
"""

    books = "\n".join(
        f"- `{s['source_id']}` — {s['author']} — {s['title']} (priority {s['core_priority']})"
        for s in rel[:20]
    ) or "- _(no P-mapped sources yet; see gaps)_"

    cons = "\n".join(
        f"- `{c['concept_id']}` — {c['name_en']} [{c['crowd_exposure']}/`{c['internal_status']}`]"
        for c in crel
    ) or "- _(sparse)_"

    purpose = {
        "chart_structure": "Observe price geometry and structure without claiming participation intent.",
        "dom_order_book": "Observe resting book facts (depth, imbalance, replenish) without claiming absorption alone.",
        "tape_executed_trades": "Observe executed aggression and participation as trade facts.",
        "spread_entry_cost": "Observe quoted entry cost at touch.",
        "volatility": "Observe amplitude regime (expand/compress/extreme).",
        "liquidity": "Observe measurable size/thinness availability facts.",
        "market_tempo": "Derived pace/acceleration/stall reading from declared parents.",
        "impulse_quality": "Derived clean vs fragile thrust quality.",
        "market_context": "Integrative regime envelope grounded in declared refs only.",
        "exhaustion": "Derived spent-thrust / decay reading — not forced reversal.",
        "cross_symbol_correlation": "Cross-symbol divergence/convergence under explicit context record.",
        "news_events": "Event windows/tags as external facts — not headline opinions.",
        "funding": "Funding rate facts when instrument supports them.",
        "open_interest": "OI level/change facts when available.",
        "session_profile": "Session phase and value geography markers.",
    }[organ_id]

    question = {
        "chart_structure": "What is the local price geometry doing (levels, compression, structural sweeps)?",
        "dom_order_book": "What resting size geography and imbalance are visible now?",
        "tape_executed_trades": "What aggression just traded — lift/hit, bursts, participation?",
        "spread_entry_cost": "What is the current quoted cost to touch?",
        "volatility": "Is amplitude expanding, compressing, or extreme vs declared window?",
        "liquidity": "Where is size present/absent along the path?",
        "market_tempo": "Is event density accelerating, stalling, or lagging parents?",
        "impulse_quality": "Was the thrust clean or fragile on declared parents?",
        "market_context": "What regime envelope is supportable from declared refs?",
        "exhaustion": "Are there spent-thrust / decay signs within parent horizons?",
        "cross_symbol_correlation": "Do related symbols diverge/converge under the context record?",
        "news_events": "Is there a bound event window affecting comparability?",
        "funding": "Is funding extreme/flipping for this instrument?",
        "open_interest": "How is OI changing with price when data exists?",
        "session_profile": "What session phase / value geography markers are active?",
    }[organ_id]

    return f"""# Organ knowledge dossier — `{organ_id}`

**File:** `03_organs/{file_stem}.md`  
**Canonical organ_id:** `{organ_id}`  
**Passport class:** `{organ_class}` / `{indep}`  
**Evidence default:** `LITERATURE_CLAIM`  
**Production influence:** `false`  
**RFC-0005:** `NOT OPEN`

## 1. Purpose
{purpose}

## 2. Market question
{question}

## 3. What it observes
See passport `GENESIS_ORGAN_COGNITIVE_PASSPORTS_v1_1_1` — this dossier does not mutate passports.

## 4. What it must not infer
No LONG/SHORT, no Scenario, no actor intent, no literature-as-proof, no production thresholds.

## 5. Primary data
As per passport evidence_dependencies / Frame slots for `{organ_id}`.

## 6. Derived data
Only if `{indep}` allows; derived organs never inflate Agreement as extra independent roots.

## 7. Time horizon
Passport `temporal_scope` for `{organ_id}`.

## 8. Dependencies
Passport `evidence_dependencies`. Literature may suggest additional research sensors — those remain hypotheses.
{fence}
## 9. Public literature concepts
{cons}

## 10. Relevant books (mapped)
{books}

## 11. Algorithms / formulas found
See `algorithm_candidates.json` entries whose organ relevance includes `{organ_id}` or general research methods.

## 12. Bot implementations found
No bot code imported. Historical automation literature classified under reuse matrix (`DO_NOT_REUSE` for venue-specific robots).

## 13. Crowd exposure
Aggregate of linked concepts — often HIGH/VERY_HIGH for classic TA-linked organs; MEDIUM for microstructure-heavy organs.

## 14. Typical retail interpretation
Retail often collapses this organ into chart patterns or indicator folklore and skips integrity/comparability.

## 15. Possible second-order use
Read popular doctrines as maps of where crowd orders/stops may cluster; combine with Tape/DOM facts in research — **not** as edge admission.

## 16. Research hypotheses
See `06_research_hypotheses/research_hypotheses.json` filtered by `{organ_id}`.

## 17. Required tests
- Integrity / freshness of required slots  
- Comparability windows  
- No look-ahead in any candidate features  
- Independent GENESIS data — literature never suffices  

## 18. Known contradictions in literature
See `02_concepts/LITERATURE_CONTRADICTIONS.md`.

## 19. Internal GENESIS contracts
Normative companion: `architecture/cognitive/GENESIS_ORGAN_COGNITIVE_PASSPORTS_v1_1_1.md`  
Cognitive Model: `GENESIS_COGNITIVE_MODEL_v1_1_3` (family ask-rights only).  
This KB dossier is informational and must not rewrite those contracts.

## 20. Gaps
- Page-level citations not fabricated (chapter/page left empty until audited extraction)  
- Many sources lack direct crypto microstructure coverage  
- Funding/OI organs sparse in classic futures/equity bookshelf  

---
BOOK KNOWLEDGE ≠ PROVEN EDGE ≠ PRODUCTION RULE
"""


def family_template(file_stem, family_id, title, sources, concepts) -> str:
    crel = [c for c in concepts if family_id in c["related_families"]]
    cons = "\n".join(
        f"- `{c['concept_id']}` — {c['name_en']} (crowd={c['crowd_exposure']})"
        for c in crel
    ) or "- _(sparse mapping)_"

    # organ role classes per family (literature+architecture prior; not scenario gates)
    roles = {
        "trend_continuation": {
            "ANALYSIS_REQUIRED": ["chart_structure", "tape_executed_trades"],
            "ANALYSIS_SUPPORTING": ["impulse_quality", "volatility", "liquidity"],
            "CONTEXTUAL": ["session_profile", "market_context"],
            "OPTIONAL_RESEARCH": ["funding", "open_interest", "cross_symbol_correlation"],
        },
        "reversal": {
            "ANALYSIS_REQUIRED": ["chart_structure", "tape_executed_trades"],
            "ANALYSIS_SUPPORTING": ["exhaustion", "impulse_quality", "dom_order_book"],
            "CONTEXTUAL": ["volatility", "session_profile"],
            "OPTIONAL_RESEARCH": ["funding", "open_interest", "news_events"],
        },
        "breakout": {
            "ANALYSIS_REQUIRED": ["chart_structure", "liquidity"],
            "ANALYSIS_SUPPORTING": ["tape_executed_trades", "dom_order_book", "volatility"],
            "CONTEXTUAL": ["session_profile", "spread_entry_cost"],
            "OPTIONAL_RESEARCH": ["news_events"],
        },
        "liquidity_sweep": {
            "ANALYSIS_REQUIRED": ["chart_structure", "liquidity", "tape_executed_trades"],
            "ANALYSIS_SUPPORTING": ["dom_order_book"],
            "CONTEXTUAL": ["session_profile", "volatility"],
            "OPTIONAL_RESEARCH": ["funding"],
        },
        "return_to_range": {
            "ANALYSIS_REQUIRED": ["chart_structure", "session_profile"],
            "ANALYSIS_SUPPORTING": ["volatility", "tape_executed_trades"],
            "CONTEXTUAL": ["market_context"],
            "OPTIONAL_RESEARCH": ["cross_symbol_correlation"],
        },
        "news_impulse_mode": {
            "ANALYSIS_REQUIRED": ["news_events", "volatility", "spread_entry_cost"],
            "ANALYSIS_SUPPORTING": ["tape_executed_trades", "market_tempo"],
            "CONTEXTUAL": ["liquidity", "market_context"],
            "OPTIONAL_RESEARCH": ["funding", "open_interest"],
        },
        "session_open": {
            "ANALYSIS_REQUIRED": ["session_profile", "chart_structure"],
            "ANALYSIS_SUPPORTING": ["volatility", "liquidity", "spread_entry_cost"],
            "CONTEXTUAL": ["market_context"],
            "OPTIONAL_RESEARCH": ["news_events"],
        },
        "false_break_failed_follow_through": {
            "ANALYSIS_REQUIRED": ["chart_structure", "tape_executed_trades", "liquidity"],
            "ANALYSIS_SUPPORTING": ["dom_order_book", "impulse_quality", "exhaustion"],
            "CONTEXTUAL": ["session_profile", "volatility"],
            "OPTIONAL_RESEARCH": ["news_events"],
        },
    }[family_id]

    def fmt_roles(d):
        lines = []
        for k, v in d.items():
            lines.append(f"- **{k}:** " + ", ".join(f"`{x}`" for x in v))
        return "\n".join(lines)

    questions = {
        "trend_continuation": [
            "Is structural continuation supported by participation?",
            "Is pullback acceptable vs broken structure?",
        ],
        "reversal": [
            "Is there comparable evidence of spent thrust + opposing participation?",
            "Is this exhaustion without opposite authority?",
        ],
        "breakout": [
            "Was a level breached with follow-through vs failed break?",
            "Where would crowded stops sit relative to the level?",
        ],
        "liquidity_sweep": [
            "Did price take liquidity beyond a visible pool then reverse/continue?",
            "Was the sweep geometric only or backed by tape?",
        ],
        "return_to_range": [
            "Is price reclaiming accepted value after excursion?",
            "Is range still valid under session profile?",
        ],
        "news_impulse_mode": [
            "Is there a bound event window?",
            "Did cost/tempo/vol change enough to alter comparability?",
        ],
        "session_open": [
            "What is the opening range / session phase geography?",
            "Is early structure informative or noise?",
        ],
        "false_break_failed_follow_through": [
            "Did break fail to attract follow-through?",
            "Did crowd breakout doctrine create exploitable liquidity?",
        ],
    }[family_id]

    qlines = "\n".join(f"- {q}" for q in questions)

    return f"""# Thinking family knowledge dossier — {title}

**File:** `04_thinking_families/{file_stem}.md`  
**family_id:** `{family_id}`  
**Catalog alignment:** Cognitive Model `thinking_family_catalog_v1.1.3`  
**Outputs allowed here:** ask-rights / literature priors only  
**Forbidden:** LONG/SHORT, Scenario gates, production thresholds

## 1. Cognitive purpose
Organize market questions for **{title}** when family analysis may be available.

## 2. Market questions
{qlines}

## 3. Required analysis domains
Price structure + participation (Tape) and/or liquidity geography depending on family roles below.

## 4–6. Supporting organs (role classes)
{fmt_roles(roles)}

## 7. Public literature basis
{cons}

## 8. Known retail doctrine
Retail often compresses this family into a single pattern name and skips integrity, cost, and failed-follow-through checks.

## 9. Crowd behavior created by that doctrine
Expect clustered stops/entries around the narrative levels; second-order research may study sweeps and failed breaks.

## 10. Common traps
- Treating availability as confirmation  
- Chart-only certainty without Tape/DOM where required  
- Inventing manipulation intent language  

## 11. Contradictory schools
See `LITERATURE_CONTRADICTIONS.md` (trend vs mean reversion; indicator vs microstructure; Elliott vs probabilistic).

## 12. Candidate algorithms
Literature priors only — see `algorithm_candidates.json`. No family algorithm is admitted.

## 13. Data requirements
Must satisfy organ integrity for ANALYSIS_REQUIRED set; otherwise `UNAVAILABLE_INSUFFICIENT_KNOWLEDGE` / `BLOCKED_BY_INTEGRITY` per Cognitive Model.

## 14. Time-horizon requirements
Must respect organ temporal_scope; no longer horizon than parents for derived organs.

## 15. Research hypotheses
Queued in `research_hypotheses.json` with `related_families` containing `{family_id}`.

## 16. No-trade / insufficient-evidence conditions
Not a trade gate. Analysis unavailable when required organs lack integrity/comparability.

## 17. What is NOT a scenario yet
Family availability ≠ Scenario ≠ Candidate ≠ Decision.

## 18. What future scenario contracts would need
Separate RFC path (not open): explicit evidence bundles, independence counting, and non-literature proof. Out of scope for this KB task.

---
BOOK KNOWLEDGE ≠ PROVEN EDGE ≠ PRODUCTION RULE
"""


def build_hypotheses(concepts, algs) -> list:
    hyps = []
    n = 0
    for c in concepts:
        if not c["algorithmizable"]:
            continue
        if c["crowd_exposure"] in ("HIGH", "VERY_HIGH") or c["concept_class"] in ("RESEARCH", "RISK", "OBSERVATION"):
            n += 1
            hyps.append({
                "hypothesis_id": f"RH-{n:03d}",
                "statement": f"Literature concept {c['concept_id']} ({c['name_en']}) can be formalized as a testable observer feature under GENESIS organ contracts.",
                "basis_concepts": [c["concept_id"]],
                "related_organs": c["related_organs"],
                "related_families": c["related_families"],
                "evidence_class": "INTERNAL_HYPOTHESIS",
                "internal_status": "RESEARCH_CANDIDATE",
                "required_tests": [
                    "Define deterministic feature on GENESIS Frame slots",
                    "No look-ahead",
                    "Integrity/freshness gates",
                    "Out-of-sample / purged validation where ML used",
                ],
                "production_influence": False,
                "crowd_exposure": c["crowd_exposure"],
                "notes": "Hypothesis only — literature prior.",
            })
    for a in algs:
        if a["possible_genesis_reuse"] in ("REUSE_RESEARCH_METHOD", "REUSE_TEST_METHOD", "REUSE_CONCEPT"):
            n += 1
            hyps.append({
                "hypothesis_id": f"RH-{n:03d}",
                "statement": f"Method {a['algorithm_id']} is reusable as {a['possible_genesis_reuse']} without importing literature rules as production gates.",
                "basis_algorithms": [a["algorithm_id"]],
                "related_organs": [],
                "related_families": [],
                "evidence_class": "INTERNAL_HYPOTHESIS",
                "internal_status": "RESEARCH_CANDIDATE",
                "required_tests": ["Map to GENESIS data model", "Document assumptions", "Commercial-safe reimplementation"],
                "production_influence": False,
                "use_now_class": a["use_now_class"],
                "notes": a["name"],
            })
    return hyps


def write_text(path: Path, text: str) -> None:
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def main():
    ensure_dirs()
    lib = load_library()
    sources = build_sources(lib)
    concepts = build_concepts(sources)
    algs = build_algorithms(sources)
    hyps = build_hypotheses(concepts, algs)

    # machine-readable
    write_json(KB / "01_sources" / "knowledge_sources.json", {
        "generated_at": now_iso(),
        "task_id": "GENESIS-KNOWLEDGE-BASE-REVERSE-MAP-v1",
        "count": len(sources),
        "doctrine": "BOOK KNOWLEDGE ≠ PROVEN EDGE ≠ PRODUCTION RULE",
        "items": sources,
    })
    write_json(KB / "02_concepts" / "knowledge_concepts.json", {
        "generated_at": now_iso(),
        "count": len(concepts),
        "items": concepts,
    })
    write_json(KB / "05_algorithms_bots" / "algorithm_candidates.json", {
        "generated_at": now_iso(),
        "count": len(algs),
        "items": algs,
    })
    write_json(KB / "06_research_hypotheses" / "research_hypotheses.json", {
        "generated_at": now_iso(),
        "count": len(hyps),
        "items": hyps,
    })

    organ_links = []
    for file_stem, organ_id, organ_class, indep in ORGANS:
        write_text(KB / "03_organs" / f"{file_stem}.md",
                   organ_template(file_stem, organ_id, organ_class, indep, sources, concepts, algs))
        organ_links.append({
            "organ_id": organ_id,
            "dossier": f"03_organs/{file_stem}.md",
            "organ_class": organ_class,
            "independence_class": indep,
            "source_ids": [s["source_id"] for s in sources if organ_id in s["relevance"]["organs"]],
            "concept_ids": [c["concept_id"] for c in concepts if organ_id in c["related_organs"]],
            "production_influence": False,
        })
    write_json(KB / "03_organs" / "organ_knowledge_links.json", {
        "generated_at": now_iso(),
        "count": len(organ_links),
        "items": organ_links,
    })

    family_links = []
    for file_stem, family_id, title in FAMILIES:
        write_text(KB / "04_thinking_families" / f"{file_stem}.md",
                   family_template(file_stem, family_id, title, sources, concepts))
        family_links.append({
            "family_id": family_id,
            "title": title,
            "dossier": f"04_thinking_families/{file_stem}.md",
            "source_ids": [s["source_id"] for s in sources if family_id in s["relevance"]["thinking_families"]],
            "concept_ids": [c["concept_id"] for c in concepts if family_id in c["related_families"]],
            "production_influence": False,
        })
    write_json(KB / "04_thinking_families" / "thinking_family_knowledge_links.json", {
        "generated_at": now_iso(),
        "count": len(family_links),
        "items": family_links,
    })

    crowd = []
    for c in concepts:
        crowd.append({
            "concept_id": c["concept_id"],
            "name_en": c["name_en"],
            "crowd_exposure": c["crowd_exposure"],
            "commercialization_level": c["commercialization_level"],
            "crowd_behavior_implication": c["crowd_behavior_implication"],
            "possible_crowding_risk": c["possible_crowding_risk"],
            "possible_second_order_use": c["possible_second_order_use"],
            "production_influence": False,
        })
    write_json(KB / "07_crowd_map" / "crowd_exposure_map.json", {
        "generated_at": now_iso(),
        "items": crowd,
    })

    citations = []
    for c in concepts:
        for ref in c["source_refs"]:
            citations.append({
                "concept_id": c["concept_id"],
                "source_id": ref["source_id"],
                "chapter": ref["chapter"],
                "page": ref["page"],
                "citation_type": ref["citation_type"],
                "evidence_class": c["evidence_class"],
            })
    write_json(KB / "08_evidence_and_citations" / "citation_index.json", {
        "generated_at": now_iso(),
        "note": "Pages/chapters intentionally empty until audited extraction; no fabricated refs.",
        "count": len(citations),
        "items": citations,
    })

    # index stamp
    write_json(KB / "00_governance" / "build_stamp.json", {
        "generated_at": now_iso(),
        "task_id": "GENESIS-KNOWLEDGE-BASE-REVERSE-MAP-v1",
        "sources": len(sources),
        "concepts": len(concepts),
        "organs": len(ORGANS),
        "families": len(FAMILIES),
        "algorithms": len(algs),
        "hypotheses": len(hyps),
        "sha256_library": hashlib.sha256(LIBRARY_JSON.read_bytes()).hexdigest(),
    })
    print(f"OK sources={len(sources)} concepts={len(concepts)} algs={len(algs)} hyps={len(hyps)}")


if __name__ == "__main__":
    main()
