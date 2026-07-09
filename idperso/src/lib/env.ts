const REQUIRED_ENV_VARS = [
  "SESSION_SECRET",
  "MONSITE_CLIENT_ID",
  "MONSITE_CLIENT_SECRET",
  "MONSITE_REDIRECT_URI",
  "APP_BASE_URL",
] as const;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.exemple to .env and fill it in.`
    );
  }
  return value;
}

export function validateEnv(): void {
  for (const name of REQUIRED_ENV_VARS) {
    requireEnv(name);
  }
}

export const env = {
  get SESSION_SECRET() {
    return requireEnv("SESSION_SECRET");
  },
  get APP_BASE_URL() {
    return requireEnv("APP_BASE_URL");
  },
  get MONSITE_CLIENT_ID() {
    return requireEnv("MONSITE_CLIENT_ID");
  },
  get MONSITE_CLIENT_SECRET() {
    return requireEnv("MONSITE_CLIENT_SECRET");
  },
  get MONSITE_REDIRECT_URI() {
    return requireEnv("MONSITE_REDIRECT_URI");
  },
  get AUTH_CODE_TTL_SECONDS() {
    return Number(process.env.AUTH_CODE_TTL_SECONDS ?? 60);
  },
  get ACCESS_TOKEN_TTL_SECONDS() {
    return Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 3600);
  },
};
