"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { markets } from "@/copy";
import type { GetPairsResponse } from "@/types";
import { parseMarketStage } from "@/types";
import { PairsTable } from "@/components/PairsTable";
import { StockBoardTable } from "@/components/StockBoardTable";
import { MemeBoardTable } from "@/components/MemeBoardTable";

type Tab = "pair" | "stock" | "meme";

export function MarketsBoard({ pairs }: { pairs: GetPairsResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "stock" || raw === "meme" ? raw : "pair";
  const stage = parseMarketStage(params.get("stage"));

  function replaceQs(mutate: (qs: URLSearchParams) => void) {
    const qs = new URLSearchParams(params.toString());
    mutate(qs);
    const suffix = qs.toString();
    router.replace(suffix ? `/?${suffix}` : "/", { scroll: false });
  }

  function setTab(next: Tab) {
    replaceQs((qs) => {
      if (next === "pair") qs.delete("tab");
      else qs.set("tab", next);
    });
  }

  function setStage(next: typeof stage) {
    replaceQs((qs) => {
      if (next === "all") qs.delete("stage");
      else qs.set("stage", next);
    });
  }

  return (
    <div>
      <div className="seg">
        {(["pair", "stock", "meme"] as const).map((id) => (
          <button
            key={id}
            type="button"
            data-active={tab === id}
            className="seg-item"
            onClick={() => setTab(id)}
          >
            {markets.tabs[id]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "stock" ? (
          <StockBoardTable />
        ) : tab === "meme" ? (
          <MemeBoardTable stage={stage} onStage={setStage} />
        ) : (
          <PairsTable
            rows={pairs.pairs}
            asOf={pairs.indexer.head}
            total={pairs.pairs_total}
            page={pairs.page}
            pageSize={pairs.page_size}
            stage={stage}
            ssrStage={pairs.stage}
            onStage={setStage}
          />
        )}
      </div>
    </div>
  );
}
