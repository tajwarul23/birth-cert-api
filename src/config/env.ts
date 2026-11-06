import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  HMAC_SECRET: z.string().min(32, "HMAC_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(10),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  VERIFICATION_TOKEN_MINUTES: z.coerce.number().int().positive().default(5),
  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
