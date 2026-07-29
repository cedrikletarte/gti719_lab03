import { requireEnv } from "@/lib/env";
import type { OAuthProviderConfig, OAuthUserInfo } from "@/lib/oauth/types";
import { fingerprint, masked } from "@/lib/oauth/logging";

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

  console.info(`[OAuth][${config.id}] Requête réelle vers le endpoint token :`);
  console.info(`  POST ${config.tokenEndpoint}`);
  console.info("  Content-Type = application/x-www-form-urlencoded");
  console.info(`  grant_type = authorization_code`);
  console.info(`  redirect_uri = ${params.redirectUri}`);
  console.info(
    `  code = ${masked(params.code)} (${params.code.length} caractères, sha256:${fingerprint(params.code)})`
  );
  console.info(`  code_verifier PKCE présent = ${Boolean(params.codeVerifier)}`);
  console.info("  client_secret présent = true (valeur volontairement masquée)");

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });

  console.info(
    `[OAuth][${config.id}] Réponse du endpoint token : HTTP ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    throw new Error(`Token exchange failed for provider "${config.id}": ${response.status}`);
  }

  const json = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error(`Token exchange response for provider "${config.id}" had no access_token`);
  }

  console.info(`  token_type = ${json.token_type ?? "non indiqué"}`);
  console.info(`  scope = ${json.scope ?? "non indiqué dans la réponse"}`);
  console.info(`  expires_in = ${json.expires_in ?? "non indiqué"} secondes`);
  console.info(
    `  access_token reçu = ${masked(json.access_token)} ` +
      `(${json.access_token.length} caractères, sha256:${fingerprint(json.access_token)})`
  );

  return { accessToken: json.access_token };
}

export async function fetchUserInfo(
  config: OAuthProviderConfig,
  accessToken: string
): Promise<OAuthUserInfo> {
  console.info(`[OAuth][${config.id}] Requête réelle vers la ressource protégée :`);
  console.info(`  GET ${config.userinfoEndpoint}`);
  console.info(
    `  Authorization = Bearer ${masked(accessToken)} (sha256:${fingerprint(accessToken)})`
  );

  const response = await fetch(config.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  console.info(
    `[OAuth][${config.id}] Réponse de userinfo : HTTP ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    throw new Error(`Userinfo fetch failed for provider "${config.id}": ${response.status}`);
  }

  const raw = await response.json();
  const userInfo = config.mapUserInfo(raw);
  console.info(`  providerAccountId = ${userInfo.providerAccountId}`);
  console.info(`  email = ${userInfo.email ?? "non fourni"}`);
  console.info(`  name = ${userInfo.name ?? "non fourni"}`);
  return userInfo;
}
