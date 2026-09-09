"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { markets } from "@/copy";
import type { GetMarketStocksResponse, MarketStockRow } from "@/types";
import { stockLogoUrls } from "@/lib/avatars";
import { asOfLabel, formatUsdCompact, formatUsdg } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Pager } from "@/components/Pager";
import { LoadingInline } from "@/components/LoadingScreen";
import type { AsOf } from "@/types";

export function StockBoardTable() {
  const [hideDead, setHideDead] = useState(true);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<MarketStockRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [asOf, setAsOf] = useState<AsOf | null>(null);
  const [busy, setBusy] = useState(true);

  async function load(nextHideDead: boolean, nextPage: number) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        hide_dead: nextHideDead ? "1" : "0",
        page: String(nextPage),
        page_size: "20",
      });
      const res = await fetch(`/api/markets/stocks?${qs}`);
      const data = (await res.json()) as GetMarketStocksResponse;
      setList(data.stocks ?? []);
      setCount(data.stocks_total ?? 0);
      setPage(data.page ?? nextPage);
      setAsOf(data.indexer.head);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(true, 1);
  }, []);

  const rows = list ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">{markets.columns.vol24h} ↓</span>
        <label className="ml-auto flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={hideDead}
            disabled={busy}
            onChange={(e) => {
              const checked = e.target.checked;
              setHideDead(checked);
              void load(checked, 1);
            }}
          />
          {markets.hideDead}
        </label>
      </div>

      {rows.length === 0 ? (
        busy ? (
          <LoadingInline label="Reading the board…" />
        ) : (
          <p className="mt-10 text-sm text-muted">{markets.emptyChain}</p>
        )
      ) : (
        <div className="card-well mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-normal">{markets.columns.stock}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.vol24h}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.dexUsdg}</th>
                <th className="py-3 pl-4 pr-4 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker} className="group border-b border-line last:border-0 hover:bg-[#323232]">
                  <td className="px-4 py-4">
                    <Link href={row.stock_path} className="flex items-center gap-3">
                      <Avatar src={stockLogoUrls(row.ticker)} label={row.ticker} size="md" />
                      <span>
                        <span className="block font-semibold">{row.ticker}</span>
                        <span className="block text-xs text-muted">{row.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.volume_usd_24h)}</td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdg(row.dex_usdg)}</td>
                  <td className="py-4 pl-4 pr-4">
                    <Link href={row.stock_path} className="font-mono text-xs text-spore">
                      {row.ticker} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pager
              page={page}
              pageSize={20}
              total={count}
              busy={busy}
              onPage={(p) => void load(hideDead, p)}
            />
            {asOf ? <p className="font-mono text-[11px] text-muted">{asOfLabel(asOf)}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
