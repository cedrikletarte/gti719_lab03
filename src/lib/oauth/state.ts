import { randomBytes } from "crypto";
import { signToken, verifyToken } from "@/lib/crypto/signedToken";

export const OAUTH_STATE_COOKIE_NAME = "monsite_oauth_state";
const STATE_MAX_AGE_SECONDS = 600; // 10 minutes

export type OAuthStatePayload = {
  provider: string;
  state: string;
  codeVerifier: string;
};

export function createOAuthState(
  provider: string,
  codeVerifier: string
): { token: string; state: string } {
  const state = randomBytes(32).toString("base64url");
  const token = signToken<OAuthStatePayload>(
    { provider, state, codeVerifier },
    STATE_MAX_AGE_SECONDS
  );
  return { token, state };
}

export function verifyOAuthState(token: string, provider: string): OAuthStatePayload | null {
  const payload = verifyToken<OAuthStatePayload>(token);
  if (!payload || payload.provider !== provider) return null;
  return payload;
}

export const oauthStateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: STATE_MAX_AGE_SECONDS,
};
