import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getProvider } from "@/lib/oauth/providers";
import { buildAuthorizationUrl } from "@/lib/oauth/client";
import { createPkcePair } from "@/lib/oauth/pkce";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions } from "@/lib/oauth/state";
import { env } from "@/lib/env";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) notFound();

  const { codeVerifier, codeChallenge } = createPkcePair();
  const { token, state } = createOAuthState(provider.id, codeVerifier);

  const redirectUri = `${env.APP_BASE_URL}/api/auth/${provider.id}/callback`;
  const authorizationUrl = buildAuthorizationUrl(provider, {
    state,
    redirectUri,
    codeChallenge,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, token, oauthStateCookieOptions);
  return response;
}
