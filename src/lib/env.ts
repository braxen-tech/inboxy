import { z } from "zod/v4";
import { isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),

  INNGEST_EVENT_KEY: z.string().optional().default(""),
  INNGEST_SIGNING_KEY: z.string().optional().default(""),

  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional().default(""),

  ENCRYPTION_KEY: z.string().refine(isValidEncryptionKeyHex, {
    message:
      "ENCRYPTION_KEY must be exactly 64 hex characters (openssl rand -hex 32)",
  }),
  ADMIN_SECRET: z.string().min(16),

  SENTRY_DSN: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error("❌ Invalid environment variables:\n", formatted);
    throw new Error("Invalid environment variables");
  }

  _env = result.data;
  return _env;
}
