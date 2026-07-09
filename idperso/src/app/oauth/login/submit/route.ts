import { NextRequest, NextResponse } from "next/server";
import { findUserByUsername, verifyPassword } from "@/lib/users/store";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { safeReturnTo } from "@/lib/returnTo";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const returnTo = safeReturnTo(form.get("return_to")?.toString());

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(user, password)) {
    const url = new URL("/oauth/login", request.url);
    url.searchParams.set("error", "invalid_credentials");
    if (returnTo !== "/") url.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(url, 303);
  }

  const sessionToken = createSessionToken(user);
  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
  return response;
}
