import { NextResponse } from "next/server";
import { API_ERROR_MESSAGE } from "@/types";
import { loadStock } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  if (ticker !== upper) {
    return NextResponse.redirect(new URL(`/api/stocks/${upper}`, request.url));
  }
  const url = new URL(request.url);
  const hideDead = url.searchParams.get("hide_dead") !== "0";
  const holders = url.searchParams.get("holders") === "1";
  const page = Number(url.searchParams.get("page") ?? "1");
  const stock = await loadStock(upper, {
    hide_dead: hideDead,
    holders,
    page: Number.isFinite(page) ? page : 1,
    page_size: 10,
  });
  if (!stock) {
    return NextResponse.json(
      { error: { code: "NOT_STOCK_TOKEN", message: API_ERROR_MESSAGE.NOT_STOCK_TOKEN } },
      { status: 404 },
    );
  }
  return NextResponse.json(stock);
}
