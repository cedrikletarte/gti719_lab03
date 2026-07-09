import type { OAuthProviderConfig, OAuthUserInfo } from "@/lib/oauth/types";

const IDPERSO_BASE_URL = process.env.IDPERSO_BASE_URL ?? "http://localhost:4000";

type IdpersoUserInfo = {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

export const idpersoProvider: OAuthProviderConfig = {
  id: "idperso",
  displayName: "IDPERSO",
  clientIdEnv: "IDPERSO_CLIENT_ID",
  clientSecretEnv: "IDPERSO_CLIENT_SECRET",
  authorizationEndpoint: `${IDPERSO_BASE_URL}/oauth/authorize`,
  tokenEndpoint: `${IDPERSO_BASE_URL}/oauth/token`,
  userinfoEndpoint: `${IDPERSO_BASE_URL}/oauth/userinfo`,
  scope: "openid profile email",
  usePkce: true,
  mapUserInfo(raw: unknown): OAuthUserInfo {
    const data = raw as IdpersoUserInfo;
    return {
      provider: "idperso",
      providerAccountId: data.sub,
      email: data.email ?? null,
      name: data.name ?? null,
      avatarUrl: data.picture ?? null,
    };
  },
};
