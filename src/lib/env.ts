const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "SESSION_SECRET",
  "APP_BASE_URL",
] as const;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.local and fill it in.`
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
  get APP_BASE_URL() {
    return requireEnv("APP_BASE_URL");
  },
  get SESSION_SECRET() {
    return requireEnv("SESSION_SECRET");
  },
};
