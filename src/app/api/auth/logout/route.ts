import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

function clearSession(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  return clearSession(request);
}

export async function POST(request: NextRequest) {
  return clearSession(request);
}
