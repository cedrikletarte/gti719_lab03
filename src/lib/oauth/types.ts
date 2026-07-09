export type OAuthUserInfo = {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type OAuthProviderConfig = {
  id: string;
  displayName: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scope: string;
  usePkce: boolean;
  authorizationParams?: Record<string, string>;
  mapUserInfo: (raw: unknown) => OAuthUserInfo;
};
