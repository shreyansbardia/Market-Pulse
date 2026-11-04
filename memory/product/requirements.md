# Requirements: Market Pulse (Tredye-style)

## Core Value
"I want a website like this (https://tredye.com/pulse/) and it should fetch from yahoo finance and all the stuff"
A live NSE dashboard for traders that detects RSI divergence and MACD setups.

## Personas & Roles
- Traders. The site is free and open, with no sign-in.

## Features
- Stocks: Nifty 200 NSE stocks, plus a Nifty 50 only view/filter
- Signals: RSI divergence + MACD setups, like Tredye (intraday 5/15/30/60 min timeframes)
- Data from Yahoo Finance
- User's words: "good stock market information top gainers and losers kind of information and Watchlist news updates and news from cnbc yahoo news or best stockmarket channel news"

## Round 2: Tredye-style visualisations
User's words: "The Visualisation the website has on cashflows and all these details that is the USB and the way it shows money moving and all that is what i want"
The user shared screenshots of tredye.com/pulse. This is what's visible in them, to use as the reference:
- A headline summary sentence at the top, e.g. "Risk-on tape: breadth 392:109, money into Oil & gas & NBFC, out of IT & Bank; NIFTY +1.21%, expected 23,215–23,443 by 03-Nov". Tabs: Overview / Money flow / Order flow. A "Market closed · showing today's close" label.
- "Money rotation": an animated flow with sectors losing money on the left in red (IT −₹1,242, Bank −₹441...), a "Net flow" bar in the centre (Net +₹30,320 cr) and sectors receiving money on the right in green (Oil & gas +₹10,716, NBFC...). Dots stream from left to right to show money moving. Below it, a one-line text summary that includes a "surge" stock.
- "Market mood": a gauge from Risk-off to Risk-on with a score (73/100), broken down into Breadth 35%, Money flow 30%, NIFTY signal 20%, Volatility 15%, each with its value.
- NIFTY and BANKNIFTY cards: price, change, a Bullish/Neutral tag, an intraday line chart and an "Expected range" bar (e.g. 23,215 – 23,443 by date).
- "Sector map": a treemap of sectors and stocks where box size = turnover and colour runs from −4% to +4%, with a Leaders/Laggards line underneath.
- India VIX: a gauge with the value and a Normal tag, a 30-session sparkline, the 1-year range and percentile, and the expected NIFTY daily move.
- Style: clean, light, white cards with a purple accent, like Tredye. A dark/light toggle was visible on the page.
- Keep the existing features (signals, watchlist, news).

## UI/UX Rules
- User's words: "No telegram or discord things or URL". Don't copy Tredye's community banner or links.
- User's words: "Make sure Visualisation is damm amazing it should have some flow and amazing designs"

## Round 3: F&O visuals (next round, after Round 2)
User's words: "All these section FNO related visual and all these things just add them make it amazing in terms of visualisation"
Context: Tredye's nav shows Options, OI Flow, Liquidity, Radar, Strength and Screeners. Its homepage describes "Option Pulse · Open interest, put-call ratio, IV smile and the writers' range" and "Liquidity Map · Where resting liquidity and stops cluster around price."
Note: Yahoo Finance doesn't provide NSE option chain data, so this needs a free public source such as NSE's public option-chain data.

## Round 4: visual edits on Pulse
User's edits on the Pulse page: span at line 43 [Pulse_43_42], "not needed this"; span at line 43 [Pulse_43_8], "Not needed". Remove both.

## Round 5: remove MongoDB
User's words: "Can it be done without it as connecting to MongoDB creates local stuff and I dont want that its okay to not create that snapshots at all"
Remove all MongoDB use (snapshots, oi_history, option_chains). Keep anything still needed in memory only. The app should run with no database connection. The user accepts that cached data and the PCR trail reset when the server restarts.

## Integrations
- Yahoo Finance for market data (no key)
- News feeds: CNBC, Yahoo Finance news, or other top stock market news sources
