"use client";

import { useMemo, useState } from "react";
import type { HolderRow } from "@/types";
import { Pager } from "@/components/Pager";
import { explorerAddress } from "@/lib/chain";
import { formatAddress, formatAmount, formatPct } from "@/lib/format";

const PAGE_SIZE = 10;

function holderRank(a: HolderRow, b: HolderRow) {
  const pa = a.pct_of_supply || 0;
  const pb = b.pct_of_supply || 0;
  if (pb !== pa) return pb - pa;
  try {
    const ba = BigInt(a.balance.raw || "0");
    const bb = BigInt(b.balance.raw || "0");
    if (bb > ba) return 1;
    if (bb < ba) return -1;
  } catch {
    /* ignore */
  }
  return 0;
}

export function HoldersList({
  rows,
  variant = "well",
}: {
  rows: HolderRow[];
  variant?: "well" | "plain";
}) {
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...rows].sort(holderRank), [rows]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (sorted.length === 0) {
    return <p className="mt-6 text-sm text-muted">No holders returned.</p>;
  }

  return (
    <div>
      <ul
        className={
          variant === "well"
            ? "card-well mt-4 space-y-2 px-4 py-3 font-mono text-sm"
            : "mt-4 space-y-2 font-mono text-sm"
        }
      >
        {slice.map((h) => (
          <li key={h.address} className="flex flex-wrap items-baseline justify-between gap-2">
            <a
              href={explorerAddress(h.address)}
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              {formatAddress(h.address)}
              {h.is_pool ? <span className="ml-2 text-[11px] text-muted">POOL</span> : null}
            </a>
            <span>
              {h.pct_of_supply > 0
                ? formatPct(h.pct_of_supply)
                : formatAmount(h.balance.amount, h.balance.symbol)}
            </span>
          </li>
        ))}
      </ul>
      <Pager page={safePage} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} />
    </div>
  );
}
