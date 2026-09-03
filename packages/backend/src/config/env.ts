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
