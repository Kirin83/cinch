"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { chrome as copy } from "@/copy";
import type { GetSearchResponse, GetStatusResponse } from "@/types";
import { routes } from "@/routes";
import { stockLogoUrls } from "@/lib/avatars";
import Link from "next/link";
import { Avatar, PairNames } from "@/components/Avatar";

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<GetSearchResponse | null>(null);
  const [status, setStatus] = useState<GetStatusResponse | null>(null);
  const lag = status?.head.lag_seconds ?? 0;
  const behind = lag > 30;

  useEffect(() => {
    let alive = true;
    void fetch("/api/status")
      .then((res) => res.json())
      .then((body: GetStatusResponse) => {
        if (alive) setStatus(body);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      setHits(await res.json());
      setOpen(true);
    }, 120);
    return () => clearTimeout(t);
  }, [q]);

  function go(path: string) {
    setOpen(false);
    setQ("");
    router.push(path);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits && setOpen(true)}
          placeholder={copy.searchPlaceholder}
          className="w-full rounded-[15px] bg-elev px-4 py-2.5 font-mono text-sm text-ink outline-none placeholder:text-muted"
        />
        {open && hits && (
          <div className="card-well absolute z-20 mt-2 w-full overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            {hits.stocks.length === 0 && hits.tokens.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">No match.</p>
            ) : (
              <ul className="max-h-72 overflow-auto text-sm">
                {hits.stocks.map((s) => (
                  <li key={s.ticker}>
                    <button
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#323232]"
                      onClick={() => go(s.path)}
                    >
                      <Avatar src={stockLogoUrls(s.ticker)} label={s.ticker} size="sm" />
                      <span className="font-semibold">{s.ticker}</span>
                      <span className="text-muted">{s.name}</span>
                    </button>
                  </li>
                ))}
                {hits.tokens.map((t) => (
                  <li key={t.address}>
                    <button
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#323232]"
                      onClick={() => go(t.path)}
                    >
                      <PairNames
                        tokenLabel={t.symbol ?? "???"}
                        stockSrc={stockLogoUrls(t.stock_ticker)}
                        stockLabel={t.stock_ticker}
                        size="sm"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <Link
        href={routes.status}
        className={`font-mono text-xs ${behind ? "text-caution" : "text-muted"}`}
      >
        {status
          ? behind
            ? copy.indexBehind(lag)
            : copy.indexSynced(lag)
          : "…"}
      </Link>
    </div>
  );
}
