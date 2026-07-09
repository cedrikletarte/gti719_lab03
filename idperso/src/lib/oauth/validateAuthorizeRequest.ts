import { env } from "@/lib/env";

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  scope: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
};

export type AuthorizeValidation =
  | { ok: true; params: AuthorizeParams }
  // Cannot safely redirect anywhere — client_id or redirect_uri itself is untrusted.
  | { ok: false; kind: "fatal"; message: string }
  // redirect_uri IS trusted at this point, safe to redirect the error back to it.
  | { ok: false; kind: "redirect_error"; error: string; redirectUri: string; state: string | null };

export function validateAuthorizeRequest(query: URLSearchParams): AuthorizeValidation {
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");

  if (clientId !== env.MONSITE_CLIENT_ID) {
    return { ok: false, kind: "fatal", message: "client_id inconnu" };
  }
  if (redirectUri !== env.MONSITE_REDIRECT_URI) {
    return { ok: false, kind: "fatal", message: "redirect_uri non enregistré pour ce client" };
  }

  const state = query.get("state");
  const responseType = query.get("response_type");
  const codeChallengeMethod = query.get("code_challenge_method");

  if (responseType !== "code") {
    return { ok: false, kind: "redirect_error", error: "unsupported_response_type", redirectUri, state };
  }
  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return { ok: false, kind: "redirect_error", error: "invalid_request", redirectUri, state };
  }

  return {
    ok: true,
    params: {
      clientId,
      redirectUri,
      scope: query.get("scope"),
      state,
      codeChallenge: query.get("code_challenge"),
      codeChallengeMethod,
    },
  };
}
