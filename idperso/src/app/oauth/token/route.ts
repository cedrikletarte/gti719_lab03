import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { consumeAuthCode } from "@/lib/store/authCodes";
import { createAccessToken } from "@/lib/store/accessTokens";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const body = new URLSearchParams(await request.text());

  const grantType = body.get("grant_type");
  const code = body.get("code");
  const redirectUri = body.get("redirect_uri");
  const clientId = body.get("client_id");
  const clientSecret = body.get("client_secret");
  const codeVerifier = body.get("code_verifier");

  if (grantType !== "authorization_code" || !code || !redirectUri || !clientId || !clientSecret) {
    return errorResponse("invalid_request", 400);
  }

  if (clientId !== env.MONSITE_CLIENT_ID || !safeEqual(clientSecret, env.MONSITE_CLIENT_SECRET)) {
    return errorResponse("invalid_client", 401);
  }

  const result = consumeAuthCode(code);
  if (!result.ok) {
    console.warn(`[idperso] token exchange rejected: ${result.reason}`);
    return errorResponse("invalid_grant", 400);
  }

  const { record } = result;
  if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
    return errorResponse("invalid_grant", 400);
  }

  if (record.codeChallenge) {
    if (!codeVerifier) {
      return errorResponse("invalid_grant", 400);
    }
    const computedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (!safeEqual(computedChallenge, record.codeChallenge)) {
      return errorResponse("invalid_grant", 400);
    }
  }

  const { token, expiresIn } = createAccessToken({
    userId: record.userId,
    clientId: record.clientId,
    scope: record.scope,
  });

  return NextResponse.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: record.scope,
  });
}
