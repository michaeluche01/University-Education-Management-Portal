import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/server/auth/jwt";

const PORTAL_PREFIXES = [
  "/student",
  "/lecturer",
  "/dept-admin",
  "/super-admin",
];

/**
 * Next.js 16 Proxy convention (UX-only route guard).
 * Verifies only the JWT signature without any database call.
 * Real authorization is enforced server-side via requireRole(...) in each role's layout.tsx and API handler.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPortalRoute = PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isPortalRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifySessionToken(token);
  if (!payload?.sub) {
    const clearUrl = new URL("/api/v1/auth/clear-session", request.url);
    return NextResponse.redirect(clearUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/lecturer/:path*",
    "/dept-admin/:path*",
    "/super-admin/:path*",
  ],
};

