type RequiredEnvKey =
  | "DATABASE_URL"
  | "JWT_ACCESS_SECRET"
  | "JWT_REFRESH_SECRET"
  | "XENDIT_SECRET_KEY";

function getOptionalEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function getRequiredEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  jwtAccessSecret: getRequiredEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: getRequiredEnv("JWT_REFRESH_SECRET"),
  xenditSecretKey: getRequiredEnv("XENDIT_SECRET_KEY"),
  xenditWebhookToken: getOptionalEnv(
    "XENDIT_WEBHOOK_TOKEN",
    "XENDIT_WEBHOOK_VERIFICATION_TOKEN",
  ),
  xenditCallbackUrl: getOptionalEnv("XENDIT_CALLBACK_URL"),
  appEnv: process.env.APP_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  cloudinaryUrl: getOptionalEnv("CLOUDINARY_URL"),
};
