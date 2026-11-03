import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import market  # noqa: E402
import nse  # noqa: E402
import liquidity  # noqa: E402
import analytics  # noqa: E402
from pulse import build_pulse  # noqa: E402
from universe import NIFTY200, NIFTY50, SECTOR_OF  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


@asynccontextmanager
async def lifespan(app):
    nse._store.update(db=db, loop=asyncio.get_running_loop())
    task = asyncio.create_task(market.run_loop(db))
    yield
    task.cancel()
    client.close()


app = FastAPI(lifespan=lifespan)
api = APIRouter(prefix="/api")


def _universe(rows, universe):
    return [r for r in rows if r["nifty50"]] if universe == "nifty50" else rows


@api.get("/")
async def root():
    return {"message": "Market Pulse API", "market": market.market_status()}


@api.get("/status")
async def status():
    return {"market": market.market_status(), "quotes_at": market.STATE["quotes_at"],
            "signals_at": market.STATE["signals_at"], "stocks": len(market.STATE["quotes"])}


@api.get("/universe")
async def universe():
    return [{"symbol": s, "sector": SECTOR_OF.get(s, "Other"), "nifty50": s in NIFTY50} for s in NIFTY200]


@api.get("/overview")
async def overview():
    return market.overview()


@api.get("/pulse")
async def pulse():
    return build_pulse()


@api.get("/stocks")
async def stocks(universe: str = "nifty200", symbols: str = None):
    rows = list(market.STATE["quotes"].values())
    if symbols:
        want = {s.strip().upper() for s in symbols.split(",") if s.strip()}
        rows = [r for r in rows if r["symbol"] in want]
    return {"updated_at": market.STATE["quotes_at"], "stocks": _universe(rows, universe)}


@api.get("/signals")
async def signals(tf: str = "15m", universe: str = "nifty200", only_signals: bool = True):
    if tf not in market.TIMEFRAMES:
        raise HTTPException(400, "invalid timeframe")
    rows = _universe(market.STATE["signals"].get(tf, []), universe)
    if only_signals:
        rows = [r for r in rows if r["signals"]]
        rows = sorted(rows, key=lambda r: min(s["bars_ago"] for s in r["signals"]))
    return {"tf": tf, "updated_at": market.STATE["signals_at"].get(tf), "scanning": tf not in market.STATE["signals"],
            "rows": rows}


@api.get("/stock/{symbol}")
async def stock(symbol: str, tf: str = Query("15m")):
    symbol = symbol.upper()
    if symbol not in NIFTY200:
        raise HTTPException(404, "symbol not in Nifty 200")
    if tf not in market.TIMEFRAMES:
        raise HTTPException(400, "invalid timeframe")
    return await market.stock_chart(symbol, tf)


UNAVAILABLE_MSG = ("Live option data is temporarily unavailable: NSE and the backup source didn't respond. "
                   "Please try again in a minute.")


async def _chain(symbol, expiry=None):
    symbol = symbol.upper()
    try:
        nse.validate_symbol(symbol, NIFTY200)
    except nse.BadRequest as e:
        raise HTTPException(404, str(e))
    try:
        return await asyncio.wait_for(asyncio.to_thread(nse.chain, symbol, expiry), timeout=25)
    except nse.BadRequest as e:
        raise HTTPException(400 if expiry else 404, str(e))
    except (nse.Unavailable, asyncio.TimeoutError):
        raise HTTPException(503, UNAVAILABLE_MSG)


@api.get("/options/{symbol}")
async def options(symbol: str, expiry: str = None):
    return await _chain(symbol, expiry)


@api.get("/options-symbols")
async def options_symbols():
    return {"indices": nse.INDEX_SYMBOLS, "stocks": NIFTY200}


@api.get("/oi-flow/{symbol}")
async def oi_flow(symbol: str):
    symbol = symbol.upper()
    ch = await _chain(symbol)
    builds = {}
    for r in ch["strikes"]:
        for side in ("ce", "pe"):
            b = r[f"{side}_build"]
            builds.setdefault(f"{side}:{b}", 0)
            builds[f"{side}:{b}"] += abs(r[side]["chg_oi"])
    return {"chain": ch, "history": await market.oi_history(db, symbol), "buildup": builds}


@api.get("/liquidity/{symbol}")
async def liquidity_map(symbol: str):
    symbol = symbol.upper()
    if symbol not in NIFTY200 and symbol not in liquidity.INDEX_YF:
        raise HTTPException(404, "unknown symbol")
    try:
        return await asyncio.to_thread(liquidity.build, symbol)
    except ValueError as e:
        raise HTTPException(404, str(e))


def _analytics():
    a = market.STATE.get("analytics")
    if not a:
        raise HTTPException(503, "analytics warming up")
    return a


@api.get("/radar")
async def radar():
    a = _analytics()
    return {"rrg": a["rrg"]}


@api.get("/radar/{symbol}")
async def radar_stock(symbol: str):
    m = _analytics()["metrics"].get(symbol.upper())
    if not m:
        raise HTTPException(404, "unknown symbol")
    return m


@api.get("/strength")
async def strength(universe: str = "nifty200"):
    a = _analytics()
    ms = [m for m in a["metrics"].values() if universe != "nifty50" or m["nifty50"]]
    ranked = sorted(ms, key=lambda m: -m["rs_score"])
    slim = lambda m: {k: m[k] for k in ("symbol", "sector", "ltp", "change_pct", "rs_score", "rel", "returns", "radar")}  # noqa: E731
    return {"sectors": analytics._sector_strength({m["symbol"]: m for m in ms}) if universe == "nifty50" else a["sectors"],
            "strongest": [slim(m) for m in ranked[:15]], "weakest": [slim(m) for m in ranked[::-1][:15]]}


@api.get("/screeners")
async def screeners_api(universe: str = "nifty200"):
    return {"screeners": analytics.screeners(_analytics()["metrics"], universe)}


@api.get("/news")
async def news(source: str = None):
    items = await market.market_news()
    if source:
        items = [n for n in items if n["source"] == source]
    return {"sources": list(market.NEWS_FEEDS.keys()), "items": items[:120]}


@api.get("/news/stocks")
async def news_stocks(symbols: str):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip().upper() in NIFTY200][:15]
    results = await asyncio.gather(*(market.stock_news(s) for s in syms))
    items = [n for r in results for n in r]
    return {"items": sorted(items, key=lambda x: x["published"] or "", reverse=True)}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
