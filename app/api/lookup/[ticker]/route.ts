import { NextResponse } from "next/server";
import { API_ERROR_MESSAGE } from "@/types";
import { loadLookup } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const data = await loadLookup(ticker);
  if (!data) {
    return NextResponse.json(
      { error: { code: "NOT_IN_REGISTRY", message: API_ERROR_MESSAGE.NOT_IN_REGISTRY } },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}
