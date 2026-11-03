# Market Pulse (Tredye-style) — PRD

## Original problem
"I want a website like this (https://tredye.com/pulse/) and it should fetch from yahoo finance and all the stuff" — live NSE dashboard for traders detecting RSI divergence and MACD setups; Nifty 200 + Nifty 50 filter; 5/15/30/60m timeframes; top gainers/losers; watchlist; news (CNBC, Yahoo, etc). Free, no sign-in.

## User choices (approved)
Watchlist in localStorage; RSS news (CNBC, Yahoo Finance, Moneycontrol, ET Markets, Livemint); server-cached scans every few min; dark terminal theme.

## Architecture
- Backend FastAPI: universe.py (Nifty 200 + sectors), indicators.py (RSI Wilder, MACD, pivot-based divergence), market.py (yfinance batch downloads w/ retry, background loop: 3 min market hours / 30 min closed, snapshots in Mongo `snapshots`, RSS news, Google News per-stock).
- APIs: /api/status, /api/universe, /api/overview, /api/stocks, /api/signals, /api/stock/{sym}, /api/news, /api/news/stocks
- Frontend React: Pulse, Signals, Watchlist, News pages, Stock drawer (recharts price/RSI/MACD), ⌘K search.

## Implemented (2026-11-02)
- All of the above; tested iteration_1 (backend 100%, frontend 95%), fixes applied: HTML entities, Moneycontrol stale feed → Google News site query, mobile badge/segments, news width, intraday date labels, per-source news fallback.

## Implemented (2026-11-02, Round 2)
- /api/pulse (backend/pulse.py): headline, mood score (breadth 35/flow 30/nifty 20/vol 15), estimated money flow (turnover × close-location), rotation, NIFTY/BANKNIFTY cards w/ intraday + VIX-based expected range, VIX card (percentile, expected move), treemap, buy/sell pressure, volume surges.
- Frontend: Pulse tabs Overview/Money flow/Order flow; animated SVG money rotation (streaming particles, net-flow capsule; mobile list variant), gauges, index cards, VIX card, recharts treemap; light (default, purple accent) / dark theme toggle via CSS vars (mp-* tailwind colors).
- News: added CNBC-TV18 feed. Tested iteration_2 (backend 27/27, frontend 93%) and fixed all reported issues afterwards.
- Note: user's attached screenshots were of an unrelated site (Bosscoder); built from the written description.

## Backlog
- P0 (Round 3): F&O visuals — Option Pulse (OI, PCR, IV smile, writers' range), OI Flow, Liquidity map, Radar, Strength, Screeners. Needs NSE public option-chain source (not on Yahoo).
- P1: Price alerts on watchlist, hidden divergence, more indicators (Supertrend, VWAP), option pulse / PCR (NSE)
- P1: Company names in universe for better per-stock news
- P2: Accounts + synced watchlist, Telegram alerts on new signals
- Note: Yahoo RSS feed sometimes times out from server; cached when it succeeds.
