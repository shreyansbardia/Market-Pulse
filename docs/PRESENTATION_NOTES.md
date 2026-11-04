# Market Pulse · Presenter notes

Use this with the [project overview deck](../outputs/01a1a547-78d5-7331-9ee9-0174f5b952c1/presentations/market-pulse-overview/output/Market-Pulse-Project-Overview.pptx). The notes support a 7–8 minute product and engineering walkthrough. Keep the emphasis on the research workflow and be explicit about the limits of public market data.

## Talk track

| Slide | Time | Point to land | Suggested narration |
| :--- | ---: | :--- | :--- |
| 1 · Market context, within reach | 0:30 | One workspace for market context and follow-up research | “Market Pulse is a browser-based NSE research dashboard. The Nifty 200 is the working universe, and the product is organized around moving from a broad session read to an individual stock or derivatives context.” |
| 2 · Five research steps | 0:45 | The views form one trader workflow | “The app begins with Pulse: breadth, mood, sector participation, indices, and volatility. From there a user can filter for a setup, open its chart, check options or liquidity, then keep the symbol in a browser-local watchlist.” |
| 3 · System map | 1:00 | Public providers feed one API and a linked React client | “Yahoo Finance supplies price bars and index data. NSE is the primary option-chain source, with Groww as a fallback. FastAPI owns refresh and calculation state; React reads its endpoints. The browser separately saves watchlist and theme.” |
| 4 · Pulse logic | 0:55 | Mood is explainable; estimated flow is a proxy | “The mood score uses four weights: 35% breadth, 30% estimated flow, 20% NIFTY signal, and 15% volatility. Flow is close-location value times estimated turnover, aggregated by sector. It is not exchange-reported or participant-level order flow.” |
| 5 · Signal engine | 0:55 | Rules are explicit and inspectable | “The scanner uses RSI(14), MACD(12,26,9), pivot-based divergence, and a recent histogram cross. A signal depends on the bar interval and rule thresholds. It’s a screening aid, not a trade instruction.” |
| 6 · Positioning context | 0:55 | Options and liquidity add distinct context, subject to provider availability | “The options view summarizes PCR, open interest, implied volatility, max pain, and writers’ levels. Liquidity estimates a volume or time-at-price profile from recent bars and swing levels. If public feeds fail, data can be stale or unavailable.” |
| 7 · Relative context | 0:45 | Signals sit within trend, momentum, and sector context | “Relative returns compare symbols with NIFTY over five windows. Radar ranks six dimensions within the current universe; RRG groups sector relative strength and momentum into four quadrants. Fourteen rule-based screeners help narrow the list.” |
| 8 · State and limits | 0:45 | The no-database choice has a clear persistence boundary | “The server is deliberately stateless across restarts: market snapshots, scan outputs, caches, and OI history are held in memory. The browser keeps watchlist and theme. This avoids database setup but means no synced accounts or durable server history.” |
| 9 · Demo setup | 0:35 | The product is straightforward to run locally | “The API and frontend run in separate terminals. I’d open Pulse, switch to Signals, then open a stock drawer. The API explorer is available for inspecting exactly what the UI reads.” |

## Five-minute live demo

1. Start the backend and frontend using the commands in the [README](../README.md); verify the API at `http://localhost:8000/api/status` and open `http://localhost:3000`.
2. On **Pulse**, identify the headline, mood components, sector map, and index/VIX context. Check the update label before discussing the displayed session.
3. Open **Signals** and explain the timeframe and universe filters. Select a stock row to open its detail chart.
4. Open **Options** for a supported index or F&O-enabled symbol. Point out the source/stale state if shown before discussing its metrics.
5. End on **Watchlist** or **Market Wire** to show the local follow-up flow.

If a provider is unreachable, use the app layout and API docs to explain the workflow without presenting stale values as live market facts. The first refresh runs in the background after API startup, so some panels may take time to populate.

## Questions to be ready for

**Is the flow figure actual institutional buying?** No. It is a close-location and turnover estimate. The product labels it as estimated flow.

**Are expected index ranges predictions?** No. They are volatility-derived ranges shown as context, not forecasts or confidence intervals.

**Is the dashboard real time?** Freshness depends on Yahoo Finance, NSE, Groww, and RSS availability. The app exposes update and stale state; no provider SLA is available.

**Why no database or sign-in?** The current product is intentionally accountless. Market data and OI history reset on API restart; the browser keeps only local preferences.

**Is there a finished mobile app?** Not yet. `mobile/` is an Expo starter shell and does not implement the web dashboard or API calls.

**Can it place trades?** No. There is no broker connection or order execution.

## Terms used in the deck

- **Breadth:** advancing versus declining quote rows in the loaded universe.
- **PCR:** put open interest divided by call open interest for the selected chain.
- **Max pain:** strike with the lowest calculated total option payout against current open interest.
- **RRG:** Relative Rotation Graph; sectors are grouped by relative strength and momentum.
- **CLV:** close-location value within the high/low range of a bar.
- **POC / value area:** the most active profile bin / approximate range covering 70% of profile volume or time-at-price.
