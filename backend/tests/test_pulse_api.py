# Round 2: /api/pulse visualisation payload tests
import math
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def pulse():
    r = requests.get(f"{BASE_URL}/api/pulse", timeout=60)
    assert r.status_code == 200
    assert "NaN" not in r.text and "Infinity" not in r.text
    d = r.json()
    if not d.get("ready"):
        pytest.skip("pulse not ready")
    return d


def _walk(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from _walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from _walk(v)
    else:
        yield o


# top-level keys + no NaN
def test_top_level_keys(pulse):
    for k in ["ready", "headline", "tape", "status_label", "mood", "rotation", "nifty", "banknifty", "vix",
              "sectors", "treemap", "leaders", "laggards", "top_inflows", "top_outflows",
              "buy_pressure", "sell_pressure", "volume_surges", "market", "updated_at"]:
        assert k in pulse, k
    for v in _walk(pulse):
        if isinstance(v, float):
            assert math.isfinite(v)


# headline / status label
def test_headline_status(pulse):
    assert pulse["tape"] in ("Risk-on", "Risk-off", "Mixed")
    assert pulse["headline"].startswith(pulse["tape"] + " tape:")
    assert "breadth" in pulse["headline"]
    if pulse["market"]["open"]:
        assert pulse["status_label"].startswith("Live")
    else:
        assert pulse["status_label"] == "Market closed · showing today's close"


# mood gauge
def test_mood(pulse):
    m = pulse["mood"]
    assert 0 <= m["score"] <= 100
    assert m["label"] in ("Risk-on", "Mild risk-on", "Neutral", "Mild risk-off", "Risk-off")
    assert [p["key"] for p in m["parts"]] == ["breadth", "flow", "nifty", "vol"]
    assert [p["weight"] for p in m["parts"]] == [35, 30, 20, 15]
    weighted = sum(p["score"] * p["weight"] for p in m["parts"]) / 100
    assert abs(weighted - m["score"]) <= 2
    for p in m["parts"]:
        assert 0 <= p["score"] <= 100


# money rotation
def test_rotation(pulse):
    r = pulse["rotation"]
    for k in ["outflows", "inflows", "net_cr", "total_in", "total_out", "text", "surge"]:
        assert k in r
    assert all(s["flow_cr"] > 0 for s in r["inflows"])
    assert all(s["flow_cr"] < 0 for s in r["outflows"])
    assert len(r["inflows"]) <= 5 and len(r["outflows"]) <= 5
    assert r["total_in"] >= 0 >= r["total_out"]
    assert abs(r["total_in"] + r["total_out"] - r["net_cr"]) <= 15
    net_sectors = sum(s["flow_cr"] for s in pulse["sectors"])
    assert abs(net_sectors - r["net_cr"]) <= 15
    if r["surge"]:
        assert f"Surge: {r['surge']}" in r["text"]


# index cards
@pytest.mark.parametrize("k", ["nifty", "banknifty"])
def test_index_cards(pulse, k):
    c = pulse[k]
    assert c["tag"] in ("Bullish", "Neutral", "Bearish")
    assert isinstance(c["intraday"], list) and len(c["intraday"]) > 10
    assert {"t", "c"} <= set(c["intraday"][0].keys())
    e = c["expected"]
    assert e["low"] < c["ltp"] < e["high"]
    assert isinstance(e["by"], str) and "-" in e["by"]


# VIX card
def test_vix(pulse):
    v = pulse["vix"]
    assert v["tag"] in ("Low", "Normal", "Elevated", "High")
    assert len(v["spark"]) == 30
    assert v["low_1y"] <= v["ltp"] <= v["high_1y"]
    assert 0 <= v["percentile"] <= 100
    assert v["nifty_move_pts"] > 0
    exp = pulse["nifty"]["ltp"] * v["ltp"] / math.sqrt(252) / 100
    assert abs(exp - v["nifty_move_pts"]) <= 2


# treemap / leaders / lists
def test_treemap_and_lists(pulse):
    tm = pulse["treemap"]
    assert len(tm) == len(pulse["sectors"]) >= 5
    for s in tm:
        assert s["children"] and all(c["size"] >= 1 for c in s["children"])
    assert len(pulse["leaders"]) == 3 and len(pulse["laggards"]) == 3
    tf = pulse["top_inflows"]
    assert tf == sorted(tf, key=lambda x: -x["flow_cr"])
    to = pulse["top_outflows"]
    assert to == sorted(to, key=lambda x: x["flow_cr"])
    bp = pulse["buy_pressure"]
    assert all(q["turnover_cr"] > 50 for q in bp)
    assert bp == sorted(bp, key=lambda x: -x["clv"])
    vs = pulse["volume_surges"]
    assert vs == sorted(vs, key=lambda x: -x["vol_ratio"])
    for q in tf:
        assert -1 <= q["clv"] <= 1
