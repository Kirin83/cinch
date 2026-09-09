"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { live as copy, markets } from "@/copy";
import type { GetLivePairsResponse, LivePairRow, MarketStage } from "@/types";
import { Chip } from "@/components/Chip";
import { PairNames } from "@/components/Avatar";
import { Pager } from "@/components/Pager";
import { StageFilter, StageChip } from "@/components/StageFilter";
import { stockLogoUrls } from "@/lib/avatars";
import { formatAge, launchpadLabel, qualityLabel } from "@/lib/format";
import { isMemeCanonical } from "@/lib/classify";

const PAGE_SIZE = 20;
const quick = ["NVDA", "AMC", "HIMS", "GME", "SPY"] as const;

async function fetchLive(opts: {
  ticker: string | null;
  canonicalOnly: boolean;
  stage: MarketStage;
  page: number;
}): Promise<GetLivePairsResponse> {
  const qs = new URLSearchParams({
    canonical_only: opts.canonicalOnly ? "1" : "0",
    stage: opts.stage,
    page: String(opts.page),
    page_size: String(PAGE_SIZE),
  });
  if (opts.ticker) qs.set("ticker", opts.ticker);
  const res = await fetch(`/api/pairs/live?${qs}`);
  if (!res.ok) throw new Error(`live ${res.status}`);
  return (await res.json()) as GetLivePairsResponse;
}

export function LiveFeed() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [canonicalOnly, setCanonicalOnly] = useState(true);
  const [stage, setStage] = useState<MarketStage>("all");
  const [pairs, setPairs] = useState<LivePairRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const req = useRef(0);

  async function load(
    nextTicker: string | null,
    nextCanonical: boolean,
    nextStage: MarketStage,
    nextPage: number,
  ) {
    const id = ++req.current;
    setBusy(true);
    try {
      const data = await fetchLive({
        ticker: nextTicker,
        canonicalOnly: nextCanonical,
        stage: nextStage,
        page: nextPage,
      });
      if (id !== req.current) return;
      setPairs(data.pairs ?? []);
      setHasMore(Boolean(data.has_more));
      setPage(data.page ?? nextPage);
    } catch {
      if (id !== req.current) return;
    } finally {
      if (id === req.current) setBusy(false);
    }
  }

  useEffect(() => {
    void load(null, true, "all", 1);
  }, []);

  const locked = busy && pairs.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="seg">
        <button
          type="button"
          className="seg-item"
          data-active={ticker == null}
          disabled={locked}
          onClick={() => {
            setTicker(null);
            void load(null, canonicalOnly, stage, 1);
          }}
        >
          {copy.allStocks}
        </button>
        {quick.map((t) => (
          <button
            key={t}
            type="button"
            className="seg-item"
            data-active={ticker === t}
            disabled={locked}
            onClick={() => {
              setTicker(t);
              void load(t, canonicalOnly, stage, 1);
            }}
          >
            {t}
          </button>
        ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={canonicalOnly}
            disabled={locked}
            onChange={(e) => {
              const checked = e.target.checked;
              setCanonicalOnly(checked);
              void load(ticker, checked, stage, 1);
            }}
          />
          {copy.canonicalOnly}
        </label>
      </div>
      <div className="mt-3">
        <StageFilter
          value={stage}
          busy={locked}
          onChange={(next) => {
            setStage(next);
            void load(ticker, canonicalOnly, next, 1);
          }}
        />
      </div>

      {pairs.length === 0 && busy ? (
        <LiveSkeleton />
      ) : pairs.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          {stage !== "all" ? markets.emptyStage : copy.empty}
        </p>
      ) : (
        <>
          <ul className={`mt-6 space-y-2 ${busy ? "opacity-70" : ""}`}>
            {pairs.map((row, i) => (
              <li key={`${row.pool_address}-${i}`}>
                <Link
                  href={row.token_path}
                  className="card-well flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-[#323232]"
                >
                  <span className="w-10 font-mono text-xs text-muted">{formatAge(row.age_seconds)}</span>
                  <PairNames
                    tokenLabel={row.meme.symbol ?? "???"}
                    stockSrc={stockLogoUrls(row.quote.ticker)}
                    stockLabel={row.quote.ticker}
                    size="sm"
                  />
                  <Chip kind={row.pair_quality}>{qualityLabel(row.pair_quality)}</Chip>
                  <StageChip stage={row.stage} />
                  {isMemeCanonical(row.pair_quality) ? (
                    <span className="text-xs text-muted">{launchpadLabel(row.launchpad)}</span>
                  ) : (
                    <span className="text-xs text-muted">{copy.notOfficial}</span>
                  )}
                  <span className="ml-auto font-mono text-xs text-spore">{copy.open}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            hasMore={hasMore}
            busy={busy}
            onPage={(p) => void load(ticker, canonicalOnly, stage, p)}
          />
        </>
      )}
    </div>
  );
}

function LiveSkeleton() {
  return (
    <ul className="mt-6 space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="card-well px-4 py-3">
          <div className="load-skel h-6 w-full" style={{ animationDelay: `${i * 60}ms` }} />
        </li>
      ))}
    </ul>
  );
}
