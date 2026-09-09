import { NextResponse } from "next/server";
import { loadMemes } from "@/lib/queries";
import { parseMarketStage } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hideDead = url.searchParams.get("hide_dead") !== "0";
  const page = Number(url.searchParams.get("page") ?? "1");
  return NextResponse.json(
    await loadMemes({
      hide_dead: hideDead,
      stage: parseMarketStage(url.searchParams.get("stage")),
      page: Number.isFinite(page) ? page : 1,
      page_size: 20,
    }),
  );
}
