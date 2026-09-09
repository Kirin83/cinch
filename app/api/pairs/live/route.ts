import { NextResponse } from "next/server";
import { loadLive } from "@/lib/queries";
import { parseMarketStage } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker") ?? undefined;
  const canonicalOnly = url.searchParams.get("canonical_only") !== "0";
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  return NextResponse.json(
    await loadLive({
      ticker,
      canonical_only: canonicalOnly,
      stage: parseMarketStage(url.searchParams.get("stage")),
      page: Number.isFinite(page) ? page : 1,
      page_size: Number.isFinite(pageSize) ? pageSize : 20,
    }),
  );
}
