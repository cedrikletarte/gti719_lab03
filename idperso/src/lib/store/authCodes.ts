import { randomBytes } from "crypto";
import { env } from "@/lib/env";

export type AuthCodeRecord = {
  clientId: string;
  redirectUri: string;
  userId: string;
  scope: string;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  state: string | null;
  expiresAt: number;
  consumed: boolean;
};

type GlobalWithStore = typeof globalThis & {
  __idperso_auth_codes__?: Map<string, AuthCodeRecord>;
};

function store(): Map<string, AuthCodeRecord> {
  const g = globalThis as GlobalWithStore;
  if (!g.__idperso_auth_codes__) {
    g.__idperso_auth_codes__ = new Map();
  }
  return g.__idperso_auth_codes__;
}

export function createAuthCode(
  input: Omit<AuthCodeRecord, "expiresAt" | "consumed">
): string {
  const code = randomBytes(24).toString("base64url");
  store().set(code, {
    ...input,
    expiresAt: Date.now() + env.AUTH_CODE_TTL_SECONDS * 1000,
    consumed: false,
  });
  return code;
}

export type ConsumeResult =
  | { ok: true; record: AuthCodeRecord }
  | { ok: false; reason: "not_found" | "already_used" | "expired" };

export function consumeAuthCode(code: string): ConsumeResult {
  const record = store().get(code);
  if (!record) return { ok: false, reason: "not_found" };
  if (record.consumed) return { ok: false, reason: "already_used" };
  if (Date.now() > record.expiresAt) {
    record.consumed = true;
    return { ok: false, reason: "expired" };
  }
  // Synchronous mark-consumed: Node's single-threaded event loop makes this
  // atomic with respect to any concurrent /oauth/token request for the same code.
  record.consumed = true;
  return { ok: true, record };
}
