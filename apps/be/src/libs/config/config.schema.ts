import { z } from 'zod';

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
});

export type AppConfig = z.infer<typeof configSchema>;

/** Thrown (technical failure) — boot must abort on bad config. */
export function validateConfig(raw: Record<string, unknown>): AppConfig {
  return configSchema.parse(raw);
}
