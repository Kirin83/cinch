"use client";

import { useState } from "react";
import { tokenPage } from "@/copy";
import type { GetTokenResponse, HolderRow } from "@/types";
import { Chip } from "@/components/Chip";
import { HoldersList } from "@/components/HoldersList";
import { LoadingInline } from "@/components/LoadingScreen";
import { formatUsdCompact, formatUsdg, launchpadLabel } from "@/lib/format";
import { StageChip } from "@/components/StageFilter";

export function TokenTabs({ data }: { data: GetTokenResponse }) {
  const [tab, setTab] = useState<"pools" | "holders">("pools");
  const [holders, setHolders] = useState<HolderRow[] | null>(data.people.holders);
  const [busy, setBusy] = useState(false);

  async function openHolders() {
    setTab("holders");
    if (holders != null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tokens/${data.token.address}?holders=1`);
      const body = (await res.json()) as GetTokenResponse;
      setHolders(body.people?.holders ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="seg w-fit font-mono text-sm">
        <button type="button" className="seg-item" data-active={tab === "pools"} onClick={() => setTab("pools")}>
          {tokenPage.pools} ({data.pools.length})
        </button>
        <button type="button" className="seg-item" data-active={tab === "holders"} onClick={() => void openHolders()}>
          {tokenPage.topHolders}
        </button>
      </div>

      {tab === "pools" ? (
        data.pools.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No pools indexed.</p>
        ) : (
          <div className="card-well mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-normal">{tokenPage.quote}</th>
                  <th className="py-3 pr-4 font-normal">{tokenPage.vol24h}</th>
                  <th className="py-3 pr-4 font-normal">{tokenPage.price}</th>
                  <th className="py-3 pr-4 font-normal">DEX</th>
                  <th className="py-3 pl-4 pr-4 font-normal" />
                </tr>
              </thead>
              <tbody>
                {data.pools.map((row) => (
                  <tr key={row.pool_address} className="border-b border-line last:border-0 hover:bg-[#323232]">
                    <td className="px-4 py-4 font-semibold">{row.quote}</td>
                    <td className="py-4 pr-4 font-mono num">{formatUsdCompact(row.volume_usd_24h)}</td>
                    <td className="py-4 pr-4 font-mono num">{formatUsdg(row.price_usdg, 6)}</td>
                    <td className="py-4 pr-4 text-muted">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{launchpadLabel(row.dex)}</span>
                        <StageChip stage={row.stage} />
                      </div>
                    </td>
                    <td className="py-4 pl-4 pr-4 font-mono text-xs">
                      {row.swap_urls?.dexscreener ? (
                        <a href={row.swap_urls.dexscreener} target="_blank" rel="noreferrer" className="text-spore">
                          Chart ↗
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : busy ? (
        <LoadingInline label="Reading holders…" />
      ) : holders && holders.length > 0 ? (
        <div className="mt-6">
          <HoldersList rows={holders} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">{tokenPage.topHolders}: not indexed.</p>
      )}
    </div>
  );
}
