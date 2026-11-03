import numpy as np
import pandas as pd
import yfinance as yf

import nse
from universe import yf_symbol

INDEX_YF = {"NIFTY": "^NSEI", "BANKNIFTY": "^NSEBANK", "FINNIFTY": "NIFTY_FIN_SERVICE.NS"}


def _swings(df, k=3):
    hi, lo = df["High"].values, df["Low"].values
    n = len(df)
    highs, lows = [], []
    for i in range(k, n - k):
        if hi[i] == hi[i - k:i + k + 1].max() and hi[i + 1:].max(initial=0) < hi[i]:
            highs.append((i, float(hi[i])))
        if lo[i] == lo[i - k:i + k + 1].min() and lo[i + 1:].min(initial=np.inf) > lo[i]:
            lows.append((i, float(lo[i])))
    return highs, lows


def _cluster(points, n, tol):
    levels = []
    for i, p in sorted(points, key=lambda x: x[1]):
        if levels and abs(p - levels[-1]["price"]) / p < tol:
            L = levels[-1]
            L["touches"] += 1
            L["price"] = (L["price"] * (L["touches"] - 1) + p) / L["touches"]
            L["last"] = max(L["last"], i)
        else:
            levels.append({"price": p, "touches": 1, "last": i})
    for L in levels:
        L["strength"] = round(L["touches"] * (0.5 + 0.5 * L["last"] / max(1, n - 1)), 2)
        L["price"] = round(L["price"], 2)
    return sorted(levels, key=lambda L: -L["strength"])[:6]


def build(symbol):
    symbol = symbol.upper()
    is_index = symbol in INDEX_YF
    df = yf.download(INDEX_YF.get(symbol) or yf_symbol(symbol), period="10d", interval="15m", progress=False, auto_adjust=False)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.dropna(subset=["Close"])
    if len(df) < 30:
        raise ValueError("not enough data")
    spot = float(df["Close"].iloc[-1])
    lo_p, hi_p = float(df["Low"].min()), float(df["High"].max())
    pad = (hi_p - lo_p) * 0.04
    lo_p, hi_p = lo_p - pad, hi_p + pad
    nb = 56
    edges = np.linspace(lo_p, hi_p, nb + 1)
    prof = np.zeros(nb)
    use_vol = not is_index and df["Volume"].sum() > 0
    for _, r in df.iterrows():
        a, b = np.searchsorted(edges, r["Low"]) - 1, np.searchsorted(edges, r["High"]) - 1
        a, b = max(0, a), min(nb - 1, max(a, b))
        w = (r["Volume"] if use_vol else 1.0) / (b - a + 1)
        prof[a:b + 1] += w
    poc_i = int(prof.argmax())
    order = np.argsort(-prof)
    acc, va = 0, set()
    for i in order:
        va.add(int(i)); acc += prof[i]
        if acc >= prof.sum() * 0.7:
            break
    highs, lows = _swings(df)
    n = len(df)
    buy_stops = [L for L in _cluster(highs, n, 0.0015) if L["price"] > spot]
    sell_stops = [L for L in _cluster(lows, n, 0.0015) if L["price"] < spot]
    walls = []
    try:
        ch = nse.chain("NIFTY" if symbol == "NIFTY" else symbol)
        for r in sorted(ch["strikes"], key=lambda r: -r["ce"]["oi"])[:3]:
            walls.append({"price": r["strike"], "side": "call", "oi": r["ce"]["oi"]})
        for r in sorted(ch["strikes"], key=lambda r: -r["pe"]["oi"])[:3]:
            walls.append({"price": r["strike"], "side": "put", "oi": r["pe"]["oi"]})
        walls = [w for w in walls if lo_p <= w["price"] <= hi_p]
    except Exception:
        walls = []
    mx = prof.max() or 1
    return {
        "symbol": symbol, "spot": round(spot, 2), "profile_kind": "Volume" if use_vol else "Time-at-price",
        "range": [round(lo_p, 2), round(hi_p, 2)],
        "bins": [{"lo": round(float(edges[i]), 2), "hi": round(float(edges[i + 1]), 2), "v": round(float(prof[i] / mx), 4),
                  "va": i in va} for i in range(nb)],
        "poc": round(float((edges[poc_i] + edges[poc_i + 1]) / 2), 2),
        "va_low": round(float(edges[min(va)]), 2), "va_high": round(float(edges[max(va) + 1]), 2),
        "buy_stops": buy_stops, "sell_stops": sell_stops, "oi_walls": walls,
        "series": [{"t": ts.isoformat(), "h": round(float(r["High"]), 2), "l": round(float(r["Low"]), 2), "c": round(float(r["Close"]), 2)}
                   for ts, r in df.iterrows()],
    }
