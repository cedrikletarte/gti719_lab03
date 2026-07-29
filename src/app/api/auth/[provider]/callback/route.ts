import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getProvider } from "@/lib/oauth/providers";
import { exchangeCodeForToken, fetchUserInfo } from "@/lib/oauth/client";
import { OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions, verifyOAuthState } from "@/lib/oauth/state";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";
import { env } from "@/lib/env";
import { fingerprint, masked } from "@/lib/oauth/logging";

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
    console.warn(`[OAuth][${provider.id}] Autorisation refusée par l'utilisateur`);
    return loginRedirect(request, "oauth_denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME);

  console.info(
    `[OAuth][${provider.id}] 2/6 Retour du fournisseur avec un code d'autorisation`
  );
  if (code) {
    console.info(
      `  callback = ${request.nextUrl.origin}${request.nextUrl.pathname}?code=[masqué]&state=[masqué]`
    );
    console.info(
      `  code reçu = ${masked(code)} (${code.length} caractères, sha256:${fingerprint(code)})`
    );
  }

  if (!code || !state || !stateCookie) {
    console.warn(`[OAuth][${provider.id}] Callback refusé : état absent ou déjà consommé`);
    return loginRedirect(request, "expired");
  }

  const statePayload = verifyOAuthState(stateCookie.value, provider.id);
  if (!statePayload || !safeEqual(statePayload.state, state)) {
    console.warn(`[OAuth][${provider.id}] Callback refusé : état OAuth invalide`);
    return loginRedirect(request, "expired");
  }

  console.info(`[OAuth][${provider.id}] 3/6 État OAuth et PKCE validés`);

  const redirectUri = `${env.APP_BASE_URL}/api/auth/${provider.id}/callback`;

  try {
    console.info(
      `[OAuth][${provider.id}] 4/6 Échange serveur-à-serveur du code contre un jeton d'accès`
    );
    const { accessToken } = await exchangeCodeForToken(provider, {
      code,
      redirectUri,
      codeVerifier: statePayload.codeVerifier,
    });
    console.info(`[OAuth][${provider.id}] Échange du code réussi`);

    console.info(`[OAuth][${provider.id}] 5/6 Accès à la ressource userinfo protégée`);
    const userInfo = await fetchUserInfo(provider, accessToken);
    console.info(`[OAuth][${provider.id}] Profil utilisateur reçu`);

    const sessionToken = createSessionToken(userInfo);

    console.info(`[OAuth][${provider.id}] 6/6 Session créée; redirection vers /profile`);
    console.info(
      `  Set-Cookie = ${SESSION_COOKIE_NAME}=[sha256:${fingerprint(sessionToken)}]`
    );
    console.info(
      `  HttpOnly=${sessionCookieOptions.httpOnly}; SameSite=${sessionCookieOptions.sameSite}; ` +
        `Secure=${sessionCookieOptions.secure}; Max-Age=${sessionCookieOptions.maxAge}`
    );
    console.info(`  Location = ${env.APP_BASE_URL}/profile`);

    const response = NextResponse.redirect(new URL("/profile", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", { ...oauthStateCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur OAuth inconnue";
    console.error(`[OAuth][${provider.id}] Échec du flux : ${message}`);
    return loginRedirect(request, "oauth_failed");
  }
}
