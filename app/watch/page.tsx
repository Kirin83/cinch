"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { watch as copy } from "@/copy";
import { routes } from "@/routes";
import { readWatchlist } from "@/lib/watchlist";
import { formatPct, formatPp } from "@/lib/format";
import { PinButton } from "@/components/PinButton";
import { Avatar } from "@/components/Avatar";
import { stockLogoUrls } from "@/lib/avatars";
import type { StockHeatmapRow } from "@/types";

export default function WatchPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [stocks, setStocks] = useState<StockHeatmapRow[]>([]);

  useEffect(() => {
    setTickers(readWatchlist());
    fetch("/api/stocks")
      .then((r) => r.json())
      .then((d) => setStocks(d.stocks ?? []));
  }, []);

  const rows = stocks.filter((s) => tickers.includes(s.ticker));

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Watch</h1>
      <p className="mt-2 text-sm text-muted">{copy.noAccount}</p>
      {rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{copy.empty}</p>
      ) : (
        <ul className="mt-8 space-y-2">
          {rows.map((row) => (
            <li key={row.ticker} className="card-well flex flex-wrap items-center gap-4 px-4 py-4">
              <Avatar src={stockLogoUrls(row.ticker)} label={row.ticker} size="md" />
              <span className="font-mono text-lg">{row.ticker}</span>
              <span className="font-mono">{formatPct(row.float_locked_pct)}</span>
              <span className="font-mono text-sm text-muted">
                {formatPp(row.float_locked_pct_change_24h)} 24h
              </span>
              <span className="text-sm text-muted">
                {row.new_pair_count_24h} new pair{row.new_pair_count_24h === 1 ? "" : "s"}
              </span>
              <Link href={routes.stock(row.ticker)} className="ml-auto font-mono text-xs text-spore">
                Open
              </Link>
              <PinButton ticker={row.ticker} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
