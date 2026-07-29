/**
 * Offline OpenAPI emit — docs/spec/init-monorepo-contract/02 §2.
 * Boots the Nest app WITHOUT listening and WITHOUT infrastructure (OPENAPI_EMIT=1 swaps
 * the DB pool for a stub), dumps the swagger document to packages/contract, exits.
 * Runs from compiled dist (nest build) so the @nestjs/swagger CLI plugin transforms apply.
 */
process.env.OPENAPI_EMIT = '1';
process.env.DATABASE_URL ??= 'postgres://offline:offline@localhost:5432/offline';
process.env.JWT_SECRET ??= 'offline-emit-only-secret-not-real';
process.env.JWT_REFRESH_SECRET ??= 'offline-emit-only-secret-not-real';

import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { configureApp, createOpenApiDocument } from '../app.setup';

const OUT = resolve(process.cwd(), '../../packages/contract/openapi.json');

async function main(): Promise<void> {
  // abortOnError: false → a bootstrap failure rejects (and prints) instead of a silent exit(1).
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  const document = createOpenApiDocument(app);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`openapi.json written: ${OUT}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  },
);
