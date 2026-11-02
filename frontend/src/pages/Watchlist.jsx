import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmt } from "../lib/api";
import { useApp } from "../lib/store";
import { Pct, Spark, SignalBadge, WatchBtn, PanelHead, Empty } from "../components/bits";
import { NewsItem } from "./News";

const Card = ({ s, sig }) => {
  const { setOpenSymbol } = useApp();
  return (
    <div data-testid={`watch-card-${s.symbol}`} onClick={() => setOpenSymbol(s.symbol)} className="panel p-4 rise cursor-pointer hover:border-[#6366F1]/50 transition-colors">
      <div className="flex justify-between items-start">
        <div><div className="font-mono font-semibold">{s.symbol}</div><div className="text-[11px] text-slate-500">{s.sector}</div></div>
        <WatchBtn symbol={s.symbol} />
      </div>
      <div className="flex items-end justify-between mt-3">
        <div><div className="num text-xl">₹{fmt(s.ltp)}</div><div className="text-xs"><Pct v={s.change_pct} /></div></div>
        <Spark data={s.spark} w={90} h={28} />
      </div>
      <div className="flex flex-wrap gap-1 mt-3 min-h-[20px]">
        {sig?.signals?.map((x, i) => <SignalBadge key={i} s={x} />)}
        {sig && <span className="font-mono text-[10px] text-slate-500 self-center">RSI15m {fmt(sig.rsi, 1)}</span>}
      </div>
    </div>
  );
};

export default function Watchlist() {
  const { watchlist } = useApp();
  const [stocks, setStocks] = useState([]);
  const [sigs, setSigs] = useState({});
  const [news, setNews] = useState(null);
  const key = watchlist.join(",");
  useEffect(() => {
    if (!key) { setStocks([]); setNews({ items: [] }); return; }
    api.get("/stocks", { params: { symbols: key } }).then((r) => setStocks(r.data.stocks));
    api.get("/signals", { params: { tf: "15m", only_signals: false } }).then((r) => setSigs(Object.fromEntries(r.data.rows.map((x) => [x.symbol, x]))));
    setNews(null);
    api.get("/news/stocks", { params: { symbols: key } }).then((r) => setNews(r.data));
  }, [key]);
  return (
    <div className="space-y-6" data-testid="watchlist-page">
      <div>
        <div className="eyebrow mb-1">Saved in this browser · {watchlist.length} stocks</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight">Watchlist</h1>
      </div>
      {watchlist.length === 0 ? (
        <Empty testid="watchlist-empty" text="Your watchlist is empty. Tap the star on any stock (or search with ⌘K) to add it." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="watchlist-grid">
          {stocks.map((s) => <Card key={s.symbol} s={s} sig={sigs[s.symbol]} />)}
        </div>
      )}
      <div className="panel overflow-hidden">
        <PanelHead eyebrow="Google News · per-stock" title="Watchlist News" right={<Link to="/news" className="font-mono text-xs text-[#6366F1]" data-testid="all-news-link">All market news →</Link>} />
        <div data-testid="watchlist-news">
          {!news ? <Empty text="Loading headlines…" /> : news.items.length === 0 ? <Empty testid="watchlist-news-empty" text="No recent headlines for your stocks." /> :
            news.items.slice(0, 30).map((n, i) => <NewsItem key={n.link + i} n={n} i={i} testid={`watch-news-${i}`} />)}
        </div>
      </div>
    </div>
  );
}
