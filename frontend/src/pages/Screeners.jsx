import { useState } from "react";
import { fmt } from "../lib/api";
import { useApp } from "../lib/store";
import { Seg, PageHead, Card, useFetch, Loading, ErrorBox } from "../components/fno";
import { Pct, WatchBtn, Empty } from "../components/bits";

const Results = ({ s }) => {
  const { setOpenSymbol } = useApp();
  if (!s.rows.length) return <Empty testid="screener-empty" text="No stocks match this screen right now." />;
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm" data-testid="screener-table">
        <thead><tr className="eyebrow text-left border-b border-mp-border"><th className="py-2">Symbol</th><th className="text-right">LTP ₹</th><th className="text-right">1D</th><th className="text-right">RSI</th><th className="text-right">Vol ×</th><th className="text-right">Gap</th><th className="text-right">CMF</th><th className="text-right">RS</th><th /></tr></thead>
        <tbody>
          {s.rows.map((r, i) => (
            <tr key={r.symbol} onClick={() => setOpenSymbol(r.symbol)} data-testid={`screener-row-${r.symbol}`}
              className="border-b border-mp-border/60 hover:bg-mp-accent/[0.05] cursor-pointer transition-colors rise" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
              <td className="py-2"><div className="font-mono font-semibold">{r.symbol}</div><div className="text-[11px] text-mp-faint">{r.sector}</div></td>
              <td className="num text-right">{fmt(r.ltp)}</td>
              <td className="text-right"><Pct v={r.change_pct} /></td>
              <td className={`num text-right ${r.rsi_d > 70 ? "text-mp-bear" : r.rsi_d < 30 ? "text-mp-bull" : ""}`}>{r.rsi_d}</td>
              <td className="num text-right">{r.vol_ratio ?? "—"}</td>
              <td className={`num text-right ${r.gap_pct >= 0 ? "text-mp-bull" : "text-mp-bear"}`}>{fmt(r.gap_pct)}%</td>
              <td className={`num text-right ${r.cmf >= 0 ? "text-mp-bull" : "text-mp-bear"}`}>{r.cmf}</td>
              <td className="num text-right">{fmt(r.rs_score)}</td>
              <td className="pl-2"><WatchBtn symbol={r.symbol} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function Screeners() {
  const [uni, setUni] = useState("nifty200");
  const [key, setKey] = useState("breakout_52w");
  const { data, error } = useFetch(`/screeners?universe=${uni}`, [uni]);
  const sel = data?.screeners.find((s) => s.key === key);
  const max = Math.max(1, ...(data?.screeners || []).map((s) => s.count));
  return (
    <div className="space-y-5" data-testid="screeners-page">
      <PageHead eyebrow="Daily scans on end-of-day Yahoo data" title="Screeners">
        <Seg prefix="screener-universe" items={[["nifty50", "Nifty 50"], ["nifty200", "Nifty 200"]]} value={uni} onChange={setUni} />
      </PageHead>
      {error && <ErrorBox msg={error} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2 content-start" data-testid="screener-list">
            {data.screeners.map((s, i) => (
              <button key={s.key} onClick={() => setKey(s.key)} data-testid={`screener-${s.key}`}
                className={`panel text-left px-4 py-3 rise transition-[border-color,transform] hover:-translate-y-0.5 ${key === s.key ? "!border-mp-accent ring-2 ring-mp-accent/20" : ""}`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-semibold">{s.name}</span><span className="num text-lg font-semibold text-mp-accent">{s.count}</span></div>
                <div className="mt-1.5 h-1 rounded-full bg-mp-elev overflow-hidden"><div className="h-full bg-mp-accent rounded-full grow-x origin-left" style={{ width: `${(s.count / max) * 100}%` }} /></div>
              </button>
            ))}
          </div>
          {sel && <Card eyebrow={sel.desc} title={`${sel.name} · ${sel.count}`} testid="screener-results"><Results s={sel} /></Card>}
        </div>
      )}
    </div>
  );
}
