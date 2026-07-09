import type { OAuthProviderConfig, OAuthUserInfo } from "@/lib/oauth/types";

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export const googleProvider: OAuthProviderConfig = {
  id: "google",
  displayName: "Google",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userinfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
  scope: "openid email profile",
  usePkce: true,
  authorizationParams: {
    access_type: "online",
    prompt: "select_account",
  },
  mapUserInfo(raw: unknown): OAuthUserInfo {
    const data = raw as GoogleUserInfo;
    return {
      provider: "google",
      providerAccountId: data.sub,
      email: data.email ?? null,
      name: data.name ?? null,
      avatarUrl: data.picture ?? null,
    };
  },
};
