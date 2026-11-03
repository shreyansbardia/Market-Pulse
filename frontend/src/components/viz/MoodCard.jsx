import { Gauge } from "./Gauge";
import { usePalette } from "../../lib/store";

const scoreColor = (s, p) => (s >= 60 ? p.bull : s <= 40 ? p.bear : p.warn);

export const MoodCard = ({ mood }) => {
  const p = usePalette();
  return (
    <div className="panel p-5 h-full flex flex-col" data-testid="market-mood-card">
      <div className="flex items-center justify-between">
        <div><div className="eyebrow">Market mood</div><h3 className="font-display text-2xl font-bold uppercase tracking-wide">Risk meter</h3></div>
        <span data-testid="mood-label" className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ color: scoreColor(mood.score, p), background: `${scoreColor(mood.score, p)}1A` }}>{mood.label}</span>
      </div>
      <div className="max-w-[300px] w-full mx-auto mt-2">
        <Gauge value={mood.score} left="RISK-OFF" right="RISK-ON" testid="mood-gauge">
          <div data-testid="mood-score" className="num text-4xl font-semibold leading-none" style={{ color: scoreColor(mood.score, p) }}>{mood.score}</div>
          <div className="font-mono text-[10px] text-mp-faint">/ 100</div>
        </Gauge>
      </div>
      <div className="mt-4 space-y-3">
        {mood.parts.map((x, i) => (
          <div key={x.key} data-testid={`mood-part-${x.key}`}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{x.label} <span className="font-mono text-[10px] text-mp-faint">{x.weight}%</span></span>
              <span className="num text-mp-muted">{x.value}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-mp-elev overflow-hidden">
              <div className="h-full rounded-full grow-x origin-left" style={{ width: `${x.score}%`, background: scoreColor(x.score, p), animationDelay: `${300 + i * 120}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
