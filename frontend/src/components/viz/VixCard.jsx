import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, YAxis } from "recharts";
import { fmt } from "../../lib/api";
import { usePalette } from "../../lib/store";
import { Gauge } from "./Gauge";

const tagColor = (t, p) => (t === "Low" || t === "Normal" ? p.bull : t === "Elevated" ? p.warn : p.bear);

export const VixCard = ({ v }) => {
  const p = usePalette();
  const uid = useId().replace(/:/g, "");
  if (!v) return null;
  const pos = ((v.ltp - v.low_1y) / (v.high_1y - v.low_1y || 1)) * 100;
  return (
    <div className="panel p-5 rise" data-testid="vix-card">
      <div className="flex items-start justify-between">
        <div><div className="eyebrow">India VIX</div><h3 className="font-display text-2xl font-bold uppercase tracking-wide">Fear gauge</h3></div>
        <span data-testid="vix-tag" className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: tagColor(v.tag, p), background: `${tagColor(v.tag, p)}1A` }}>{v.tag}</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-3 items-center mt-1">
        <Gauge value={((v.ltp - 10) / 20) * 100} left="CALM" right="FEAR" invert testid="vix-gauge">
          <div data-testid="vix-value" className="num text-2xl font-semibold leading-none">{fmt(v.ltp)}</div>
          <div className={`num text-[10px] ${v.change >= 0 ? "text-mp-bear" : "text-mp-bull"}`}>{v.change >= 0 ? "+" : ""}{fmt(v.change_pct)}%</div>
        </Gauge>
        <div>
          <div className="eyebrow mb-1">30 sessions</div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={v.spark.map((c, i) => ({ i, c }))}>
                <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.accent} stopOpacity={0.35} /><stop offset="1" stopColor={p.accent} stopOpacity={0} /></linearGradient></defs>
                <YAxis domain={["auto", "auto"]} hide />
                <Area dataKey="c" stroke={p.accent} strokeWidth={1.8} fill={`url(#${uid})`} animationDuration={1500} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between"><span className="eyebrow">1-year range</span><span data-testid="vix-percentile" className="font-mono text-[10px] text-mp-accent">{v.percentile}{["th", "st", "nd", "rd"][(v.percentile % 100 > 10 && v.percentile % 100 < 14) || v.percentile % 10 > 3 ? 0 : v.percentile % 10]} percentile</span></div>
        <div className="relative h-6 mt-1">
          <div className="absolute top-2 inset-x-0 h-2 rounded-full grow-x origin-left" style={{ background: `linear-gradient(90deg, ${p.bull}, ${p.warn}, ${p.bear})`, opacity: 0.75 }} />
          <div className="absolute top-0 w-3.5 h-6 -ml-[7px] rounded-full bg-mp-surface border-2 border-mp-fg shadow transition-[left] duration-1000" style={{ left: `${pos}%` }} />
        </div>
        <div className="flex justify-between num text-xs text-mp-muted"><span>{fmt(v.low_1y)}</span><span>{fmt(v.high_1y)}</span></div>
      </div>
      <div className="mt-4 rounded-lg bg-mp-elev px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-mp-muted">Expected NIFTY daily move</span>
        <span data-testid="vix-nifty-move" className="num text-sm font-semibold">±{fmt(v.nifty_move_pts, 0)} pts <span className="text-mp-faint font-normal">(±{v.nifty_move_pct}%)</span></span>
      </div>
    </div>
  );
};
