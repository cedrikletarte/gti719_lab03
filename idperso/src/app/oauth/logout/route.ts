import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { safeReturnTo } from "@/lib/returnTo";

function clearSession(request: NextRequest): NextResponse {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("return_to"));
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  return clearSession(request);
}

export async function POST(request: NextRequest) {
  return clearSession(request);
}
