import { signToken, verifyToken } from "@/lib/crypto/signedToken";
import type { OAuthUserInfo } from "@/lib/oauth/types";

export const SESSION_COOKIE_NAME = "monsite_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours

export type SessionPayload = {
  sub: string;
  provider: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  iat: number;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function createSessionToken(user: OAuthUserInfo): string {
  const payload: SessionPayload = {
    sub: user.providerAccountId,
    provider: user.provider,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    iat: Math.floor(Date.now() / 1000),
  };
  return signToken(payload, SESSION_MAX_AGE_SECONDS);
}

export function readSession(cookies: CookieReader): SessionPayload | null {
  const cookie = cookies.get(SESSION_COOKIE_NAME);
  if (!cookie) return null;
  return verifyToken<SessionPayload>(cookie.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
