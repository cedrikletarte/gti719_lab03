import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getProvider } from "@/lib/oauth/providers";
import { exchangeCodeForToken, fetchUserInfo } from "@/lib/oauth/client";
import { OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions, verifyOAuthState } from "@/lib/oauth/state";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { env } from "@/lib/env";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function loginRedirect(request: NextRequest, error: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  // Always clear the one-time state cookie, on both success and failure paths,
  // so a replayed callback URL can never reach the token exchange a second time.
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", { ...oauthStateCookieOptions, maxAge: 0 });
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) notFound();

  const idpError = request.nextUrl.searchParams.get("error");
  if (idpError) {
    return loginRedirect(request, "oauth_denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME);

  if (!code || !state || !stateCookie) {
    return loginRedirect(request, "expired");
  }

  const statePayload = verifyOAuthState(stateCookie.value, provider.id);
  if (!statePayload || !safeEqual(statePayload.state, state)) {
    return loginRedirect(request, "expired");
  }

  const redirectUri = `${env.APP_BASE_URL}/api/auth/${provider.id}/callback`;

  try {
    const { accessToken } = await exchangeCodeForToken(provider, {
      code,
      redirectUri,
      codeVerifier: statePayload.codeVerifier,
    });
    const userInfo = await fetchUserInfo(provider, accessToken);
    const sessionToken = createSessionToken(userInfo);

    const response = NextResponse.redirect(new URL("/profile", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", { ...oauthStateCookieOptions, maxAge: 0 });
    return response;
  } catch {
    return loginRedirect(request, "oauth_failed");
  }
}
