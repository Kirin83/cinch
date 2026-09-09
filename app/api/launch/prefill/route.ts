import { NextResponse } from "next/server";
import { API_ERROR_MESSAGE } from "@/types";
import { loadLaunchPrefill } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get("ticker") ?? "";
  const prefill = await loadLaunchPrefill(ticker);
  if (!prefill) {
    return NextResponse.json(
      { error: { code: "NOT_IN_REGISTRY", message: API_ERROR_MESSAGE.NOT_IN_REGISTRY } },
      { status: 404 },
    );
  }
  return NextResponse.json(prefill);
}
