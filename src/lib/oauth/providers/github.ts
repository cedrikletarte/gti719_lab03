import type { OAuthProviderConfig, OAuthUserInfo } from "@/lib/oauth/types";

type GitHubUserInfo = {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url?: string;
};

export const githubProvider: OAuthProviderConfig = {
  id: "github",
  displayName: "GitHub",
  clientIdEnv: "GITHUB_CLIENT_ID",
  clientSecretEnv: "GITHUB_CLIENT_SECRET",
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  userinfoEndpoint: "https://api.github.com/user",
  scope: "read:user user:email",
  usePkce: true,
  mapUserInfo(raw: unknown): OAuthUserInfo {
    const data = raw as GitHubUserInfo;
    return {
      provider: "github",
      providerAccountId: String(data.id),
      email: data.email ?? null,
      name: data.name ?? data.login,
      avatarUrl: data.avatar_url ?? null,
    };
  },
};
