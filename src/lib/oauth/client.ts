import { requireEnv } from "@/lib/env";
import type { OAuthProviderConfig, OAuthUserInfo } from "@/lib/oauth/types";

const USER_AGENT = "monsite-oauth-client";

export function buildAuthorizationUrl(
  config: OAuthProviderConfig,
  params: { state: string; redirectUri: string; codeChallenge?: string }
): string {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", requireEnv(config.clientIdEnv));
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", params.state);

  if (config.usePkce && params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  for (const [key, value] of Object.entries(config.authorizationParams ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export async function exchangeCodeForToken(
  config: OAuthProviderConfig,
  params: { code: string; redirectUri: string; codeVerifier?: string }
): Promise<{ accessToken: string }> {
  const body = new URLSearchParams({
    client_id: requireEnv(config.clientIdEnv),
    client_secret: requireEnv(config.clientSecretEnv),
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  if (config.usePkce && params.codeVerifier) {
    body.set("code_verifier", params.codeVerifier);
  }

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed for provider "${config.id}": ${response.status}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error(`Token exchange response for provider "${config.id}" had no access_token`);
  }

  return { accessToken: json.access_token };
}

export async function fetchUserInfo(
  config: OAuthProviderConfig,
  accessToken: string
): Promise<OAuthUserInfo> {
  const response = await fetch(config.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Userinfo fetch failed for provider "${config.id}": ${response.status}`);
  }

  const raw = await response.json();
  return config.mapUserInfo(raw);
}
