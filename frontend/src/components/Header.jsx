import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Search } from "lucide-react";
import { api, fmt } from "../lib/api";
import { useApp } from "../lib/store";
import { Pct } from "./bits";
import { CommandDialog, CommandInput, CommandList, CommandItem, CommandEmpty } from "./ui/command";

const NAV = [["/", "Pulse", "pulse"], ["/signals", "Signals", "signals"], ["/watchlist", "Watchlist", "watchlist"], ["/news", "News", "news"]];

const Clock = ({ market }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const ist = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  return (
    <div className="hidden md:flex items-center gap-2 font-mono text-xs">
      <span data-testid="market-status-badge" className={`px-2 py-0.5 rounded-sm border ${market?.open ? "text-[#10B981] border-[#10B981]/40 bg-[#10B981]/10" : "text-slate-400 border-[#232736]"}`}>
        {market?.open ? "MARKET OPEN" : "MARKET CLOSED"}
      </span>
      <span data-testid="ist-clock" className="text-slate-400">{ist} IST</span>
    </div>
  );
};

const StockSearch = () => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const { setOpenSymbol } = useApp();
  useEffect(() => { api.get("/universe").then((r) => setList(r.data)); }, []);
  useEffect(() => {
    const k = (e) => { if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <>
      <button data-testid="stock-search-open" onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#232736] bg-[#12141C] text-slate-400 text-xs hover:border-[#6366F1]/60 transition-colors">
        <Search size={14} /> <span className="hidden sm:inline">Search Nifty 200</span>
        <kbd className="hidden lg:inline font-mono text-[10px] text-slate-500 ml-2">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput data-testid="stock-search-input" placeholder="Type a symbol e.g. RELIANCE" />
        <CommandList>
          <CommandEmpty>No stock found.</CommandEmpty>
          {list.map((s) => (
            <CommandItem key={s.symbol} value={s.symbol} data-testid={`search-result-${s.symbol}`}
              onSelect={() => { setOpenSymbol(s.symbol); setOpen(false); }}>
              <span className="font-mono font-semibold">{s.symbol}</span>
              <span className="ml-auto text-xs text-slate-500">{s.sector}{s.nifty50 ? " · N50" : ""}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export const TickerStrip = ({ indices = [] }) => (
  <div data-testid="ticker-strip" className="bg-[#0D0F17] border-b border-[#1E2230] py-2 px-4 md:px-8 overflow-x-auto scroll-thin flex items-center gap-8 text-xs font-mono whitespace-nowrap">
    {indices.length === 0 && <span className="text-slate-500">Loading indices…</span>}
    {indices.map((i) => (
      <div key={i.key} data-testid={`index-${i.key}`} className="flex items-center gap-2">
        <span className="text-slate-500">{i.name}</span>
        <span className="text-slate-100">{fmt(i.ltp)}</span>
        <Pct v={i.change_pct} />
      </div>
    ))}
  </div>
);

export const Header = ({ indices, market }) => (
  <header className="sticky top-0 z-40 bg-[#090A0F]/90 backdrop-blur-md">
    <div className="flex items-center justify-between gap-4 px-4 md:px-8 py-2.5 border-b border-[#232736]">
      <div className="flex items-center gap-8">
        <NavLink to="/" data-testid="brand-logo" className="flex items-center gap-2">
          <span className="live-dot w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight">Market<span className="text-[#6366F1]">Pulse</span></span>
          <span className="font-mono text-[10px] text-slate-500 mt-1">NSE</span>
        </NavLink>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(([to, label, id]) => (
            <NavLink key={to} to={to} end data-testid={`nav-tab-${id}`}
              className={({ isActive }) => `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isActive ? "bg-[#1A1D28] text-white" : "text-slate-400 hover:text-white"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4"><Clock market={market} /><StockSearch /></div>
    </div>
    <nav className="md:hidden flex border-b border-[#232736]">
      {NAV.map(([to, label, id]) => (
        <NavLink key={to} to={to} end data-testid={`mobile-nav-${id}`}
          className={({ isActive }) => `flex-1 text-center py-2 text-xs ${isActive ? "text-white border-b-2 border-[#6366F1]" : "text-slate-500"}`}>{label}</NavLink>
      ))}
    </nav>
    <TickerStrip indices={indices} />
  </header>
);
