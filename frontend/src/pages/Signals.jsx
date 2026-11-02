import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { api, fmt, SIGNAL_META, TIMEFRAMES, timeAgo } from "../lib/api";
import { useApp } from "../lib/store";
import { Pct, SignalBadge, WatchBtn, Empty } from "../components/bits";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";

const Seg = ({ items, value, onChange, prefix }) => (
  <div className="flex max-w-full overflow-x-auto scroll-thin rounded-md border border-[#232736] p-0.5 bg-[#0D0F17]">
    {items.map(([v, l]) => (
      <button key={v} data-testid={`${prefix}-${v}`} onClick={() => onChange(v)}
        className={`px-3 py-1 rounded whitespace-nowrap font-mono text-xs transition-colors ${value === v ? "bg-[#6366F1] text-white" : "text-slate-400 hover:text-white"}`}>{l}</button>
    ))}
  </div>
);

const Row = ({ r }) => {
  const { setOpenSymbol } = useApp();
  return (
    <tr data-testid={`stock-row-${r.symbol}`} onClick={() => setOpenSymbol(r.symbol)} className="border-b border-[#1A1D28] hover:bg-white/[0.03] cursor-pointer transition-colors">
      <td className="px-4 py-2.5"><div className="font-mono font-semibold">{r.symbol}{r.nifty50 && <span className="ml-1.5 text-[9px] text-[#6366F1]">N50</span>}</div><div className="text-[11px] text-slate-500">{r.sector}</div></td>
      <td className="px-3 num text-right">{fmt(r.ltp)}</td>
      <td className="px-3 text-right"><Pct v={r.change_pct} /></td>
      <td className="px-3"><div className="flex flex-wrap gap-1">{r.signals.map((s, i) => <SignalBadge key={i} s={s} testid={`signal-${r.symbol}-${s.type}`} />)}</div></td>
      <td className={`px-3 num text-right ${r.rsi > 70 ? "text-[#EF4444]" : r.rsi < 30 ? "text-[#10B981]" : ""}`}>{fmt(r.rsi, 1)}</td>
      <td className={`px-3 num text-right ${r.hist >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{fmt(r.hist, 2)}</td>
      <td className="px-3 num text-right text-slate-400">{r.vol_ratio ? `${r.vol_ratio}x` : "—"}</td>
      <td className="px-3"><WatchBtn symbol={r.symbol} /></td>
    </tr>
  );
};

export default function Signals() {
  const [params, setParams] = useSearchParams();
  const [tf, setTf] = useState("15m");
  const [uni, setUni] = useState("nifty200");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const type = params.get("type") || "all";
  const load = () => { setData(null); api.get("/signals", { params: { tf, universe: uni } }).then((r) => setData(r.data)); };
  useEffect(load, [tf, uni]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => (data?.rows || []).filter((r) =>
    (type === "all" || r.signals.some((s) => s.type === type)) && (!q || r.symbol.includes(q.toUpperCase()) || r.sector.toLowerCase().includes(q.toLowerCase()))
  ), [data, type, q]);

  return (
    <div className="space-y-4" data-testid="signals-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">RSI(14) divergence · MACD(12,26,9) crossovers</div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight">Signal Scanner</h1>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-slate-500">
          <span data-testid="signals-updated">scanned {timeAgo(data?.updated_at)}</span>
          <button data-testid="signals-refresh" onClick={load} className="p-1.5 rounded border border-[#232736] hover:text-white transition-colors"><RefreshCw size={13} /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Seg prefix="timeframe" items={TIMEFRAMES.map((t) => [t, t === "1d" ? "Daily" : t])} value={tf} onChange={setTf} />
        <Seg prefix="universe-toggle" items={[["nifty50", "Nifty 50"], ["nifty200", "Nifty 200"]]} value={uni} onChange={setUni} />
        <Seg prefix="signal-filter" items={[["all", "All"], ...Object.entries(SIGNAL_META).map(([k, m]) => [k, m.label])]} value={type}
          onChange={(v) => setParams(v === "all" ? {} : { type: v })} />
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <Input data-testid="signals-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol or sector" className="pl-8 h-9 w-56 bg-[#0D0F17] font-mono text-xs" />
        </div>
      </div>
      <div className="panel overflow-x-auto scroll-thin">
        {!data ? <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 bg-[#1A1D28]" />)}</div> :
          data.scanning ? <Empty testid="signals-scanning" text="Scanning this timeframe for the first time… refresh in ~30s." /> :
          rows.length === 0 ? <Empty testid="signals-empty" text="No setups match these filters right now." /> : (
          <table className="w-full text-sm" data-testid="signals-table">
            <thead className="sticky top-0 bg-[#12141C]">
              <tr className="eyebrow text-left border-b border-[#232736]">
                <th className="px-4 py-3">Symbol</th><th className="px-3 text-right">LTP ₹</th><th className="px-3 text-right">1D %</th>
                <th className="px-3">Signal</th><th className="px-3 text-right">RSI</th><th className="px-3 text-right">MACD Hist</th>
                <th className="px-3 text-right">Vol x</th><th className="px-3" />
              </tr>
            </thead>
            <tbody>{rows.map((r) => <Row key={r.symbol} r={r} />)}</tbody>
          </table>
        )}
      </div>
      <p data-testid="signals-count" className="font-mono text-[11px] text-slate-500">{rows.length} setups · bars ago shown as “·Nb” · educational only, not investment advice</p>
    </div>
  );
}
