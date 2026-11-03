import numpy as np
import pandas as pd

from indicators import rsi
from universe import SECTOR_OF, NIFTY50

PERIODS = {"1D": 1, "1W": 5, "1M": 21, "3M": 63, "6M": 126}


def _ret(c, n):
    return float(c.iloc[-1] / c.iloc[-1 - n] - 1) * 100 if len(c) > n else None


def _pct_rank(values):
    s = pd.Series(values, dtype=float)
    return (s.rank(pct=True) * 100).round().fillna(50).astype(int).tolist()


def stock_metrics(sym, df, nifty_c):
    c, h, l, v = df["Close"], df["High"], df["Low"], df["Volume"]
    sma50, sma200 = c.rolling(50).mean(), c.rolling(200).mean()
    r = rsi(c)
    rng = (h - l)
    mfm = (((c - l) - (h - c)) / rng.replace(0, np.nan)).fillna(0)
    cmf = float((mfm * v).tail(20).sum() / max(v.tail(20).sum(), 1))
    atr_pct = float((rng / c).tail(14).mean() * 100)
    cross = None
    diff = (sma50 - sma200).dropna()
    if len(diff) > 10:
        recent = np.sign(diff.tail(11).values)
        if recent[0] < 0 < recent[-1]:
            cross = "golden"
        elif recent[0] > 0 > recent[-1]:
            cross = "death"
    rets = {k: _ret(c, n) for k, n in PERIODS.items()}
    nrets = {k: _ret(nifty_c, n) for k, n in PERIODS.items()}
    rel = {k: round(rets[k] - nrets[k], 2) if rets[k] is not None and nrets[k] is not None else None for k in PERIODS}
    prev_high = float(h.iloc[-253:-1].max()) if len(h) > 2 else None
    return {
        "symbol": sym, "sector": SECTOR_OF.get(sym, "Other"), "nifty50": sym in NIFTY50,
        "ltp": round(float(c.iloc[-1]), 2), "change_pct": round(_ret(c, 1) or 0, 2),
        "rsi_d": round(float(r.iloc[-1]), 1),
        "sma50": round(float(sma50.iloc[-1]), 2) if not np.isnan(sma50.iloc[-1]) else None,
        "sma200": round(float(sma200.iloc[-1]), 2) if not np.isnan(sma200.iloc[-1]) else None,
        "cross": cross, "cmf": round(cmf, 3), "atr_pct": round(atr_pct, 2),
        "gap_pct": round(float(df["Open"].iloc[-1] / c.iloc[-2] - 1) * 100, 2) if len(c) > 1 else 0,
        "nr7": bool(rng.iloc[-1] <= rng.tail(7).min()) if len(rng) >= 7 else False,
        "breakout_52w": bool(prev_high and h.iloc[-1] > prev_high),
        "near_52w_low": bool(c.iloc[-1] <= l.tail(252).min() * 1.03),
        "vol_ratio": round(float(v.iloc[-1] / v.iloc[-21:-1].mean()), 2) if v.iloc[-21:-1].mean() else None,
        "returns": {k: round(x, 2) if x is not None else None for k, x in rets.items()}, "rel": rel,
    }


def _radar_scores(metrics):
    syms = list(metrics)
    m = [metrics[s] for s in syms]
    trend_raw = [((x["ltp"] / x["sma50"] - 1) if x["sma50"] else 0) + ((x["ltp"] / x["sma200"] - 1) if x["sma200"] else 0) for x in m]
    cols = {
        "Momentum": _pct_rank([x["rsi_d"] for x in m]),
        "Trend": _pct_rank(trend_raw),
        "Rel. strength": _pct_rank([x["rel"]["3M"] if x["rel"]["3M"] is not None else 0 for x in m]),
        "Volume": _pct_rank([x["vol_ratio"] or 0 for x in m]),
        "Money flow": _pct_rank([x["cmf"] for x in m]),
        "Stability": _pct_rank([-x["atr_pct"] for x in m]),
    }
    for i, s in enumerate(syms):
        metrics[s]["radar"] = {k: v[i] for k, v in cols.items()}
        rs = [x for x in (m[i]["rel"]["1M"], m[i]["rel"]["3M"], m[i]["rel"]["6M"]) if x is not None]
        metrics[s]["rs_score"] = round(float(np.mean(rs)), 2) if rs else 0


def _rrg(frames, nifty_c, tail=6):
    closes = pd.DataFrame({s: df["Close"] for s, df in frames.items()}).ffill()
    weekly = closes.resample("W-FRI").last()
    nw = nifty_c.resample("W-FRI").last().reindex(weekly.index).ffill()
    out = []
    for sec in sorted(set(SECTOR_OF.values())):
        cols = [s for s in weekly.columns if SECTOR_OF.get(s) == sec]
        if not cols:
            continue
        norm = weekly[cols].div(weekly[cols].bfill().iloc[0]).mean(axis=1)
        rs = (100 * norm / nw).ewm(span=3, adjust=False).mean()
        ratio = 100 * rs / rs.rolling(10).mean()
        mom = (100 * ratio / ratio.rolling(4).mean()).ewm(span=2, adjust=False).mean()
        pts = pd.DataFrame({"x": ratio, "y": mom}).dropna().tail(tail)
        if len(pts) < 2:
            continue
        x, y = pts["x"].iloc[-1], pts["y"].iloc[-1]
        quad = ("Leading" if x >= 100 and y >= 100 else "Weakening" if x >= 100 else
                "Lagging" if y < 100 else "Improving")
        out.append({"sector": sec, "quadrant": quad, "count": len(cols),
                    "tail": [{"x": round(float(a), 3), "y": round(float(b), 3), "date": min(d, closes.index[-1]).strftime("%d-%b")}
                             for d, a, b in zip(pts.index, pts["x"], pts["y"])]})
    return out


def _sector_strength(metrics):
    by = {}
    for m in metrics.values():
        by.setdefault(m["sector"], []).append(m)
    rows = []
    for sec, ms in by.items():
        rel = {k: round(float(np.mean([x["rel"][k] for x in ms if x["rel"][k] is not None] or [0])), 2) for k in PERIODS}
        rows.append({"sector": sec, "count": len(ms), "rel": rel,
                     "score": round(float(np.mean([rel["1M"], rel["3M"], rel["6M"]])), 2)})
    return sorted(rows, key=lambda r: -r["score"])


SCREENERS = [
    ("breakout_52w", "52-week high breakout", "Day high above the prior 52-week high", lambda m: m["breakout_52w"]),
    ("near_52w_low", "Near 52-week low", "Within 3% of the 52-week low", lambda m: m["near_52w_low"]),
    ("volume_breakout", "Volume breakout", "Volume ≥ 2× 20-day average and price up", lambda m: (m["vol_ratio"] or 0) >= 2 and m["change_pct"] > 0),
    ("rsi_oversold", "RSI oversold", "Daily RSI(14) below 30", lambda m: m["rsi_d"] < 30),
    ("rsi_overbought", "RSI overbought", "Daily RSI(14) above 70", lambda m: m["rsi_d"] > 70),
    ("golden_cross", "Golden cross", "50 DMA crossed above 200 DMA in last 10 sessions", lambda m: m["cross"] == "golden"),
    ("death_cross", "Death cross", "50 DMA crossed below 200 DMA in last 10 sessions", lambda m: m["cross"] == "death"),
    ("above_dmas", "Above 50 & 200 DMA", "Price above both moving averages", lambda m: m["sma50"] and m["sma200"] and m["ltp"] > m["sma50"] > m["sma200"]),
    ("below_200", "Below 200 DMA", "Price under the 200-day average", lambda m: m["sma200"] and m["ltp"] < m["sma200"]),
    ("gap_up", "Gap up > 2%", "Opened 2%+ above previous close", lambda m: m["gap_pct"] > 2),
    ("gap_down", "Gap down > 2%", "Opened 2%+ below previous close", lambda m: m["gap_pct"] < -2),
    ("nr7", "NR7 squeeze", "Narrowest daily range of the last 7 sessions", lambda m: m["nr7"]),
    ("accumulation", "Accumulation", "20-day Chaikin money flow > 0.15", lambda m: m["cmf"] > 0.15),
    ("distribution", "Distribution", "20-day Chaikin money flow < −0.15", lambda m: m["cmf"] < -0.15),
]


def screeners(metrics, universe="nifty200"):
    ms = [m for m in metrics.values() if universe != "nifty50" or m["nifty50"]]
    out = []
    for key, name, desc, fn in SCREENERS:
        rows = sorted([m for m in ms if fn(m)], key=lambda m: -abs(m["change_pct"]))
        out.append({"key": key, "name": name, "desc": desc, "count": len(rows),
                    "rows": [{k: m[k] for k in ("symbol", "sector", "ltp", "change_pct", "rsi_d", "vol_ratio", "cmf", "gap_pct", "rs_score")} for m in rows]})
    return out


def build(frames, nifty_c):
    metrics = {}
    for sym, df in frames.items():
        if len(df) >= 30:
            try:
                metrics[sym] = stock_metrics(sym, df, nifty_c)
            except Exception:
                continue
    _radar_scores(metrics)
    return {"metrics": metrics, "rrg": _rrg(frames, nifty_c), "sectors": _sector_strength(metrics)}
