import { useState } from "react";
import { fmt } from "../lib/api";
import { usePalette } from "../lib/store";
import { SymbolBar, PageHead, Card, useFetch, Loading, ErrorBox } from "../components/fno";

const W = 1100, H = 540, PX = 880, PL = 60, PT = 20, PB = 30;

const Level = ({ y, color, label, dash, w = 1.5, slot = 0, testid }) => (
  <g data-testid={testid}>
    <line x1={PL} x2={PX} y1={y} y2={y} stroke={color} strokeWidth={w} strokeDasharray={dash} className="breathe" />
    <rect x={PL + 6 + slot * 190} y={y - 17} rx={4} width={label.length * 6.6 + 12} height={15} fill={color} opacity={0.14} />
    <text x={PL + 12 + slot * 190} y={y - 6} fill={color} style={{ font: "600 10px 'JetBrains Mono'" }}>{label}</text>
  </g>
);

const withSlots = (levels, y) => {
  const sorted = [...levels].sort((a, b) => y(a.price) - y(b.price));
  let lastY = -99, slot = 0;
  return sorted.map((L) => {
    const yy = y(L.price);
    slot = yy - lastY < 18 ? (slot + 1) % 4 : 0;
    lastY = yy;
    return { ...L, slot };
  });
};

const LiquidityMap = ({ d }) => {
  const p = usePalette();
  const [lo, hi] = d.range;
  const y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const n = d.series.length;
  const x = (i) => PL + (i / (n - 1)) * (PX - PL - 10);
  const path = d.series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.c).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: 7 }, (_, i) => lo + ((hi - lo) * i) / 6);
  const days = d.series.reduce((a, s, i) => { const day = s.t.slice(0, 10); if (!a.length || a[a.length - 1].day !== day) a.push({ day, i }); return a; }, []);
  const maxStop = Math.max(1, ...[...d.buy_stops, ...d.sell_stops].map((s) => s.strength));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" data-testid="liquidity-svg">
      <defs>
        <linearGradient id="lqBand" x1="0" x2="1"><stop offset="0" stopColor={p.accent} stopOpacity={0.05} /><stop offset="0.5" stopColor={p.accent} stopOpacity={0.3} /><stop offset="1" stopColor={p.accent} stopOpacity={0.12} /></linearGradient>
        <linearGradient id="lqProf" x1="0" x2="1"><stop offset="0" stopColor={p.accent} stopOpacity={0.9} /><stop offset="1" stopColor={p.accent2} stopOpacity={0.6} /></linearGradient>
        <filter id="lqGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {d.bins.map((b, i) => (
        <rect key={i} x={PL} width={PX - PL} y={y(b.hi)} height={Math.max(1, y(b.lo) - y(b.hi))} fill="url(#lqBand)" opacity={Math.pow(b.v, 1.4) * 0.9} className="rise" style={{ animationDelay: `${i * 12}ms` }} />
      ))}
      <rect x={PL} width={PX - PL} y={y(d.va_high)} height={y(d.va_low) - y(d.va_high)} fill="none" stroke={p.accent} strokeOpacity={0.35} strokeDasharray="2 6" />
      {days.map((dd) => (
        <g key={dd.day}><line x1={x(dd.i)} x2={x(dd.i)} y1={PT} y2={H - PB} stroke={p.grid} />
          <text x={x(dd.i) + 4} y={H - 10} fill={p.tick} style={{ font: "500 9px 'JetBrains Mono'" }}>{new Date(dd.day).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</text></g>
      ))}
      {ticks.map((t) => <text key={t} x={PL - 8} y={y(t) + 3} textAnchor="end" fill={p.tick} style={{ font: "500 10px 'JetBrains Mono'" }}>{fmt(t, 0)}</text>)}
      {withSlots([
        ...d.oi_walls.map((w) => ({ ...w, kind: w.side })),
        ...d.buy_stops.map((s) => ({ ...s, kind: "buy" })),
        ...d.sell_stops.map((s) => ({ ...s, kind: "sell" })),
      ], y).map((L) => {
        if (L.kind === "call" || L.kind === "put")
          return <Level key={`${L.kind}${L.price}`} y={y(L.price)} slot={L.slot} color={L.kind === "call" ? p.bear : p.bull} w={3} dash="0" label={`${L.kind.toUpperCase()} WALL ${fmt(L.price, 0)}`} testid={`lq-wall-${L.kind}-${L.price}`} />;
        const buy = L.kind === "buy";
        return <Level key={`${L.kind}${L.price}`} y={y(L.price)} slot={L.slot} color={buy ? p.warn : p.sky} w={1 + (2 * L.strength) / maxStop} dash="6 5"
          label={`${buy ? "BUY" : "SELL"} STOPS ~${fmt(L.price, 0)} ×${L.touches}`} testid={`lq-${L.kind}stop-${Math.round(L.price)}`} />;
      })}
      <path d={path} fill="none" stroke={p.fg} strokeWidth={1.6} pathLength={1} className="draw" strokeLinejoin="round" />
      <line x1={PL} x2={W - 10} y1={y(d.spot)} y2={y(d.spot)} stroke={p.accent} strokeWidth={1} strokeDasharray="2 3" />
      <g filter="url(#lqGlow)">
        <circle cx={x(n - 1)} cy={y(d.spot)} r={9} fill={p.accent} className="ping-ring" />
        <circle cx={x(n - 1)} cy={y(d.spot)} r={5} fill={p.accent} />
      </g>
      {d.bins.map((b, i) => {
        const bw = b.v * (W - PX - 30);
        const poc = d.poc >= b.lo && d.poc <= b.hi;
        return <rect key={`p${i}`} x={PX + 14} y={y(b.hi) + 0.5} height={Math.max(1, y(b.lo) - y(b.hi) - 1)} width={bw} rx={1.5}
          fill={poc ? p.warn : "url(#lqProf)"} opacity={b.va ? 0.95 : 0.4} className="grow-x" style={{ transformOrigin: `${PX + 14}px 0`, animationDelay: `${300 + i * 10}ms` }} />;
      })}
      <text x={PX + 14} y={PT - 6} fill={p.tick} style={{ font: "500 9px 'JetBrains Mono'", letterSpacing: ".14em" }}>{d.profile_kind.toUpperCase()} PROFILE</text>
      <rect x={W - 96} y={y(d.spot) - 10} width={86} height={20} rx={10} fill={p.accent} />
      <text x={W - 53} y={y(d.spot) + 4} textAnchor="middle" fill="#fff" style={{ font: "700 11px 'JetBrains Mono'" }}>{fmt(d.spot, 0)}</text>
    </svg>
  );
};

const LevelList = ({ title, items, color, fmtItem, testid }) => (
  <div className="panel p-4" data-testid={testid}>
    <div className="eyebrow mb-2" style={{ color }}>{title}</div>
    {items.length ? items.map((s, i) => (
      <div key={i} className="flex justify-between py-1.5 border-b border-mp-border/60 last:border-0 text-sm"><span className="num font-semibold">{fmt(s.price, 0)}</span><span className="text-xs text-mp-muted">{fmtItem(s)}</span></div>
    )) : <div className="text-xs text-mp-faint">None in range</div>}
  </div>
);

export default function Liquidity() {
  const [sym, setSym] = useState("NIFTY");
  const { data: d, error } = useFetch(`/liquidity/${encodeURIComponent(sym)}`, [sym]);
  const p = usePalette();
  return (
    <div className="space-y-5" data-testid="liquidity-page">
      <PageHead eyebrow="Where resting liquidity and stops cluster around price · last 10 sessions · 15m" title="Liquidity Map" />
      <SymbolBar value={sym} onChange={setSym} indices={["NIFTY", "BANKNIFTY", "FINNIFTY"]} prefix="liq-symbol" />
      {error && <ErrorBox msg={error} />}
      {!d && !error && <Loading h={560} />}
      {d && (
        <>
          <Card eyebrow={`${d.symbol} · bright bands = price spent the most ${d.profile_kind === "Volume" ? "volume" : "time"} here`} title="Liquidity heat" testid="liquidity-card"
            right={<div className="flex flex-wrap gap-3 font-mono text-[10px] text-mp-muted">
              <span className="flex items-center gap-1"><i className="w-3 h-0.5" style={{ background: p.warn }} />Buy stops</span>
              <span className="flex items-center gap-1"><i className="w-3 h-0.5" style={{ background: p.sky }} />Sell stops</span>
              <span className="flex items-center gap-1"><i className="w-3 h-1" style={{ background: p.bear }} />Call wall</span>
              <span className="flex items-center gap-1"><i className="w-3 h-1" style={{ background: p.bull }} />Put wall</span>
            </div>}>
            <LiquidityMap d={d} />
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LevelList title="Buy-stop clusters (above)" items={d.buy_stops} color={p.warn} fmtItem={(s) => `${s.touches} swing high${s.touches > 1 ? "s" : ""} untouched`} testid="lq-list-buy" />
            <LevelList title="Sell-stop clusters (below)" items={d.sell_stops} color={p.sky} fmtItem={(s) => `${s.touches} swing low${s.touches > 1 ? "s" : ""} untouched`} testid="lq-list-sell" />
            <LevelList title="Option OI walls" items={d.oi_walls} color={p.accent} fmtItem={(w) => `${w.side} OI ${(w.oi / 1e5).toFixed(2)}L`} testid="lq-list-walls" />
            <div className="panel p-4" data-testid="lq-profile-stats">
              <div className="eyebrow mb-2">{d.profile_kind} profile</div>
              <div className="flex justify-between py-1.5 text-sm"><span>Point of control</span><b className="num text-amber-600">{fmt(d.poc, 0)}</b></div>
              <div className="flex justify-between py-1.5 text-sm"><span>Value area (70%)</span><b className="num">{fmt(d.va_low, 0)}–{fmt(d.va_high, 0)}</b></div>
              <div className="flex justify-between py-1.5 text-sm"><span>Spot</span><b className="num text-mp-accent">{fmt(d.spot)}</b></div>
            </div>
          </div>
          <p className="text-xs text-mp-faint">Stops are estimated from swing highs and lows that price hasn't revisited. Buy stops sit above old highs and sell stops below old lows. Index profiles use time-at-price because Yahoo has no index volume.</p>
        </>
      )}
    </div>
  );
}
