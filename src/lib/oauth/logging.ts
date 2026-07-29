import { createHash } from "crypto";

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function masked(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 3)}…`;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
