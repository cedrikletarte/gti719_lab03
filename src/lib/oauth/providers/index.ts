import type { OAuthProviderConfig } from "@/lib/oauth/types";
import { googleProvider } from "@/lib/oauth/providers/google";
import { githubProvider } from "@/lib/oauth/providers/github";

const providers: Record<string, OAuthProviderConfig> = {
  google: googleProvider,
  github: githubProvider,
};

export function getProvider(id: string): OAuthProviderConfig | undefined {
  return providers[id];
}

export function listProviders(): OAuthProviderConfig[] {
  return Object.values(providers);
}
