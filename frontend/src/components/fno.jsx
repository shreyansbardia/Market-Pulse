import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export const Seg = ({ items, value, onChange, prefix }) => (
  <div className="flex max-w-full overflow-x-auto scroll-thin rounded-full border border-mp-border p-1 bg-mp-elev">
    {items.map(([v, l]) => (
      <button key={v} data-testid={`${prefix}-${v}`} onClick={() => onChange(v)}
        className={`px-3.5 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-[background-color,color] duration-200 ${value === v ? "bg-mp-surface text-mp-accent shadow" : "text-mp-muted hover:text-mp-fg"}`}>{l}</button>
    ))}
  </div>
);

export const SymbolBar = ({ value, onChange, indices = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"], prefix = "symbol" }) => {
  const [stocks, setStocks] = useState([]);
  useEffect(() => { api.get("/universe").then((r) => setStocks(r.data.map((s) => s.symbol).sort())); }, []);
  const isStock = !indices.includes(value);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {indices.length > 0 && <Seg prefix={prefix} items={indices.map((s) => [s, s])} value={isStock ? "" : value} onChange={onChange} />}
      <Select value={isStock ? value : ""} onValueChange={onChange}>
        <SelectTrigger data-testid={`${prefix}-stock-select`} className="w-44 h-9 rounded-full bg-mp-surface font-mono text-xs">
          <SelectValue placeholder="Or pick a stock" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {stocks.map((s) => <SelectItem key={s} value={s} className="font-mono text-xs" data-testid={`${prefix}-opt-${s}`}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

export const PageHead = ({ eyebrow, title, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 rise">
    <div>
      <div className="eyebrow mb-1">{eyebrow}</div>
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight">{title}</h1>
    </div>
    {children}
  </div>
);

export const Card = ({ title, eyebrow, right, children, className = "", testid }) => (
  <div className={`panel p-5 ${className}`} data-testid={testid}>
    {(title || eyebrow) && (
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}{title && <h3 className="font-display text-2xl font-bold uppercase tracking-wide">{title}</h3>}</div>
        {right}
      </div>
    )}
    {children}
  </div>
);

export const Tag = ({ children, tone = "accent", testid }) => {
  const c = { bull: "text-mp-bull bg-mp-bull/10", bear: "text-mp-bear bg-mp-bear/10", accent: "text-mp-accent bg-mp-accent/10", warn: "text-amber-600 bg-amber-500/10" }[tone];
  return <span data-testid={testid} className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${c}`}>{children}</span>;
};

export const useFetch = (url, deps = []) => {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ data: null, error: null });
    api.get(url).then((r) => live && setState({ data: r.data, error: null }))
      .catch((e) => live && setState({ data: null, error: e.response?.data?.detail || "Failed to load" }));
    return () => { live = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
};

export const Loading = ({ h = 420 }) => (
  <div className="panel overflow-hidden shimmer" style={{ height: h }} data-testid="loading-block" />
);

export const ErrorBox = ({ msg }) => (
  <div data-testid="error-box" className="panel p-8 text-sm text-mp-bear">{msg}</div>
);
