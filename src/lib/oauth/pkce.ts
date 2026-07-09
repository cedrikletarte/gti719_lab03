import { createHash, randomBytes } from "crypto";

export type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export function createPkcePair(): PkcePair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}
