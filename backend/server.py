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
from universe import NIFTY200, NIFTY50, SECTOR_OF  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


@asynccontextmanager
async def lifespan(app):
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
