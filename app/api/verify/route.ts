import { NextResponse } from "next/server";
import { loadVerify } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  const data = await loadVerify(address);
  if (!data) {
    return NextResponse.json(
      { error: { message: "Need a 0x address, 40 hex chars." } },
      { status: 400 },
    );
  }
  return NextResponse.json(data);
}
