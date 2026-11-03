import { useState } from "react";
import { fmt, fmtL } from "../../lib/api";

export const OIButterfly = ({ d }) => {
  const [hover, setHover] = useState(null);
  const rows = [...d.strikes].reverse();
  const max = Math.max(1, ...rows.flatMap((r) => [r.ce.oi, r.pe.oi]));
  const spotIdx = rows.findIndex((r) => r.strike <= d.spot);
  return (
    <div data-testid="oi-butterfly">
      <div className="grid grid-cols-[1fr_72px_1fr] text-[10px] font-mono tracking-widest text-mp-faint mb-2">
        <span className="text-right pr-2">CALL OI · writers' ceiling</span><span className="text-center">STRIKE</span><span className="pl-2">PUT OI · writers' floor</span>
      </div>
      <div className="relative space-y-[3px]">
        {rows.map((r, i) => {
          const ce = (r.ce.oi / max) * 100, pe = (r.pe.oi / max) * 100;
          const cec = (Math.max(0, r.ce.chg_oi) / max) * 100, pec = (Math.max(0, r.pe.chg_oi) / max) * 100;
          const atm = r.strike === d.atm;
          const key = { [d.writers.resistance]: "R", [d.writers.support]: "S", [d.max_pain]: "MP" }[r.strike];
          return (
            <div key={r.strike} data-testid={`oi-row-${r.strike}`} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}
              className={`relative grid grid-cols-[1fr_72px_1fr] items-center h-[16px] rounded transition-colors ${atm ? "bg-mp-accent/10" : "hover:bg-mp-elev"}`}>
              {i === spotIdx && (
                <div className="absolute -top-[2px] inset-x-0 h-0 border-t-2 border-dashed border-mp-accent z-10" data-testid="oi-spot-line">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-mp-accent text-white font-mono text-[9px] leading-4">SPOT {fmt(d.spot, 0)}</span>
                </div>
              )}
              <div className="flex justify-end h-full items-center">
                <div className="relative h-[12px] rounded-l grow-x origin-right" style={{ width: `${ce}%`, background: "rgb(var(--c-bear) / .28)", animationDelay: `${i * 18}ms` }}>
                  <div className="absolute right-0 inset-y-0 rounded-l bg-mp-bear" style={{ width: `${(cec / Math.max(ce, 0.01)) * 100}%` }} />
                </div>
              </div>
              <div className={`text-center font-mono text-[11px] ${atm ? "text-mp-accent font-bold" : "text-mp-muted"}`}>
                {fmt(r.strike, 0)}{key && <sup className="ml-0.5 text-[8px] text-mp-accent">{key}</sup>}
              </div>
              <div className="flex h-full items-center">
                <div className="relative h-[12px] rounded-r grow-x origin-left" style={{ width: `${pe}%`, background: "rgb(var(--c-bull) / .28)", animationDelay: `${i * 18}ms` }}>
                  <div className="absolute left-0 inset-y-0 rounded-r bg-mp-bull" style={{ width: `${(pec / Math.max(pe, 0.01)) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-10 flex items-center justify-between gap-3 text-[11px] font-mono text-mp-muted" data-testid="oi-hover-info">
        {hover ? (
          <>
            <span className="text-mp-bear">CE OI {fmtL(hover.ce.oi)} ({hover.ce.chg_oi >= 0 ? "+" : ""}{fmtL(hover.ce.chg_oi)}) · IV {hover.ce.iv || "—"} · ₹{fmt(hover.ce.ltp)}</span>
            <span className="text-mp-fg font-semibold">{fmt(hover.strike, 0)}</span>
            <span className="text-mp-bull">PE OI {fmtL(hover.pe.oi)} ({hover.pe.chg_oi >= 0 ? "+" : ""}{fmtL(hover.pe.chg_oi)}) · IV {hover.pe.iv || "—"} · ₹{fmt(hover.pe.ltp)}</span>
          </>
        ) : <span>Solid = OI added today · faded = total OI · R resistance · S support · MP max pain. Hover a strike for details.</span>}
      </div>
    </div>
  );
};

export const WritersRange = ({ d }) => {
  const w = d.writers;
  const pts = [w.support2, w.support, w.resistance, w.resistance2, d.spot, d.max_pain, d.expected.low, d.expected.high].filter(Boolean);
  const a = Math.min(...pts), b = Math.max(...pts), pad = (b - a) * 0.08;
  const A = a - pad, B = b + pad, x = (v) => `${((v - A) / (B - A)) * 100}%`;
  const Mark = ({ v, label, cls, top, testid }) => (
    <div data-testid={testid} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: x(v), top }}>
      <span className={`font-mono text-[10px] whitespace-nowrap ${cls}`}>{label}</span>
      <span className="font-mono text-[11px] font-semibold">{fmt(v, 0)}</span>
    </div>
  );
  return (
    <div className="relative h-32" data-testid="writers-range">
      <div className="absolute top-[56px] inset-x-0 h-3 rounded-full bg-mp-elev" />
      <div className="absolute top-[56px] h-3 rounded-l-full bg-mp-bull/30 grow-x origin-left" style={{ left: x(Math.min(w.support2 || w.support, w.support)), width: `calc(${x(w.support)} - ${x(Math.min(w.support2 || w.support, w.support))})` }} />
      <div className="absolute top-[56px] h-3 rounded-r-full bg-mp-bear/30 grow-x origin-right" style={{ left: x(w.resistance), width: `calc(${x(Math.max(w.resistance2 || w.resistance, w.resistance))} - ${x(w.resistance)})` }} />
      <div className="absolute top-[56px] h-3 grow-x" style={{ left: x(d.expected.low), width: `calc(${x(d.expected.high)} - ${x(d.expected.low)})`, background: "linear-gradient(90deg, rgb(var(--c-accent) / .15), rgb(var(--c-accent) / .45), rgb(var(--c-accent) / .15))" }} />
      <div className="absolute top-[50px] w-[3px] h-6 bg-mp-bull rounded" style={{ left: x(w.support) }} />
      <div className="absolute top-[50px] w-[3px] h-6 bg-mp-bear rounded" style={{ left: x(w.resistance) }} />
      <div className="absolute top-[46px] -translate-x-1/2 transition-[left] duration-1000" style={{ left: x(d.spot) }}>
        <span className="absolute inset-0 rounded-full bg-mp-accent ping-ring" />
        <span className="relative block w-8 h-8 rounded-full bg-mp-accent border-4 border-mp-surface shadow-lg" />
      </div>
      <Mark v={w.support} label="PUT WALL · SUPPORT" cls="text-mp-bull" top={0} testid="writers-support" />
      <Mark v={w.resistance} label="CALL WALL · RESISTANCE" cls="text-mp-bear" top={0} testid="writers-resistance" />
      <Mark v={d.spot} label="SPOT" cls="text-mp-accent" top={84} testid="writers-spot" />
      <Mark v={d.max_pain} label="MAX PAIN" cls="text-amber-600" top={84} testid="writers-maxpain" />
    </div>
  );
};
