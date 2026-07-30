/**
 * One-time seed import of the shop's Google Sheets CSV (~200 dresses) —
 * `pnpm --filter be import:dresses <file.csv>`. Needs the real DB (.env).
 *
 * Each row is dispatched through CreateDressService, so domain rules (code
 * format, money bounds) and the duplicate-code precondition apply exactly as
 * over HTTP. Existing codes are SKIPPED — re-running after fixing bad rows is
 * safe (idempotent). Photos are not part of the sheet; paste links later via
 * the edit dialog. Exit 0 = everything imported/skipped; 1 = some rows failed.
 */
// Quiet the per-row domain-event logging (200 rows = 200 debug lines);
// an exported LOG_LEVEL still wins, the .env value is deliberately bypassed.
process.env.LOG_LEVEL ??= 'warn';

import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { CreateDressCommand } from '../modules/catalog/commands/create-dress/create-dress.command';
import {
  CreateDressService,
} from '../modules/catalog/commands/create-dress/create-dress.service';
import { DressCodeAlreadyExistsError } from '../modules/catalog/domain/dress.errors';
import { DressCsvError, parseDressCsv } from '../modules/catalog/import/dress-csv';

/* eslint-disable no-console */

async function main(): Promise<void> {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: pnpm --filter be import:dresses <file.csv>');
    process.exit(2);
  }

  const content = readFileSync(resolve(process.cwd(), fileArg), 'utf8');
  const { rows, errors } = parseDressCsv(content);
  const failures: DressCsvError[] = [...errors];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const createDress = app.get(CreateDressService);

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      const result = await createDress.execute(
        new CreateDressCommand({
          code: row.code,
          name: row.name,
          sizeLabel: row.sizeLabel,
          rentalPrice: row.rentalPrice,
          depositAmount: row.depositAmount,
          notes: row.notes,
          photoUrls: [],
        }),
      );
      if (result.isOk()) {
        imported += 1;
      } else if (result.unwrapErr() instanceof DressCodeAlreadyExistsError) {
        skipped += 1; // idempotent re-run
      } else {
        failures.push({ record: row.record, message: result.unwrapErr().message });
      }
    } catch (error) {
      // Domain validation (e.g. bad code format) throws — report and continue.
      failures.push({ record: row.record, message: (error as Error).message });
    }
  }
  await app.close();

  console.log(`imported=${imported} skipped(duplicate)=${skipped} failed=${failures.length}`);
  for (const failure of failures) {
    console.error(`  record ${failure.record}: ${failure.message}`);
  }
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
