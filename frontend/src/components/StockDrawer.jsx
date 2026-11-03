import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";
import { api, fmt, TIMEFRAMES } from "../lib/api";
import { useApp, usePalette, tipStyle } from "../lib/store";
import { Pct, SignalBadge, WatchBtn } from "./bits";

const label = (t, tf) => new Date(t).toLocaleString("en-IN", tf === "1d" ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

const Stat = ({ k, v, testid }) => (
  <div className="border border-mp-border rounded p-2.5 bg-mp-sunken">
    <div className="eyebrow">{k}</div>
    <div data-testid={testid} className="num text-sm mt-1">{v}</div>
  </div>
);

const Charts = ({ series, tf }) => {
  const data = series.map((d) => ({ ...d, x: label(d.t, tf) }));
  const p = usePalette();
  const tick = { fill: p.tick, fontSize: 10, fontFamily: "JetBrains Mono" };
  const tip = tipStyle(p);
  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} syncId="s">
          <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.accent} stopOpacity={0.35} /><stop offset="1" stopColor={p.accent} stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="x" hide /><YAxis domain={["auto", "auto"]} tick={tick} width={56} orientation="right" />
          <Tooltip {...tip} />
          <Area dataKey="c" name="Close" stroke={p.accent} fill="url(#pg)" strokeWidth={1.6} dot={false} />
          <Line dataKey="ema20" name="EMA20" stroke={p.warn} strokeWidth={1} dot={false} />
          <Line dataKey="sma50" name="SMA50" stroke={p.sky} strokeWidth={1} dot={false} strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="eyebrow pl-1">RSI 14</div>
      <ResponsiveContainer width="100%" height={90}>
        <ComposedChart data={data} syncId="s">
          <XAxis dataKey="x" hide /><YAxis domain={[0, 100]} ticks={[30, 70]} tick={tick} width={56} orientation="right" />
          <Tooltip {...tip} />
          <ReferenceLine y={70} stroke={p.bear} strokeDasharray="2 4" /><ReferenceLine y={30} stroke={p.bull} strokeDasharray="2 4" />
          <Line dataKey="rsi" name="RSI" stroke={p.accent} strokeWidth={1.4} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="eyebrow pl-1">MACD 12·26·9</div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={data} syncId="s">
          <XAxis dataKey="x" tick={tick} minTickGap={70} /><YAxis tick={tick} width={56} orientation="right" />
          <Tooltip {...tip} />
          <Bar dataKey="hist" name="Hist">{data.map((d, i) => <Cell key={i} fill={d.hist >= 0 ? p.bull : p.bear} fillOpacity={0.6} />)}</Bar>
          <Line dataKey="macd" name="MACD" stroke={p.sky} strokeWidth={1.2} dot={false} />
          <Line dataKey="signal" name="Signal" stroke={p.warn} strokeWidth={1.2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const Body = ({ symbol }) => {
  const [tf, setTf] = useState("15m");
  const [d, setD] = useState(null);
  useEffect(() => {
    setD(null);
    api.get(`/stock/${encodeURIComponent(symbol)}`, { params: { tf } }).then((r) => setD(r.data)).catch(() => setD({ error: true }));
  }, [symbol, tf]);
  const q = d?.quote, a = d?.analysis;
  return (
    <div className="space-y-5">
      <div className="flex gap-1" data-testid="drawer-timeframes">
        {TIMEFRAMES.map((t) => (
          <button key={t} data-testid={`drawer-tf-${t}`} onClick={() => setTf(t)}
            className={`px-2.5 py-1 rounded font-mono text-xs border transition-colors ${tf === t ? "bg-mp-accent border-mp-accent text-white" : "border-mp-border text-mp-muted hover:text-mp-fg"}`}>{t}</button>
        ))}
      </div>
      {!d && <Skeleton className="h-[440px] w-full bg-mp-elev" />}
      {d?.error && <div className="text-sm text-mp-bear">Failed to load chart.</div>}
      {d?.series && <Charts series={d.series} tf={tf} />}
      {a && (
        <div>
          <div className="eyebrow mb-2">Active signals · {tf}</div>
          <div data-testid="drawer-signals" className="flex flex-wrap gap-2">
            {a.signals.length ? a.signals.map((s, i) => (
              <div key={i} className="w-full flex items-center gap-3"><SignalBadge s={s} /><span className="text-xs text-mp-muted">{s.detail}</span></div>
            )) : <span className="text-xs text-mp-faint">No RSI divergence or MACD cross on this timeframe.</span>}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat k="RSI" v={fmt(a?.rsi)} testid="drawer-rsi" />
        <Stat k="MACD Hist" v={fmt(a?.hist, 3)} testid="drawer-hist" />
        <Stat k="Day H/L" v={q ? `${fmt(q.high)} / ${fmt(q.low)}` : "—"} />
        <Stat k="Vol x Avg" v={q?.vol_ratio ? `${q.vol_ratio}x` : "—"} />
        <Stat k="52W High" v={fmt(q?.high_52w)} />
        <Stat k="52W Low" v={fmt(q?.low_52w)} />
        <Stat k="Prev Close" v={fmt(q?.prev_close)} />
        <Stat k="Open" v={fmt(q?.open)} />
      </div>
    </div>
  );
};

export const StockDrawer = () => {
  const { openSymbol, setOpenSymbol } = useApp();
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    setQuote(null);
    if (openSymbol) api.get("/stocks", { params: { symbols: openSymbol } }).then((r) => setQuote(r.data.stocks[0]));
  }, [openSymbol]);
  return (
    <Sheet open={!!openSymbol} onOpenChange={(o) => !o && setOpenSymbol(null)}>
      <SheetContent data-testid="stock-detail-drawer" className="w-full sm:max-w-2xl bg-mp-bg border-l border-mp-border overflow-y-auto scroll-thin">
        {openSymbol && (
          <>
            <SheetHeader className="mb-5 text-left">
              <div className="eyebrow">{quote?.sector || "NSE"}{quote?.nifty50 ? " · Nifty 50" : " · Nifty 200"}</div>
              <SheetTitle className="flex items-center gap-3">
                <span data-testid="drawer-symbol" className="font-display text-4xl font-extrabold uppercase">{openSymbol}</span>
                <WatchBtn symbol={openSymbol} />
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex items-baseline gap-3">
                  <span data-testid="drawer-ltp" className="num text-2xl text-mp-fg">₹{fmt(quote?.ltp)}</span>
                  {quote && <Pct v={quote.change_pct} testid="drawer-change" />}
                </div>
              </SheetDescription>
            </SheetHeader>
            <Body symbol={openSymbol} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
