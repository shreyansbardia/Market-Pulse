import axios from "axios";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

export const fmt = (n, d = 2) =>
  n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pctClass = (n) => (n > 0 ? "text-[#10B981]" : n < 0 ? "text-[#EF4444]" : "text-slate-400");

export const SIGNAL_META = {
  RSI_BULL_DIV: { label: "RSI Bull Div", bull: true },
  RSI_BEAR_DIV: { label: "RSI Bear Div", bull: false },
  MACD_BULL_X: { label: "MACD Bull X", bull: true },
  MACD_BEAR_X: { label: "MACD Bear X", bull: false },
};

export const TIMEFRAMES = ["5m", "15m", "30m", "60m", "1d"];

export const fmtL = (n) => {
  if (n === null || n === undefined) return "—";
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1e7) return `${s}${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2)}Cr`;
  if (a >= 1e5) return `${s}${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
};

export const timeAgo = (iso) => {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
