import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, timeAgo } from "../lib/api";
import { Empty } from "../components/bits";
import { Skeleton } from "../components/ui/skeleton";

export const NewsItem = ({ n, i, testid }) => (
  <a href={n.link} target="_blank" rel="noreferrer" data-testid={testid}
    className="rise group block px-5 py-4 border-b border-mp-elev hover:bg-mp-accent/[0.05] transition-colors" style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}>
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
      <span className="text-mp-accent">{n.source}</span>
      {n.symbol && <span className="text-[#F59E0B]">{n.symbol}</span>}
      <span className="text-mp-faint">{timeAgo(n.published)}</span>
    </div>
    <div className="mt-1 flex gap-2 items-start">
      <h4 className="text-[15px] font-medium leading-snug group-hover:text-mp-fg text-mp-fg">{n.title}</h4>
      <ExternalLink size={12} className="mt-1 shrink-0 text-mp-faint group-hover:text-mp-fg" />
    </div>
    {n.summary && <p className="mt-1 text-xs text-mp-faint line-clamp-2">{n.summary.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ")}</p>}
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
            className={`px-3 py-1 rounded-full border font-mono text-xs transition-colors ${src === s ? "bg-mp-fg text-mp-bg border-mp-fg" : "border-mp-border text-mp-muted hover:text-mp-fg"}`}>{s || "All"}</button>
        ))}
      </div>
      <div className="panel overflow-hidden" data-testid="news-list">
        {!data ? <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 bg-mp-elev" />)}</div> :
          data.items.length === 0 ? <Empty testid="news-empty" text="No headlines from this source right now." /> :
          data.items.map((n, i) => <NewsItem key={n.link + i} n={n} i={i} testid={`news-item-${i}`} />)}
      </div>
    </div>
  );
}
