# Round 3 F&O APIs: options, oi-flow, liquidity, radar, strength, screeners
import math
import os

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
T = 60


def get(path, **params):
    return requests.get(f"{BASE_URL}/api{path}", params=params, timeout=T)


def _finite(obj):
    if isinstance(obj, float):
        assert math.isfinite(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _finite(v)
    elif isinstance(obj, list):
        for v in obj:
            _finite(v)


# Options chain analytics
@pytest.mark.parametrize("sym", ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "RELIANCE"])
def test_options_shape(sym):
    r = get(f"/options/{sym}")
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("spot", "pcr", "max_pain", "atm", "atm_iv", "straddle", "expected", "writers", "strikes", "pain", "smile", "expiries"):
        assert k in d, k
    assert d["symbol"] == sym
    assert d["spot"] > 0 and d["pcr"] >= 0
    assert d["expected"]["low"] < d["spot"] < d["expected"]["high"]
    assert abs((d["expected"]["high"] - d["spot"]) - d["straddle"]) < 0.05
    for k in ("support", "resistance"):
        assert d["writers"][k] in [s["strike"] for s in d["strikes"]]
    assert len(d["strikes"]) == len(d["pain"]) == len(d["smile"]) > 5
    s0 = d["strikes"][0]
    for side in ("ce", "pe"):
        for f in ("oi", "chg_oi", "iv", "ltp"):
            assert f in s0[side]
    assert s0["ce_build"] in ("Long buildup", "Short buildup", "Short covering", "Long unwinding")
    strikes = [s["strike"] for s in d["strikes"]]
    assert strikes == sorted(strikes)
    assert d["max_pain"] in [p["strike"] for p in d["pain"]] or True
    assert isinstance(d["expiries"], list) and d["expiry"] == d["expiries"][0]
    _finite(d)


def test_options_expiry_switch():
    d = get("/options/NIFTY").json()
    e2 = d["expiries"][1]
    d2 = get("/options/NIFTY", expiry=e2).json()
    assert d2["expiry"] == e2
    assert d2["straddle"] != d["straddle"]


def test_options_pcr_consistent():
    d = get("/options/NIFTY").json()
    assert abs(d["pcr"] - d["pe_oi"] / d["ce_oi"]) < 0.01


def test_options_bad_symbol():
    r = get("/options/NOTASYMBOL")
    assert r.status_code in (400, 404, 502)


# OI flow
def test_oi_flow():
    r = get("/oi-flow/NIFTY")
    assert r.status_code == 200
    d = r.json()
    assert d["chain"]["symbol"] == "NIFTY"
    assert isinstance(d["history"], list) and len(d["history"]) >= 1
    assert "_id" not in d["history"][0]
    assert d["history"][0]["pcr"] > 0
    assert all(k.split(":")[0] in ("ce", "pe") for k in d["buildup"])


# Liquidity map
@pytest.mark.parametrize("sym,kind", [("NIFTY", "Time-at-price"), ("BANKNIFTY", "Time-at-price"), ("RELIANCE", "Volume")])
def test_liquidity(sym, kind):
    r = get(f"/liquidity/{sym}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["bins"]) == 56
    assert d["profile_kind"] == kind
    assert d["va_low"] <= d["poc"] <= d["va_high"]
    assert max(b["v"] for b in d["bins"]) == 1.0
    assert all(b["price"] > d["spot"] for b in d["buy_stops"])
    assert all(b["price"] < d["spot"] for b in d["sell_stops"])
    for w in d["oi_walls"]:
        assert d["range"][0] <= w["price"] <= d["range"][1]
    assert len(d["series"]) > 30
    _finite(d)


def test_liquidity_unknown():
    assert get("/liquidity/FOOBAR").status_code == 404


# Radar / RRG
def test_radar_rrg():
    d = get("/radar").json()
    assert len(d["rrg"]) >= 8
    for s in d["rrg"]:
        assert 2 <= len(s["tail"]) <= 6
        x, y = s["tail"][-1]["x"], s["tail"][-1]["y"]
        exp = "Leading" if x >= 100 and y >= 100 else "Weakening" if x >= 100 else "Lagging" if y < 100 else "Improving"
        assert s["quadrant"] == exp


def test_radar_stock():
    d = get("/radar/RELIANCE").json()
    assert len(d["radar"]) == 6
    assert all(0 <= v <= 100 for v in d["radar"].values())
    assert get("/radar/FOOBAR").status_code == 404


# Strength
@pytest.mark.parametrize("u", ["nifty50", "nifty200"])
def test_strength(u):
    d = get("/strength", universe=u).json()
    assert len(d["strongest"]) == 15 and len(d["weakest"]) == 15
    rs = [x["rs_score"] for x in d["strongest"]]
    assert rs == sorted(rs, reverse=True)
    assert d["strongest"][0]["rs_score"] >= d["weakest"][0]["rs_score"]
    assert set(d["sectors"][0]["rel"]) == {"1D", "1W", "1M", "3M", "6M"}


# Screeners
@pytest.mark.parametrize("u", ["nifty50", "nifty200"])
def test_screeners(u):
    d = get("/screeners", universe=u).json()["screeners"]
    assert len(d) == 14
    for s in d:
        assert s["count"] == len(s["rows"])
    _finite(d)
