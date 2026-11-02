# Market Pulse API regression tests (status, overview, stocks, signals, stock chart, news, universe)
import math
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
S = requests.Session()


def get(path, **kw):
    return S.get(f"{BASE_URL}/api{path}", timeout=60, **kw)


def _no_nan(obj):
    if isinstance(obj, float):
        assert not math.isnan(obj) and not math.isinf(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _no_nan(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_nan(v)


# Status / universe
def test_status():
    r = get("/status")
    assert r.status_code == 200
    d = r.json()
    assert "open" in d["market"] and d["stocks"] >= 190
    assert set(["5m", "15m", "30m", "60m", "1d"]) <= set(d["signals_at"].keys())


def test_universe():
    d = get("/universe").json()
    assert len(d) == 200
    assert sum(1 for x in d if x["nifty50"]) == 50
    assert all("sector" in x for x in d)


# Overview
def test_overview():
    d = get("/overview").json()
    _no_nan(d)
    for k in ["indices", "advances", "declines", "mood", "sectors", "gainers", "losers", "volume_shockers",
              "signal_counts_15m"]:
        assert k in d
    assert len(d["indices"]) > 0
    assert len(d["gainers"]) == 10 and len(d["losers"]) == 10
    assert d["gainers"][0]["change_pct"] >= d["gainers"][-1]["change_pct"]
    assert d["losers"][0]["change_pct"] <= d["losers"][-1]["change_pct"]
    assert d["advances"] + d["declines"] + d["unchanged"] >= 190


# Stocks
def test_stocks_all_and_filters():
    d = get("/stocks").json()
    _no_nan(d)
    assert len(d["stocks"]) >= 190
    n50 = get("/stocks", params={"universe": "nifty50"}).json()["stocks"]
    assert 45 <= len(n50) <= 50 and all(s["nifty50"] for s in n50)
    sel = get("/stocks", params={"symbols": "reliance,TCS,INFY"}).json()["stocks"]
    assert {s["symbol"] for s in sel} == {"RELIANCE", "TCS", "INFY"}


# Signals
@pytest.mark.parametrize("tf", ["5m", "15m", "30m", "60m", "1d"])
def test_signals_tf(tf):
    r = get("/signals", params={"tf": tf})
    assert r.status_code == 200
    d = r.json()
    _no_nan(d)
    assert d["tf"] == tf
    for row in d["rows"]:
        assert row["signals"]
        for s in row["signals"]:
            assert s["type"] in {"RSI_BULL_DIV", "RSI_BEAR_DIV", "MACD_BULL_X", "MACD_BEAR_X"}


def test_signals_nifty50_and_all():
    d = get("/signals", params={"tf": "15m", "universe": "nifty50"}).json()
    assert all(r["nifty50"] for r in d["rows"])
    full = get("/signals", params={"tf": "15m", "only_signals": "false"}).json()
    assert len(full["rows"]) >= len(get("/signals", params={"tf": "15m"}).json()["rows"])


def test_signals_invalid_tf():
    assert get("/signals", params={"tf": "7m"}).status_code == 400


# Stock chart
@pytest.mark.parametrize("tf", ["5m", "1d"])
def test_stock_chart(tf):
    r = get("/stock/reliance", params={"tf": tf})
    assert r.status_code == 200
    d = r.json()
    _no_nan(d)
    assert d["symbol"] == "RELIANCE" and d["tf"] == tf
    assert len(d["series"]) > 20
    pt = d["series"][-1]
    for k in ["t", "o", "h", "l", "c", "rsi", "macd", "signal", "hist"]:
        assert k in pt
    assert d["quote"]["symbol"] == "RELIANCE"
    assert d["analysis"] is not None


def test_stock_unknown_404():
    assert get("/stock/FOOBAR").status_code == 404


def test_stock_invalid_tf_400():
    assert get("/stock/TCS", params={"tf": "2h"}).status_code == 400


# News
def test_news():
    d = get("/news").json()
    assert len(d["sources"]) == 5
    assert len(d["items"]) > 0
    src = d["items"][0]["source"]
    f = get("/news", params={"source": src}).json()["items"]
    assert f and all(n["source"] == src for n in f)


def test_news_sources_populated():
    d = get("/news").json()
    present = {n["source"] for n in d["items"]}
    missing = set(d["sources"]) - present
    print("missing news sources:", missing)
    assert len(present) >= 3


def test_stock_news():
    d = get("/news/stocks", params={"symbols": "RELIANCE,TCS"}).json()
    assert len(d["items"]) > 0
    assert {n["symbol"] for n in d["items"]} <= {"RELIANCE", "TCS"}
    assert all(n["title"] and n["link"] for n in d["items"])


def test_stock_news_missing_param():
    assert get("/news/stocks").status_code == 422
