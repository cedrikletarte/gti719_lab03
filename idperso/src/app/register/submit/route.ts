import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users/store";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { safeReturnTo } from "@/lib/returnTo";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const returnTo = safeReturnTo(form.get("return_to")?.toString());

  if (!username || !email || !password) {
    const url = new URL("/register", request.url);
    url.searchParams.set("error", "missing_fields");
    if (returnTo !== "/") url.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(url, 303);
  }

  try {
    const user = createUser(username, email, password);
    const sessionToken = createSessionToken(user);
    const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
    return response;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    const url = new URL("/register", request.url);
    url.searchParams.set("error", reason);
    if (returnTo !== "/") url.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(url, 303);
  }
}
