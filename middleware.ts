import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const stock = pathname.match(/^\/s\/([^/]+)\/?$/);
  if (stock) {
    const ticker = stock[1];
    const upper = ticker.toUpperCase();
    if (ticker !== upper) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${upper}`;
      return NextResponse.redirect(url);
    }
  }

  const legacy = pathname.match(/^\/token\/([^/]+)\/?$/);
  if (legacy) {
    const url = request.nextUrl.clone();
    url.pathname = `/t/${legacy[1].toLowerCase()}`;
    return NextResponse.redirect(url);
  }

  const token = pathname.match(/^\/t\/([^/]+)\/?$/);
  if (token) {
    const address = token[1];
    const lower = address.toLowerCase();
    if (address !== lower) {
      const url = request.nextUrl.clone();
      url.pathname = `/t/${lower}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/s/:path*", "/t/:path*", "/token/:path*"],
};
