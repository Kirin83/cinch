import { NextResponse } from "next/server";
import { loadMarketStocks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hideDead = url.searchParams.get("hide_dead") !== "0";
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("page_size") ?? "20");
  return NextResponse.json(
    await loadMarketStocks({
      hide_dead: hideDead,
      page: Number.isFinite(page) ? page : 1,
      page_size: Number.isFinite(pageSize) ? pageSize : 20,
    }),
  );
}
