import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, Legend } from "recharts";
import { fmt, fmtL } from "../lib/api";
import { usePalette, tipStyle } from "../lib/store";
import { Seg, PageHead, Card, Tag, useFetch, Loading, ErrorBox } from "../components/fno";

const TugOfWar = ({ ce, pe }) => {
  const tot = Math.abs(ce) + Math.abs(pe) || 1;
  const peShare = (Math.max(pe, 0) / (Math.max(ce, 0) + Math.max(pe, 0) || 1)) * 100;
  const bullish = pe >= ce;
  return (
    <div data-testid="oi-tug">
      <div className="flex justify-between text-sm mb-2">
        <span><span className="eyebrow block">Call writers added</span><b className="num text-mp-bear text-xl">{fmtL(ce)}</b></span>
        <span className="text-right"><span className="eyebrow block">Put writers added</span><b className="num text-mp-bull text-xl">{fmtL(pe)}</b></span>
      </div>
      <div className="relative h-5 rounded-full overflow-hidden bg-mp-elev">
        <div className="absolute inset-y-0 left-0 bg-mp-bear grow-x origin-left" style={{ width: `${100 - peShare}%` }} />
        <div className="absolute inset-y-0 right-0 bg-mp-bull grow-x origin-right" style={{ width: `${peShare}%` }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`absolute top-1.5 w-2 h-2 rounded-full bg-white/80 ${bullish ? "tug-right" : "tug-left"}`} style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
        <div className="absolute top-0 bottom-0 w-1 bg-mp-surface transition-[left] duration-1000" style={{ left: `${100 - peShare}%` }} />
      </div>
      <p className="text-sm text-mp-muted mt-3" data-testid="oi-tug-verdict">
        {bullish ? "Put writers are adding more positions than call writers. They're selling downside insurance, which supports price."
          : "Call writers are adding more positions than put writers. They're capping upside, which weighs on price."}
        <span className="font-mono text-xs text-mp-faint"> ({fmtL(tot)} contracts of new OI)</span>
      </p>
    </div>
  );
};

const BUILDS = [
  ["ce:Short buildup", "Call writing", "bear", "Calls sold: bearish ceiling"],
  ["ce:Long buildup", "Call buying", "bull", "Calls bought: upside bets"],
  ["ce:Short covering", "Call short covering", "bull", "Call writers exit: ceiling lifts"],
  ["ce:Long unwinding", "Call unwinding", "bear", "Call buyers exit"],
  ["pe:Short buildup", "Put writing", "bull", "Puts sold: floor below"],
  ["pe:Long buildup", "Put buying", "bear", "Puts bought: hedging/downside"],
  ["pe:Short covering", "Put short covering", "bear", "Put writers exit: floor weakens"],
  ["pe:Long unwinding", "Put unwinding", "bull", "Put buyers exit"],
];

const Buildup = ({ b }) => {
  const max = Math.max(1, ...Object.values(b));
  return (
    <div className="grid sm:grid-cols-2 gap-3" data-testid="oi-buildup">
      {BUILDS.map(([k, label, tone, desc], i) => (
        <div key={k} className="rounded-xl border border-mp-border p-3 rise" style={{ animationDelay: `${i * 50}ms` }} data-testid={`buildup-${k.replace(":", "-").replace(" ", "-")}`}>
          <div className="flex justify-between items-baseline"><span className="text-sm font-semibold">{label}</span><span className="num text-xs text-mp-muted">{fmtL(b[k] || 0)}</span></div>
          <div className="mt-2 h-1.5 rounded-full bg-mp-elev overflow-hidden">
            <div className={`h-full rounded-full grow-x origin-left ${tone === "bull" ? "bg-mp-bull" : "bg-mp-bear"}`} style={{ width: `${((b[k] || 0) / max) * 100}%`, animationDelay: `${200 + i * 60}ms` }} />
          </div>
          <div className="text-[11px] text-mp-faint mt-1.5">{desc}</div>
        </div>
      ))}
    </div>
  );
};

const ChgChart = ({ d }) => {
  const p = usePalette();
  const tick = { fill: p.tick, fontSize: 10, fontFamily: "JetBrains Mono" };
  const data = d.strikes.map((r) => ({ strike: r.strike, ce: r.ce.chg_oi, pe: r.pe.chg_oi }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ left: -6, right: 8 }} barGap={1}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey="strike" tick={tick} minTickGap={24} /><YAxis tick={tick} tickFormatter={fmtL} />
        <Tooltip {...tipStyle(p)} formatter={(v, n) => [fmtL(v), n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke={p.tick} />
        <ReferenceLine x={d.atm} stroke={p.accent} strokeDasharray="3 3" label={{ value: `Spot ${fmt(d.spot, 0)}`, fill: p.accent, fontSize: 10, position: "top" }} />
        <Bar dataKey="ce" name="Call Δ OI" fill={p.bear} radius={[3, 3, 0, 0]} animationDuration={1200} />
        <Bar dataKey="pe" name="Put Δ OI" fill={p.bull} radius={[3, 3, 0, 0]} animationDuration={1200} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const History = ({ h }) => {
  const p = usePalette();
  const tick = { fill: p.tick, fontSize: 10, fontFamily: "JetBrains Mono" };
  if (h.length < 2) return <div className="h-[240px] flex items-center justify-center text-center text-sm text-mp-faint px-6" data-testid="oi-history-empty">The intraday PCR trail fills in every 3 minutes while the market is open. {h.length === 1 && `Last snapshot: PCR ${h[0].pcr} at ${h[0].timestamp}.`}</div>;
  const data = h.map((x) => ({ ...x, t: x.timestamp.split(" ")[1]?.slice(0, 5) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -6, right: 8 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey="t" tick={tick} minTickGap={30} /><YAxis yAxisId="a" tick={tick} domain={["auto", "auto"]} /><YAxis yAxisId="b" orientation="right" tick={tick} domain={["auto", "auto"]} />
        <Tooltip {...tipStyle(p)} />
        <Line yAxisId="a" dataKey="pcr" name="PCR" stroke={p.accent} strokeWidth={2} dot={false} />
        <Line yAxisId="b" dataKey="spot" name="Spot" stroke={p.tick} strokeWidth={1.4} dot={false} strokeDasharray="4 3" />
      </LineChart>
    </ResponsiveContainer>
  );
};

const tone = (b) => (b === "Short buildup" || b === "Long unwinding" ? "text-mp-bear" : "text-mp-bull");
const ptone = (b) => (b === "Short buildup" || b === "Long unwinding" ? "text-mp-bull" : "text-mp-bear");

const StrikeTable = ({ d }) => (
  <div className="overflow-x-auto scroll-thin" data-testid="oi-strike-table">
    <table className="w-full text-xs">
      <thead><tr className="eyebrow text-left border-b border-mp-border"><th className="py-2">Call action</th><th className="text-right">Call Δ OI</th><th className="text-center">Strike</th><th>Put Δ OI</th><th className="text-right">Put action</th></tr></thead>
      <tbody>
        {d.strikes.filter((r) => Math.abs(r.strike - d.spot) <= (d.strikes[1].strike - d.strikes[0].strike) * 8).map((r) => (
          <tr key={r.strike} className={`border-b border-mp-border/60 ${r.strike === d.atm ? "bg-mp-accent/10" : ""}`}>
            <td className={`py-1.5 ${r.ce.chg_oi ? tone(r.ce_build) : "text-mp-faint"}`}>{r.ce_build}</td>
            <td className="num text-right">{fmtL(r.ce.chg_oi)}</td>
            <td className="num text-center font-semibold">{fmt(r.strike, 0)}</td>
            <td className="num">{fmtL(r.pe.chg_oi)}</td>
            <td className={`text-right ${r.pe.chg_oi ? ptone(r.pe_build) : "text-mp-faint"}`}>{r.pe_build}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function OIFlow() {
  const [sym, setSym] = useState("NIFTY");
  const { data, error } = useFetch(`/oi-flow/${sym}`, [sym]);
  const d = data?.chain;
  return (
    <div className="space-y-5" data-testid="oi-flow-page">
      <PageHead eyebrow="Who is adding and exiting positions today · NSE options" title="OI Flow">
        {d && <span className="font-mono text-[11px] text-mp-faint">NSE as of {d.timestamp} · {d.expiry}</span>}
      </PageHead>
      <Seg prefix="oiflow-symbol" items={["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].map((s) => [s, s])} value={sym} onChange={setSym} />
      {error && <ErrorBox msg={error} />}
      {!data && !error && <Loading />}
      {d && (
        <>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card eyebrow="Today's new open interest" title="Tug of war" right={<Tag tone={d.pe_chg_oi >= d.ce_chg_oi ? "bull" : "bear"} testid="oiflow-verdict">{d.pe_chg_oi >= d.ce_chg_oi ? "Supportive" : "Capping"}</Tag>} testid="tug-card">
              <TugOfWar ce={d.ce_chg_oi} pe={d.pe_chg_oi} />
            </Card>
            <Card eyebrow="PCR through the session" title="PCR trail" testid="pcr-trail-card"><History h={data.history} /></Card>
          </div>
          <Card eyebrow="Change in open interest by strike" title="Where positions were added" testid="chg-oi-card"><ChgChart d={d} /></Card>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card eyebrow="Price change × OI change classification" title="Buildup breakdown" testid="buildup-card"><Buildup b={data.buildup} /></Card>
            <Card eyebrow="Strikes near spot" title="Strike-wise action" testid="strike-action-card"><StrikeTable d={d} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
