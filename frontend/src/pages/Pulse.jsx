import { Link } from "react-router-dom";
import { fmt, SIGNAL_META, timeAgo } from "../lib/api";
import { useApp } from "../lib/store";
import { PanelHead, Pct } from "../components/bits";
import { StockList } from "../components/StockTable";
import { Skeleton } from "../components/ui/skeleton";

const Breadth = ({ o }) => {
  const total = o.advances + o.declines + o.unchanged || 1;
  const bull = (o.advances / total) * 100;
  return (
    <div className="panel p-5 rise" data-testid="market-breadth">
      <div className="eyebrow mb-2">Nifty 200 breadth</div>
      <div className="flex items-baseline justify-between">
        <h2 data-testid="market-mood" className={`font-display text-4xl lg:text-5xl font-extrabold uppercase tracking-tight ${bull > 58 ? "text-[#10B981]" : bull < 42 ? "text-[#EF4444]" : "text-slate-100"}`}>{o.mood}</h2>
        <span className="num text-xs text-slate-500">updated {timeAgo(o.updated_at)}</span>
      </div>
      <div className="mt-5 h-2.5 rounded-full overflow-hidden flex bg-[#1A1D28]">
        <div className="bg-[#10B981] transition-[width] duration-700" style={{ width: `${bull}%` }} />
        <div className="bg-slate-600" style={{ width: `${(o.unchanged / total) * 100}%` }} />
        <div className="bg-[#EF4444] flex-1" />
      </div>
      <div className="mt-3 flex justify-between font-mono text-xs">
        <span data-testid="advances-count" className="text-[#10B981]">▲ {o.advances} advancing</span>
        <span data-testid="declines-count" className="text-[#EF4444]">{o.declines} declining ▼</span>
      </div>
    </div>
  );
};

const IndexCards = ({ indices }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {indices.map((i, k) => (
      <div key={i.key} data-testid={`index-card-${i.key}`} className="panel p-4 rise" style={{ animationDelay: `${k * 60}ms` }}>
        <div className="eyebrow">{i.name}</div>
        <div className="num text-lg mt-1">{fmt(i.ltp)}</div>
        <div className="text-xs num"><Pct v={i.change_pct} /> <span className="text-slate-500">({i.change > 0 ? "+" : ""}{fmt(i.change)})</span></div>
      </div>
    ))}
  </div>
);

const heat = (v) => {
  const a = Math.min(1, Math.abs(v) / 2.5) * 0.55 + 0.08;
  return v >= 0 ? `rgba(16,185,129,${a})` : `rgba(239,68,68,${a})`;
};

const Heatmap = ({ sectors }) => {
  const { setOpenSymbol } = useApp();
  return (
    <div className="panel" data-testid="sector-heatmap">
      <PanelHead eyebrow="Avg change by sector" title="Sector Heatmap" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-4">
        {sectors.map((s) => (
          <div key={s.sector} data-testid={`sector-tile-${s.sector}`} className="rounded p-3 border border-white/5 transition-transform hover:-translate-y-0.5" style={{ background: heat(s.change_pct) }}>
            <div className="flex justify-between items-baseline">
              <span className="font-display text-lg font-bold uppercase">{s.sector}</span>
              <span className="num text-sm text-white">{s.change_pct > 0 ? "+" : ""}{fmt(s.change_pct)}%</span>
            </div>
            <div className="font-mono text-[10px] text-white/60">{s.advances}/{s.count} up</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {s.top.map((t) => (
                <button key={t.symbol} onClick={() => setOpenSymbol(t.symbol)} data-testid={`sector-stock-${t.symbol}`}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-black/30 hover:bg-black/50 transition-colors">
                  {t.symbol} {t.change_pct > 0 ? "+" : ""}{fmt(t.change_pct, 1)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SignalSummary = ({ counts }) => (
  <div className="panel p-5" data-testid="signal-summary">
    <div className="eyebrow mb-3">Live setups · 15m · Nifty 200</div>
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(SIGNAL_META).map(([k, m]) => (
        <Link key={k} to={`/signals?type=${k}`} data-testid={`signal-count-${k}`} className="rounded border border-[#232736] p-3 hover:border-[#6366F1]/60 transition-colors">
          <div className={`num text-3xl ${m.bull ? "text-[#10B981]" : "text-[#EF4444]"}`}>{counts[k] || 0}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 mt-1">{m.label}</div>
        </Link>
      ))}
    </div>
  </div>
);

const ListPanel = ({ title, eyebrow, rows, testid }) => (
  <div className="panel overflow-hidden">
    <PanelHead eyebrow={eyebrow} title={title} />
    <StockList rows={rows} testid={testid} />
  </div>
);

export default function Pulse({ overview: o }) {
  if (!o) return <div className="grid gap-4 md:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 bg-[#12141C]" />)}</div>;
  if (!o.updated_at) return <div data-testid="warming-up" className="panel p-10 font-mono text-sm text-slate-400">Fetching Nifty 200 data from Yahoo Finance… this takes ~30s on first boot.</div>;
  return (
    <div className="space-y-4" data-testid="pulse-page">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Breadth o={o} />
        <IndexCards indices={o.indices} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Heatmap sectors={o.sectors} />
        <SignalSummary counts={o.signal_counts_15m} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ListPanel eyebrow="Nifty 200 · today" title="Top Gainers" rows={o.gainers} testid="top-gainers" />
        <ListPanel eyebrow="Nifty 200 · today" title="Top Losers" rows={o.losers} testid="top-losers" />
        <ListPanel eyebrow="Volume vs 20d avg" title="Volume Shockers" rows={o.volume_shockers} testid="volume-shockers" />
      </div>
    </div>
  );
}
