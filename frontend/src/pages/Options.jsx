import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from "recharts";
import { fmt, fmtL } from "../lib/api";
import { usePalette, tipStyle } from "../lib/store";
import { SymbolBar, PageHead, Card, Tag, useFetch, Loading, ErrorBox, SourceBadge } from "../components/fno";
import { Gauge } from "../components/viz/Gauge";
import { OIButterfly, WritersRange } from "../components/viz/OptionsViz";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const Stat = ({ k, v, sub, testid, tone }) => (
  <div className="panel p-4 rise" data-testid={testid}>
    <div className="eyebrow">{k}</div>
    <div className={`num text-2xl font-semibold mt-1 ${tone || ""}`}>{v}</div>
    {sub && <div className="text-[11px] text-mp-faint mt-0.5">{sub}</div>}
  </div>
);

const Smile = ({ d }) => {
  const p = usePalette();
  const tick = { fill: p.tick, fontSize: 10, fontFamily: "JetBrains Mono" };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={d.smile} margin={{ left: -10, right: 8 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey="strike" tick={tick} minTickGap={30} /><YAxis tick={tick} domain={["auto", "auto"]} />
        <Tooltip {...tipStyle(p)} />
        <ReferenceLine x={d.atm} stroke={p.accent} strokeDasharray="3 3" label={{ value: "ATM", fill: p.accent, fontSize: 10, position: "top" }} />
        <Line dataKey="ce_iv" name="Call IV" stroke={p.bear} strokeWidth={2} dot={false} connectNulls animationDuration={1400} />
        <Line dataKey="pe_iv" name="Put IV" stroke={p.bull} strokeWidth={2} dot={false} connectNulls animationDuration={1400} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const PainCurve = ({ d }) => {
  const p = usePalette();
  const tick = { fill: p.tick, fontSize: 10, fontFamily: "JetBrains Mono" };
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={d.pain} margin={{ left: -10, right: 8 }}>
        <defs><linearGradient id="painG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.warn} stopOpacity={0.35} /><stop offset="1" stopColor={p.warn} stopOpacity={0} /></linearGradient></defs>
        <XAxis dataKey="strike" tick={tick} minTickGap={30} /><YAxis tick={tick} tickFormatter={fmtL} />
        <Tooltip {...tipStyle(p)} formatter={(v) => [fmtL(v), "Writers' payout"]} />
        <ReferenceLine x={d.max_pain} stroke={p.warn} strokeDasharray="3 3" label={{ value: `Max pain ${d.max_pain}`, fill: p.warn, fontSize: 10, position: "insideTop" }} />
        <ReferenceLine x={d.atm} stroke={p.accent} strokeDasharray="2 4" />
        <Area dataKey="pain" stroke={p.warn} strokeWidth={2} fill="url(#painG)" animationDuration={1400} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default function Options() {
  const [sym, setSym] = useState("NIFTY");
  const [exp, setExp] = useState("");
  const { data: d, error } = useFetch(`/options/${encodeURIComponent(sym)}${exp ? `?expiry=${exp}` : ""}`, [sym, exp]);
  const change = (s) => { setSym(s); setExp(""); };
  const tone = d?.sentiment === "Bullish" ? "bull" : d?.sentiment === "Bearish" ? "bear" : "warn";
  return (
    <div className="space-y-5" data-testid="options-page">
      <PageHead eyebrow="Open interest · put-call ratio · IV smile · writers' range · NSE" title="Option Pulse">
        {d && <SourceBadge d={d} />}
      </PageHead>
      <div className="flex flex-wrap items-center gap-3">
        <SymbolBar value={sym} onChange={change} prefix="options-symbol" />
        {d && (
          <Select value={d.expiry} onValueChange={setExp}>
            <SelectTrigger data-testid="options-expiry-select" className="w-40 h-9 rounded-full bg-mp-surface font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{d.expiries.map((e) => <SelectItem key={e} value={e} className="font-mono text-xs">{e}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {error && <ErrorBox msg={error} />}
      {!d && !error && <Loading />}
      {d && (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Stat k="Spot" v={fmt(d.spot)} sub={`ATM ${fmt(d.atm, 0)}`} testid="opt-spot" />
            <Stat k="PCR (OI)" v={d.pcr} sub={d.pcr_chg ? `Today's change PCR ${d.pcr_chg}` : "—"} testid="opt-pcr" tone={d.pcr >= 1 ? "text-mp-bull" : "text-mp-bear"} />
            <Stat k="Max pain" v={fmt(d.max_pain, 0)} sub={`${d.max_pain > d.spot ? "+" : ""}${fmt(d.max_pain - d.spot, 0)} from spot`} testid="opt-maxpain" />
            <Stat k="ATM IV" v={d.atm_iv ? `${d.atm_iv}%` : "—"} sub="avg of call & put" testid="opt-iv" />
            <Stat k="Straddle move" v={`±${fmt(d.straddle, 0)}`} sub={`${fmt(d.expected.low, 0)} – ${fmt(d.expected.high, 0)}`} testid="opt-straddle" />
            <Stat k="Total OI" v={`${fmtL(d.pe_oi)} / ${fmtL(d.ce_oi)}`} sub="puts / calls (contracts)" testid="opt-oi" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <Card eyebrow="Where option writers have parked their money" title="Writers' range" testid="writers-card"
              right={<Tag tone={tone} testid="opt-sentiment">{d.sentiment}</Tag>}>
              <WritersRange d={d} />
              <p className="text-sm text-mp-muted mt-2" data-testid="writers-summary">
                Put writers defend <b className="text-mp-bull">{fmt(d.writers.support, 0)}</b>, call writers cap <b className="text-mp-bear">{fmt(d.writers.resistance, 0)}</b>.
                The ATM straddle prices a move to <b className="text-mp-accent">{fmt(d.expected.low, 0)}–{fmt(d.expected.high, 0)}</b> by {d.expiry}.
              </p>
            </Card>
            <Card eyebrow="Puts ÷ calls open interest" title="PCR meter" testid="pcr-card">
              <Gauge value={((d.pcr - 0.5) / 1.0) * 100} left="0.5" right="1.5" testid="pcr-gauge">
                <div className="num text-3xl font-semibold leading-none">{d.pcr}</div>
                <div className="font-mono text-[10px] text-mp-faint mt-1">{d.sentiment}</div>
              </Gauge>
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card eyebrow={`${d.symbol} · ${d.expiry} · ${d.strikes.length} strikes around ATM`} title="Open interest map" testid="oi-map-card">
              <OIButterfly d={d} />
            </Card>
            <div className="space-y-4">
              <Card eyebrow="Implied volatility by strike" title="IV smile" testid="iv-smile-card"><Smile d={d} /></Card>
              <Card eyebrow="Total writer payout if expiry settles at strike" title="Max pain curve" testid="max-pain-card"><PainCurve d={d} /></Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
