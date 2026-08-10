/**
 * The e2e suite TRUNCATES tables, so it must never point at the dev database. It derives a
 * sibling `<db>_test` URL from DATABASE_URL (or takes E2E_DATABASE_URL verbatim) and refuses to
 * run against the dev database unless E2E_ALLOW_DEV_DB=1 says so out loud.
 */
import { loadEnvFile } from './load-env';

export function e2eDatabaseUrl(): string {
  loadEnvFile();
  const explicit = process.env.E2E_DATABASE_URL;
  const dev = process.env.DATABASE_URL;
  if (!dev && !explicit) {
    throw new Error('Set DATABASE_URL (or E2E_DATABASE_URL) before running the e2e suite');
  }

  const url = new URL(explicit ?? (dev as string));
  if (!explicit) {
    const database = url.pathname.replace(/^\//, '');
    url.pathname = `/${database}_test`;
  }

  if (dev && url.href === new URL(dev).href && process.env.E2E_ALLOW_DEV_DB !== '1') {
    throw new Error(
      'Refusing to run the e2e suite against DATABASE_URL (it truncates tables). ' +
        'Use a separate database or set E2E_ALLOW_DEV_DB=1 deliberately.',
    );
  }
  return url.href;
}
