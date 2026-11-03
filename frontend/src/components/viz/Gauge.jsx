import { useEffect, useId, useState } from "react";
import { usePalette } from "../../lib/store";

const R = 92, CX = 120, CY = 116, L = Math.PI * R;

export const Gauge = ({ value, left, right, invert = false, children, testid }) => {
  const p = usePalette();
  const uid = useId().replace(/:/g, "");
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(Math.max(0, Math.min(100, value))), 80); return () => clearTimeout(t); }, [value]);
  const stops = invert ? [p.bull, p.warn, p.bear] : [p.bear, p.warn, p.bull];
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
  return (
    <div className="relative" data-testid={testid}>
      <svg viewBox="0 0 240 140" className="w-full h-auto">
        <defs>
          <linearGradient id={uid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={stops[0]} /><stop offset="0.5" stopColor={stops[1]} /><stop offset="1" stopColor={stops[2]} />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke={p.track} strokeWidth={16} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={`url(#${uid})`} strokeWidth={16} strokeLinecap="round" opacity={0.22} />
        <path d={arc} fill="none" stroke={`url(#${uid})`} strokeWidth={16} strokeLinecap="round"
          strokeDasharray={L} strokeDashoffset={L * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)" }} />
        {[0, 25, 50, 75, 100].map((t) => {
          const a = Math.PI * (1 - t / 100);
          return <line key={t} x1={CX + (R - 14) * Math.cos(a)} y1={CY - (R - 14) * Math.sin(a)} x2={CX + (R - 20) * Math.cos(a)} y2={CY - (R - 20) * Math.sin(a)} stroke={p.tick} strokeWidth={1.4} />;
        })}
        <g style={{ transform: `rotate(${-90 + 1.8 * v}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 1.4s cubic-bezier(.34,1.56,.64,1)" }}>
          <path d={`M ${CX - 4} ${CY} L ${CX} ${CY - R + 26} L ${CX + 4} ${CY} Z`} fill={p.fg} />
        </g>
        <circle cx={CX} cy={CY} r={8} fill={p.fg} /><circle cx={CX} cy={CY} r={3} fill={p.accent} />
        <text x={CX - R} y={CY + 22} textAnchor="middle" fill={p.tick} style={{ font: "500 9px 'JetBrains Mono'", letterSpacing: ".12em" }}>{left}</text>
        <text x={CX + R} y={CY + 22} textAnchor="middle" fill={p.tick} style={{ font: "500 9px 'JetBrains Mono'", letterSpacing: ".12em" }}>{right}</text>
      </svg>
      {children && <div className="-mt-1 flex flex-col items-center">{children}</div>}
    </div>
  );
};
