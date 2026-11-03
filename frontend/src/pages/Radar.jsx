import { useMemo, useState } from "react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RRadar, Tooltip } from "recharts";
import { fmt } from "../lib/api";
import { usePalette, tipStyle, useApp } from "../lib/store";
import { SymbolBar, PageHead, Card, Tag, useFetch, Loading, ErrorBox } from "../components/fno";
import { Pct } from "../components/bits";

const W = 760, H = 560, M = 44;
const QUAD = { Leading: "bull", Weakening: "warn", Lagging: "bear", Improving: "sky" };

const RRG = ({ rrg }) => {
  const p = usePalette();
  const [focus, setFocus] = useState(null);
  const all = rrg.flatMap((r) => r.tail);
  const span = (k) => Math.max(1.2, ...all.map((t) => Math.abs(t[k] - 100))) * 1.15;
  const sx = span("x"), sy = span("y");
  const X = (v) => M + ((v - (100 - sx)) / (2 * sx)) * (W - 2 * M);
  const Y = (v) => H - M - ((v - (100 - sy)) / (2 * sy)) * (H - 2 * M);
  const qc = { Leading: p.bull, Weakening: p.warn, Lagging: p.bear, Improving: p.sky };
  const cx = X(100), cy = Y(100);
  const labelY = {};
  [...rrg].map((r) => ({ s: r.sector, x: X(r.tail[r.tail.length - 1].x), y: Y(r.tail[r.tail.length - 1].y) }))
    .sort((a, b) => a.y - b.y)
    .forEach((h, i, arr) => {
      let ly = h.y + 4;
      arr.slice(0, i).forEach((o) => { if (Math.abs(o.x - h.x) < 110 && Math.abs(labelY[o.s] - ly) < 14) ly = labelY[o.s] + 14; });
      labelY[h.s] = ly;
    });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" data-testid="rrg-svg">
      <rect x={cx} y={M} width={W - M - cx} height={cy - M} fill={p.bull} opacity={0.06} />
      <rect x={cx} y={cy} width={W - M - cx} height={H - M - cy} fill={p.warn} opacity={0.06} />
      <rect x={M} y={cy} width={cx - M} height={H - M - cy} fill={p.bear} opacity={0.06} />
      <rect x={M} y={M} width={cx - M} height={cy - M} fill={p.sky} opacity={0.06} />
      <line x1={M} x2={W - M} y1={cy} y2={cy} stroke={p.tick} strokeOpacity={0.4} />
      <line x1={cx} x2={cx} y1={M} y2={H - M} stroke={p.tick} strokeOpacity={0.4} />
      {[["LEADING", W - M - 8, M + 18, "end", p.bull], ["WEAKENING", W - M - 8, H - M - 10, "end", p.warn], ["LAGGING", M + 8, H - M - 10, "start", p.bear], ["IMPROVING", M + 8, M + 18, "start", p.sky]].map(([t, x, y, a, c]) => (
        <text key={t} x={x} y={y} textAnchor={a} fill={c} style={{ font: "700 13px 'Barlow Condensed'", letterSpacing: ".2em" }}>{t}</text>
      ))}
      <text x={W / 2} y={H - 10} textAnchor="middle" fill={p.tick} style={{ font: "500 10px 'JetBrains Mono'" }}>RS-RATIO (strength vs NIFTY) →</text>
      <text x={14} y={H / 2} textAnchor="middle" fill={p.tick} transform={`rotate(-90 14 ${H / 2})`} style={{ font: "500 10px 'JetBrains Mono'" }}>RS-MOMENTUM →</text>
      {rrg.map((r, k) => {
        const c = qc[r.quadrant];
        const pts = r.tail.map((t) => `${X(t.x).toFixed(1)},${Y(t.y).toFixed(1)}`).join(" ");
        const head = r.tail[r.tail.length - 1];
        const dim = focus && focus !== r.sector;
        return (
          <g key={r.sector} opacity={dim ? 0.15 : 1} style={{ transition: "opacity .25s" }} onMouseEnter={() => setFocus(r.sector)} onMouseLeave={() => setFocus(null)} data-testid={`rrg-${r.sector}`} className="cursor-pointer">
            <polyline points={pts} fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" style={{ animationDelay: `${k * 90}ms` }} opacity={0.75} />
            {r.tail.slice(0, -1).map((t, i) => <circle key={i} cx={X(t.x)} cy={Y(t.y)} r={1.5 + i * 0.35} fill={c} opacity={0.35 + (i / r.tail.length) * 0.5} />)}
            <circle cx={X(head.x)} cy={Y(head.y)} r={7} fill={c} className="ping-ring" opacity={0.5} />
            <circle cx={X(head.x)} cy={Y(head.y)} r={6} fill={c} stroke={p.tipBg} strokeWidth={2} />
            {Math.abs(labelY[r.sector] - (Y(head.y) + 4)) > 2 && <line x1={X(head.x) + 6} y1={Y(head.y)} x2={X(head.x) + 10} y2={labelY[r.sector] - 4} stroke={c} strokeWidth={1} />}
            <text x={X(head.x) + 10} y={labelY[r.sector]} fill={p.fg} style={{ font: "600 12px 'DM Sans'" }}>{r.sector}</text>
            {focus === r.sector && <text x={X(head.x) + 10} y={labelY[r.sector] + 14} fill={p.tick} style={{ font: "500 10px 'JetBrains Mono'" }}>{head.x.toFixed(2)} / {head.y.toFixed(2)} · {r.tail[0].date}→{head.date}</text>}
          </g>
        );
      })}
    </svg>
  );
};

const StockRadar = ({ sym }) => {
  const p = usePalette();
  const { setOpenSymbol } = useApp();
  const { data: m, error } = useFetch(`/radar/${encodeURIComponent(sym)}`, [sym]);
  const data = useMemo(() => (m ? Object.entries(m.radar).map(([k, v]) => ({ axis: k, score: v, avg: 50 })) : []), [m]);
  if (error) return <ErrorBox msg={error} />;
  if (!m) return <Loading h={380} />;
  const overall = Math.round(data.reduce((a, b) => a + b.score, 0) / data.length);
  return (
    <div className="grid md:grid-cols-[1fr_220px] gap-4 items-center" data-testid="stock-radar">
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke={p.grid} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: p.fg, fontSize: 11, fontFamily: "DM Sans" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip {...tipStyle(p)} />
          <RRadar name="Nifty 200 median" dataKey="avg" stroke={p.tick} fill={p.tick} fillOpacity={0.06} strokeDasharray="3 3" />
          <RRadar name={sym} dataKey="score" stroke={p.accent} fill={p.accent} fillOpacity={0.3} strokeWidth={2} animationDuration={1200} dot={{ r: 3, fill: p.accent }} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="space-y-3">
        <button onClick={() => setOpenSymbol(sym)} className="font-display text-4xl font-extrabold uppercase hover:text-mp-accent transition-colors" data-testid="radar-open-drawer">{sym}</button>
        <div className="text-sm"><span className="num">₹{fmt(m.ltp)}</span> <Pct v={m.change_pct} /></div>
        <div><div className="eyebrow">Composite score</div><div className="num text-4xl font-semibold text-mp-accent" data-testid="radar-score">{overall}</div><div className="text-[11px] text-mp-faint">percentile vs Nifty 200</div></div>
        <div className="text-xs text-mp-muted space-y-1">
          <div>RSI (daily) <b className="num text-mp-fg">{m.rsi_d}</b></div>
          <div>20-day CMF <b className="num text-mp-fg">{m.cmf}</b></div>
          <div>3M vs NIFTY <b className={`num ${m.rel["3M"] >= 0 ? "text-mp-bull" : "text-mp-bear"}`}>{m.rel["3M"] > 0 ? "+" : ""}{m.rel["3M"]}%</b></div>
        </div>
      </div>
    </div>
  );
};

export default function Radar() {
  const { data, error } = useFetch("/radar", []);
  const [sym, setSym] = useState("RELIANCE");
  const groups = useMemo(() => {
    const g = { Leading: [], Improving: [], Weakening: [], Lagging: [] };
    (data?.rrg || []).forEach((r) => g[r.quadrant].push(r.sector));
    return g;
  }, [data]);
  return (
    <div className="space-y-5" data-testid="radar-page">
      <PageHead eyebrow="Relative rotation of Nifty sectors vs NIFTY · weekly tails" title="Radar" />
      {error && <ErrorBox msg={error} />}
      {!data && !error && <Loading h={560} />}
      {data && (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <Card eyebrow="Sectors rotate clockwise: improving → leading → weakening → lagging" title="Sector rotation" testid="rrg-card"><RRG rrg={data.rrg} /></Card>
          <div className="space-y-3">
            {Object.entries(groups).map(([q, list]) => (
              <div key={q} className="panel p-4 rise" data-testid={`rrg-quad-${q}`}>
                <div className="flex justify-between items-center mb-2"><Tag tone={QUAD[q] === "sky" ? "accent" : QUAD[q]}>{q}</Tag><span className="num text-xs text-mp-faint">{list.length}</span></div>
                <div className="flex flex-wrap gap-1.5">{list.length ? list.map((s) => <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-mp-elev">{s}</span>) : <span className="text-xs text-mp-faint">None</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Card eyebrow="Six-factor percentile profile vs the Nifty 200" title="Stock radar" testid="stock-radar-card"
        right={<SymbolBar value={sym} onChange={setSym} indices={[]} prefix="radar-symbol" />}>
        <StockRadar sym={sym} />
      </Card>
    </div>
  );
}
