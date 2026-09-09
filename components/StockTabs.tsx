"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttons, markets, stockPage } from "@/copy";
import { Pager } from "@/components/Pager";
import { routes } from "@/routes";
import type { GetStockResponse, HolderRow, MemePairRow } from "@/types";
import { Chip } from "@/components/Chip";
import { StageChip } from "@/components/StageFilter";
import { Avatar } from "@/components/Avatar";
import { HoldersList } from "@/components/HoldersList";
import { LoadingInline } from "@/components/LoadingScreen";
import { clickableRow } from "@/components/clickableRow";
import {
  formatAge,
  formatAmount,
  formatPct,
  formatUsdCompact,
  qualityLabel,
} from "@/lib/format";

export function StockTabs({ data }: { data: GetStockResponse }) {
  const router = useRouter();
  const ticker = data.stock.ticker;
  const [tab, setTab] = useState<"meme" | "spot" | "holders">("meme");
  const [hideDead, setHideDead] = useState(true);
  const [page, setPage] = useState(data.page);
  const [pairs, setPairs] = useState<MemePairRow[]>(data.meme_pairs);
  const [total, setTotal] = useState(data.meme_pairs_total);
  const [holders, setHolders] = useState<HolderRow[] | null>(data.holders);
  const [busy, setBusy] = useState(false);

  const pageSize = data.page_size || 10;

  async function loadPage(nextHideDead: boolean, nextPage: number) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        hide_dead: nextHideDead ? "1" : "0",
        page: String(nextPage),
        page_size: "10",
      });
      const res = await fetch(`/api/stocks/${ticker}?${qs}`);
      const body = (await res.json()) as GetStockResponse;
      setPairs(body.meme_pairs ?? []);
      setTotal(body.meme_pairs_total ?? 0);
      setPage(body.page ?? nextPage);
    } finally {
      setBusy(false);
    }
  }

  async function onHideDead(checked: boolean) {
    setHideDead(checked);
    await loadPage(checked, 1);
  }

  async function openHolders() {
    setTab("holders");
    if (holders != null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/stocks/${ticker}?holders=1&page=1`);
      const body = (await res.json()) as GetStockResponse;
      setHolders(body.holders);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg w-fit font-mono text-sm">
          <TabBtn on={tab === "meme"} onClick={() => setTab("meme")}>
            {stockPage.tabs.memePairs(total)}
          </TabBtn>
          <TabBtn on={tab === "spot"} onClick={() => setTab("spot")}>
            {stockPage.tabs.spotPools}
          </TabBtn>
          <TabBtn on={tab === "holders"} onClick={() => void openHolders()}>
            {stockPage.tabs.holders}
          </TabBtn>
        </div>
        {tab === "meme" ? (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={hideDead}
              disabled={busy}
              onChange={(e) => void onHideDead(e.target.checked)}
            />
            {markets.hideDead}
          </label>
        ) : null}
      </div>

      {tab === "meme" && (
        pairs.length === 0 ? (
          busy ? (
            <LoadingInline label="Reading pairs…" />
          ) : (
            <p className="mt-6 text-sm text-muted">{stockPage.emptyPairs(ticker)}</p>
          )
        ) : (
          <>
            <div className="card-well mt-4 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="py-3 pl-5 pr-4 font-normal">{stockPage.pairColumns.token}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.age}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.fdv}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.stockInLp}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.pctOfStock(ticker)}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.vol24h}</th>
                    <th className="py-3 pr-4 font-normal">{stockPage.pairColumns.risk}</th>
                    <th className="py-3 pl-2 pr-5 font-normal">{stockPage.pairColumns.pair}</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((row) => (
                    <tr
                      key={row.pool_address}
                      className="cursor-pointer border-b border-line align-top hover:bg-[#323232]"
                      {...clickableRow(routes.token(row.token.address), router)}
                    >
                      <td className="py-3 pl-5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar label={row.token.symbol} size="sm" />
                          <span className="font-semibold">{row.token.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono">{formatAge(row.age_seconds)}</td>
                      <td className="py-3 pr-4 font-mono">{formatUsdCompact(row.fdv_usd)}</td>
                      <td className="py-3 pr-4 font-mono">
                        {formatAmount(row.stock_in_lp.amount, row.stock_in_lp.symbol)}
                      </td>
                      <td className="py-3 pr-4 font-mono">{formatPct(row.stock_in_lp_pct_of_supply)}</td>
                      <td className="py-3 pr-4 font-mono">{formatUsdCompact(row.volume_usd_24h)}</td>
                      <td className="py-3 pr-4">
                        {row.risk ? (
                          <div className="flex flex-col gap-1">
                            <Chip kind={row.risk.grade}>{row.risk.grade.toUpperCase()}</Chip>
                            <span className="text-xs text-muted">{row.risk.summary}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-5">
                        <Chip kind={row.pair_quality}>{qualityLabel(row.pair_quality)}</Chip>
                        <div className="mt-1">
                          <StageChip stage={row.stage} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 font-mono text-xs text-muted">
                          <Link href={routes.token(row.token.address)} className="hover:text-ink">
                            {stockPage.openCoin}
                          </Link>
                          {row.chart_url ? (
                            <a href={row.chart_url} target="_blank" rel="noreferrer">
                              {stockPage.chart}
                            </a>
                          ) : null}
                          {row.swap_urls?.pons ? (
                            <a href={row.swap_urls.pons} target="_blank" rel="noreferrer">
                              {buttons.swap}
                            </a>
                          ) : null}
                          {row.swap_urls?.long ? (
                            <a href={row.swap_urls.long} target="_blank" rel="noreferrer">
                              Long ↗
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              pageSize={pageSize}
              total={total}
              busy={busy}
              onPage={(p) => void loadPage(hideDead, p)}
            />
          </>
        )
      )}

      {tab === "spot" && (
        data.spot_pools.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No spot pools indexed.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {data.spot_pools.map((p) => (
              <li key={p.pool_address} className="card-well px-4 py-3">
                <div className="flex justify-between font-mono">
                  <span>{ticker}/{p.quote}</span>
                  <span>{formatUsdCompact(p.volume_usd_24h)} 24h</span>
                </div>
                <div className="mt-1 text-muted">
                  {formatAmount(p.stock_in_lp.amount, ticker)} in LP
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "holders" && (
        holders == null ? (
          busy ? (
            <LoadingInline label="Reading holders…" />
          ) : (
            <p className="mt-6 text-sm text-muted">Holders unavailable. Blockscout did not return a list for this token.</p>
          )
        ) : (
          <HoldersList rows={holders} />
        )
      )}
    </div>
  );
}

function TabBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="seg-item"
      data-active={on}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
