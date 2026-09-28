import { z } from 'zod';

/** `KEY=` in an env file means "not set", not "set to the empty string". */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

function optionalString() {
  return z.preprocess(emptyToUndefined, z.string().trim().optional());
}

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2_592_000),
  CLEANING_BUFFER_DAYS: z.coerce.number().int().min(0).default(2),
  /**
   * FR-RENT-09 late fee: flat VND per dress per day, decided by the shop owner
   * (docs/design/rentals/settle-late-fee.md §6.Q1). Env for now — moves to the database only when
   * the shop needs to change it without a deploy.
   */
  LATE_FEE_PER_DRESS_PER_DAY: z.coerce.number().int().min(0).default(200_000),
  /**
   * FR-CAT-10 photo upload (docs/design/catalog/dress-photo-upload.md §5). ALL optional: any of the
   * five missing (or empty) → the signer is disabled and only `POST /photos/upload-urls` answers
   * 503; the rest of the app boots normally, and `openapi:emit` needs none of them.
   */
  R2_ACCOUNT_ID: optionalString(),
  R2_ACCESS_KEY_ID: optionalString(),
  R2_SECRET_ACCESS_KEY: optionalString(),
  R2_BUCKET: optionalString(),
  /** Public read origin of the bucket (custom domain), stored in `photo_urls`; no trailing slash. */
  IMAGE_PUBLIC_BASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .url()
      .transform((url) => url.replace(/\/+$/, ''))
      .optional(),
  ),
  MAX_PHOTO_BYTES: z.coerce.number().int().positive().default(10_485_760),
  /**
   * Rate limit of the ANONYMOUS `/public/*` endpoints only (docs/design/catalog/public-listing.md
   * §Contract check): LIMIT requests per TTL seconds per client IP (X-Forwarded-For behind the
   * local nginx — main.ts trusts loopback proxies). Staff routes are never throttled.
   */
  PUBLIC_THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),
  PUBLIC_THROTTLE_TTL_SEC: z.coerce.number().int().positive().default(60),
  /**
   * true (default): a request whose client IP is loopback is not throttled — that is the web's
   * own ISR server calling from the same VPS. The e2e suite sets it false to prove the 429.
   */
  PUBLIC_THROTTLE_SKIP_LOOPBACK: z
    .preprocess(emptyToUndefined, z.enum(['true', 'false', '1', '0']).optional())
    .transform((value) => value === undefined || value === 'true' || value === '1'),
});

export type AppConfig = z.infer<typeof configSchema>;

/** Thrown (technical failure) — boot must abort on bad config. */
export function validateConfig(raw: Record<string, unknown>): AppConfig {
  return configSchema.parse(raw);
}
