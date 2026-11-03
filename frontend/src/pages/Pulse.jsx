import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, SIGNAL_META, timeAgo } from "../lib/api";
import { useApp } from "../lib/store";
import { PanelHead } from "../components/bits";
import { StockList } from "../components/StockTable";
import { Skeleton } from "../components/ui/skeleton";
import { MoneyRotation } from "../components/viz/MoneyRotation";
import { MoodCard } from "../components/viz/MoodCard";
import { IndexCard } from "../components/viz/IndexCard";
import { VixCard } from "../components/viz/VixCard";
import { SectorTreemap } from "../components/viz/SectorTreemap";
import { SectorFlowBars, FlowList, PressureList } from "../components/viz/FlowPanels";

const TABS = [["overview", "Overview"], ["money", "Money flow"], ["order", "Order flow"]];

const Tabs = ({ tab, setTab }) => {
  const i = TABS.findIndex(([k]) => k === tab);
  return (
    <div className="relative inline-flex p-1 rounded-full bg-mp-elev border border-mp-border" data-testid="pulse-tabs">
      <span className="absolute top-1 bottom-1 rounded-full bg-mp-surface shadow transition-transform duration-300 ease-out" style={{ width: `calc((100% - 8px) / 3)`, transform: `translateX(${i * 100}%)` }} />
      {TABS.map(([k, l]) => (
        <button key={k} data-testid={`pulse-tab-${k}`} onClick={() => setTab(k)}
          className={`relative z-10 w-28 py-1.5 text-sm font-medium rounded-full transition-colors ${tab === k ? "text-mp-accent" : "text-mp-muted hover:text-mp-fg"}`}>{l}</button>
      ))}
    </div>
  );
};

const Headline = ({ d }) => {
  const [tape, ...rest] = d.headline.split(":");
  const c = d.tape === "Risk-on" ? "text-mp-bull" : d.tape === "Risk-off" ? "text-mp-bear" : "text-mp-accent";
  return (
    <div className="rise">
      <div className="flex items-center gap-2 mb-3" data-testid="pulse-status-label">
        <span className="relative flex w-2 h-2">
          <span className={`absolute inset-0 rounded-full ${d.market.open ? "bg-mp-bull ping-ring" : "bg-mp-faint"}`} />
          <span className={`relative w-2 h-2 rounded-full ${d.market.open ? "bg-mp-bull" : "bg-mp-faint"}`} />
        </span>
        <span className="font-mono text-[11px] text-mp-muted">{d.status_label} · updated {timeAgo(d.updated_at)}</span>
      </div>
      <h1 data-testid="pulse-headline" className="text-2xl md:text-3xl lg:text-[34px] font-semibold tracking-tight leading-snug max-w-5xl">
        <span className={c}>{tape}:</span><span className="text-mp-fg">{rest.join(":")}</span>
      </h1>
    </div>
  );
};

const SignalSummary = ({ counts }) => (
  <div className="panel p-5 h-full" data-testid="signal-summary">
    <div className="eyebrow">RSI divergence · MACD · 15m</div>
    <h3 className="font-display text-2xl font-bold uppercase tracking-wide mb-4">Live setups</h3>
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(SIGNAL_META).map(([k, m]) => (
        <Link key={k} to={`/signals?type=${k}`} data-testid={`signal-count-${k}`} className="rounded-xl border border-mp-border p-4 hover:border-mp-accent/60 hover:-translate-y-0.5 transition-[transform,border-color]">
          <div className={`num text-3xl font-semibold ${m.bull ? "text-mp-bull" : "text-mp-bear"}`}>{counts[k] || 0}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-mp-muted mt-1">{m.label}</div>
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

const Overview = ({ d, o }) => {
  const { setOpenSymbol } = useApp();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><div className="eyebrow">Where money moved today · Nifty 200</div><h3 className="font-display text-2xl font-bold uppercase tracking-wide">Money rotation</h3></div>
            <div className="flex gap-4 font-mono text-[10px] text-mp-muted">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-mp-bear" />Losing money</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-mp-bull" />Receiving money</span>
            </div>
          </div>
          <MoneyRotation rotation={d.rotation} />
          <p data-testid="rotation-summary" className="text-sm text-mp-muted border-t border-mp-border pt-3">
            {d.rotation.text.split("Surge:")[0]}
            {d.rotation.surge && <>Surge: <button onClick={() => setOpenSymbol(d.rotation.surge)} data-testid="rotation-surge" className="font-mono font-semibold text-mp-accent hover:underline">{d.rotation.text.split("Surge:")[1]}</button></>}
          </p>
        </div>
        <MoodCard mood={d.mood} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <IndexCard d={d.nifty} testid="nifty-card" />
        <IndexCard d={d.banknifty} testid="banknifty-card" />
        <VixCard v={d.vix} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="panel p-5">
          <div className="eyebrow">Box size = turnover · colour = % change</div>
          <h3 className="font-display text-2xl font-bold uppercase tracking-wide mb-4">Sector map</h3>
          <SectorTreemap data={d.treemap} leaders={d.leaders} laggards={d.laggards} />
        </div>
        <SignalSummary counts={o?.signal_counts_15m || {}} />
      </div>
      {o && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ListPanel eyebrow="Nifty 200 · today" title="Top Gainers" rows={o.gainers} testid="top-gainers" />
          <ListPanel eyebrow="Nifty 200 · today" title="Top Losers" rows={o.losers} testid="top-losers" />
          <ListPanel eyebrow="Volume vs 20d avg" title="Volume Shockers" rows={o.volume_shockers} testid="volume-shockers" />
        </div>
      )}
    </div>
  );
};

const MoneyTab = ({ d }) => (
  <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]" data-testid="money-flow-tab">
    <SectorFlowBars sectors={d.sectors} />
    <FlowList title="Top inflows" eyebrow="Stocks receiving money" rows={d.top_inflows} metric="flow" bull testid="top-inflows" />
    <FlowList title="Top outflows" eyebrow="Closed near day low · estimated" rows={d.top_outflows} metric="flow" testid="top-outflows" />
  </div>
);

const OrderTab = ({ d }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="order-flow-tab">
    <PressureList title="Buy pressure" eyebrow="Closed near day high · turnover > ₹50 cr" rows={d.buy_pressure} testid="buy-pressure" />
    <PressureList title="Sell pressure" eyebrow="Closed near day low · turnover > ₹50 cr" rows={d.sell_pressure} testid="sell-pressure" />
    <FlowList title="Volume surges" eyebrow="Volume vs 20-day average" rows={d.volume_surges} metric="vol" testid="volume-surges" />
  </div>
);

export default function Pulse({ overview: o }) {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    const load = () => api.get("/pulse").then((r) => setD(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (!d) return <div className="grid gap-4 md:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl bg-mp-elev" />)}</div>;
  if (!d.ready) return <div data-testid="warming-up" className="panel p-10 font-mono text-sm text-mp-muted">Fetching Nifty 200 data from Yahoo Finance… this takes ~30s on first boot.</div>;
  return (
    <div className="space-y-6" data-testid="pulse-page">
      <Headline d={d} />
      <Tabs tab={tab} setTab={setTab} />
      {tab === "overview" && <Overview d={d} o={o} />}
      {tab === "money" && <MoneyTab d={d} />}
      {tab === "order" && <OrderTab d={d} />}
    </div>
  );
}
