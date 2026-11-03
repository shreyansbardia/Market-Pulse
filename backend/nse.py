import logging
import math
import threading
import time
from datetime import datetime, timezone, timedelta

import requests

log = logging.getLogger("nse")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BASE = "https://www.nseindia.com"
GROWW = "https://groww.in/v1/api"
INDEX_SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]
GROWW_INDEX = {"NIFTY": "nifty", "BANKNIFTY": "nifty-bank", "FINNIFTY": "nifty-financial-services", "MIDCPNIFTY": "nifty-midcap-select"}
IST = timezone(timedelta(hours=5, minutes=30))
FRESH_TTL = 90
NSE_BLOCK_SECS = 900

_lock = threading.Lock()
_sess = {"s": None, "at": 0}
_state = {"nse_blocked_until": 0}
_cache = {}
_slugs = {}
_store = {"db": None, "loop": None}


class Unavailable(Exception):
    pass


class BadRequest(Exception):
    pass


# ---------- NSE (primary) ----------
def _session(force=False):
    with _lock:
        if force or not _sess["s"] or time.time() - _sess["at"] > 600:
            s = requests.Session()
            s.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                              "Accept-Language": "en-US,en;q=0.9", "Referer": f"{BASE}/option-chain"})
            s.get(f"{BASE}/option-chain", timeout=6)
            _sess["s"], _sess["at"] = s, time.time()
        return _sess["s"]


def _nse_get(path, params):
    if time.time() < _state["nse_blocked_until"]:
        raise RuntimeError("NSE blocked (cooling down)")
    status = None
    for attempt in range(2):
        r = _session(force=attempt > 0).get(f"{BASE}{path}", params=params, timeout=6)
        status = r.status_code
        if status == 200 and r.text.startswith("{"):
            return r.json()
    if status in (401, 403):
        _state["nse_blocked_until"] = time.time() + NSE_BLOCK_SECS
        log.warning("NSE returned %s; using fallback source for %ss", status, NSE_BLOCK_SECS)
    raise RuntimeError(f"NSE {path} failed ({status})")


def _nse_expiries(symbol):
    return _nse_get("/api/option-chain-contract-info", {"symbol": symbol})["expiryDates"]


def _nse_chain(symbol, expiry):
    kind = "Indices" if symbol in INDEX_SYMBOLS else "Equity"
    return _nse_get("/api/option-chain-v3", {"type": kind, "symbol": symbol, "expiry": expiry})["records"]


# ---------- Groww (fallback) ----------
def _groww_slug(symbol):
    if symbol in GROWW_INDEX:
        return GROWW_INDEX[symbol]
    if symbol in _slugs:
        return _slugs[symbol]
    r = requests.get(f"{GROWW}/search/v3/query/global/st_query", params={"query": symbol, "page": 0, "size": 6},
                     headers={"User-Agent": UA}, timeout=8)
    r.raise_for_status()
    for x in r.json()["data"]["content"]:
        if x.get("entity_type") == "Stocks" and x.get("nse_scrip_code") == symbol:
            if not x.get("fo_enabled"):
                raise BadRequest(f"{symbol} has no F&O contracts")
            _slugs[symbol] = x["search_id"]
            return x["search_id"]
    raise BadRequest(f"{symbol} not found")


def _iso_to_nse(d):
    return datetime.strptime(d, "%Y-%m-%d").strftime("%d-%b-%Y")


def _nse_to_iso(d):
    return datetime.strptime(d, "%d-%b-%Y").strftime("%Y-%m-%d")


def _bs_price(S, K, T, sigma, call, r=0.065):
    d1 = (math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    N = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))  # noqa: E731
    return S * N(d1) - K * math.exp(-r * T) * N(d2) if call else K * math.exp(-r * T) * N(-d2) - S * N(-d1)


def implied_vol(price, S, K, T, call):
    intrinsic = max(0.0, S - K) if call else max(0.0, K - S)
    if price <= intrinsic + 0.05 or T <= 0:
        return 0
    lo, hi = 0.01, 3.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if _bs_price(S, K, T, mid, call) > price:
            hi = mid
        else:
            lo = mid
    v = round(mid * 100, 2)
    return v if 1 < v < 290 else 0


def _groww_fetch(symbol, expiry_iso=None):
    params = {"expiry": expiry_iso} if expiry_iso else {}
    r = requests.get(f"{GROWW}/option_chain_service/v1/option_chain/derivatives/{_groww_slug(symbol)}",
                     params=params, headers={"User-Agent": UA}, timeout=8)
    r.raise_for_status()
    d = r.json()
    if "optionChain" not in d:
        raise RuntimeError("Groww returned no option chain")
    return d


def _groww_side(o, S, K, T, call):
    if not o:
        return None
    ltp = o.get("ltp") or 0
    return {"openInterest": o.get("openInterest") or 0,
            "changeinOpenInterest": (o.get("openInterest") or 0) - (o.get("prevOpenInterest") or 0),
            "lastPrice": ltp, "change": o.get("dayChange") or 0, "totalTradedVolume": o.get("volume") or 0,
            "impliedVolatility": implied_vol(ltp, S, K, T, call) if ltp else 0}


def _groww_records(d):
    oc = d["optionChain"]
    exp_iso = oc["expiryDetailsDto"]["currentExpiry"]
    live = d.get("livePrice") or {}
    S = live.get("value") or live.get("ltp")
    ts = live.get("tsInMillis")
    ts = datetime.fromtimestamp(ts if ts < 1e11 else ts / 1000, IST) if ts else datetime.now(IST)
    exp_dt = datetime.strptime(exp_iso, "%Y-%m-%d").replace(hour=15, minute=30, tzinfo=IST)
    T = max((exp_dt - datetime.now(IST)).total_seconds(), 3600) / (365 * 86400)
    data = []
    for c in oc["optionChains"]:
        K = c["strikePrice"] / 100
        data.append({"strikePrice": K, "CE": _groww_side(c.get("callOption"), S, K, T, True),
                     "PE": _groww_side(c.get("putOption"), S, K, T, False)})
    return {"underlyingValue": S, "timestamp": ts.strftime("%d-%b-%Y %H:%M:%S"), "data": data}, \
        [_iso_to_nse(x) for x in oc["expiryDetailsDto"]["expiryDates"]], _iso_to_nse(exp_iso)


# ---------- analytics ----------
def _buildup(price_chg, oi_chg):
    if oi_chg >= 0:
        return "Long buildup" if price_chg >= 0 else "Short buildup"
    return "Short covering" if price_chg >= 0 else "Long unwinding"


def _side(d):
    d = d or {}
    return {"oi": d.get("openInterest", 0) or 0, "chg_oi": d.get("changeinOpenInterest", 0) or 0,
            "ltp": d.get("lastPrice", 0) or 0, "chg": d.get("change", 0) or 0,
            "iv": d.get("impliedVolatility", 0) or 0, "vol": d.get("totalTradedVolume", 0) or 0}


def analyze_records(symbol, expiry, rec, window=18):
    spot = rec["underlyingValue"]
    rows = []
    for d in rec["data"]:
        ce, pe = _side(d.get("CE")), _side(d.get("PE"))
        rows.append({"strike": d["strikePrice"], "ce": ce, "pe": pe,
                     "ce_build": _buildup(ce["chg"], ce["chg_oi"]), "pe_build": _buildup(pe["chg"], pe["chg_oi"])})
    rows = [r for r in rows if r["ce"]["oi"] or r["pe"]["oi"]]
    rows.sort(key=lambda r: r["strike"])
    if len(rows) < 3 or not spot:
        raise RuntimeError("empty option chain")
    ce_tot = sum(r["ce"]["oi"] for r in rows)
    pe_tot = sum(r["pe"]["oi"] for r in rows)
    ce_chg = sum(r["ce"]["chg_oi"] for r in rows)
    pe_chg = sum(r["pe"]["chg_oi"] for r in rows)
    pain = [{"strike": k, "pain": sum(r["ce"]["oi"] * max(0, k - r["strike"]) + r["pe"]["oi"] * max(0, r["strike"] - k) for r in rows)}
            for k in (r["strike"] for r in rows)]
    max_pain = min(pain, key=lambda x: x["pain"])["strike"]
    atm_i = min(range(len(rows)), key=lambda i: abs(rows[i]["strike"] - spot))
    atm = rows[atm_i]
    straddle = atm["ce"]["ltp"] + atm["pe"]["ltp"]
    ivs = [x for x in (atm["ce"]["iv"], atm["pe"]["iv"]) if x]
    win = rows[max(0, atm_i - window): min(len(rows), atm_i + window + 1)]
    res = sorted(win, key=lambda r: -r["ce"]["oi"])
    sup = sorted(win, key=lambda r: -r["pe"]["oi"])
    pcr = pe_tot / ce_tot if ce_tot else 0
    return {
        "symbol": symbol, "expiry": expiry, "spot": spot, "timestamp": rec.get("timestamp"),
        "pcr": round(pcr, 2), "pcr_chg": round(pe_chg / ce_chg, 2) if ce_chg > 0 else None,
        "sentiment": "Bullish" if pcr >= 1.2 else "Bearish" if pcr <= 0.7 else "Neutral",
        "ce_oi": ce_tot, "pe_oi": pe_tot, "ce_chg_oi": ce_chg, "pe_chg_oi": pe_chg,
        "max_pain": max_pain, "atm": atm["strike"], "atm_iv": round(sum(ivs) / len(ivs), 2) if ivs else None,
        "straddle": round(straddle, 2), "expected": {"low": round(spot - straddle, 2), "high": round(spot + straddle, 2)},
        "writers": {"resistance": res[0]["strike"], "resistance2": res[1]["strike"] if len(res) > 1 else None,
                    "support": sup[0]["strike"], "support2": sup[1]["strike"] if len(sup) > 1 else None},
        "strikes": win, "pain": [p for p in pain if win[0]["strike"] <= p["strike"] <= win[-1]["strike"]],
        "smile": [{"strike": r["strike"], "ce_iv": r["ce"]["iv"] or None, "pe_iv": r["pe"]["iv"] or None} for r in win],
    }


# ---------- orchestration ----------
def _fetch_live(symbol, expiry):
    """Try NSE then Groww. Returns analysed dict."""
    errors = []
    try:
        exps = _nse_expiries(symbol)
        exp = expiry or exps[0]
        if exp not in exps:
            raise BadRequest(f"Invalid expiry {exp}. Available: {', '.join(exps[:6])}")
        return {**analyze_records(symbol, exp, _nse_chain(symbol, exp)), "expiries": exps[:8], "source": "NSE"}
    except BadRequest:
        raise
    except Exception as e:
        errors.append(f"NSE: {e}")
    try:
        d = _groww_fetch(symbol)
        exps = [_iso_to_nse(x) for x in d["optionChain"]["expiryDetailsDto"]["expiryDates"]]
        if expiry and expiry not in exps:
            raise BadRequest(f"Invalid expiry {expiry}. Available: {', '.join(exps[:6])}")
        if expiry and expiry != _iso_to_nse(d["optionChain"]["expiryDetailsDto"]["currentExpiry"]):
            d = _groww_fetch(symbol, _nse_to_iso(expiry))
        rec, exps, exp = _groww_records(d)
        return {**analyze_records(symbol, exp, rec), "expiries": exps[:8], "source": "Groww"}
    except BadRequest:
        raise
    except Exception as e:
        errors.append(f"Groww: {e}")
    raise Unavailable("; ".join(errors))


def _persist(key, data):
    db, loop = _store["db"], _store["loop"]
    if db is None or loop is None:
        return
    import asyncio
    doc = {"_id": f"{key[0]}|{key[1] or ''}", "data": data, "at": time.time()}

    async def _save():
        await db.option_chains.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    asyncio.run_coroutine_threadsafe(_save(), loop)


def _load_persisted(key):
    db, loop = _store["db"], _store["loop"]
    if db is None or loop is None:
        return None
    import asyncio

    async def _load():
        return await db.option_chains.find_one({"_id": f"{key[0]}|{key[1] or ''}"})
    fut = asyncio.run_coroutine_threadsafe(_load(), loop)
    try:
        doc = fut.result(timeout=3)
    except Exception:
        return None
    return (doc["at"], doc["data"]) if doc else None


def validate_symbol(symbol, universe):
    if symbol not in INDEX_SYMBOLS and symbol not in universe:
        raise BadRequest(f"{symbol} is not a supported index or Nifty 200 stock")


def _ttl():
    now = datetime.now(IST)
    open_ = now.weekday() < 5 and (9, 15) <= (now.hour, now.minute) <= (15, 30)
    return FRESH_TTL if open_ else 900


def chain(symbol, expiry=None):
    symbol = symbol.upper()
    key = (symbol, expiry)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < _ttl():
        return {**hit[1], "stale": False, "age_secs": int(time.time() - hit[0])}
    try:
        data = _fetch_live(symbol, expiry)
        _cache[key] = (time.time(), data)
        if expiry is None:
            _cache[(symbol, data["expiry"])] = (time.time(), data)
        _persist(key, data)
        return {**data, "stale": False, "age_secs": 0}
    except BadRequest:
        raise
    except Unavailable as e:
        log.warning("option chain %s %s unavailable: %s", symbol, expiry, e)
        old = hit or _load_persisted(key)
        if old:
            _cache.setdefault(key, old)
            return {**old[1], "stale": True, "age_secs": int(time.time() - old[0])}
        raise


def expiries(symbol):
    return chain(symbol)["expiries"]
