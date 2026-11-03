import { fmt } from "../lib/api";
import { useApp } from "../lib/store";
import { Pct, Spark, WatchBtn, Empty } from "./bits";

export const StockList = ({ rows, testid, showSpark = true }) => {
  const { setOpenSymbol } = useApp();
  if (!rows?.length) return <Empty text="No data yet" testid={`${testid}-empty`} />;
  return (
    <div data-testid={testid} className="divide-y divide-mp-elev">
      {rows.map((r, i) => (
        <div key={r.symbol} data-testid={`${testid}-row-${r.symbol}`} onClick={() => setOpenSymbol(r.symbol)}
          className="rise grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 cursor-pointer hover:bg-mp-accent/[0.05] transition-colors"
          style={{ animationDelay: `${i * 25}ms` }}>
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold truncate">{r.symbol}</div>
            <div className="text-[11px] text-mp-faint truncate">{r.sector}</div>
          </div>
          {showSpark ? <Spark data={r.spark} w={64} h={20} /> : <span />}
          <div className="text-right">
            <div className="num text-sm">{fmt(r.ltp)}</div>
            <div className="text-xs"><Pct v={r.change_pct} /></div>
          </div>
          <WatchBtn symbol={r.symbol} />
        </div>
      ))}
    </div>
  );
};
