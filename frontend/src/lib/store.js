import { createContext, useContext, useCallback, useEffect, useState } from "react";

const KEY = "mp_watchlist";
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export const useAppState = () => {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || ["RELIANCE", "HDFCBANK", "TCS", "INFY"]; } catch { return []; }
  });
  const [openSymbol, setOpenSymbol] = useState(null);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(watchlist)), [watchlist]);
  const toggleWatch = useCallback(
    (s) => setWatchlist((w) => (w.includes(s) ? w.filter((x) => x !== s) : [...w, s])), []);
  return { watchlist, toggleWatch, openSymbol, setOpenSymbol };
};
