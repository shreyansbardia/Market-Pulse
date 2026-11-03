import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Search, Sun, Moon } from "lucide-react";
import { api, fmt } from "../lib/api";
import { useApp } from "../lib/store";
import { Pct } from "./bits";
import { CommandDialog, CommandInput, CommandList, CommandItem, CommandEmpty } from "./ui/command";

const NAV = [["/", "Pulse", "pulse"], ["/signals", "Signals", "signals"], ["/options", "Options", "options"], ["/oi-flow", "OI Flow", "oi-flow"],
  ["/liquidity", "Liquidity", "liquidity"], ["/radar", "Radar", "radar"], ["/strength", "Strength", "strength"], ["/screeners", "Screeners", "screeners"],
  ["/watchlist", "Watchlist", "watchlist"], ["/news", "News", "news"]];

const Clock = ({ market }) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const ist = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  return (
    <div className="hidden 2xl:flex items-center gap-2 font-mono text-xs">
      <span data-testid="market-status-badge" className={`px-2 py-0.5 rounded-sm border ${market?.open ? "text-mp-bull border-mp-bull/40 bg-mp-bull/10" : "text-mp-muted border-mp-border"}`}>
        {market?.open ? "MARKET OPEN" : "MARKET CLOSED"}
      </span>
      <span data-testid="ist-clock" className="text-mp-muted">{ist} IST</span>
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-mp-border bg-mp-surface text-mp-muted text-xs hover:border-mp-accent/60 transition-colors">
        <Search size={14} /> <span className="hidden sm:inline">Search Nifty 200</span>
        <kbd className="hidden lg:inline font-mono text-[10px] text-mp-faint ml-2">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput data-testid="stock-search-input" placeholder="Type a symbol e.g. RELIANCE" />
        <CommandList>
          <CommandEmpty>No stock found.</CommandEmpty>
          {list.map((s) => (
            <CommandItem key={s.symbol} value={s.symbol} data-testid={`search-result-${s.symbol}`}
              onSelect={() => { setOpenSymbol(s.symbol); setOpen(false); }}>
              <span className="font-mono font-semibold">{s.symbol}</span>
              <span className="ml-auto text-xs text-mp-faint">{s.sector}{s.nifty50 ? " · N50" : ""}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export const TickerStrip = ({ indices = [] }) => (
  <div data-testid="ticker-strip" className="bg-mp-sunken border-b border-mp-border py-2 px-4 md:px-8 overflow-x-auto scroll-thin flex items-center gap-8 text-xs font-mono whitespace-nowrap">
    {indices.length === 0 && <span className="text-mp-faint">Loading indices…</span>}
    {indices.map((i) => (
      <div key={i.key} data-testid={`index-${i.key}`} className="flex items-center gap-2">
        <span className="text-mp-faint">{i.name}</span>
        <span className="text-mp-fg">{fmt(i.ltp)}</span>
        <Pct v={i.change_pct} />
      </div>
    ))}
  </div>
);

const ThemeToggle = () => {
  const { theme, toggleTheme } = useApp();
  return (
    <button data-testid="theme-toggle" onClick={toggleTheme} aria-label="toggle theme"
      className="relative w-14 h-7 rounded-full border border-mp-border bg-mp-elev transition-colors">
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-mp-surface shadow flex items-center justify-center transition-transform duration-300 ${theme === "dark" ? "translate-x-7" : ""}`}>
        {theme === "dark" ? <Moon size={13} className="text-mp-accent" /> : <Sun size={13} className="text-mp-accent" />}
      </span>
    </button>
  );
};

export const Header = ({ indices, market }) => (
  <header className="sticky top-0 z-40 bg-mp-bg/90 backdrop-blur-md">
    <div className="flex items-center justify-between gap-4 px-4 md:px-8 py-2.5 border-b border-mp-border">
      <div className="flex items-center gap-6 min-w-0">
        <NavLink to="/" data-testid="brand-logo" className="flex items-center gap-2 shrink-0">
          <span className="live-dot w-2 h-2 rounded-full bg-mp-bull" />
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight">Market<span className="text-mp-accent">Pulse</span></span>
          <span className="font-mono text-[10px] text-mp-faint mt-1">NSE</span>
        </NavLink>
        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto scroll-thin">
          {NAV.map(([to, label, id]) => (
            <NavLink key={to} to={to} end data-testid={`nav-tab-${id}`}
              className={({ isActive }) => `px-2.5 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${isActive ? "bg-mp-elev text-mp-fg" : "text-mp-muted hover:text-mp-fg"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 shrink-0"><Clock market={market} /><StockSearch /><ThemeToggle /></div>
    </div>
    <nav className="lg:hidden flex overflow-x-auto scroll-thin border-b border-mp-border">
      {NAV.map(([to, label, id]) => (
        <NavLink key={to} to={to} end data-testid={`mobile-nav-${id}`}
          className={({ isActive }) => `flex-none px-3.5 text-center py-2 text-xs whitespace-nowrap ${isActive ? "text-mp-fg font-semibold border-b-2 border-mp-accent" : "text-mp-faint"}`}>{label}</NavLink>
      ))}
    </nav>
    <TickerStrip indices={indices} />
  </header>
);
