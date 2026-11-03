import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, ReferenceLine } from "recharts";
import { fmt } from "../../lib/api";
import { usePalette, tipStyle } from "../../lib/store";
import { Pct } from "../bits";

const tagColor = (t, p) => (t === "Bullish" ? p.bull : t === "Bearish" ? p.bear : p.warn);
const hm = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

const LastDot = ({ cx, cy, index, len, color }) =>
  index === len - 1 ? (
    <g><circle cx={cx} cy={cy} r={4} fill={color} className="ping-ring" /><circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} /></g>
  ) : <g />;

export const RangeBar = ({ lo, hi, low, high, ltp, testid }) => {
  const p = usePalette();
  const a = Math.min(lo, low ?? lo), b = Math.max(hi, high ?? hi);
  const pad = (b - a) * 0.08, A = a - pad, B = b + pad;
  const x = (v) => `${((v - A) / (B - A)) * 100}%`;
  return (
    <div data-testid={testid} className="relative h-8">
      <div className="absolute top-3 inset-x-0 h-2 rounded-full bg-mp-elev" />
      <div className="absolute top-3 h-2 rounded-full grow-x origin-left" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})`, background: `linear-gradient(90deg, ${p.bear}55, ${p.accent}88, ${p.bull}55)` }} />
      {low != null && <div className="absolute top-[18px] h-[3px] bg-mp-fg/40 rounded" style={{ left: x(low), width: `calc(${x(high)} - ${x(low)})` }} title="Today's range" />}
      <div className="absolute top-1.5 w-1 h-5 -ml-0.5 rounded-full bg-mp-fg shadow transition-[left] duration-700" style={{ left: x(ltp) }} />
    </div>
  );
};

export const IndexCard = ({ d, testid }) => {
  const p = usePalette();
  const uid = useId().replace(/:/g, "");
  if (!d) return null;
  const up = d.change >= 0, color = up ? p.bull : p.bear;
  const data = d.intraday;
  return (
    <div className="panel p-5 rise" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="eyebrow">{d.name}</div>
          <div className="num text-3xl font-semibold mt-1" data-testid={`${testid}-ltp`}>{fmt(d.ltp)}</div>
          <div className="text-sm num"><Pct v={d.change_pct} /> <span className="text-mp-faint">({up ? "+" : ""}{fmt(d.change)})</span></div>
        </div>
        <span data-testid={`${testid}-tag`} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: tagColor(d.tag, p), background: `${tagColor(d.tag, p)}1A` }}>{d.tag}</span>
      </div>
      <div className="h-[120px] -mx-2 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 10 }}>
            <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.3} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="t" hide /><YAxis domain={["auto", "auto"]} hide />
            <Tooltip {...tipStyle(p)} labelFormatter={hm} formatter={(v) => [fmt(v), "Price"]} />
            <ReferenceLine y={d.prev_close} stroke={p.tick} strokeDasharray="3 4" />
            <Area dataKey="c" stroke={color} strokeWidth={2} fill={`url(#${uid})`} animationDuration={1400}
              dot={(pr) => <LastDot key={pr.index} {...pr} len={data.length} color={color} />} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <div className="flex justify-between items-baseline">
          <span className="eyebrow">Expected range · by {d.expected.by}</span>
          <span className="font-mono text-[10px] text-mp-faint">±{d.expected.sigma_pct}%</span>
        </div>
        <RangeBar lo={d.expected.low} hi={d.expected.high} low={d.low} high={d.high} ltp={d.ltp} testid={`${testid}-range`} />
        <div className="flex justify-between num text-xs text-mp-muted -mt-1">
          <span>{fmt(d.expected.low, 0)}</span><span>{fmt(d.expected.high, 0)}</span>
        </div>
      </div>
    </div>
  );
};
