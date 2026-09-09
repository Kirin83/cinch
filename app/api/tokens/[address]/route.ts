import { NextResponse } from "next/server";
import { API_ERROR_MESSAGE } from "@/types";
import { loadToken } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const lower = address.toLowerCase();
  if (address !== lower) {
    return NextResponse.redirect(new URL(`/api/tokens/${lower}`, request.url));
  }
  const url = new URL(request.url);
  const holders = url.searchParams.get("holders") === "1";
  const token = await loadToken(lower, { holders });
  if (!token) {
    return NextResponse.json(
      { error: { code: "NOT_INDEXED", message: API_ERROR_MESSAGE.NOT_INDEXED } },
      { status: 404 },
    );
  }
  return NextResponse.json(token);
}
