import { Suspense } from "react";
import { loadPairs } from "@/lib/queries";
import { parseMarketStage } from "@/types";
import { MarketsBoard } from "@/components/MarketsBoard";
import { LoadingInline } from "@/components/LoadingScreen";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stage?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadPairs({
    quality: "canonical",
    sort: "vol24h",
    hide_dead: true,
    stage: parseMarketStage(sp.stage),
  });
  return (
    <Suspense fallback={<LoadingInline label="Reading the board…" />}>
      <MarketsBoard pairs={data} />
    </Suspense>
  );
}
