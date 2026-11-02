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
        </Routes>
      </main>
      <footer className="relative z-10 px-4 md:px-8 py-6 border-t border-[#232736] font-mono text-[10px] text-slate-600">
        Data via Yahoo Finance (delayed). News via public RSS. For education only, not investment advice.
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
