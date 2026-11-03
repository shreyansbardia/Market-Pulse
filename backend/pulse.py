import math
from datetime import datetime, timedelta

import numpy as np

from market import STATE, IST, market_status

clamp = lambda v, lo=-1.0, hi=1.0: max(lo, min(hi, v))  # noqa: E731


def _next_session(date_str):
    d = datetime.strptime(date_str, "%Y-%m-%d") + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.strftime("%d-%b")


def _sector_flows(qs):
    by = {}
    for q in qs:
        s = by.setdefault(q["sector"], {"sector": q["sector"], "flow_cr": 0.0, "turnover_cr": 0.0, "stocks": []})
        s["flow_cr"] += q.get("flow_cr", 0)
        s["turnover_cr"] += q.get("turnover_cr", 0)
        s["stocks"].append(q)
    out = []
    for s in by.values():
        st = s.pop("stocks")
        s["flow_cr"], s["turnover_cr"] = round(s["flow_cr"]), round(s["turnover_cr"])
        s["change_pct"] = round(float(np.mean([x["change_pct"] for x in st])), 2)
        s["advances"], s["count"] = sum(1 for x in st if x["change_pct"] > 0), len(st)
        s["top_in"] = max(st, key=lambda x: x.get("flow_cr", 0))["symbol"]
        s["top_out"] = min(st, key=lambda x: x.get("flow_cr", 0))["symbol"]
        out.append(s)
    return sorted(out, key=lambda x: -x["flow_cr"])


def _index_card(idx, vix, intraday):
    if not idx:
        return None
    sigma = (vix["ltp"] / 100 / math.sqrt(252)) if (vix and idx["key"] == "NIFTY50") else (idx.get("sigma20") or 0.01)
    lo, hi = idx["ltp"] * (1 - sigma), idx["ltp"] * (1 + sigma)
    above = idx["ltp"] > idx.get("ema20", idx["ltp"])
    tag = "Bullish" if idx["change_pct"] > 0.3 and above else "Bearish" if idx["change_pct"] < -0.3 and not above else "Neutral"
    return {**{k: idx[k] for k in ("key", "name", "ltp", "change", "change_pct", "prev_close", "high", "low", "ema20")},
            "tag": tag, "intraday": intraday.get(idx["key"], []),
            "expected": {"low": round(lo, 2), "high": round(hi, 2), "by": _next_session(idx["date"]),
                         "sigma_pct": round(sigma * 100, 2)}}


def _vix_card(vix, nifty):
    if not vix:
        return None
    hist = vix.get("hist") or vix["spark"]
    v = vix["ltp"]
    pct = round(100 * sum(1 for x in hist if x < v) / len(hist))
    tag = "Low" if v < 12 else "Normal" if v < 18 else "Elevated" if v < 25 else "High"
    move_pct = v / math.sqrt(252)
    return {"ltp": v, "change": vix["change"], "change_pct": vix["change_pct"], "tag": tag,
            "spark": vix["spark"], "low_1y": min(hist), "high_1y": max(hist), "percentile": pct,
            "nifty_move_pct": round(move_pct, 2),
            "nifty_move_pts": round(nifty["ltp"] * move_pct / 100) if nifty else None}


def _mood(adv, dec, net, turnover, nifty, vix):
    breadth = 100 * adv / max(1, adv + dec)
    flow = 50 + 50 * clamp((net / turnover) / 0.6 if turnover else 0)
    if nifty:
        ns = 50 + 35 * clamp(nifty["change_pct"] / 1.5) + (15 if nifty["ltp"] > nifty["ema20"] else -15)
        ns = clamp(ns, 0, 100)
    else:
        ns = 50
    vol = 100 - vix["percentile"] if vix else 50
    score = round(0.35 * breadth + 0.30 * flow + 0.20 * ns + 0.15 * vol)
    label = ("Risk-on" if score >= 65 else "Mild risk-on" if score >= 55 else "Neutral" if score > 45
             else "Mild risk-off" if score > 35 else "Risk-off")
    parts = [
        {"key": "breadth", "label": "Breadth", "weight": 35, "score": round(breadth), "value": f"{adv}:{dec}"},
        {"key": "flow", "label": "Money flow", "weight": 30, "score": round(flow), "value": f"{'+' if net >= 0 else '−'}₹{abs(net):,.0f} cr"},
        {"key": "nifty", "label": "NIFTY signal", "weight": 20, "score": round(ns),
         "value": f"{nifty['change_pct']:+.2f}%" if nifty else "—"},
        {"key": "vol", "label": "Volatility", "weight": 15, "score": round(vol),
         "value": f"VIX {vix['ltp']:.2f}" if vix else "—"},
    ]
    return {"score": score, "label": label, "parts": parts}


def _join(names):
    if not names:
        return "none"
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} & {names[-1]}"


def build_pulse():
    qs = list(STATE["quotes"].values())
    if not qs:
        return {"ready": False, "market": market_status()}
    idx = {i["key"]: i for i in STATE["indices"]}
    adv = sum(1 for q in qs if q["change_pct"] > 0)
    dec = sum(1 for q in qs if q["change_pct"] < 0)
    sectors = _sector_flows(qs)
    net = round(sum(s["flow_cr"] for s in sectors))
    turnover = sum(s["turnover_cr"] for s in sectors)
    vix = _vix_card(idx.get("INDIAVIX"), idx.get("NIFTY50"))
    nifty = _index_card(idx.get("NIFTY50"), idx.get("INDIAVIX"), STATE["intraday"])
    bank = _index_card(idx.get("BANKNIFTY"), idx.get("INDIAVIX"), STATE["intraday"])
    mood = _mood(adv, dec, net, turnover, idx.get("NIFTY50"), vix)

    inflows = [s for s in sectors if s["flow_cr"] > 0][:5]
    outflows = sorted([s for s in sectors if s["flow_cr"] < 0], key=lambda x: x["flow_cr"])[:5]
    surge = max([q for q in qs if q.get("flow_cr", 0) > 0 and q["vol_ratio"]], key=lambda x: x["vol_ratio"], default=None)
    tape = "Risk-on" if mood["score"] >= 60 else "Risk-off" if mood["score"] <= 40 else "Mixed"
    headline = f"{tape} tape: breadth {adv}:{dec}, money into {_join([s['sector'] for s in inflows[:2]])}, out of {_join([s['sector'] for s in outflows[:2]])}"
    if nifty:
        headline += f"; NIFTY {nifty['change_pct']:+.2f}%, expected {nifty['expected']['low']:,.0f}–{nifty['expected']['high']:,.0f} by {nifty['expected']['by']}"
    rotation_text = (f"₹{abs(sum(s['flow_cr'] for s in outflows[:3])):,.0f} cr left {_join([s['sector'] for s in outflows[:3]])}"
                     f" while ₹{sum(s['flow_cr'] for s in inflows[:3]):,.0f} cr went into {_join([s['sector'] for s in inflows[:3]])}")
    if surge:
        rotation_text += f". Surge: {surge['symbol']} ({surge['vol_ratio']}x volume, {surge['change_pct']:+.2f}%)"

    ranked = sorted(qs, key=lambda x: x["change_pct"])
    treemap = [{"name": s["sector"], "change_pct": s["change_pct"],
                "children": [{"name": q["symbol"], "size": max(q.get("turnover_cr", 0), 1), "change_pct": q["change_pct"],
                              "sector": q["sector"]} for q in sorted(qs, key=lambda x: -x.get("turnover_cr", 0)) if q["sector"] == s["sector"]]}
               for s in sorted(sectors, key=lambda x: -x["turnover_cr"])]
    by_flow = sorted(qs, key=lambda x: -x.get("flow_cr", 0))
    by_clv = sorted([q for q in qs if q.get("turnover_cr", 0) > 50], key=lambda x: -x.get("clv", 0))
    status = market_status()
    data_date = idx["NIFTY50"]["date"] if "NIFTY50" in idx else None
    today = datetime.now(IST).strftime("%Y-%m-%d")
    if status["open"]:
        status_label = "Live · updates every 3 min"
    elif data_date == today:
        status_label = "Market closed · showing today's close"
    else:
        status_label = f"Market closed · showing last session's close ({datetime.strptime(data_date, '%Y-%m-%d').strftime('%d-%b')})" if data_date else "Market closed"
    return {
        "ready": True, "market": status, "updated_at": STATE["quotes_at"],
        "status_label": status_label,
        "headline": headline, "tape": tape, "mood": mood,
        "rotation": {"outflows": outflows, "inflows": inflows, "net_cr": net,
                     "total_in": round(sum(s["flow_cr"] for s in sectors if s["flow_cr"] > 0)),
                     "total_out": round(sum(s["flow_cr"] for s in sectors if s["flow_cr"] < 0)),
                     "text": rotation_text, "surge": surge["symbol"] if surge else None},
        "nifty": nifty, "banknifty": bank, "vix": vix,
        "sectors": sectors, "treemap": treemap,
        "leaders": [q["symbol"] for q in ranked[::-1][:3]], "laggards": [q["symbol"] for q in ranked[:3]],
        "top_inflows": by_flow[:12], "top_outflows": by_flow[::-1][:12],
        "buy_pressure": by_clv[:12], "sell_pressure": by_clv[::-1][:12],
        "volume_surges": sorted([q for q in qs if q["vol_ratio"]], key=lambda x: -x["vol_ratio"])[:12],
        "turnover_cr": round(turnover), "advances": adv, "declines": dec,
    }
