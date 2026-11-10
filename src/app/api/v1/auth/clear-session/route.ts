import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/jwt";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookie(response);
  return response;
}

