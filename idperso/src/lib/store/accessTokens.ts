import { randomBytes } from "crypto";
import { env } from "@/lib/env";

export type AccessTokenRecord = {
  userId: string;
  clientId: string;
  scope: string;
  expiresAt: number;
};

type GlobalWithStore = typeof globalThis & {
  __idperso_access_tokens__?: Map<string, AccessTokenRecord>;
};

function store(): Map<string, AccessTokenRecord> {
  const g = globalThis as GlobalWithStore;
  if (!g.__idperso_access_tokens__) {
    g.__idperso_access_tokens__ = new Map();
  }
  return g.__idperso_access_tokens__;
}

export function createAccessToken(
  input: Omit<AccessTokenRecord, "expiresAt">
): { token: string; expiresIn: number } {
  const token = randomBytes(32).toString("base64url");
  const expiresIn = env.ACCESS_TOKEN_TTL_SECONDS;
  store().set(token, { ...input, expiresAt: Date.now() + expiresIn * 1000 });
  return { token, expiresIn };
}

export function getAccessToken(token: string): AccessTokenRecord | null {
  const record = store().get(token);
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    store().delete(token);
    return null;
  }
  return record;
}
