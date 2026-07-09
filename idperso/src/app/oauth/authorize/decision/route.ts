import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { validateAuthorizeRequest } from "@/lib/oauth/validateAuthorizeRequest";
import { createAuthCode } from "@/lib/store/authCodes";

function buildErrorRedirectUrl(redirectUri: string, error: string, state: string | null): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const query = new URLSearchParams();
  for (const key of [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") query.set(key, value);
  }

  const validation = validateAuthorizeRequest(query);

  if (!validation.ok && validation.kind === "fatal") {
    return NextResponse.json({ error: "invalid_request", message: validation.message }, { status: 400 });
  }
  if (!validation.ok) {
    return NextResponse.redirect(
      buildErrorRedirectUrl(validation.redirectUri, validation.error, validation.state),
      303
    );
  }

  const { params } = validation;

  const session = readSession(request.cookies);
  if (!session) {
    return NextResponse.redirect(
      new URL(
        `/oauth/login?return_to=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`,
        request.url
      ),
      303
    );
  }

  const decision = form.get("decision");
  if (decision !== "approve") {
    return NextResponse.redirect(
      buildErrorRedirectUrl(params.redirectUri, "access_denied", params.state),
      303
    );
  }

  const code = createAuthCode({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    userId: session.sub,
    scope: params.scope ?? "",
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    state: params.state,
  });

  const redirectUrl = new URL(params.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (params.state) redirectUrl.searchParams.set("state", params.state);

  return NextResponse.redirect(redirectUrl, 303);
}
