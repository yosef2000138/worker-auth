import { z } from 'zod';
import { logger } from '../utils/logger';

const environmentBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return value;
}, z.boolean());

const tokenTtl = z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m or 7d');
const optionalWebhookSecret = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(32).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: tokenTtl.default('15m'),
  JWT_REFRESH_EXPIRES_IN: tokenTtl.default('7d'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string().email(),

  CLIENT_URL: z.string().min(1).optional(),

  REVENUECAT_WEBHOOK_AUTH_TOKEN: optionalWebhookSecret,
  REVENUECAT_WEBHOOK_SIGNING_SECRET: optionalWebhookSecret,
  REVENUECAT_SECRET_API_KEY: z.string().optional(),
  REVENUECAT_PROJECT_ID: z.string().optional(),
  REVENUECAT_ENTITLEMENT_ID: z.string().min(1).default('worker_pro'),
  SUBSCRIPTIONS_ENABLED: environmentBoolean.default(false),
  WORKER_FREE_ACCEPTED_REQUEST_LIMIT: z.coerce.number().int().min(0).default(5),
  MAX_OFFERS_PER_REQUEST: z.coerce.number().int().min(1).max(20).default(5),

  // Cloudinary — required for image uploads
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY:    z.string(),
  CLOUDINARY_API_SECRET: z.string(),
});

export function parseEnvironment(source: NodeJS.ProcessEnv) {
  const data = envSchema.parse(source);

  if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be different.');
  }

  if (data.NODE_ENV === 'production') {
    if (!data.CLIENT_URL) {
      throw new Error('CLIENT_URL is required in production.');
    }

    if (data.CLIENT_URL.split(',').some(origin => origin.trim() === '*')) {
      throw new Error('Wildcard CORS origins are not allowed in production.');
    }
  }

  return {
    ...data,
    CLIENT_URL: data.CLIENT_URL ?? 'http://localhost:8081',
  };
}

let parsedEnvironment: ReturnType<typeof parseEnvironment>;
try {
  parsedEnvironment = parseEnvironment(process.env);
} catch (error) {
  logger.error('environment.invalid', {
    errorName: error instanceof Error ? error.name : 'ConfigurationError',
  });
  if (error instanceof z.ZodError) {
    logger.error('environment.validation_failed', {
      fields: Object.keys(error.flatten().fieldErrors),
    });
  }
  process.exit(1);
}

export const env = parsedEnvironment;
