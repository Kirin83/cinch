"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttons, markets } from "@/copy";
import { routes } from "@/routes";
import type { StockFilter, StockHeatmapRow, StockSort } from "@/types";
import { stockLogoUrls } from "@/lib/avatars";
import {
  asOfLabel,
  formatPct,
  formatPremiumBps,
  formatPressure,
  formatUsd,
  formatUsdCompact,
} from "@/lib/format";
import { PinButton } from "@/components/PinButton";
import { Avatar } from "@/components/Avatar";

const filters: { id: StockFilter; label: string }[] = [
  { id: "all", label: markets.filter.all },
  { id: "mega", label: markets.filter.mega },
  { id: "meme_stocks", label: markets.filter.memeStocks },
  { id: "ai", label: markets.filter.ai },
  { id: "etf", label: markets.filter.etf },
];

export function MarketsTable({ rows }: { rows: StockHeatmapRow[] }) {
  const [sort, setSort] = useState<StockSort>("meme_vol");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [hideEmpty, setHideEmpty] = useState(false);

  const visible = useMemo(() => {
    let list = [...rows];
    if (filter === "etf") list = list.filter((r) => r.asset_type === "etf");
    else if (filter !== "all") {
      list = list.filter((r) => r.sectors.includes(filter as "mega" | "meme_stocks" | "ai"));
    }
    if (hideEmpty) list = list.filter((r) => r.meme_pair_count > 0);
    list.sort((a, b) => {
      if (sort === "meme_vol") return b.meme_vol_24h_usd - a.meme_vol_24h_usd;
      if (sort === "premium") return (b.premium_bps ?? 0) - (a.premium_bps ?? 0);
      if (sort === "pairs") return b.meme_pair_count - a.meme_pair_count;
      return b.float_locked_pct - a.float_locked_pct;
    });
    return list;
  }, [rows, sort, filter, hideEmpty]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as StockSort)}
            className="rounded-[15px] bg-elev px-3 py-1.5 outline-none"
          >
            <option value="meme_vol">{markets.sort.memeVol} ↓</option>
            <option value="float_locked">{markets.sort.floatLocked}</option>
            <option value="premium">{markets.sort.premium}</option>
            <option value="pairs">{markets.sort.pairs}</option>
          </select>
        </div>
        <div className="seg flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              data-active={filter === f.id}
              className="seg-item"
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
          />
          {markets.hideEmpty}
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          {rows.length === 0 ? markets.emptyChain : markets.emptyFilter}
        </p>
      ) : (
        <div className="card-well mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-normal">{markets.columns.stock}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.oracle}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.dex}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.premium}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.floatLocked}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.memePairs}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.memeVol24h}</th>
                <th className="py-3 font-normal">{markets.columns.pressure}</th>
                <th className="py-3 pl-4 pr-4 font-normal" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.ticker} className="group border-b border-line last:border-0 hover:bg-[#323232]">
                  <td className="px-4 py-4">
                    <Link href={routes.stock(row.ticker)} className="flex items-center gap-3">
                      <Avatar src={stockLogoUrls(row.ticker)} label={row.ticker} size="md" />
                      <span>
                        <span className="block font-semibold">{row.ticker}</span>
                        <span className="block text-xs text-muted">{row.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-4 pr-4 font-mono num">{formatUsd(row.oracle_price_usd)}</td>
                  <td className="py-4 pr-4 font-mono num">{formatUsd(row.dex_price_usd)}</td>
                  <td className="py-4 pr-4 font-mono num">{formatPremiumBps(row.premium_bps)}</td>
                  <td className="py-4 pr-4">
                    <div className="font-mono text-base num">{formatPct(row.float_locked_pct)}</div>
                    <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-elev">
                      <div
                        className="h-full rounded-full bg-leaf"
                        style={{ width: `${Math.min(100, Math.max(0, row.float_locked_pct * 100))}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-4 pr-4 font-mono num">{row.meme_pair_count}</td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.meme_vol_24h_usd)}</td>
                  <td className="py-4 font-mono num">{formatPressure(row.meme_pressure)}</td>
                  <td className="py-4 pl-4 pr-4">
                    <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100">
                      <Link href={routes.stock(row.ticker)} className="font-mono text-xs text-spore">
                        {buttons.openStock(row.ticker)} →
                      </Link>
                      <PinButton ticker={row.ticker} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible[0] ? (
            <p className="px-4 py-3 font-mono text-[11px] text-muted">{asOfLabel(visible[0].as_of)}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
