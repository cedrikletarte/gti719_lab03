import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(payloadB64).digest("base64url");
}

export function signToken<T extends object>(payload: T, maxAgeSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payloadB64 = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyToken<T>(token: string): T | null {
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: T & { exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
