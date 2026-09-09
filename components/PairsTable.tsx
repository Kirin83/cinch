"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markets } from "@/copy";
import type { GetPairsResponse, MarketStage, PairBoardRow } from "@/types";
import { stockLogoUrls } from "@/lib/avatars";
import { asOfLabel, formatAmount, formatUsdCompact, formatUsdg, launchpadLabel, qualityLabel } from "@/lib/format";
import { PairNames } from "@/components/Avatar";
import { Chip } from "@/components/Chip";
import { Pager } from "@/components/Pager";
import { StageFilter, StageChip } from "@/components/StageFilter";
import { LoadingInline } from "@/components/LoadingScreen";
import { clickableRow } from "@/components/clickableRow";
import type { AsOf } from "@/types";

export function PairsTable({
  rows,
  asOf,
  total,
  page: initialPage,
  pageSize,
  stage,
  ssrStage,
  onStage,
  showStockUsdg = false,
}: {
  rows: PairBoardRow[];
  asOf: AsOf;
  total: number;
  page: number;
  pageSize: number;
  stage: MarketStage;
  ssrStage: MarketStage;
  onStage: (stage: MarketStage) => void;
  showStockUsdg?: boolean;
}) {
  const router = useRouter();
  const [hideDead, setHideDead] = useState(true);
  const [page, setPage] = useState(initialPage);
  const [list, setList] = useState(rows);
  const [count, setCount] = useState(total);
  const [busy, setBusy] = useState(false);
  const firstStage = useRef(true);

  async function load(nextHideDead: boolean, nextPage: number, nextStage: MarketStage) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        quality: "canonical",
        sort: "vol24h",
        hide_dead: nextHideDead ? "1" : "0",
        stage: nextStage,
        page: String(nextPage),
        page_size: "20",
      });
      const res = await fetch(`/api/pairs?${qs}`);
      const data = (await res.json()) as GetPairsResponse;
      setList(data.pairs ?? []);
      setCount(data.pairs_total ?? 0);
      setPage(data.page ?? nextPage);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (firstStage.current) {
      firstStage.current = false;
      if (stage === ssrStage) return;
    }
    void load(hideDead, 1, stage);
    // hideDead is applied via checkbox; stage URL drives this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StageFilter
          value={stage}
          busy={busy}
          onChange={(next) => {
            onStage(next);
          }}
        />
        <span className="text-muted">{markets.sort.memeVol} ↓</span>
        {stage === "graduated" ? (
          <span className="ml-auto text-xs text-muted">{markets.graduatedQuiet}</span>
        ) : (
          <label className="ml-auto flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={hideDead}
              disabled={busy}
              onChange={(e) => {
                const checked = e.target.checked;
                setHideDead(checked);
                void load(checked, 1, stage);
              }}
            />
            {markets.hideDead}
          </label>
        )}
      </div>

      {list.length === 0 ? (
        busy ? (
          <LoadingInline label="Reading the board…" />
        ) : (
          <p className="mt-10 text-sm text-muted">
            {stage !== "all"
              ? markets.emptyStage
              : rows.length === 0
                ? markets.emptyChain
                : markets.emptyFilter}
          </p>
        )
      ) : (
        <div className="card-well mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-normal">{markets.columns.pair}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.memeVol24h}</th>
                {showStockUsdg ? (
                  <th className="py-3 pr-4 font-normal">{markets.columns.stockUsdg}</th>
                ) : null}
                <th className="py-3 pr-4 font-normal">{stockInLpLabel}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.dex}</th>
                <th className="py-3 pl-4 pr-4 font-normal" />
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.pool_address}
                  className="group cursor-pointer border-b border-line last:border-0 hover:bg-[#323232]"
                  {...clickableRow(row.token_path, router)}
                >
                  <td className="px-4 py-4">
                    <Link href={row.token_path} className="flex items-center gap-3">
                      <PairNames
                        tokenLabel={row.meme.symbol ?? "???"}
                        stockSrc={stockLogoUrls(row.stock.ticker)}
                        stockLabel={row.stock.ticker}
                        size="md"
                      />
                      <Chip kind="pair_canonical">{qualityLabel("pair_canonical")}</Chip>
                      <StageChip stage={row.stage} />
                    </Link>
                  </td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.volume_usd_24h)}</td>
                  {showStockUsdg ? (
                    <td className="py-4 pr-4 font-mono num">{formatUsdg(row.stock_dex_usdg)}</td>
                  ) : null}
                  <td className="py-4 pr-4 font-mono num">
                    {formatAmount(row.stock_in_lp.amount, row.stock_in_lp.symbol)}
                  </td>
                  <td className="py-4 pr-4 text-muted">{launchpadLabel(row.launchpad)}</td>
                  <td className="py-4 pl-4 pr-4">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs opacity-70 group-hover:opacity-100">
                      <Link href={row.stock_path} className="text-spore">
                        {row.stock.ticker} →
                      </Link>
                      {row.swap_urls?.pons ? (
                        <a href={row.swap_urls.pons} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                          Pons
                        </a>
                      ) : null}
                      {row.swap_urls?.long ? (
                        <a href={row.swap_urls.long} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                          Long
                        </a>
                      ) : null}
                      {row.swap_urls?.uniswap ? (
                        <a href={row.swap_urls.uniswap} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                          Uniswap
                        </a>
                      ) : null}
                      {row.swap_urls?.dexscreener ? (
                        <a href={row.swap_urls.dexscreener} target="_blank" rel="noreferrer" className="text-muted hover:text-ink">
                          Dexscreener
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Pager
              page={page}
              pageSize={pageSize}
              total={count}
              busy={busy}
              onPage={(p) => void load(hideDead, p, stage)}
            />
            <p className="font-mono text-[11px] text-muted">{asOfLabel(asOf)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const stockInLpLabel = "Stock in LP";
