import asyncio
import html
import logging
import re
import time
import warnings
from datetime import datetime, timezone, timedelta

import feedparser
import numpy as np
import pandas as pd
import requests
import yfinance as yf
from concurrent.futures import ThreadPoolExecutor

import analytics
import nse
from indicators import analyze, chart_series
from universe import NIFTY200, NIFTY50, SECTOR_OF, INDICES, yf_symbol

warnings.filterwarnings("ignore")
log = logging.getLogger("market")
IST = timezone(timedelta(hours=5, minutes=30))

TIMEFRAMES = {"5m": "5d", "15m": "10d", "30m": "20d", "60m": "1mo", "1d": "1y"}

NEWS_FEEDS = {
    "CNBC-TV18": "https://www.cnbctv18.com/commonfeeds/v1/cne/rss/market.xml",
    "CNBC": "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    "Yahoo Finance": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ENSEI,%5EBSESN,RELIANCE.NS,HDFCBANK.NS&region=IN&lang=en-IN",
    "Moneycontrol": "https://news.google.com/rss/search?q=site:moneycontrol.com+markets+when:2d&hl=en-IN&gl=IN&ceid=IN:en",
    "ET Markets": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "Livemint": "https://www.livemint.com/rss/markets",
}

STATE = {"quotes": {}, "indices": [], "intraday": {}, "analytics": None, "oi_history": {}, "signals": {}, "quotes_at": None, "signals_at": {}, "news": [], "news_at": 0}
_chart_cache = {}
_stock_news_cache = {}


def market_status():
    now = datetime.now(IST)
    open_t = now.replace(hour=9, minute=15, second=0, microsecond=0)
    close_t = now.replace(hour=15, minute=30, second=0, microsecond=0)
    is_open = now.weekday() < 5 and open_t <= now <= close_t
    return {"open": is_open, "ist_time": now.isoformat()}


def _download(tickers, period, interval):
    data = yf.download(tickers, period=period, interval=interval, group_by="ticker",
                       progress=False, threads=8, auto_adjust=False)
    missing = [t for t in tickers if _frame(data, t) is None]
    if missing and len(missing) < len(tickers):
        time.sleep(2)
        retry = yf.download(missing, period=period, interval=interval, group_by="ticker",
                            progress=False, threads=4, auto_adjust=False)
        if not isinstance(retry.columns, pd.MultiIndex):
            retry.columns = pd.MultiIndex.from_product([missing, retry.columns])
        got = [t for t in missing if _frame(retry, t) is not None]
        if got:
            data = pd.concat([data.drop(columns=got, level=0, errors="ignore"), retry[got]], axis=1)
    return data


def _frame(data, ticker):
    try:
        df = data[ticker] if isinstance(data.columns, pd.MultiIndex) else data
        df = df.dropna(subset=["Close"])
        return df if len(df) else None
    except KeyError:
        return None


def _fetch_quotes():
    tickers = [yf_symbol(s) for s in NIFTY200]
    data = _download(tickers, "1y", "1d")
    quotes, frames = {}, {}
    for sym in NIFTY200:
        df = _frame(data, yf_symbol(sym))
        if df is None or len(df) < 2:
            continue
        frames[sym] = df
        c = df["Close"]
        last, prev = float(c.iloc[-1]), float(c.iloc[-2])
        avg_vol = df["Volume"].iloc[-21:-1].mean()
        h, l, o = float(df["High"].iloc[-1]), float(df["Low"].iloc[-1]), float(df["Open"].iloc[-1])
        vol = float(df["Volume"].iloc[-1])
        clv = ((last - l) - (h - last)) / (h - l) if h > l else 0.0
        turnover = last * vol / 1e7
        quotes[sym] = {
            "symbol": sym, "sector": SECTOR_OF.get(sym, "Other"), "nifty50": sym in NIFTY50,
            "ltp": round(last, 2), "prev_close": round(prev, 2),
            "change": round(last - prev, 2), "change_pct": round((last / prev - 1) * 100, 2),
            "open": round(o, 2), "high": round(h, 2), "low": round(l, 2), "volume": int(vol),
            "vol_ratio": round(float(vol / avg_vol), 2) if avg_vol else None,
            "high_52w": round(float(df["High"].max()), 2), "low_52w": round(float(df["Low"].min()), 2),
            "spark": [round(float(x), 2) for x in c.tail(20)],
            "turnover_cr": round(turnover, 2), "clv": round(clv, 3), "flow_cr": round(clv * turnover, 2),
        }
    idx_data = _download([i["yf"] for i in INDICES], "1y", "1d")
    indices = []
    for i in INDICES:
        df = _frame(idx_data, i["yf"])
        if df is None or len(df) < 2:
            continue
        c = df["Close"]
        last, prev = float(c.iloc[-1]), float(c.iloc[-2])
        indices.append({"key": i["key"], "name": i["name"], "ltp": round(last, 2), "prev_close": round(prev, 2),
                        "change": round(last - prev, 2), "change_pct": round((last / prev - 1) * 100, 2),
                        "high": round(float(df["High"].iloc[-1]), 2), "low": round(float(df["Low"].iloc[-1]), 2),
                        "ema20": round(float(c.ewm(span=20, adjust=False).mean().iloc[-1]), 2),
                        "sigma20": round(float(c.pct_change().tail(20).std()), 5),
                        "date": df.index[-1].strftime("%Y-%m-%d"),
                        "spark": [round(float(x), 2) for x in c.tail(30)],
                        "hist": [round(float(x), 2) for x in c] if i["key"] == "INDIAVIX" else None})
    intraday = {}
    intra = _download(["^NSEI", "^NSEBANK"], "5d", "5m")
    for key, t in (("NIFTY50", "^NSEI"), ("BANKNIFTY", "^NSEBANK")):
        df = _frame(intra, t)
        if df is None:
            continue
        last_day = df.index[-1].date()
        df = df[[d.date() == last_day for d in df.index]]
        intraday[key] = [{"t": ts.isoformat(), "c": round(float(v), 2)} for ts, v in df["Close"].items()]
    nifty_df = _frame(idx_data, "^NSEI")
    stats = analytics.build(frames, nifty_df["Close"]) if nifty_df is not None and frames else None
    return quotes, indices, intraday, stats


def _scan(tf):
    tickers = [yf_symbol(s) for s in NIFTY200]
    data = _download(tickers, TIMEFRAMES[tf], tf)
    rows = []
    for sym in NIFTY200:
        df = _frame(data, yf_symbol(sym))
        if df is None:
            continue
        a = analyze(df)
        if not a:
            continue
        q = STATE["quotes"].get(sym, {})
        rows.append({"symbol": sym, "sector": SECTOR_OF.get(sym, "Other"), "nifty50": sym in NIFTY50,
                     "ltp": q.get("ltp", a["last"]), "change_pct": q.get("change_pct"), **a})
    return rows


async def refresh_quotes():
    quotes, indices, intraday, stats = await asyncio.to_thread(_fetch_quotes)
    if stats:
        STATE["analytics"] = stats
    if quotes:
        STATE["quotes"], STATE["indices"], STATE["intraday"] = quotes, indices, intraday
        STATE["quotes_at"] = datetime.now(timezone.utc).isoformat()


async def refresh_signals(tf):
    rows = await asyncio.to_thread(_scan, tf)
    if rows:
        STATE["signals"][tf] = rows
        STATE["signals_at"][tf] = datetime.now(timezone.utc).isoformat()


async def snapshot_oi():
    for sym in nse.INDEX_SYMBOLS:
        try:
            ch = await asyncio.to_thread(nse.chain, sym)
        except Exception as e:
            log.warning("oi snapshot %s failed: %s", sym, e)
            continue
        if ch.get("stale") or sym not in ("NIFTY", "BANKNIFTY"):
            continue
        ts = ch["timestamp"]
        session = ts.split(" ")[0]
        hist = [p for p in STATE["oi_history"].get(sym, []) if p["session"] == session]
        if not hist or hist[-1]["timestamp"] != ts:
            hist.append({"symbol": sym, "timestamp": ts, "session": session, "expiry": ch["expiry"],
                         "spot": ch["spot"], "pcr": ch["pcr"], "ce_oi": ch["ce_oi"], "pe_oi": ch["pe_oi"],
                         "ce_chg_oi": ch["ce_chg_oi"], "pe_chg_oi": ch["pe_chg_oi"], "max_pain": ch["max_pain"],
                         "at": datetime.now(timezone.utc).isoformat()})
        STATE["oi_history"][sym] = hist[-500:]


def oi_history(sym):
    return STATE["oi_history"].get(sym, [])


async def run_loop():
    while True:
        try:
            await refresh_quotes()
            await refresh_signals("15m")
            await snapshot_oi()
            for tf in TIMEFRAMES:
                if tf != "15m":
                    await refresh_signals(tf)
        except Exception as e:
            log.exception("refresh failed: %s", e)
        await asyncio.sleep(180 if market_status()["open"] else 1800)


def overview():
    qs = list(STATE["quotes"].values())
    adv = sum(1 for q in qs if q["change_pct"] > 0)
    dec = sum(1 for q in qs if q["change_pct"] < 0)
    by_sector = {}
    for q in qs:
        by_sector.setdefault(q["sector"], []).append(q)
    sectors = sorted([{"sector": s, "change_pct": round(float(np.mean([x["change_pct"] for x in l])), 2),
                       "count": len(l), "advances": sum(1 for x in l if x["change_pct"] > 0),
                       "top": sorted(l, key=lambda x: -abs(x["change_pct"]))[:4]}
                      for s, l in by_sector.items()], key=lambda x: -x["change_pct"])
    ranked = sorted(qs, key=lambda x: x["change_pct"])
    ratio = adv / max(1, adv + dec)
    mood = ("Extremely Bullish" if ratio > 0.75 else "Bullish" if ratio > 0.58 else
            "Neutral" if ratio >= 0.42 else "Bearish" if ratio >= 0.25 else "Extremely Bearish")
    sig_counts = {}
    for r in STATE["signals"].get("15m", []):
        for s in r["signals"]:
            sig_counts[s["type"]] = sig_counts.get(s["type"], 0) + 1
    return {
        "indices": STATE["indices"], "advances": adv, "declines": dec, "unchanged": len(qs) - adv - dec,
        "mood": mood, "sectors": sectors, "gainers": ranked[::-1][:10], "losers": ranked[:10],
        "volume_shockers": sorted([q for q in qs if q["vol_ratio"]], key=lambda x: -x["vol_ratio"])[:10],
        "near_52w_high": [q for q in qs if q["ltp"] >= q["high_52w"] * 0.98][:10],
        "signal_counts_15m": sig_counts, "updated_at": STATE["quotes_at"], "market": market_status(),
    }


def _fetch_chart(sym, tf):
    df = yf.download(yf_symbol(sym), period=TIMEFRAMES[tf], interval=tf, progress=False, auto_adjust=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return chart_series(df), analyze(df)


async def stock_chart(sym, tf):
    key = (sym, tf)
    hit = _chart_cache.get(key)
    if hit and time.time() - hit[0] < 60:
        return hit[1]
    series, snap = await asyncio.to_thread(_fetch_chart, sym, tf)
    res = {"symbol": sym, "tf": tf, "quote": STATE["quotes"].get(sym), "series": series, "analysis": snap}
    _chart_cache[key] = (time.time(), res)
    return res


def _clean(s):
    s = html.unescape(html.unescape(s or "")).replace("#39;", "'")
    return re.sub(r"<[^>]+>", "", s).strip()


def _parse_feed(source, url):
    try:
        try:
            resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 MarketPulse"})
        except requests.RequestException:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 MarketPulse"})
        f = feedparser.parse(resp.content)
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        items = []
        for e in f.entries[:25]:
            ts = e.get("published_parsed") or e.get("updated_parsed")
            pub = datetime(*ts[:6], tzinfo=timezone.utc) if ts else None
            if pub and pub < cutoff:
                continue
            title = _clean(e.get("title"))
            if source == "Moneycontrol":
                title = title.rsplit(" - ", 1)[0]
            items.append({"source": source, "title": title, "link": e.get("link"),
                          "summary": "" if "news.google" in url else _clean(e.get("summary"))[:300],
                          "published": pub.isoformat() if pub else None})
        return items
    except Exception as e:
        log.warning("feed %s failed: %s", source, e)
        return []


def _fetch_news():
    with ThreadPoolExecutor(len(NEWS_FEEDS)) as ex:
        items = [n for r in ex.map(lambda kv: _parse_feed(*kv), NEWS_FEEDS.items()) for n in r]
    return sorted(items, key=lambda x: x["published"] or "", reverse=True)


async def market_news():
    if time.time() - STATE["news_at"] > 600 or not STATE["news"]:
        items = await asyncio.to_thread(_fetch_news)
        got = {n["source"] for n in items}
        items += [n for n in STATE["news"] if n["source"] not in got]
        if items:
            STATE["news"] = sorted(items, key=lambda x: x["published"] or "", reverse=True)
            STATE["news_at"] = time.time()
    return STATE["news"]


def _fetch_stock_news(sym):
    url = f"https://news.google.com/rss/search?q={requests.utils.quote(chr(34) + sym + chr(34) + ' NSE stock')}+when:7d&hl=en-IN&gl=IN&ceid=IN:en"
    items = _parse_feed("Google News", url)
    key = re.sub(r"[^a-z]", "", sym.lower())[:5]
    rel = [n for n in items if key in re.sub(r"[^a-z]", "", n["title"].lower())]
    items = (rel or items[:3])[:6]
    out = []
    for n in items:
        title, _, pub = n["title"].rpartition(" - ")
        out.append({**n, "symbol": sym, "title": title or n["title"], "source": pub or n["source"], "summary": ""})
    if not out:
        for n in (yf.Ticker(yf_symbol(sym)).news or [])[:6]:
            c = n.get("content", n)
            link = (c.get("canonicalUrl") or {}).get("url") or n.get("link")
            out.append({"symbol": sym, "title": c.get("title"), "link": link, "source": "Yahoo Finance",
                        "summary": (c.get("summary") or "")[:300], "published": c.get("pubDate")})
    return [x for x in out if x["title"]]


async def stock_news(sym):
    hit = _stock_news_cache.get(sym)
    if hit and time.time() - hit[0] < 900:
        return hit[1]
    try:
        items = await asyncio.to_thread(_fetch_stock_news, sym)
    except Exception as e:
        log.warning("stock news %s failed: %s", sym, e)
        items = []
    _stock_news_cache[sym] = (time.time(), items)
    return items
