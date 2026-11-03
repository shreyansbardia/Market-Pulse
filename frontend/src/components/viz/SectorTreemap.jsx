import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { fmt } from "../../lib/api";
import { useApp, usePalette, tipStyle } from "../../lib/store";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
export const heatColor = (chg, p) => {
  const t = Math.max(-1, Math.min(1, chg / 4));
  return mix(p.neutral, t >= 0 ? p.bull : p.bear, Math.pow(Math.abs(t), 0.65));
};

const Cell = (props) => {
  const { x, y, width: w, height: h, depth, name, change_pct: c, p, onPick, index, sector } = props;
  if (depth === 1) {
    return <rect x={x} y={y} width={w} height={h} fill="none" stroke={p.tipBg} strokeWidth={4} />;
  }
  if (depth !== 2) return <g />;
  const strong = Math.abs(c) > 1.6;
  const txt = strong ? "#fff" : p.fg;
  return (
    <g className="tm-cell cursor-pointer" onClick={() => onPick(name)} data-testid={`treemap-cell-${name}`}>
      <rect x={x} y={y} width={w} height={h} fill={heatColor(c, p)} stroke={p.tipBg} strokeWidth={1.5} rx={3} />
      {index === 0 && w > 60 && h > 40 && (
        <text x={x + 6} y={y + 13} fill={txt} opacity={0.8} style={{ font: "700 11px 'Barlow Condensed'", letterSpacing: ".1em" }}>{sector?.toUpperCase()}</text>
      )}
      {w > 46 && h > 30 && (
        <>
          <text x={x + w / 2} y={y + h / 2 + (h > 44 ? -2 : 4)} textAnchor="middle" fill={txt} style={{ font: `600 ${w > 90 && h > 60 ? 13 : 10}px 'JetBrains Mono'` }}>{name}</text>
          {h > 44 && <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fill={txt} opacity={0.85} style={{ font: "500 10px 'JetBrains Mono'" }}>{c > 0 ? "+" : ""}{fmt(c)}%</text>}
        </>
      )}
    </g>
  );
};

const Tip = ({ active, payload, p }) => {
  const d = payload?.[0]?.payload;
  if (!active || !d || !d.sector) return null;
  return (
    <div style={tipStyle(p).contentStyle} className="px-3 py-2">
      <div className="font-semibold">{d.name} <span style={{ color: p.tick }}>· {d.sector}</span></div>
      <div>{d.change_pct > 0 ? "+" : ""}{fmt(d.change_pct)}% · ₹{fmt(d.size, 0)} cr turnover</div>
    </div>
  );
};

export const SectorTreemap = ({ data, leaders, laggards }) => {
  const p = usePalette();
  const { setOpenSymbol } = useApp();
  return (
    <div data-testid="sector-treemap">
      <div className="h-[440px] rounded-lg overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap data={data} dataKey="size" aspectRatio={16 / 9} animationDuration={900}
            content={<Cell p={p} onPick={setOpenSymbol} />}>
            <Tooltip content={<Tip p={p} />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-mono text-[10px] text-mp-faint">
          <span>−4%</span>
          <div className="w-40 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${p.bear}, ${p.neutral}, ${p.bull})` }} />
          <span>+4%</span><span className="ml-2">box size = turnover</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs" data-testid="leaders-laggards">
          <span><span className="text-mp-faint mr-1">Leaders</span>{leaders.map((s) => <button key={s} onClick={() => setOpenSymbol(s)} className="font-mono font-semibold text-mp-bull mr-2 hover:underline" data-testid={`leader-${s}`}>{s}</button>)}</span>
          <span><span className="text-mp-faint mr-1">Laggards</span>{laggards.map((s) => <button key={s} onClick={() => setOpenSymbol(s)} className="font-mono font-semibold text-mp-bear mr-2 hover:underline" data-testid={`laggard-${s}`}>{s}</button>)}</span>
        </div>
      </div>
    </div>
  );
};
