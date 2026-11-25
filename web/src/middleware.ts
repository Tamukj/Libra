import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_SALT = "libra-clinical-v1";

function signSession(ts: string): string {
  let h = 2166136261;
  const input = `${SESSION_SALT}:${ts}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{10,15}$/.test(parts[1])) {
    return false;
  }
  return parts[2] === signSession(parts[1]);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal")) {
    const sessionToken = request.cookies.get("libra_session")?.value;
    if (!isValidSessionToken(sessionToken)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};
