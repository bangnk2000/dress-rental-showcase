import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  CheckIntegrityConstraintViolationError,
  DatabasePool,
  ForeignKeyIntegrityConstraintViolationError,
  sql,
  UniqueIntegrityConstraintViolationError,
} from 'slonik';
import { z } from 'zod';
import { AggregateID } from '../../../libs/ddd/entity.base';
import { DB_POOL } from '../../../libs/db/db.di-tokens';
import { DressListingRepositoryPort } from '../application/ports/dress-listing.repository.port';
import {
  ListingGoneError,
  ListingNoActiveDressConflictError,
  ListingPhotoCheckError,
  ListingSlugConflictError,
  ListingSlugLockedConflictError,
} from '../application/ports/listing-write-conflict.errors';
import { DressListingEntity } from '../domain/dress-listing.entity';
import { DressListingMapper } from './dress-listing.mapper';
import { dressListingSchema } from './dress-listing.persistence.model';

/** Names from migrations/1755500000000_dress_listings.js — the adapter keys its translation on them. */
const PHOTO_CHECK = 'dress_listings_published_has_photo';
const ITEMS_LISTING_FK = 'dress_listing_items_listing_id_fkey';

const idRowSchema = z.object({ id: z.string() });
const dressIdRowSchema = z.object({ dress_id: z.string() });
const countSchema = z.object({ total: z.number().int() });
const existsSchema = z.object({ exists: z.boolean() });

/**
 * DressListing adapter. Not a `SqlRepositoryBase`: the aggregate is never written as a whole-row
 * upsert — every write is a targeted statement carrying its own race guard (spec §2 Concurrency),
 * and the aggregate publishes no domain events (spec: no consumer).
 */
@Injectable()
export class DressListingRepository implements DressListingRepositoryPort {
  constructor(
    @Inject(DB_POOL) private readonly pool: DatabasePool,
    private readonly mapper: DressListingMapper,
  ) {}

  nextId(): AggregateID {
    return randomUUID();
  }

  async findOneById(id: AggregateID): Promise<DressListingEntity | null> {
    const row = await this.pool.maybeOne(
      sql.type(dressListingSchema)`SELECT * FROM dress_listings WHERE id = ${id}`,
    );
    if (!row) return null;
    const items = await this.pool.any(
      sql.type(dressIdRowSchema)`
        SELECT dress_id FROM dress_listing_items WHERE listing_id = ${id} ORDER BY dress_id
      `,
    );
    return this.mapper.toDomain(
      row,
      items.map((item) => item.dress_id),
    );
  }

  async slugTaken(slug: string, exceptId?: AggregateID): Promise<boolean> {
    const except = exceptId ? sql.fragment`AND id <> ${exceptId}` : sql.fragment``;
    const { exists } = await this.pool.one(
      sql.type(existsSchema)`
        SELECT EXISTS (SELECT 1 FROM dress_listings WHERE slug = ${slug} ${except}) AS exists
      `,
    );
    return exists;
  }

  async insert(entity: DressListingEntity): Promise<void> {
    const r = this.mapper.toPersistence(entity);
    await this.translate(() =>
      this.pool.query(sql.unsafe`
        INSERT INTO dress_listings (
          id, slug, name, tagline, description, styles, retail_price,
          material, silhouette, length, color, styles_text, photo_urls, is_hot,
          published_at, first_published_at, created_at, updated_at
        ) VALUES (
          ${r.id}, ${r.slug}, ${r.name}, ${r.tagline}, ${r.description},
          ${sql.array(r.styles, 'text')}, ${r.retail_price},
          ${r.material}, ${r.silhouette}, ${r.length}, ${r.color}, ${r.styles_text},
          ${sql.array(r.photo_urls, 'text')}, ${r.is_hot},
          NULL, NULL, ${iso(r.created_at)}, ${iso(r.updated_at)}
        )
      `),
    );
  }

  async updateContent(
    entity: DressListingEntity,
    options: { slugChanged: boolean },
  ): Promise<void> {
    const r = this.mapper.toPersistence(entity);
    const slugSet = options.slugChanged ? sql.fragment`slug = ${r.slug},` : sql.fragment``;
    // R2 lives IN the write: a publish that commits between our load and this UPDATE makes the
    // re-evaluated WHERE miss the row, so "published first, slug changed after" cannot happen.
    const slugGuard = options.slugChanged
      ? sql.fragment`AND first_published_at IS NULL`
      : sql.fragment``;

    const result = await this.translate(() =>
      this.pool.query(sql.unsafe`
        UPDATE dress_listings SET
          ${slugSet}
          name = ${r.name},
          tagline = ${r.tagline},
          description = ${r.description},
          styles = ${sql.array(r.styles, 'text')},
          retail_price = ${r.retail_price},
          material = ${r.material},
          silhouette = ${r.silhouette},
          length = ${r.length},
          color = ${r.color},
          styles_text = ${r.styles_text},
          photo_urls = ${sql.array(r.photo_urls, 'text')},
          is_hot = ${r.is_hot},
          updated_at = ${iso(r.updated_at)}
        WHERE id = ${r.id} ${slugGuard}
      `),
    );
    if (result.rowCount > 0) return;
    if (!(await this.exists(r.id))) throw new ListingGoneError();
    throw new ListingSlugLockedConflictError();
  }

  async replaceDresses(listingId: AggregateID, dressIds: string[]): Promise<void> {
    await this.translate(() =>
      this.pool.transaction(async (conn) => {
        const touched = await conn.query(sql.unsafe`
          UPDATE dress_listings SET updated_at = now() WHERE id = ${listingId}
        `);
        if (touched.rowCount === 0) throw new ListingGoneError();
        await conn.query(sql.unsafe`
          DELETE FROM dress_listing_items
          WHERE listing_id = ${listingId}
            AND NOT (dress_id = ANY(${sql.array(dressIds, 'uuid')}))
        `);
        if (dressIds.length > 0) {
          await conn.query(sql.unsafe`
            INSERT INTO dress_listing_items (listing_id, dress_id)
            SELECT ${listingId}, unnest(${sql.array(dressIds, 'uuid')})
            ON CONFLICT DO NOTHING
          `);
        }
      }),
    );
  }

  async findExistingDressIds(dressIds: string[]): Promise<string[]> {
    if (dressIds.length === 0) return [];
    const rows = await this.pool.any(
      sql.type(idRowSchema)`
        SELECT id FROM dresses WHERE id = ANY(${sql.array(dressIds, 'uuid')})
      `,
    );
    return rows.map((row) => row.id);
  }

  async countActiveDresses(listingId: AggregateID): Promise<number> {
    const { total } = await this.pool.one(
      sql.type(countSchema)`
        SELECT count(*)::int AS total
        FROM dress_listing_items i JOIN dresses d ON d.id = i.dress_id
        WHERE i.listing_id = ${listingId} AND d.status = 'active'
      `,
    );
    return total;
  }

  async markPublished(listingId: AggregateID, now: Date): Promise<void> {
    // COALESCE keeps both timestamps of an already-published listing (idempotent) and makes
    // first_published_at write-once — the anchor of R2, R8 and the "new" badge.
    // The active-dress precondition lives IN the write: a concurrent detach/retire that commits
    // before this statement makes it match 0 rows instead of publishing a listing with no dress.
    const result = await this.translate(() =>
      this.pool.query(sql.unsafe`
        UPDATE dress_listings SET
          published_at = COALESCE(published_at, ${iso(now)}),
          first_published_at = COALESCE(first_published_at, ${iso(now)}),
          updated_at = ${iso(now)}
        WHERE id = ${listingId}
          AND EXISTS (
            SELECT 1 FROM dress_listing_items i
            JOIN dresses d ON d.id = i.dress_id AND d.status = 'active'
            WHERE i.listing_id = ${listingId}
          )
      `),
    );
    if (result.rowCount === 0) {
      const stillThere = await this.pool.maybeOne(sql.unsafe`
        SELECT 1 FROM dress_listings WHERE id = ${listingId}
      `);
      throw stillThere ? new ListingNoActiveDressConflictError() : new ListingGoneError();
    }
  }

  async markUnpublished(listingId: AggregateID, now: Date): Promise<void> {
    const result = await this.pool.query(sql.unsafe`
      UPDATE dress_listings SET published_at = NULL, updated_at = ${iso(now)}
      WHERE id = ${listingId}
    `);
    if (result.rowCount === 0) throw new ListingGoneError();
  }

  async delete(
    listingId: AggregateID,
    options: { onlyIfNeverPublished: boolean },
  ): Promise<number> {
    // R8 for staff lives IN the DELETE: a publish landing after the service's check leaves the
    // row in place (0 rows) instead of letting staff remove a live listing.
    const guard = options.onlyIfNeverPublished
      ? sql.fragment`AND first_published_at IS NULL`
      : sql.fragment``;
    const result = await this.pool.query(sql.unsafe`
      DELETE FROM dress_listings WHERE id = ${listingId} ${guard}
    `);
    return result.rowCount;
  }

  private async exists(id: AggregateID): Promise<boolean> {
    const { exists } = await this.pool.one(
      sql.type(existsSchema)`
        SELECT EXISTS (SELECT 1 FROM dress_listings WHERE id = ${id}) AS exists
      `,
    );
    return exists;
  }

  /** Constraint violations → port errors (no slonik type leaves the adapter). */
  private async translate<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof UniqueIntegrityConstraintViolationError) {
        // dress_listings has ONE unique constraint besides its PK: the slug (R1).
        throw new ListingSlugConflictError(error);
      }
      if (
        error instanceof CheckIntegrityConstraintViolationError &&
        error.constraint === PHOTO_CHECK
      ) {
        throw new ListingPhotoCheckError(error);
      }
      if (
        error instanceof ForeignKeyIntegrityConstraintViolationError &&
        error.constraint === ITEMS_LISTING_FK
      ) {
        throw new ListingGoneError(error);
      }
      throw error;
    }
  }
}

function iso(value: Date | string | number): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
