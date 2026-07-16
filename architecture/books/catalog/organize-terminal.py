#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Organize TSLab terminal dump into GENESIS-ready taxonomy."""
from __future__ import annotations

import csv
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

BOOKS = Path(r"D:\genessis\architecture\books")
# discover терминал by content signature (avoid encoding issues in shell)
ROOT = None
for d in BOOKS.iterdir():
    if d.is_dir() and (d / "TsLabMegaTulzer.rar").exists():
        ROOT = d
        break
if ROOT is None:
    # fallback: folder name contains terminal-like letters
    for d in BOOKS.iterdir():
        if d.is_dir() and "термин" in d.name.lower():
            ROOT = d
            break
if ROOT is None:
    raise SystemExit("terminal folder not found under architecture/books")

FOLDERS = [
    "01_indicators",
    "02_trade_control",
    "03_time_datetime",
    "04_risk_money_stats",
    "05_data_io_utils",
    "06_messaging_ui",
    "07_toolkits_bundles",
    "08_connectivity",
    "09_uncategorized",
    "catalog",
]

MAP = {
    # indicators
    "BollingerBands_канал.zip": ("01_indicators", "Indicator - Bollinger Bands Channel", "indicator", "Bollinger channel envelope", ["chart_structure", "volatility"], "P2", ""),
    "LSMA-Индикатор.zip": ("01_indicators", "Indicator - LSMA", "indicator", "Least Squares Moving Average", ["chart_structure"], "P3", ""),
    "MFI_Индикатор TSLab.zip": ("01_indicators", "Indicator - MFI", "indicator", "Money Flow Index", ["chart_structure", "impulse_quality"], "P3", ""),
    "PMA_IndicatorTsLab.rar": ("01_indicators", "Indicator - PMA", "indicator", "PMA indicator block", ["chart_structure"], "P3", ""),
    "VWAP_ind.rar": ("01_indicators", "Indicator - VWAP", "indicator", "Volume Weighted Average Price", ["session_profile", "chart_structure"], "P2", ""),
    "VolatilityIndex.rar": ("01_indicators", "Indicator - Volatility Index", "indicator", "Volatility index sensor", ["volatility"], "P2", ""),
    "Индикатор DiNapoli Stochastic.tscript": ("01_indicators", "Indicator - DiNapoli Stochastic", "indicator", "DiNapoli stochastic script", ["chart_structure"], "P2", ""),
    "Индикатор_EMA_в_TSLab.rar": ("01_indicators", "Indicator - EMA", "indicator", "EMA block", ["chart_structure"], "P3", ""),
    "Индикатор_SMA.rar": ("01_indicators", "Indicator - SMA", "indicator", "SMA block", ["chart_structure"], "P3", ""),
    "SMAсАдаптивнымПериодом.rar": ("01_indicators", "Indicator - SMA Adaptive Period", "indicator", "SMA with adaptive period", ["chart_structure", "volatility"], "P2", ""),
    "Счетчик_Рост_Падение_ind.rar": ("01_indicators", "Indicator - Up Down Counter", "indicator", "Rise/fall bar counter", ["chart_structure", "impulse_quality"], "P3", ""),
    # trade
    "CheckTradeSettings.rar": ("02_trade_control", "Trade - Check Trade Settings", "trade_guard", "Pre-trade settings validation cube", ["spread_entry_cost", "liquidity"], "P1", "Useful pattern for readiness gates (research only)"),
    "IsPositionLong_Short.rar": ("02_trade_control", "Trade - Is Position Long Short", "trade_state", "Position side detector", ["market_context"], "P2", ""),
    "IsReadyForTrade.rar": ("02_trade_control", "Trade - Is Ready For Trade", "trade_guard", "Ready-to-trade predicate", ["spread_entry_cost", "liquidity"], "P1", ""),
    "PositionsInfo.rar": ("02_trade_control", "Trade - Positions Info", "trade_state", "Open positions information", ["market_context"], "P2", ""),
    "LockedMoney3.rar": ("02_trade_control", "Trade - Locked Money", "trade_state", "Locked margin/money observation", ["liquidity"], "P2", ""),
    "Торговый_интервал_в_минуты.rar": ("02_trade_control", "Trade - Interval Minutes", "trade_timing", "Trading interval in minutes", ["session_profile", "market_tempo"], "P2", ""),
    "Блок_IsLabMode.rar": ("02_trade_control", "Trade - Is Lab Mode", "env_guard", "Lab vs live mode discriminator", ["market_context"], "P1", "Critical hygiene: never mix lab and live semantics"),
    "ДваВыходаИзКубика.rar": ("02_trade_control", "Trade - Dual Exit Cube", "trade_flow", "Block with two exit paths", ["impulse_quality"], "P3", ""),
    # time
    "AddSubtractTime.rar": ("03_time_datetime", "Time - Add Subtract", "datetime", "Add/subtract time intervals", ["session_profile", "market_tempo"], "P2", ""),
    "DateTimeConstant.rar": ("03_time_datetime", "Time - DateTime Constant", "datetime", "Datetime constant source", ["session_profile"], "P3", ""),
    "SystemDate.rar": ("03_time_datetime", "Time - System Date", "datetime", "System date block", ["session_profile"], "P3", ""),
    "КубикBarDate.rar": ("03_time_datetime", "Time - Bar Date", "datetime", "Bar date extraction", ["session_profile", "chart_structure"], "P2", ""),
    "Кубик_SystemTime.rar": ("03_time_datetime", "Time - System Time", "datetime", "System clock block", ["market_tempo", "session_profile"], "P2", ""),
    "кубик_IsLastBar.rar": ("03_time_datetime", "Time - Is Last Bar", "bar_state", "Detect last bar in series", ["chart_structure", "market_tempo"], "P1", "Important for look-ahead hygiene analogies"),
    "ИнтерваловМеждуДатами.rar": ("03_time_datetime", "Time - Intervals Between Dates", "datetime", "Date interval calculator", ["session_profile"], "P3", ""),
    "ДатаВнормальномВиде.rar": ("03_time_datetime", "Time - Date Normalized Text", "datetime", "Human-readable date format", ["session_profile"], "P3", ""),
    "DoubleToTextDate.rar": ("03_time_datetime", "Time - Double To Text Date", "datetime", "Numeric date to text", ["session_profile"], "P3", ""),
    "ОповещениеДатаЭкспирация.rar": ("03_time_datetime", "Time - Expiry Date Alert", "alert", "Instrument expiry date notification", ["news_events", "session_profile"], "P2", ""),
    # risk/stats
    "gaaDifferent_BalanceControl.rar": ("04_risk_money_stats", "Risk - Balance Control", "risk", "Balance / equity control helper", ["liquidity", "volatility"], "P1", ""),
    "gaaMarketData_TicketRiskData.rar": ("04_risk_money_stats", "Risk - Ticket Risk Data", "risk", "Per-ticket risk data block", ["spread_entry_cost", "liquidity"], "P1", ""),
    "gaaStatData_PeriodStatistic.rar": ("04_risk_money_stats", "Stats - Period Statistic", "stats", "Period statistics aggregation", ["market_context", "volatility"], "P2", ""),
    "Dohod_za_Period.rar": ("04_risk_money_stats", "Money - Income For Period", "pnl", "Income over period", ["market_context"], "P2", ""),
    "Индикатор_Подсчет_дохода.zip": ("04_risk_money_stats", "Money - Income Counter Indicator", "pnl", "Income counting indicator", ["market_context"], "P3", ""),
    "ComissionAdv.rar": ("04_risk_money_stats", "Money - Commission Advanced", "costs", "Advanced commission model", ["spread_entry_cost"], "P1", "Cost realism for research backtests"),
    "ПримерРасчетаКомиссии.rar": ("04_risk_money_stats", "Money - Commission Example", "costs", "Commission calculation example", ["spread_entry_cost"], "P2", ""),
    "Correlation.rar": ("04_risk_money_stats", "Stats - Correlation", "stats", "Correlation block", ["cross_symbol_correlation"], "P2", ""),
    "TradesDistribution.rar": ("04_risk_money_stats", "Stats - Trades Distribution", "stats", "Trade distribution analytics", ["market_context"], "P2", ""),
    "TradesLoger.rar": ("04_risk_money_stats", "Stats - Trades Logger", "logging", "Trades logging cube", ["market_context"], "P2", ""),
    "SmirnovCoef.rar": ("04_risk_money_stats", "Stats - Smirnov Coefficient", "stats", "Smirnov coefficient block", ["market_context"], "P3", ""),
    # data utils
    "InterRecalcMemorizer.rar": ("05_data_io_utils", "Data - Inter Recalc Memorizer", "state", "Memoization across recalculation", ["market_tempo"], "P1", "Observer continuity / state pattern analog"),
    "ЗаписьВфайл.rar": ("05_data_io_utils", "Data - Write To File", "io", "File writer block", ["market_context"], "P2", ""),
    "Делители.rar": ("05_data_io_utils", "Data - Dividers", "util", "Divider utilities pack", ["chart_structure"], "P3", ""),
    "кубик для получения значений.rar": ("05_data_io_utils", "Data - Value Getter Cube", "util", "Generic value getter", ["market_context"], "P3", ""),
    "Блок показывает название инструмента SecToText.zip": ("05_data_io_utils", "Data - Sec To Text Instrument Name", "util", "Security to readable name", ["market_context"], "P3", ""),
    "RandomMetronome.rar": ("05_data_io_utils", "Tempo - Random Metronome", "tempo", "Random metronome tick source", ["market_tempo"], "P3", ""),
    "Метраномы для TSLab.rar": ("05_data_io_utils", "Tempo - Metronomes Pack", "tempo", "Metronome utility pack", ["market_tempo"], "P3", ""),
    # ui
    "БлокСообщение_MessageAdv.rar": ("06_messaging_ui", "UI - Message Advanced", "ui", "Advanced message/notification block", ["news_events"], "P3", ""),
    "Линейка_в_TSLab.zip": ("06_messaging_ui", "UI - Ruler", "ui", "Chart ruler tool", ["chart_structure"], "P3", ""),
    "Рисования_в_тслаб_код.zip": ("06_messaging_ui", "UI - Drawing Code", "ui", "Drawing helpers in TSLab", ["chart_structure"], "P3", ""),
    # bundles
    "TsLabMegaTulzer.rar": ("07_toolkits_bundles", "Bundle - TsLab Mega Toolzer", "toolkit", "Large multi-tool pack", ["market_context"], "P2", "Inspect before reuse; treat as vendor bundle"),
    "TSBTD v1.0.rar": ("07_toolkits_bundles", "Bundle - TSBTD v1.0", "toolkit", "TSBTD toolkit v1.0", ["market_context"], "P3", ""),
    "Обновление 31_03_2021.rar": ("07_toolkits_bundles", "Bundle - Update 2021-03-31", "update", "Dated update pack", ["market_context"], "P3", "Legacy dated bundle"),
    # connectivity
    "чекер пинга к OKX api.rar": ("08_connectivity", "Connectivity - OKX API Ping Checker", "connectivity", "OKX API latency/ping checker", ["spread_entry_cost", "market_tempo"], "P1", "Exchange health probe pattern for GENESIS connectivity research"),
}


def safe_name(base: str, ext: str) -> str:
    s = re.sub(r'[<>:"/\\|?*]', "", base).strip()
    if len(s) > 110:
        s = s[:110].strip()
    return f"{s}{ext}"


def main():
    for f in FOLDERS:
        (ROOT / f).mkdir(parents=True, exist_ok=True)

    files = [p for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() in {".rar", ".zip", ".tscript"}]
    catalog = []
    manifest = []
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    for i, path in enumerate(sorted(files, key=lambda p: p.name.lower()), start=1):
        orig = path.name
        ext = path.suffix.lower()
        if orig in MAP:
            cat, title, kind, purpose, organs, pri, notes = MAP[orig]
        else:
            cat, title, kind, purpose, organs, pri, notes = (
                "09_uncategorized",
                path.stem,
                "unknown",
                "",
                [],
                "REFERENCE",
                "Auto-filed; needs review",
            )
        dest_name = safe_name(title, ext)
        dest = ROOT / cat / dest_name
        n = 2
        while dest.exists():
            dest_name = safe_name(f"{title} ({n})", ext)
            dest = ROOT / cat / dest_name
            n += 1
        shutil.move(str(path), str(dest))
        rel = f"{cat}/{dest_name}".replace("\\", "/")
        tid = f"T{i:03d}"
        catalog.append(
            {
                "id": tid,
                "status": "moved",
                "category": cat,
                "kind": kind,
                "title": title,
                "purpose": purpose,
                "genesis_organs": organs,
                "priority": pri,
                "notes": notes,
                "platform": "TSLab",
                "format": ext.lstrip("."),
                "size_bytes": dest.stat().st_size,
                "size_mb": round(dest.stat().st_size / (1024 * 1024), 3),
                "original_name": orig,
                "relative_path": rel,
                "absolute_path": str(dest),
                "production_influence": False,
                "evidence_class": "LITERATURE_CLAIM",
            }
        )
        manifest.append({"id": tid, "from": orig, "to": rel})

    cat_dir = ROOT / "catalog"
    (cat_dir / "terminal_modules.json").write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "root": str(ROOT),
                "total": len(catalog),
                "doctrine": "TSLab module ≠ GENESIS production rule",
                "items": catalog,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    with (cat_dir / "terminal_modules.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(
            fh,
            fieldnames=[
                "id",
                "category",
                "kind",
                "title",
                "purpose",
                "genesis_organs",
                "priority",
                "notes",
                "format",
                "size_mb",
                "relative_path",
                "original_name",
            ],
        )
        w.writeheader()
        for row in catalog:
            r = dict(row)
            r["genesis_organs"] = ";".join(row["genesis_organs"])
            w.writerow({k: r.get(k, "") for k in w.fieldnames})

    (cat_dir / f"move-manifest-{stamp}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    by = {}
    for row in catalog:
        by.setdefault(row["category"], {"category": row["category"], "count": 0, "size_mb": 0.0})
        by[row["category"]]["count"] += 1
        by[row["category"]]["size_mb"] += row["size_mb"]
    for v in by.values():
        v["size_mb"] = round(v["size_mb"], 2)
    (cat_dir / "summary.json").write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total": len(catalog),
                "by_category": sorted(by.values(), key=lambda x: x["category"]),
                "root": str(ROOT),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    leftovers = [p.name for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() in {".rar", ".zip", ".tscript"}]
    print(f"ROOT={ROOT}")
    print(f"DONE modules={len(catalog)} leftovers={len(leftovers)}")
    for v in sorted(by.values(), key=lambda x: x["category"]):
        print(f"  {v['category']}: {v['count']} ({v['size_mb']} MB)")


if __name__ == "__main__":
    main()
