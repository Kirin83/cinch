"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markets } from "@/copy";
import type { GetMemesResponse, MarketStage, MemeBoardRow } from "@/types";
import { asOfLabel, formatUsdCompact, formatUsdg } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Pager } from "@/components/Pager";
import { StageFilter, StageChip } from "@/components/StageFilter";
import { LoadingInline } from "@/components/LoadingScreen";
import { clickableRow } from "@/components/clickableRow";
import type { AsOf } from "@/types";

export function MemeBoardTable({
  stage,
  onStage,
}: {
  stage: MarketStage;
  onStage: (stage: MarketStage) => void;
}) {
  const router = useRouter();
  const [hideDead, setHideDead] = useState(true);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<MemeBoardRow[] | null>(null);
  const [count, setCount] = useState(0);
  const [asOf, setAsOf] = useState<AsOf | null>(null);
  const [busy, setBusy] = useState(true);

  async function load(nextHideDead: boolean, nextPage: number, nextStage: MarketStage) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        hide_dead: nextHideDead ? "1" : "0",
        stage: nextStage,
        page: String(nextPage),
        page_size: "20",
      });
      const res = await fetch(`/api/markets/memes?${qs}`);
      const data = (await res.json()) as GetMemesResponse;
      setList(data.memes ?? []);
      setCount(data.memes_total ?? 0);
      setPage(data.page ?? nextPage);
      setAsOf(data.indexer.head);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(hideDead, 1, stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const rows = list ?? [];

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
        <span className="text-muted">{markets.columns.vol24h} ↓</span>
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

      {rows.length === 0 ? (
        busy ? (
          <LoadingInline label="Reading the board…" />
        ) : (
          <p className="mt-10 text-sm text-muted">
            {stage !== "all" ? markets.emptyStage : markets.emptyMemes}
          </p>
        )
      ) : (
        <div className="card-well mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-normal">{markets.columns.meme}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.vol24h}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.price}</th>
                <th className="py-3 pr-4 font-normal">{markets.columns.marketcap}</th>
                <th className="py-3 pl-4 pr-4 font-normal" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.address}
                  className="group cursor-pointer border-b border-line last:border-0 hover:bg-[#323232]"
                  {...clickableRow(row.token_path, router)}
                >
                  <td className="px-4 py-4">
                    <Link href={row.token_path} className="flex items-center gap-3">
                      <Avatar label={row.symbol ?? "???"} size="md" />
                      <span>
                        <span className="block font-semibold">{row.symbol ?? "???"}</span>
                        {row.name ? <span className="block text-xs text-muted">{row.name}</span> : null}
                      </span>
                      <StageChip stage={row.stage} />
                    </Link>
                  </td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.volume_usd_24h)}</td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdg(row.price_usdg, 6)}</td>
                  <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.marketcap_usdg)}</td>
                  <td className="py-4 pl-4 pr-4 font-mono text-xs text-muted">{row.quote ?? ""}</td>
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
              onPage={(p) => void load(hideDead, p, stage)}
            />
            {asOf ? <p className="font-mono text-[11px] text-muted">{asOfLabel(asOf)}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
