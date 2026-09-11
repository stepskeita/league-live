import "dotenv/config";
import { z } from "zod";

export const PLATFORM_OPERATOR_DEFAULT_PASSWORD = "ChangeMe123!";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1).default("mongodb://localhost:27017/leaguelive"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  CORS_ORIGIN: z.string().default("*"),

  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-me"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-me"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  PLATFORM_OPERATOR_EMAIL: z.string().email().default("admin@leaguelive.dev"),
  PLATFORM_OPERATOR_NAME: z.string().min(1).default("Platform Operator"),
  PLATFORM_OPERATOR_PASSWORD: z.string().min(8).default(PLATFORM_OPERATOR_DEFAULT_PASSWORD),

  // FR36: web push. Unlike the JWT secrets above, there's no meaningful dev
  // default for a VAPID keypair (it identifies this server to push
  // services, a real keypair or nothing) — left unset, notification.service
  // treats push as not configured and every send becomes a no-op rather
  // than the server failing to start. Generate a pair with
  // `npx web-push generate-vapid-keys`.
  // Preprocessed so an empty string (e.g. a literal `VAPID_PUBLIC_KEY=` left
  // in .env, exactly what .env.example ships) is treated the same as the
  // variable being absent altogether, not a validation failure.
  VAPID_PUBLIC_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  VAPID_PRIVATE_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@leaguelive.dev"),
});

export type Env = z.infer<typeof envSchema>;

const INSECURE_DEFAULT_SECRETS = ["dev-access-secret-change-me", "dev-refresh-secret-change-me"];

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  if (
    parsed.data.NODE_ENV === "production" &&
    (INSECURE_DEFAULT_SECRETS.includes(parsed.data.JWT_ACCESS_SECRET) ||
      INSECURE_DEFAULT_SECRETS.includes(parsed.data.JWT_REFRESH_SECRET))
  ) {
    console.error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set explicitly in production.");
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
