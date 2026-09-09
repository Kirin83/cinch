"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markets } from "@/copy";
import { routes } from "@/routes";
import type { GetHomeSummaryResponse, HomeMemeHit, MarketStage, MarketStockRow, PairBoardRow } from "@/types";
import { stockLogoUrls } from "@/lib/avatars";
import { asOfLabel, formatUsdCompact, qualityLabel } from "@/lib/format";
import { Avatar, PairNames } from "@/components/Avatar";
import { Chip } from "@/components/Chip";
import { StageChip, StageFilter } from "@/components/StageFilter";
import { clickableRow } from "@/components/clickableRow";

export function HomeDashboard({ data }: { data: GetHomeSummaryResponse }) {
  const router = useRouter();
  const { stats } = data;
  const [stage, setStage] = useState<MarketStage>(data.stage);
  const [top, setTop] = useState(data.top);
  const [busy, setBusy] = useState(false);
  const tape: { label: string; value: string }[] = [
    { label: "Live canonical", value: stats.live_canonical.toLocaleString("en-US") },
    { label: "Vol 24h", value: formatUsdCompact(stats.volume_usd_24h) },
  ];
  if (stats.new_pairs_24h != null) {
    tape.push({ label: "New 24h", value: stats.new_pairs_24h.toLocaleString("en-US") });
  }
  if (stats.fake_count != null) {
    tape.push({ label: "Fakes", value: stats.fake_count.toLocaleString("en-US") });
  }

  async function onStage(next: MarketStage) {
    setStage(next);
    setBusy(true);
    const qs = next === "all" ? "" : `?stage=${next}`;
    window.history.replaceState(null, "", `${routes.analytics}${qs}`);
    try {
      const res = await fetch(`/api/home/summary${qs}`);
      const body = (await res.json()) as GetHomeSummaryResponse;
      setTop(body.top ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">{markets.title}</h1>

      <div className="mt-6 flex flex-wrap gap-3">
        {tape.map((item) => (
          <div key={item.label} className="card-well min-w-[8rem] flex-1 px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{item.label}</p>
            <p className="mt-1 font-mono text-lg num">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
        <PairTopCard title={markets.homeTopVol} rows={data.top_pairs} />
        <StockTopCard title={markets.homeTopVolStock} rows={data.top_stocks} />
        <MemeTopCard title={markets.homeTopVolMeme} rows={data.top_memes} />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl tracking-tight">{markets.homeTop25}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <StageFilter value={stage} busy={busy} onChange={onStage} />
            <Link href={routes.home} className="text-sm text-spore hover:underline">
              Full list
            </Link>
          </div>
        </div>
        {stage === "graduated" ? (
          <p className="mt-2 text-xs text-muted">{markets.graduatedQuiet}</p>
        ) : null}
        {top.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            {stage === "all" ? markets.emptyChain : markets.emptyStage}
          </p>
        ) : (
          <div className="card-well mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-normal">{markets.columns.pair}</th>
                  <th className="py-3 pr-4 font-normal">{markets.columns.memeVol24h}</th>
                  <th className="py-3 pl-4 pr-4 font-normal" />
                </tr>
              </thead>
              <tbody>
                {top.map((row) => (
                  <tr
                    key={row.pool_address}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-[#323232]"
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
                    <td className="py-4 pl-4 pr-4">
                      <Link href={row.stock_path} className="font-mono text-xs text-spore">
                        {row.stock.ticker} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 font-mono text-[11px] text-muted">{asOfLabel(data.indexer.head)}</p>
    </div>
  );
}

function PairTopCard({ title, rows }: { title: string; rows: PairBoardRow[] }) {
  return (
    <div className="card-well min-w-[16rem] flex-1 snap-start px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.pool_address}>
              <Link href={row.token_path} className="flex items-center gap-3">
                <PairNames
                  tokenLabel={row.meme.symbol ?? "???"}
                  stockSrc={stockLogoUrls(row.stock.ticker)}
                  stockLabel={row.stock.ticker}
                  size="sm"
                />
                <span className="ml-auto font-mono text-sm num">{formatUsdCompact(row.volume_usd_24h)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StockTopCard({ title, rows }: { title: string; rows: MarketStockRow[] }) {
  return (
    <div className="card-well min-w-[16rem] flex-1 snap-start px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.ticker}>
              <Link href={row.stock_path} className="flex items-center gap-3">
                <Avatar src={stockLogoUrls(row.ticker)} label={row.ticker} size="sm" />
                <span className="text-sm font-medium">{row.ticker}</span>
                <span className="ml-auto font-mono text-sm num">{formatUsdCompact(row.volume_usd_24h)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MemeTopCard({ title, rows }: { title: string; rows: HomeMemeHit[] }) {
  return (
    <div className="card-well min-w-[16rem] flex-1 snap-start px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((row) => (
            <li key={row.address}>
              <Link href={row.token_path} className="flex items-center gap-3">
                <span className="text-sm font-medium">{row.symbol ?? "???"}</span>
                <span className="ml-auto font-mono text-sm num">{formatUsdCompact(row.volume_usd_24h)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
