import { Star } from "lucide-react";
import { fmt, pctClass, SIGNAL_META } from "../lib/api";
import { useApp } from "../lib/store";

export const Pct = ({ v, testid }) => (
  <span data-testid={testid} className={`num ${pctClass(v)}`}>
    {v > 0 ? "+" : ""}{fmt(v)}%
  </span>
);

export const Spark = ({ data = [], w = 80, h = 24 }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * h}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "#10B981" : "#EF4444"} strokeWidth="1.4" />
    </svg>
  );
};

export const SignalBadge = ({ s, testid }) => {
  const m = SIGNAL_META[s.type] || { label: s.type, bull: true };
  return (
    <span
      data-testid={testid}
      title={s.detail}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider border ${
        m.bull ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30" : "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30"
      }`}
    >
      {m.label}<span className="opacity-80">·{s.bars_ago}b</span>
    </span>
  );
};

export const WatchBtn = ({ symbol }) => {
  const { watchlist, toggleWatch } = useApp();
  const on = watchlist.includes(symbol);
  return (
    <button
      data-testid={`watchlist-toggle-${symbol}`}
      onClick={(e) => { e.stopPropagation(); toggleWatch(symbol); }}
      className="p-1 rounded hover:bg-white/5 transition-colors"
      aria-label="toggle watchlist"
    >
      <Star size={14} className={on ? "fill-[#F59E0B] text-[#F59E0B]" : "text-slate-500"} />
    </button>
  );
};

export const PanelHead = ({ title, eyebrow, right }) => (
  <div className="flex items-end justify-between px-4 pt-4 pb-3 border-b border-[#232736]">
    <div>
      {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
      <h3 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h3>
    </div>
    {right}
  </div>
);

export const Empty = ({ text, testid }) => (
  <div data-testid={testid} className="p-8 text-center font-mono text-xs text-slate-500">{text}</div>
);
