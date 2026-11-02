import numpy as np
import pandas as pd


def rsi(close: pd.Series, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / dn.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50)


def macd(close: pd.Series, fast=12, slow=26, sig=9):
    m = close.ewm(span=fast, adjust=False).mean() - close.ewm(span=slow, adjust=False).mean()
    s = m.ewm(span=sig, adjust=False).mean()
    return m, s, m - s


def _pivots(arr, k, is_low):
    out = []
    for i in range(k, len(arr) - 2):
        win = arr[i - k: i + 3]
        if (is_low and arr[i] == win.min()) or (not is_low and arr[i] == win.max()):
            out.append(i)
    return out


def _divergence(price, osc, is_low, lookback=60, recent=8, min_gap=5):
    n = len(price)
    start = max(0, n - lookback)
    p = price[start:]
    piv = _pivots(p, 3, is_low)
    if len(piv) < 2:
        return None
    p2 = piv[-1]
    if len(p) - 1 - p2 > recent:
        return None
    for p1 in reversed(piv[:-1]):
        if p2 - p1 < min_gap:
            continue
        o1, o2 = osc[start + p1], osc[start + p2]
        if is_low and p[p2] < p[p1] and o2 > o1 and o1 < 45:
            return {"type": "RSI_BULL_DIV", "bars_ago": int(len(p) - 1 - p2),
                    "detail": f"Price LL {p[p1]:.1f}->{p[p2]:.1f}, RSI HL {o1:.1f}->{o2:.1f}",
                    "pivots": [start + p1, start + p2]}
        if not is_low and p[p2] > p[p1] and o2 < o1 and o1 > 55:
            return {"type": "RSI_BEAR_DIV", "bars_ago": int(len(p) - 1 - p2),
                    "detail": f"Price HH {p[p1]:.1f}->{p[p2]:.1f}, RSI LH {o1:.1f}->{o2:.1f}",
                    "pivots": [start + p1, start + p2]}
        break
    return None


def analyze(df: pd.DataFrame):
    """df with Open/High/Low/Close/Volume. Returns indicator snapshot + signals."""
    df = df.dropna(subset=["Close"])
    if len(df) < 40:
        return None
    close = df["Close"]
    r = rsi(close)
    m, s, h = macd(close)
    signals = []
    for is_low, col in ((True, "Low"), (False, "High")):
        d = _divergence(df[col].values, r.values, is_low)
        if d:
            d.pop("pivots")
            signals.append(d)
    diff = (m - s).values
    for back in range(0, 3):
        i = len(diff) - 1 - back
        if diff[i] > 0 and diff[i - 1] <= 0:
            signals.append({"type": "MACD_BULL_X", "bars_ago": back,
                            "detail": f"MACD crossed above signal ({'below' if m.iloc[i] < 0 else 'above'} zero)"})
            break
        if diff[i] < 0 and diff[i - 1] >= 0:
            signals.append({"type": "MACD_BEAR_X", "bars_ago": back,
                            "detail": f"MACD crossed below signal ({'above' if m.iloc[i] > 0 else 'below'} zero)"})
            break
    vol = df["Volume"]
    avg = vol.iloc[-21:-1].mean()
    return {
        "last": round(float(close.iloc[-1]), 2),
        "rsi": round(float(r.iloc[-1]), 2),
        "macd": round(float(m.iloc[-1]), 3),
        "macd_signal": round(float(s.iloc[-1]), 3),
        "hist": round(float(h.iloc[-1]), 3),
        "vol_ratio": round(float(vol.iloc[-1] / avg), 2) if avg and avg > 0 else None,
        "bar_time": df.index[-1].isoformat(),
        "signals": signals,
    }


def chart_series(df: pd.DataFrame, limit=150):
    df = df.dropna(subset=["Close"]).copy()
    df["rsi"] = rsi(df["Close"])
    df["macd"], df["signal"], df["hist"] = macd(df["Close"])
    df["ema20"] = df["Close"].ewm(span=20, adjust=False).mean()
    df["sma50"] = df["Close"].rolling(50).mean()
    out = []
    for ts, row in df.tail(limit).iterrows():
        out.append({
            "t": ts.isoformat(),
            "o": round(float(row["Open"]), 2), "h": round(float(row["High"]), 2),
            "l": round(float(row["Low"]), 2), "c": round(float(row["Close"]), 2),
            "v": int(row["Volume"]) if not np.isnan(row["Volume"]) else 0,
            "rsi": round(float(row["rsi"]), 2), "macd": round(float(row["macd"]), 3),
            "signal": round(float(row["signal"]), 3), "hist": round(float(row["hist"]), 3),
            "ema20": round(float(row["ema20"]), 2),
            "sma50": None if np.isnan(row["sma50"]) else round(float(row["sma50"]), 2),
        })
    return out
