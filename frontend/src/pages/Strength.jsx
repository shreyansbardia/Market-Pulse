import { useState } from "react";
import { fmt } from "../lib/api";
import { useApp, usePalette } from "../lib/store";
import { Seg, PageHead, Card, useFetch, Loading, ErrorBox } from "../components/fno";
import { heatColor } from "../components/viz/SectorTreemap";

const PERIODS = ["1D", "1W", "1M", "3M", "6M"];

const SectorGrid = ({ rows }) => {
  const p = usePalette();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.score)));
  return (
    <div className="overflow-x-auto scroll-thin" data-testid="strength-grid">
      <table className="w-full text-sm border-separate border-spacing-1">
        <thead><tr className="eyebrow"><th className="text-left">Sector</th>{PERIODS.map((k) => <th key={k}>{k}</th>)}<th className="text-left pl-3">Strength score</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.sector} data-testid={`strength-row-${r.sector}`} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
              <td className="font-medium pr-3 whitespace-nowrap"><span className="num text-[10px] text-mp-faint mr-2">{i + 1}</span>{r.sector}</td>
              {PERIODS.map((k) => {
                const v = r.rel[k];
                return <td key={k} className="text-center rounded-md num text-xs py-2 min-w-[64px] transition-transform hover:scale-105"
                  style={{ background: heatColor(v * 0.6, p), color: Math.abs(v) > 4 ? "#fff" : p.fg }}>{v > 0 ? "+" : ""}{fmt(v, 1)}</td>;
              })}
              <td className="pl-3 min-w-[160px]">
                <div className="relative h-2 rounded-full bg-mp-elev">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-mp-border" />
                  <div className={`absolute inset-y-0 rounded-full grow-x ${r.score >= 0 ? "left-1/2 origin-left bg-mp-bull" : "right-1/2 origin-right bg-mp-bear"}`} style={{ width: `${(Math.abs(r.score) / max) * 50}%`, animationDelay: `${200 + i * 45}ms` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StockRank = ({ rows, testid, bull }) => {
  const { setOpenSymbol } = useApp();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.rs_score)));
  return (
    <div className="divide-y divide-mp-border/60" data-testid={testid}>
      {rows.map((r, i) => (
        <button key={r.symbol} onClick={() => setOpenSymbol(r.symbol)} data-testid={`${testid}-row-${r.symbol}`}
          className="w-full text-left py-2.5 hover:bg-mp-accent/[0.05] transition-colors rise" style={{ animationDelay: `${i * 35}ms` }}>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-semibold"><span className="text-mp-faint text-[10px] mr-2">{i + 1}</span>{r.symbol} <span className="font-sans font-normal text-[11px] text-mp-faint">{r.sector}</span></span>
            <span className={`num text-xs ${bull ? "text-mp-bull" : "text-mp-bear"}`}>{r.rs_score > 0 ? "+" : ""}{fmt(r.rs_score)} RS</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-mp-elev overflow-hidden">
              <div className={`h-full rounded-full grow-x origin-left ${bull ? "bg-mp-bull" : "bg-mp-bear"}`} style={{ width: `${(Math.abs(r.rs_score) / max) * 100}%`, animationDelay: `${150 + i * 40}ms` }} />
            </div>
            {["1M", "3M", "6M"].map((k) => <span key={k} className={`num text-[10px] w-14 text-right ${r.rel[k] >= 0 ? "text-mp-bull" : "text-mp-bear"}`}>{k} {r.rel[k] > 0 ? "+" : ""}{fmt(r.rel[k], 1)}</span>)}
          </div>
        </button>
      ))}
    </div>
  );
};

export default function Strength() {
  const [uni, setUni] = useState("nifty200");
  const { data, error } = useFetch(`/strength?universe=${uni}`, [uni]);
  return (
    <div className="space-y-5" data-testid="strength-page">
      <PageHead eyebrow="Return relative to NIFTY 50, in % points" title="Strength">
        <Seg prefix="strength-universe" items={[["nifty50", "Nifty 50"], ["nifty200", "Nifty 200"]]} value={uni} onChange={setUni} />
      </PageHead>
      {error && <ErrorBox msg={error} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <Card eyebrow="Equal-weight sector average vs NIFTY · score = mean of 1M/3M/6M" title="Sector strength matrix" testid="sector-strength-card"><SectorGrid rows={data.sectors} /></Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card eyebrow="Highest relative strength" title="Strongest stocks" testid="strongest-card"><StockRank rows={data.strongest} testid="strongest" bull /></Card>
            <Card eyebrow="Lowest relative strength" title="Weakest stocks" testid="weakest-card"><StockRank rows={data.weakest} testid="weakest" /></Card>
          </div>
        </>
      )}
    </div>
  );
}
