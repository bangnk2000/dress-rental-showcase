/**
 * Bulk-create website listings (mẫu) from the catalog — one DRAFT listing per dress code group
 * (`VAY02` + `VAY02_1` + `VAY02_2` → one listing with three sizes):
 *
 *   pnpm --filter be listings:from-dresses [--prefix VAY] [--dry-run]
 *
 * Needs the real DB (.env). The planner (`modules/catalog/import/listings-from-dresses.ts`) decides
 * name, slug, styles and photos; each plan is dispatched through CreateListingService +
 * SetListingDressesService, so the slug/style/photo rules apply exactly as over HTTP. Never
 * publishes — staff review and publish in /website. A group with any dress already in a listing
 * is SKIPPED, so re-running after new dresses arrive only adds the new groups (idempotent).
 * Exit 0 = everything created/skipped; 1 = some groups failed.
 */
// Quiet the per-command domain-event logging; an exported LOG_LEVEL still wins.
process.env.LOG_LEVEL ??= 'warn';

import { NestFactory } from '@nestjs/core';
import { DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { DB_POOL } from '../libs/db/db.di-tokens';
import { CreateListingCommand } from '../modules/catalog/commands/create-listing/create-listing.command';
import { CreateListingService } from '../modules/catalog/commands/create-listing/create-listing.service';
import { SetListingDressesCommand } from '../modules/catalog/commands/set-listing-dresses/set-listing-dresses.command';
import { SetListingDressesService } from '../modules/catalog/commands/set-listing-dresses/set-listing-dresses.service';
import {
  ListingPlan,
  planListingsFromDresses,
} from '../modules/catalog/import/listings-from-dresses';
import { listingRefsByDress } from '../modules/catalog/queries/dress-listing-refs';

/* eslint-disable no-console */

const dressRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(['active', 'retired']),
  photo_urls: z.array(z.string()),
});
const slugRowSchema = z.object({ slug: z.string() });

function parseArgs(argv: string[]): { prefix: string; dryRun: boolean } {
  let prefix = 'VAY';
  let dryRun = false;
  const args = [...argv];
  for (let arg = args.shift(); arg !== undefined; arg = args.shift()) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--prefix') prefix = args.shift() ?? '';
    else if (arg.startsWith('--prefix=')) prefix = arg.slice('--prefix='.length);
    else {
      console.error(`Unknown argument '${arg}'`);
      console.error('Usage: pnpm --filter be listings:from-dresses [--prefix VAY] [--dry-run]');
      process.exit(2);
    }
  }
  prefix = prefix.trim().toUpperCase(); // dress codes are stored uppercase (DressCode VO)
  if (!prefix) {
    console.error('--prefix must not be empty');
    process.exit(2);
  }
  return { prefix, dryRun };
}

function describe(plan: ListingPlan): string {
  const styles = plan.styles.join(',') + (plan.stylesDefaulted ? '*' : '');
  return (
    `${plan.baseCode} (${plan.codes.join(', ')}) → "${plan.name}" /${plan.slug}` +
    ` [${styles}] ${plan.photoUrls.length} ảnh`
  );
}

async function main(): Promise<void> {
  const { prefix, dryRun } = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  const pool = app.get<DatabasePool>(DB_POOL);

  // Exact-character prefix (no LIKE: `_` is the duplicate separator, not a wildcard).
  const dresses = await pool.any(sql.type(dressRowSchema)`
    SELECT id, code, name, status, photo_urls FROM dresses
    WHERE left(code, ${prefix.length}) = ${prefix}
    ORDER BY code ASC
  `);
  const refs = await listingRefsByDress(
    pool,
    dresses.map((row) => row.id),
  );
  const takenSlugs = new Set(
    (await pool.any(sql.type(slugRowSchema)`SELECT slug FROM dress_listings`)).map(
      (row) => row.slug,
    ),
  );

  const { plans, skipped } = planListingsFromDresses(
    dresses.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      photoUrls: row.photo_urls,
      listingNames: (refs.get(row.id) ?? []).map((ref) => ref.name),
    })),
    takenSlugs,
  );

  console.log(
    `${dresses.length} váy mã ${prefix}* → ${plans.length + skipped.length} nhóm` +
      (dryRun ? ' (DRY RUN — không ghi gì)' : ''),
  );
  for (const group of skipped) {
    console.log(`  = ${group.baseCode} (${group.codes.join(', ')}) bỏ qua: ${group.reason}`);
  }

  const createListing = app.get(CreateListingService);
  const setListingDresses = app.get(SetListingDressesService);
  const failures: string[] = [];
  let created = 0;

  for (const plan of plans) {
    if (dryRun) {
      console.log(`  + ${describe(plan)}`);
      continue;
    }
    try {
      const createdResult = await createListing.execute(
        new CreateListingCommand({
          name: plan.name,
          slug: plan.slug,
          tagline: '',
          description: '',
          styles: plan.styles,
          retailPrice: null,
          specs: { material: null, silhouette: null, length: null, color: null, stylesText: null },
          photoUrls: plan.photoUrls,
          isHot: false,
        }),
      );
      if (createdResult.isErr()) {
        failures.push(`${plan.baseCode}: ${createdResult.unwrapErr().message}`);
        continue;
      }
      const listingId = createdResult.unwrap();
      const attached = await setListingDresses.execute(
        new SetListingDressesCommand({ listingId, dressIds: plan.dressIds }),
      );
      if (attached.isErr()) {
        // The draft exists but holds no dress — name it so staff can attach or delete it.
        failures.push(
          `${plan.baseCode}: mẫu ${listingId} đã tạo nhưng chưa gắn váy — ${attached.unwrapErr().message}`,
        );
        continue;
      }
      created += 1;
      console.log(`  + ${describe(plan)}`);
    } catch (error) {
      // VO validation (e.g. a name the entity refuses) throws — report and continue.
      failures.push(`${plan.baseCode}: ${(error as Error).message}`);
    }
  }
  await app.close();

  const defaulted = plans.filter((plan) => plan.stylesDefaulted).length;
  console.log(
    `${dryRun ? 'would create' : 'created'}=${dryRun ? plans.length : created}` +
      ` skipped=${skipped.length} failed=${failures.length}` +
      (defaulted > 0 ? ` · ${defaulted} mẫu loại mặc định "silk" (đánh dấu *) — sửa trong /website` : ''),
  );
  for (const failure of failures) console.error(`  ! ${failure}`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
