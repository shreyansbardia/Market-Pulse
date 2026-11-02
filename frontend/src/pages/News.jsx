import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, timeAgo } from "../lib/api";
import { Empty } from "../components/bits";
import { Skeleton } from "../components/ui/skeleton";

export const NewsItem = ({ n, i, testid }) => (
  <a href={n.link} target="_blank" rel="noreferrer" data-testid={testid}
    className="rise group block px-5 py-4 border-b border-[#1A1D28] hover:bg-white/[0.03] transition-colors" style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}>
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
      <span className="text-[#6366F1]">{n.source}</span>
      {n.symbol && <span className="text-[#F59E0B]">{n.symbol}</span>}
      <span className="text-slate-500">{timeAgo(n.published)}</span>
    </div>
    <div className="mt-1 flex gap-2 items-start">
      <h4 className="text-[15px] font-medium leading-snug group-hover:text-white text-slate-200">{n.title}</h4>
      <ExternalLink size={12} className="mt-1 shrink-0 text-slate-600 group-hover:text-slate-300" />
    </div>
    {n.summary && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{n.summary.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ")}</p>}
  </a>
);

export default function News() {
  const [src, setSrc] = useState("");
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.get("/news", { params: src ? { source: src } : {} }).then((r) => setData(r.data)); }, [src]);
  const sources = data?.sources || [];
  return (
    <div className="space-y-4 max-w-6xl" data-testid="news-page">
      <div>
        <div className="eyebrow mb-1">CNBC · Yahoo Finance · Moneycontrol · ET Markets · Livemint</div>
        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight">Market Wire</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {["", ...sources].map((s) => (
          <button key={s || "all"} data-testid={`news-source-${(s || "all").toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setSrc(s)}
            className={`px-3 py-1 rounded-full border font-mono text-xs transition-colors ${src === s ? "bg-white text-black border-white" : "border-[#232736] text-slate-400 hover:text-white"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="panel overflow-hidden" data-testid="news-list">
        {!data ? <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 bg-[#1A1D28]" />)}</div> :
          data.items.length === 0 ? <Empty testid="news-empty" text="No headlines from this source right now." /> :
          data.items.map((n, i) => <NewsItem key={n.link + i} n={n} i={i} testid={`news-item-${i}`} />)}
      </div>
    </div>
  );
}
