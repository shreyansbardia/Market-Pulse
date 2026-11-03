import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import { api } from "./lib/api";
import { AppCtx, useAppState } from "./lib/store";
import { Header } from "./components/Header";
import { StockDrawer } from "./components/StockDrawer";
import Pulse from "./pages/Pulse";
import Signals from "./pages/Signals";
import Watchlist from "./pages/Watchlist";
import News from "./pages/News";
import Options from "./pages/Options";
import OIFlow from "./pages/OIFlow";
import Liquidity from "./pages/Liquidity";
import Radar from "./pages/Radar";
import Strength from "./pages/Strength";
import Screeners from "./pages/Screeners";

function Shell() {
  const [overview, setOverview] = useState(null);
  useEffect(() => {
    const load = () => api.get("/overview").then((r) => setOverview(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grain min-h-screen relative">
      <Header indices={overview?.indices} market={overview?.market} />
      <main className="relative z-10 px-4 md:px-8 py-6 max-w-[1600px] mx-auto">
        <Routes>
          <Route path="/" element={<Pulse overview={overview} />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/news" element={<News />} />
          <Route path="/options" element={<Options />} />
          <Route path="/oi-flow" element={<OIFlow />} />
          <Route path="/liquidity" element={<Liquidity />} />
          <Route path="/radar" element={<Radar />} />
          <Route path="/strength" element={<Strength />} />
          <Route path="/screeners" element={<Screeners />} />
        </Routes>
      </main>
      <footer className="relative z-10 px-4 md:px-8 py-6 border-t border-mp-border font-mono text-[10px] text-mp-faint">
        Data via Yahoo Finance (delayed) and NSE public option-chain data. News via public RSS. For education only, not investment advice.
      </footer>
      <StockDrawer />
    </div>
  );
}

export default function App() {
  const state = useAppState();
  return (
    <AppCtx.Provider value={state}>
      <BrowserRouter><Shell /></BrowserRouter>
    </AppCtx.Provider>
  );
}
