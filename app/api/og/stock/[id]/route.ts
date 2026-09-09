import { NextResponse } from "next/server";
import { API_ERROR_MESSAGE } from "@/types";
import { loadOgStock } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const og = await loadOgStock(id);
  if (!og) {
    return NextResponse.json(
      { error: { code: "NOT_STOCK_TOKEN", message: API_ERROR_MESSAGE.NOT_STOCK_TOKEN } },
      { status: 404 },
    );
  }
  return NextResponse.json(og);
}
