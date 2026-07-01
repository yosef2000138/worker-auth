import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().default(12),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().email(),

  CLIENT_URL: z.string().min(1).default('http://localhost:8081'),

  REVENUECAT_WEBHOOK_AUTH_TOKEN: z.string().optional(),
  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_PROJECT_ID: z.string().optional(),
  REVENUECAT_ENTITLEMENT_ID: z.string().min(1).default('worker_pro'),
  SUBSCRIPTIONS_ENABLED: z.coerce.boolean().default(false),
  WORKER_FREE_ACCEPTED_REQUEST_LIMIT: z.coerce.number().int().min(0).default(5),
  MAX_OFFERS_PER_REQUEST: z.coerce.number().int().min(1).max(20).default(5),

  // Cloudinary — required for image uploads
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY:    z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
