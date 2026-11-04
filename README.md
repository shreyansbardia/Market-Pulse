<div align="center">

# Market Pulse

### A live market dashboard for India’s markets

Track market breadth, money flow, technical signals, options activity, and market news across the Nifty 200.

<br />

**FastAPI** · **React** · **Expo** · **Yahoo Finance** · **NSE / Groww**

</div>

---

## At a glance

Market Pulse brings market context and stock level analysis into one dashboard. Its pulse view summarizes the session, while dedicated screens help explore signals, options positioning, liquidity, relative strength, screeners, a personal watchlist, and market news.

| Area | What you can explore |
| --- | --- |
| **Pulse** | Market mood, breadth, sector rotation, estimated money flow, index cards, volatility, and a turnover weighted sector map |
| **Signals** | RSI divergence and MACD crossovers across 5m, 15m, 30m, 60m, and daily timeframes |
| **Options** | Option chain, put/call ratio, implied volatility, max pain, and writers’ range |
| **OI Flow** | Open interest changes and buildup by strike, with an in-session PCR history |
| **Liquidity** | A price map of estimated liquidity levels |
| **Radar & Strength** | Relative rotation and relative strength across stocks and sectors |
| **Screeners** | Rule based stock groupings for market exploration |
| **Watchlist** | A browser saved watchlist with quick access to selected stocks |
| **News** | Public market RSS feeds and stock specific headlines |

The dashboard supports light and dark themes, stock detail charts, and keyboard search. It is designed as an analysis aid; it does not place trades.

## Project layout

```text
Market-Pulse/
├── backend/                 # FastAPI service and market data/analysis logic
│   ├── server.py            # API routes and application lifecycle
│   ├── market.py            # Quotes, signal scans, caches, and news
│   ├── indicators.py        # RSI, MACD, divergence, and chart series
│   ├── analytics.py         # Relative strength and screener calculations
│   ├── pulse.py             # Market pulse summary and flow calculations
│   ├── nse.py               # Option chain source/fallback and analysis
│   ├── liquidity.py         # Liquidity map calculations
│   └── universe.py          # Nifty 200, Nifty 50, sectors, and index symbols
├── frontend/                # React web dashboard
│   └── src/
│       ├── pages/            # Pulse, Signals, Options, News, and other views
│       ├── components/       # Shared UI, charts, header, and stock drawer
│       └── lib/              # API client and browser state
├── mobile/                  # Expo / React Native app shell
├── memory/                  # Product requirements and project notes
└── test_reports/             # Existing iteration reports
```

## Run locally

You’ll need Python 3.10 or newer, Node.js, and Yarn Classic 1.22.22. If `yarn` is not installed on macOS, install the project’s Yarn version with `npm install --global yarn@1.22.22`, then open a new Terminal tab and check it with `yarn --version`. On macOS, run the backend and frontend in separate Terminal tabs. No database is required.

### 1. Start the backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000/api`; interactive API docs are at `http://localhost:8000/docs`.

### 2. Start the web dashboard

In another terminal, from the repository root:

```bash
cd frontend
yarn install
```

Set the backend URL in the frontend environment (for example, `frontend/.env`):

```dotenv
REACT_APP_BACKEND_URL=http://localhost:8000
```

Then start the development server:

```bash
yarn start
```

The frontend dev server will print its local URL, usually `http://localhost:3000`.

For a device or remote browser, set `REACT_APP_BACKEND_URL` to an address reachable from that device. The backend’s `CORS_ORIGINS` setting accepts a comma separated origin list and defaults to `*`.

### Optional: mobile shell

The Expo project lives in `mobile/` and can be started with:

```bash
cd mobile
yarn install
yarn start
```

The current mobile entry screen is a visual app shell, not the full web dashboard. `EXPO_PUBLIC_BACKEND_URL` is read by the app, but the current entry screen does not yet consume the API.

## Data and refresh behavior

- **Quotes, indices, and price history:** fetched through `yfinance` from Yahoo Finance. Availability, delays, and intraday history depend on Yahoo Finance.
- **Options:** NSE is the primary public source, with Groww used as a fallback. If both are unavailable, a recent in-memory cached response may be served and marked stale.
- **News:** aggregated from public RSS feeds, including CNBC-TV18, CNBC, Yahoo Finance, Moneycontrol via Google News, ET Markets, and Livemint. Feed availability varies.
- **Universe:** Nifty 200, with Nifty 50 filtering in supported views.
- **Refresh:** the backend refresh loop runs approximately every 3 minutes during market hours and every 30 minutes when the market is closed. A fresh startup performs an initial scan; data becomes available as upstream requests finish.
- **Storage:** market data and caches live in process memory. They reset when the backend restarts. The browser watchlist is stored locally in the browser.

External data providers can rate limit requests or change their feeds and endpoints. A missing or stale value may reflect upstream availability rather than a dashboard calculation.

## API overview

All application endpoints are under `/api`.

| Endpoint | Purpose |
| --- | --- |
| `GET /status` | Market status and data refresh timestamps |
| `GET /universe` | Supported symbols and sectors |
| `GET /overview` | Market overview and index data |
| `GET /pulse` | Pulse summary, flow, mood, and visualisation data |
| `GET /stocks` | Quotes, optionally filtered by universe or symbols |
| `GET /signals?tf=15m&universe=nifty200` | Technical signal scan |
| `GET /stock/{symbol}?tf=15m` | Per-stock chart and indicator series |
| `GET /options/{symbol}?expiry=YYYY-MM-DD` | Option chain and derived statistics |
| `GET /options-symbols` | Supported option symbols |
| `GET /oi-flow/{symbol}` | Open interest flow and in-memory history |
| `GET /liquidity/{symbol}` | Liquidity map data |
| `GET /radar`, `GET /radar/{symbol}` | Relative rotation data |
| `GET /strength?universe=nifty200` | Relative strength rankings and sectors |
| `GET /screeners?universe=nifty200` | Screener results |
| `GET /news` | Market headlines; optional `source` filter |
| `GET /news/stocks?symbols=RELIANCE,TCS` | Headlines for selected symbols |

For query values and response schemas, use the interactive docs at `/docs` while the backend is running.

## Tech stack

- **Web:** React 19, React Router, Tailwind CSS, Recharts, Axios, and Radix UI components
- **API:** FastAPI, pandas, NumPy, yfinance, requests, and feedparser
- **Mobile shell:** Expo, React Native, and Expo Router
- **Market sources:** Yahoo Finance, NSE public option chain, Groww fallback, and public RSS feeds

## Disclaimer

Market Pulse is provided for educational and informational use only. Its indicators, flow estimates, screeners, and visualisations are not financial advice or recommendations to buy or sell securities. Verify data independently before making financial decisions.
