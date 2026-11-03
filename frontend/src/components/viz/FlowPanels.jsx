import { fmt } from "../../lib/api";
import { useApp } from "../../lib/store";
import { Pct, PanelHead } from "../bits";

const cr = (v) => `${v >= 0 ? "+" : "−"}₹${fmt(Math.abs(v), 0)} cr`;

export const SectorFlowBars = ({ sectors }) => {
  const max = Math.sqrt(Math.max(1, ...sectors.map((s) => Math.abs(s.flow_cr))));
  return (
    <div className="panel self-start" data-testid="sector-flow-bars">
      <PanelHead eyebrow="Estimated ₹ flow · turnover × close location" title="Sector Money Flow" />
      <div className="p-5 space-y-2.5">
        {sectors.map((s, i) => {
          const w = (Math.sqrt(Math.abs(s.flow_cr)) / max) * 50, pos = s.flow_cr >= 0;
          return (
            <div key={s.sector} data-testid={`sector-flow-${s.sector}`} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 text-sm">
              <span className="font-medium truncate">{s.sector}</span>
              <div className="relative h-6 rounded bg-mp-elev/60">
                <div className="absolute inset-y-0 left-1/2 w-px bg-mp-border" />
                <div className={`absolute inset-y-1 rounded grow-x overflow-hidden ${pos ? "origin-left bg-mp-bull" : "origin-right bg-mp-bear"}`}
                  style={{ [pos ? "left" : "right"]: "50%", width: `${w}%`, animationDelay: `${i * 60}ms` }}>
                  <span className="shimmer absolute inset-0 block" />
                </div>
              </div>
              <span className={`num text-right text-xs ${pos ? "text-mp-bull" : "text-mp-bear"}`}>{cr(s.flow_cr)}</span>
            </div>
          );
        })}
        <p className="pt-3 text-[11px] text-mp-faint leading-relaxed" data-testid="flow-method-note">
          Estimated, not exchange order data: each stock's turnover weighted by where it closed in its day range (near high = inflow, near low = outflow). A stock can be up on the day yet show outflow if it closed near its low. Bar length uses a square-root scale.
        </p>
      </div>
    </div>
  );
};

export const FlowList = ({ title, eyebrow, rows, metric, testid, bull }) => {
  const { setOpenSymbol } = useApp();
  const val = (r) => (metric === "flow" ? Math.abs(r.flow_cr) : r.vol_ratio);
  const max = Math.max(1, ...rows.map(val));
  return (
    <div className="panel overflow-hidden" data-testid={testid}>
      <PanelHead eyebrow={eyebrow} title={title} />
      <div className="divide-y divide-mp-border/60">
        {rows.map((r, i) => (
          <button key={r.symbol} onClick={() => setOpenSymbol(r.symbol)} data-testid={`${testid}-row-${r.symbol}`}
            className="rise w-full text-left px-5 py-2.5 hover:bg-mp-accent/[0.05] transition-colors" style={{ animationDelay: `${i * 35}ms` }}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold">{r.symbol} <span className="font-sans font-normal text-[11px] text-mp-faint">{r.sector}</span></span>
              <span className="text-xs"><Pct v={r.change_pct} /></span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-mp-elev overflow-hidden">
                <div className="h-full rounded-full grow-x origin-left" style={{ width: `${(val(r) / max) * 100}%`, background: metric === "flow" ? (bull ? "rgb(var(--c-bull))" : "rgb(var(--c-bear))") : "rgb(var(--c-accent))", animationDelay: `${150 + i * 40}ms` }} />
              </div>
              <span className="num text-[11px] w-24 text-right text-mp-muted">{metric === "flow" ? cr(r.flow_cr) : `${r.vol_ratio}x vol`}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export const PressureList = ({ title, eyebrow, rows, testid }) => {
  const { setOpenSymbol } = useApp();
  return (
    <div className="panel overflow-hidden" data-testid={testid}>
      <PanelHead eyebrow={eyebrow} title={title} />
      <div className="px-5 pt-3 flex justify-between font-mono text-[9px] tracking-widest text-mp-faint"><span>DAY LOW</span><span>CLOSE POSITION</span><span>DAY HIGH</span></div>
      <div className="divide-y divide-mp-border/60">
        {rows.map((r, i) => {
          const pos = ((r.clv + 1) / 2) * 100;
          return (
            <button key={r.symbol} onClick={() => setOpenSymbol(r.symbol)} data-testid={`${testid}-row-${r.symbol}`}
              className="rise w-full text-left px-5 py-2.5 hover:bg-mp-accent/[0.05] transition-colors" style={{ animationDelay: `${i * 35}ms` }}>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-semibold">{r.symbol}</span>
                <span className="num text-[11px] text-mp-muted">₹{fmt(r.turnover_cr, 0)} cr · <Pct v={r.change_pct} /></span>
              </div>
              <div className="relative mt-2 h-2 rounded-full" style={{ background: "linear-gradient(90deg, rgb(var(--c-bear) / .35), rgb(var(--c-elev)), rgb(var(--c-bull) / .35))" }}>
                <div className="absolute -top-1 w-1.5 h-4 -ml-[3px] rounded-full bg-mp-fg transition-[left] duration-700" style={{ left: `${pos}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
