import { NextResponse } from "next/server";
import { loadStocks } from "@/lib/queries";
import type { StockFilter, StockSort } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await loadStocks();
  const sort = (url.searchParams.get("sort") as StockSort) || data.sort;
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const filter = (url.searchParams.get("filter") as StockFilter) || "all";
  const hideEmpty = url.searchParams.get("hide_empty") === "1";

  let stocks = [...data.stocks];
  if (filter === "etf") stocks = stocks.filter((s) => s.asset_type === "etf");
  else if (filter !== "all") {
    stocks = stocks.filter((s) => s.sectors.includes(filter as "mega" | "meme_stocks" | "ai"));
  }
  if (hideEmpty) stocks = stocks.filter((s) => s.meme_pair_count > 0);

  stocks.sort((a, b) => {
    const dir = order === "asc" ? 1 : -1;
    if (sort === "meme_vol") return (a.meme_vol_24h_usd - b.meme_vol_24h_usd) * dir;
    if (sort === "premium") return ((a.premium_bps ?? 0) - (b.premium_bps ?? 0)) * dir;
    if (sort === "pairs") return (a.meme_pair_count - b.meme_pair_count) * dir;
    return (a.float_locked_pct - b.float_locked_pct) * dir;
  });

  return NextResponse.json({
    ...data,
    sort,
    order,
    filter,
    hide_empty: hideEmpty,
    stocks,
  });
}
