import { NextResponse } from "next/server";
import { loadHomeSummary } from "@/lib/queries";
import { parseMarketStage } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const stage = parseMarketStage(new URL(request.url).searchParams.get("stage"));
  return NextResponse.json(await loadHomeSummary({ stage }));
}
