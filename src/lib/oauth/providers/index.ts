import type { OAuthProviderConfig } from "@/lib/oauth/types";
import { googleProvider } from "@/lib/oauth/providers/google";
import { githubProvider } from "@/lib/oauth/providers/github";
import { idpersoProvider } from "@/lib/oauth/providers/idperso";

const providers: Record<string, OAuthProviderConfig> = {
  google: googleProvider,
  github: githubProvider,
  idperso: idpersoProvider,
};

export function getProvider(id: string): OAuthProviderConfig | undefined {
  return providers[id];
}

export function listProviders(): OAuthProviderConfig[] {
  return Object.values(providers);
}
