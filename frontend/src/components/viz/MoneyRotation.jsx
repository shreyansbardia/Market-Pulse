import { useId } from "react";
import { fmt } from "../../lib/api";
import { usePalette, useApp } from "../../lib/store";

const W = 960, H = 360, LX = 210, RX = 750, CX = 480, CY = 180, CAP = 170;
const ys = (n) => (n === 1 ? [CY] : Array.from({ length: n }, (_, i) => 52 + i * ((H - 104) / (n - 1))));
const cr = (v) => `${v >= 0 ? "+" : "−"}₹${fmt(Math.abs(v), 0)}`;

const Stream = ({ d, color, sw, ratio, gid, idx }) => {
  const n = 2 + Math.round(4 * ratio);
  const dur = 3.4 - 1.5 * ratio;
  return (
    <g>
      <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={sw} strokeOpacity={0.22} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} strokeOpacity={0.55} strokeDasharray="3 13" className="dash-flow" />
      {Array.from({ length: n }).map((_, k) => (
        <circle key={k} r={2.2 + sw / 9} fill={color} filter="url(#mp-glow)">
          <animateMotion dur={`${dur}s`} begin={`${-((k * dur) / n + idx * 0.37)}s`} repeatCount="indefinite" path={d} />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${dur}s`} begin={`${-((k * dur) / n + idx * 0.37)}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
};

const Node = ({ x, y, s, color, side, onClick, testid }) => {
  const anchor = side === "left" ? "end" : "start";
  const tx = side === "left" ? x - 16 : x + 16;
  return (
    <g data-testid={testid} onClick={onClick} className="cursor-pointer" style={{ transition: "opacity .2s" }}>
      <circle cx={x} cy={y} r={6} fill={color} className="ping-ring" opacity={0.5} />
      <circle cx={x} cy={y} r={6} fill={color} />
      <circle cx={x} cy={y} r={2.5} fill="#fff" />
      <text x={tx} y={y - 3} textAnchor={anchor} className="fill-mp-fg" style={{ font: "600 15px 'DM Sans'" }}>{s.sector}</text>
      <text x={tx} y={y + 15} textAnchor={anchor} fill={color} style={{ font: "500 13px 'JetBrains Mono'" }}>{cr(s.flow_cr)} cr</text>
    </g>
  );
};

const MobileRow = ({ s, color, max, onClick, i }) => (
  <button onClick={onClick} data-testid={`m-rotation-${s.sector}`} className="w-full text-left rise" style={{ animationDelay: `${i * 60}ms` }}>
    <div className="flex justify-between text-sm"><span className="font-medium">{s.sector}</span><span className="num text-xs" style={{ color }}>{cr(s.flow_cr)} cr</span></div>
    <div className="relative mt-1 h-2 rounded-full bg-mp-elev overflow-hidden">
      <div className="absolute inset-y-0 left-0 rounded-full grow-x origin-left" style={{ width: `${Math.max(6, (Math.sqrt(Math.abs(s.flow_cr)) / max) * 100)}%`, background: color }}>
        <span className="slide-dot absolute top-0 h-2 w-2 rounded-full bg-white/80" />
      </div>
    </div>
  </button>
);

const MobileRotation = ({ r }) => {
  const p = usePalette();
  const { setOpenSymbol } = useApp();
  const max = Math.sqrt(Math.max(1, ...[...r.outflows, ...r.inflows].map((s) => Math.abs(s.flow_cr))));
  return (
    <div className="md:hidden space-y-4 py-4" data-testid="money-rotation-mobile">
      <div className="text-center">
        <div className="eyebrow">Net flow</div>
        <div className="num text-2xl font-semibold" style={{ color: r.net_cr >= 0 ? p.bull : p.bear }}>{cr(r.net_cr)} cr</div>
      </div>
      <div className="space-y-2.5"><div className="eyebrow">Losing money</div>
        {r.outflows.length ? r.outflows.map((s, i) => <MobileRow key={s.sector} s={s} i={i} color={p.bear} max={max} onClick={() => setOpenSymbol(s.top_out)} />) : <div className="text-xs text-mp-faint">No sector outflows</div>}
      </div>
      <div className="space-y-2.5"><div className="eyebrow">Receiving money</div>
        {r.inflows.map((s, i) => <MobileRow key={s.sector} s={s} i={i} color={p.bull} max={max} onClick={() => setOpenSymbol(s.top_in)} />)}
      </div>
    </div>
  );
};

export const MoneyRotation = ({ rotation: r }) => {
  const p = usePalette();
  const { setOpenSymbol } = useApp();
  const uid = useId().replace(/:/g, "");
  const all = [...r.outflows, ...r.inflows];
  const max = Math.max(1, ...all.map((s) => Math.abs(s.flow_cr)));
  const ly = ys(r.outflows.length), ry = ys(r.inflows.length);
  const tot = r.total_in + Math.abs(r.total_out) || 1;
  const inH = (CAP * r.total_in) / tot, outH = CAP - inH;
  const top = CY - CAP / 2;
  return (
    <div className="relative" data-testid="money-rotation">
      <MobileRotation r={r} />
      <svg viewBox={`0 0 ${W} ${H}`} className="hidden md:block w-full h-auto overflow-visible">
        <defs>
          <filter id="mp-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id={`${uid}l`} gradientUnits="userSpaceOnUse" x1={LX} x2={CX} y1="0" y2="0"><stop offset="0" stopColor={p.bear} /><stop offset="1" stopColor={p.accent} /></linearGradient>
          <linearGradient id={`${uid}r`} gradientUnits="userSpaceOnUse" x1={CX} x2={RX} y1="0" y2="0"><stop offset="0" stopColor={p.accent} /><stop offset="1" stopColor={p.bull} /></linearGradient>
          <clipPath id={`${uid}c`}><rect x={CX - 26} y={top} width={52} height={CAP} rx={26} /></clipPath>
          <radialGradient id={`${uid}h`}><stop offset="0" stopColor={p.accent} stopOpacity={0.22} /><stop offset="1" stopColor={p.accent} stopOpacity={0} /></radialGradient>
        </defs>
        <ellipse cx={CX} cy={CY} rx={150} ry={150} fill={`url(#${uid}h)`} className="breathe" />
        {r.outflows.map((s, i) => {
          const ratio = Math.abs(s.flow_cr) / max;
          const d = `M ${LX + 8} ${ly[i]} C ${CX - 140} ${ly[i]}, ${CX - 150} ${CY}, ${CX - 30} ${CY}`;
          return <Stream key={s.sector} d={d} color={p.bear} sw={2 + 16 * ratio} ratio={ratio} gid={`${uid}l`} idx={i} />;
        })}
        {r.inflows.map((s, i) => {
          const ratio = Math.abs(s.flow_cr) / max;
          const d = `M ${CX + 30} ${CY} C ${CX + 150} ${CY}, ${RX - 140} ${ry[i]}, ${RX - 8} ${ry[i]}`;
          return <Stream key={s.sector} d={d} color={p.bull} sw={2 + 16 * ratio} ratio={ratio} gid={`${uid}r`} idx={i + 3} />;
        })}
        <g data-testid="net-flow-bar">
          <rect x={CX - 26} y={top} width={52} height={CAP} rx={26} fill={p.track} />
          <g clipPath={`url(#${uid}c)`}>
            <rect x={CX - 26} y={top} width={52} height={inH} fill={p.bull} opacity={0.9}>
              <animate attributeName="height" from="0" to={inH} dur="1.1s" fill="freeze" calcMode="spline" keySplines=".2 .7 .2 1" />
            </rect>
            <rect x={CX - 26} y={top + inH} width={52} height={outH} fill={p.bear} opacity={0.9}>
              <animate attributeName="y" from={top + CAP} to={top + inH} dur="1.1s" fill="freeze" calcMode="spline" keySplines=".2 .7 .2 1" />
            </rect>
          </g>
          <text x={CX} y={top - 16} textAnchor="middle" className="fill-mp-faint" style={{ font: "500 10px 'JetBrains Mono'", letterSpacing: "0.18em" }}>NET FLOW</text>
          <text x={CX} y={top + CAP + 28} textAnchor="middle" fill={r.net_cr >= 0 ? p.bull : p.bear} style={{ font: "700 22px 'JetBrains Mono'" }} data-testid="net-flow-value">{cr(r.net_cr)} cr</text>
          <text x={CX + 36} y={top + 12} className="fill-mp-faint" style={{ font: "500 10px 'JetBrains Mono'" }}>IN ₹{fmt(r.total_in, 0)}</text>
          <text x={CX + 36} y={top + CAP - 4} className="fill-mp-faint" style={{ font: "500 10px 'JetBrains Mono'" }}>OUT ₹{fmt(Math.abs(r.total_out), 0)}</text>
        </g>
        {r.outflows.map((s, i) => <Node key={s.sector} x={LX} y={ly[i]} s={s} color={p.bear} side="left" testid={`rotation-out-${s.sector}`} onClick={() => setOpenSymbol(s.top_out)} />)}
        {r.inflows.map((s, i) => <Node key={s.sector} x={RX} y={ry[i]} s={s} color={p.bull} side="right" testid={`rotation-in-${s.sector}`} onClick={() => setOpenSymbol(s.top_in)} />)}
        {!r.outflows.length && <text x={LX} y={CY} textAnchor="end" className="fill-mp-faint" style={{ font: "500 12px 'JetBrains Mono'" }}>No sector outflows</text>}
        {!r.inflows.length && <text x={RX} y={CY} className="fill-mp-faint" style={{ font: "500 12px 'JetBrains Mono'" }}>No sector inflows</text>}
      </svg>
    </div>
  );
};
