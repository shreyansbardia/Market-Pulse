import logging
import threading
import time
from datetime import datetime

import requests

log = logging.getLogger("nse")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BASE = "https://www.nseindia.com"
INDEX_SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]

_lock = threading.Lock()
_sess = {"s": None, "at": 0}
_cache = {}


def _session(force=False):
    with _lock:
        if force or not _sess["s"] or time.time() - _sess["at"] > 600:
            s = requests.Session()
            s.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                              "Accept-Language": "en-US,en;q=0.9", "Referer": f"{BASE}/option-chain"})
            s.get(f"{BASE}/option-chain", timeout=12)
            _sess["s"], _sess["at"] = s, time.time()
        return _sess["s"]


def _get(path, params):
    for attempt in range(2):
        s = _session(force=attempt > 0)
        r = s.get(f"{BASE}{path}", params=params, timeout=15)
        if r.status_code == 200 and r.text.startswith("{"):
            return r.json()
    raise RuntimeError(f"NSE {path} failed ({r.status_code})")


def _cached(key, ttl, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


def expiries(symbol):
    return _cached(("exp", symbol), 3600, lambda: _get("/api/option-chain-contract-info", {"symbol": symbol})["expiryDates"])


def _raw_chain(symbol, expiry):
    kind = "Indices" if symbol in INDEX_SYMBOLS else "Equity"
    return _get("/api/option-chain-v3", {"type": kind, "symbol": symbol, "expiry": expiry})["records"]


def _buildup(price_chg, oi_chg):
    if oi_chg >= 0:
        return "Long buildup" if price_chg >= 0 else "Short buildup"
    return "Short covering" if price_chg >= 0 else "Long unwinding"


def _side(d):
    d = d or {}
    return {"oi": d.get("openInterest", 0) or 0, "chg_oi": d.get("changeinOpenInterest", 0) or 0,
            "ltp": d.get("lastPrice", 0) or 0, "chg": d.get("change", 0) or 0,
            "iv": d.get("impliedVolatility", 0) or 0, "vol": d.get("totalTradedVolume", 0) or 0}


def analyze_chain(symbol, expiry, window=18):
    rec = _raw_chain(symbol, expiry)
    spot = rec["underlyingValue"]
    rows = []
    for d in rec["data"]:
        ce, pe = _side(d.get("CE")), _side(d.get("PE"))
        rows.append({"strike": d["strikePrice"], "ce": ce, "pe": pe,
                     "ce_build": _buildup(ce["chg"], ce["chg_oi"]), "pe_build": _buildup(pe["chg"], pe["chg_oi"])})
    rows.sort(key=lambda r: r["strike"])
    if not rows or not spot:
        raise RuntimeError("empty option chain")
    ce_tot = sum(r["ce"]["oi"] for r in rows)
    pe_tot = sum(r["pe"]["oi"] for r in rows)
    ce_chg = sum(r["ce"]["chg_oi"] for r in rows)
    pe_chg = sum(r["pe"]["chg_oi"] for r in rows)
    strikes = [r["strike"] for r in rows]
    pain = []
    for k in strikes:
        loss = sum(r["ce"]["oi"] * max(0, k - r["strike"]) + r["pe"]["oi"] * max(0, r["strike"] - k) for r in rows)
        pain.append({"strike": k, "pain": loss})
    max_pain = min(pain, key=lambda x: x["pain"])["strike"]
    atm_i = min(range(len(rows)), key=lambda i: abs(rows[i]["strike"] - spot))
    atm = rows[atm_i]
    straddle = atm["ce"]["ltp"] + atm["pe"]["ltp"]
    ivs = [x for x in (atm["ce"]["iv"], atm["pe"]["iv"]) if x]
    lo, hi = max(0, atm_i - window), min(len(rows), atm_i + window + 1)
    win = rows[lo:hi]
    res = sorted(win, key=lambda r: -r["ce"]["oi"])
    sup = sorted(win, key=lambda r: -r["pe"]["oi"])
    pcr = pe_tot / ce_tot if ce_tot else 0
    sentiment = "Bullish" if pcr >= 1.2 else "Bearish" if pcr <= 0.7 else "Neutral"
    pain_win = [p for p in pain if win[0]["strike"] <= p["strike"] <= win[-1]["strike"]]
    return {
        "symbol": symbol, "expiry": expiry, "spot": spot, "timestamp": rec.get("timestamp"),
        "pcr": round(pcr, 2), "pcr_chg": round(pe_chg / ce_chg, 2) if ce_chg > 0 else None, "sentiment": sentiment,
        "ce_oi": ce_tot, "pe_oi": pe_tot, "ce_chg_oi": ce_chg, "pe_chg_oi": pe_chg,
        "max_pain": max_pain, "atm": atm["strike"], "atm_iv": round(sum(ivs) / len(ivs), 2) if ivs else None,
        "straddle": round(straddle, 2), "expected": {"low": round(spot - straddle, 2), "high": round(spot + straddle, 2)},
        "writers": {"resistance": res[0]["strike"], "resistance2": res[1]["strike"] if len(res) > 1 else None,
                    "support": sup[0]["strike"], "support2": sup[1]["strike"] if len(sup) > 1 else None},
        "strikes": win, "pain": pain_win,
        "smile": [{"strike": r["strike"], "ce_iv": r["ce"]["iv"] or None, "pe_iv": r["pe"]["iv"] or None} for r in win],
    }


def chain(symbol, expiry=None):
    symbol = symbol.upper()
    exp = expiry or expiries(symbol)[0]
    data = _cached(("chain", symbol, exp), 90, lambda: analyze_chain(symbol, exp))
    return {**data, "expiries": expiries(symbol)[:8], "fetched_at": datetime.now().isoformat()}
