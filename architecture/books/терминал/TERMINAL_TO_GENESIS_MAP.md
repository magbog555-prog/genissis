# Terminal Modules → GENESIS Organs Map

Machine source: `catalog/terminal_modules.json`  
This document is a navigation layer for engineers.

## Coverage matrix (module count by organ tag)

| organ_id | Role of terminal priors | Example modules |
|---|---|---|
| chart_structure | Classical indicator sensors / geometry helpers | SMA, EMA, LSMA, MFI, Bollinger, DiNapoli, ruler |
| volatility | Amplitude / adaptive windows | Volatility Index, Adaptive SMA, Bollinger |
| session_profile | Session clocks / VWAP / intervals | VWAP, BarDate, SystemTime, trade interval minutes |
| market_tempo | Pace / metronomes / last-bar timing | Metronomes, IsLastBar, SystemTime |
| impulse_quality | Participation-ish proxies (weak) | MFI, up/down counter, dual exit |
| spread_entry_cost | Cost/readiness realism | Commission*, Ticket Risk, ReadyForTrade |
| liquidity | Lock/balance/readiness | LockedMoney, Balance Control, ReadyForTrade |
| market_context | Env + aggregates | IsLabMode, PositionsInfo, period stats, toolkits |
| cross_symbol_correlation | Cross relations | Correlation |
| news_events | Alerts/messages (weak) | Expiry alert, MessageAdv |

\* Commission blocks inform **research cost models**, not Spread organ mutation.

## Thinking-family usefulness (secondary)

| Family | Terminal relevance |
|---|---|
| session_open | clocks, VWAP, intervals |
| breakout / false_break | readiness folklore + indicator baselines as crowd map |
| trend_continuation | MA family as crowded features |
| news_impulse_mode | expiry/message alerts only weakly |

## P1 research stack (start tomorrow)

1. Lab/live fence (`Is Lab Mode`)  
2. Readiness predicates (`Is Ready For Trade`, `Check Trade Settings`)  
3. Closed-bar / recalc hygiene (`Is Last Bar`, `Inter Recalc Memorizer`)  
4. Cost realism (`Commission*`, ticket risk)  
5. Venue health (`OKX API Ping Checker`)  

## Explicit non-goals

- No LONG/SHORT from any module  
- No Scenario admission  
- No Producer import  
- No “Mega Toolzer” blind unpack into services  
