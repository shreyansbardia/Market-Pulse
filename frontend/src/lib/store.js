import { createContext, useContext, useCallback, useEffect, useState } from "react";

const KEY = "mp_watchlist";
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const PALETTES = {
  light: { bull: "#059669", bear: "#DC2626", accent: "#7C3AED", accent2: "#A78BFA", warn: "#D97706", sky: "#0284C7",
    tick: "#928CA8", grid: "#ECE9F5", tipBg: "#FFFFFF", tipBorder: "#E6E2F2", neutral: "#EEEBF6", fg: "#161226", track: "#EEEBF6" },
  dark: { bull: "#10B981", bear: "#EF4444", accent: "#8B5CF6", accent2: "#C4B5FD", warn: "#F59E0B", sky: "#38BDF8",
    tick: "#64748B", grid: "#1A1D28", tipBg: "#1A1D28", tipBorder: "#232736", neutral: "#1F2230", fg: "#F1F5F9", track: "#1A1D28" },
};

export const usePalette = () => PALETTES[useApp().theme];

export const tipStyle = (p) => ({
  contentStyle: { background: p.tipBg, border: `1px solid ${p.tipBorder}`, borderRadius: 8, fontSize: 11, fontFamily: "JetBrains Mono", color: p.fg },
  labelStyle: { color: p.tick },
});

export const useAppState = () => {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || ["RELIANCE", "HDFCBANK", "TCS", "INFY"]; } catch { return []; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("mp_theme") || "light");
  const [openSymbol, setOpenSymbol] = useState(null);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(watchlist)), [watchlist]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("mp_theme", theme);
  }, [theme]);
  const toggleWatch = useCallback(
    (s) => setWatchlist((w) => (w.includes(s) ? w.filter((x) => x !== s) : [...w, s])), []);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { watchlist, toggleWatch, openSymbol, setOpenSymbol, theme, toggleTheme };
};
