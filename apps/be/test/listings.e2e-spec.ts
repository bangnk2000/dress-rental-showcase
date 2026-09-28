import { ApiResponse, E2eContext, startE2eApp } from './e2e-app';

/**
 * catalog/public-listing — CMS side (docs/design/catalog/public-listing.md §Invariant-enforcement,
 * §5 BE proof column). Each rule is proven three ways where the spec says so: the named outcome on
 * the API path, a concurrent race, and a raw SQL write that bypasses the app.
 */
describe('public listings — CMS commands (real Postgres)', () => {
  let context: E2eContext;

  beforeAll(async () => {
    context = await startE2eApp();
  }, 60_000);

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await context.reset();
  });

  const PHOTO = 'https://img.test/anh-trang-1.jpg';

  const createListing = (body: Record<string, unknown> = {}, token?: string) =>
    context.request('/api/v1/listings', {
      method: 'POST',
      body: { name: 'Đầm Ánh Trăng', occasions: ['gala'], photoUrls: [PHOTO], ...body },
      token: token ?? context.token,
    });

  const idOf = (response: ApiResponse): string => {
    expect([200, 201]).toContain(response.status);
    return (response.body as { id: string }).id;
  };

  const patch = (id: string, body: Record<string, unknown>, token?: string) =>
    context.request(`/api/v1/listings/${id}`, {
      method: 'PATCH',
      body,
      token: token ?? context.token,
    });

  const setDresses = (id: string, dressIds: string[]) =>
    context.request(`/api/v1/listings/${id}/dresses`, {
      method: 'PUT',
      body: { dressIds },
      token: context.token,
    });

  const publish = (id: string, token?: string) =>
    context.request(`/api/v1/listings/${id}/publish`, {
      method: 'POST',
      token: token ?? context.token,
    });

  const unpublish = (id: string) =>
    context.request(`/api/v1/listings/${id}/unpublish`, { method: 'POST', token: context.token });

  const remove = (id: string, token: string) =>
    context.request(`/api/v1/listings/${id}`, { method: 'DELETE', token });

  /** A listing with a photo and one active dress, published. */
  async function publishedListing(slug = 'dam-anh-trang'): Promise<string> {
    const id = idOf(await createListing({ slug }));
    const dressId = await context.db.seedDress(`PL-${slug.slice(0, 8).toUpperCase()}`);
    expect((await setDresses(id, [dressId])).status).toBe(200);
    expect((await publish(id)).status).toBe(200);
    return id;
  }

  async function listingRow(id: string) {
    const result = await context.db.query<{
      slug: string;
      published_at: Date | null;
      first_published_at: Date | null;
      photo_urls: string[];
    }>(
      'SELECT slug, published_at, first_published_at, photo_urls FROM dress_listings WHERE id = $1',
      [id],
    );
    return result.rows[0];
  }

  it('reads need a token; every staff member may create (listing:manage)', async () => {
    expect((await context.request('/api/v1/listings')).status).toBe(401);
    const created = await createListing({}, context.staffToken);
    expect(created.status).toBe(201);
  });

  describe('R1 slug unique + format', () => {
    it('derives the slug from the Vietnamese name when omitted', async () => {
      const id = idOf(await createListing({ name: 'Đầm dạ hội Ánh Trăng' }));
      const detail = await context.request(`/api/v1/listings/${id}`, { token: context.token });
      expect(detail.status).toBe(200);
      expect((detail.body as { slug: string }).slug).toBe('dam-da-hoi-anh-trang');
    });

    it('a taken slug is the named 422 outcome carrying the slug', async () => {
      idOf(await createListing({ slug: 'dam-x' }));
      const second = await createListing({ slug: 'dam-x', name: 'Khác' });
      expect(second.status).toBe(422);
      expect(second.body).toEqual({ status: 'rejected_listing_slug_taken', slug: 'dam-x' });

      // Same rule on update.
      const other = idOf(await createListing({ slug: 'dam-y' }));
      const renamed = await patch(other, { slug: 'dam-x' });
      expect(renamed.status).toBe(422);
      expect(renamed.body).toEqual({ status: 'rejected_listing_slug_taken', slug: 'dam-x' });
    });

    it('two concurrent creates with one slug: exactly one wins, the loser gets the SAME outcome', async () => {
      const [a, b] = await Promise.all([
        createListing({ slug: 'dam-race' }),
        createListing({ slug: 'dam-race' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 422]);
      const loser = a.status === 422 ? a : b;
      expect(loser.body).toEqual({ status: 'rejected_listing_slug_taken', slug: 'dam-race' });
      const rows = await context.db.query("SELECT 1 FROM dress_listings WHERE slug = 'dam-race'");
      expect(rows.rowCount).toBe(1);
    });

    it('a bad slug on the API is a 400 envelope, never an outcome', async () => {
      const response = await createListing({ slug: 'Đầm Sai' });
      expect(response.status).toBe(400);
      expect((response.body as { error: { code: string } }).error.code).toBe('GENERIC.VALIDATION');
    });

    it('raw INSERTs: a duplicate slug hits UNIQUE, a bad format hits CHECK', async () => {
      idOf(await createListing({ slug: 'dam-x' }));
      await expect(
        context.db.query(
          "INSERT INTO dress_listings (id, slug, name, occasions) VALUES (gen_random_uuid(), 'dam-x', 'x', '{gala}')",
        ),
      ).rejects.toThrow(/duplicate key|unique/i);
      for (const bad of ['Dam-X', 'dam--x', '-dam', 'dam x', 'a'.repeat(81)]) {
        await expect(
          context.db.query(
            "INSERT INTO dress_listings (id, slug, name, occasions) VALUES (gen_random_uuid(), $1, 'x', '{gala}')",
            [bad],
          ),
        ).rejects.toThrow(/check constraint/i);
      }
    });
  });

  describe('R2 slug locked after the first publish', () => {
    it('change after publish → 422; still 422 after unpublish; the same slug is not a change', async () => {
      const id = await publishedListing();

      const locked = await patch(id, { slug: 'dam-moi' });
      expect(locked.status).toBe(422);
      expect(locked.body).toEqual({ status: 'rejected_listing_slug_locked' });

      expect((await unpublish(id)).status).toBe(200);
      const stillLocked = await patch(id, { slug: 'dam-moi' });
      expect(stillLocked.status).toBe(422);
      expect(stillLocked.body).toEqual({ status: 'rejected_listing_slug_locked' });

      expect((await patch(id, { slug: 'dam-anh-trang', tagline: 'ok' })).status).toBe(200);
      expect((await listingRow(id))!.slug).toBe('dam-anh-trang');
    });

    it('a draft may change its slug', async () => {
      const id = idOf(await createListing({ slug: 'dam-cu' }));
      expect((await patch(id, { slug: 'dam-moi' })).status).toBe(200);
      expect((await listingRow(id))!.slug).toBe('dam-moi');
    });

    it('publish ∥ slug change never ends "published first, slug changed after"', async () => {
      for (let round = 0; round < 6; round += 1) {
        const id = idOf(await createListing({ slug: `dam-race-${round}` }));
        const dressId = await context.db.seedDress(`RACE-${round}`);
        expect((await setDresses(id, [dressId])).status).toBe(200);

        const [changed, published] = await Promise.all([
          patch(id, { slug: `dam-moi-${round}` }),
          publish(id),
        ]);
        expect(published.status).toBe(200);
        const row = (await listingRow(id))!;
        expect(row.published_at).not.toBeNull();
        if (changed.status === 200) {
          // The slug landed BEFORE the publish — a draft rename, legal.
          expect(row.slug).toBe(`dam-moi-${round}`);
        } else {
          // The publish got in first: the conditional UPDATE refused, the slug is untouched.
          expect(changed.status).toBe(422);
          expect(changed.body).toEqual({ status: 'rejected_listing_slug_locked' });
          expect(row.slug).toBe(`dam-race-${round}`);
        }
        // Either way, from now on the slug is frozen.
        expect((await patch(id, { slug: `dam-sau-${round}` })).status).toBe(422);
      }
    });
  });

  describe('R3 published ⇒ ≥ 1 photo', () => {
    it('emptying the photos of a published listing → 422; a draft may have none', async () => {
      const id = await publishedListing();
      const response = await patch(id, { photoUrls: [] });
      expect(response.status).toBe(422);
      expect(response.body).toEqual({ status: 'rejected_listing_photo_required' });
      expect((await listingRow(id))!.photo_urls).toEqual([PHOTO]);

      const draft = idOf(await createListing({ slug: 'dam-nhap' }));
      expect((await patch(draft, { photoUrls: [] })).status).toBe(200);
    });

    it('raw UPDATEs that would leave a published listing without a photo hit the CHECK', async () => {
      const id = await publishedListing();
      await expect(
        context.db.query("UPDATE dress_listings SET photo_urls = '{}' WHERE id = $1", [id]),
      ).rejects.toThrow(/dress_listings_published_has_photo/);

      const draft = idOf(await createListing({ slug: 'dam-khong-anh', photoUrls: [] }));
      await expect(
        context.db.query(
          'UPDATE dress_listings SET published_at = now(), first_published_at = now() WHERE id = $1',
          [draft],
        ),
      ).rejects.toThrow(/dress_listings_published_has_photo/);
    });
  });

  describe('R4 occasions', () => {
    it.each([
      ['none', []],
      ['unknown', ['gala', 'prom']],
      ['repeated', ['gala', 'gala']],
    ])('%s occasions → 400 envelope', async (_label, occasions) => {
      const response = await createListing({ occasions });
      expect(response.status).toBe(400);
    });

    it('raw INSERTs with garbage occasions hit the CHECK', async () => {
      for (const occasions of ['{}', '{gala,prom}', '{NULL}']) {
        await expect(
          context.db.query(
            `INSERT INTO dress_listings (id, slug, name, occasions) VALUES (gen_random_uuid(), 'dam-rac', 'x', $1)`,
            [occasions],
          ),
        ).rejects.toThrow(/check constraint/i);
      }
    });

    it('retail price must be ≥ 0 (API 400, raw CHECK)', async () => {
      expect((await createListing({ retailPrice: -1 })).status).toBe(400);
      const id = idOf(await createListing({ slug: 'dam-gia' }));
      await expect(
        context.db.query('UPDATE dress_listings SET retail_price = -1 WHERE id = $1', [id]),
      ).rejects.toThrow(/check constraint/i);
    });
  });

  describe('attached dresses', () => {
    it('replaces the set, reports unknown ids exactly, and the dress detail names its listings', async () => {
      const id = idOf(await createListing({ slug: 'dam-a', name: 'Mẫu A' }));
      const d1 = await context.db.seedDress('LD-001');
      const d2 = await context.db.seedDress('LD-002', { retired: true });
      const unknown = '00000000-0000-4000-8000-00000000dead';

      const bad = await setDresses(id, [d1, unknown]);
      expect(bad.status).toBe(422);
      expect(bad.body).toEqual({ status: 'rejected_dress_not_found', dressIds: [unknown] });

      // Retired dresses may be attached (they just never show on the web).
      expect((await setDresses(id, [d1, d2, d1])).status).toBe(200);
      const detail = await context.request(`/api/v1/listings/${id}`, { token: context.staffToken });
      expect(
        (detail.body as { dresses: { code: string; status: string }[] }).dresses.map(
          (dress) => `${dress.code}:${dress.status}`,
        ),
      ).toEqual(['LD-001:active', 'LD-002:retired']);

      const dress = await context.request(`/api/v1/dresses/${d1}`, { token: context.staffToken });
      expect((dress.body as { listings: unknown }).listings).toEqual([{ id, name: 'Mẫu A' }]);
      const list = await context.request('/api/v1/dresses', { token: context.staffToken });
      for (const row of (list.body as { data: { listings: unknown }[] }).data) {
        expect(Array.isArray(row.listings)).toBe(true);
      }

      expect((await setDresses(id, [d2])).status).toBe(200);
      const after = await context.db.query(
        'SELECT dress_id FROM dress_listing_items WHERE listing_id = $1',
        [id],
      );
      expect(after.rows).toEqual([{ dress_id: d2 }]);
    });

    it('unknown listing → rejected_listing_not_found', async () => {
      const response = await setDresses('00000000-0000-4000-8000-00000000beef', []);
      expect(response.status).toBe(422);
      expect(response.body).toEqual({ status: 'rejected_listing_not_found' });
    });

    it('the (listing, dress) pair is a PRIMARY KEY; the dress FK is RESTRICT', async () => {
      const id = idOf(await createListing({ slug: 'dam-pk' }));
      const dressId = await context.db.seedDress('PK-001');
      await context.db.query(
        'INSERT INTO dress_listing_items (listing_id, dress_id) VALUES ($1, $2)',
        [id, dressId],
      );
      await expect(
        context.db.query('INSERT INTO dress_listing_items (listing_id, dress_id) VALUES ($1, $2)', [
          id,
          dressId,
        ]),
      ).rejects.toThrow(/duplicate key|dress_listing_items_pkey/);
      await expect(
        context.db.query('DELETE FROM dresses WHERE id = $1', [dressId]),
      ).rejects.toThrow(/foreign key/i);
    });

    it('the CMS list counts dresses, active sizes and "hidden: out of dresses"', async () => {
      const id = await publishedListing('dam-dem');
      const extra = await context.db.seedDress('CNT-002');
      await context.db.query("UPDATE dresses SET size_label = 'L' WHERE id = $1", [extra]);
      const current = await context.db.query<{ dress_id: string }>(
        'SELECT dress_id FROM dress_listing_items WHERE listing_id = $1',
        [id],
      );
      await setDresses(id, [current.rows[0]!.dress_id, extra]);

      const list = await context.request('/api/v1/listings', { token: context.staffToken });
      expect(list.status).toBe(200);
      const [row] = (list.body as { data: Record<string, unknown>[] }).data;
      expect(row).toMatchObject({
        id,
        slug: 'dam-dem',
        coverUrl: PHOTO,
        dressCount: 2,
        activeDressCount: 2,
        activeSizeCount: 2,
        visibleOnWeb: true,
      });

      await context.db.query("UPDATE dresses SET status = 'retired'");
      const hidden = await context.request('/api/v1/listings', { token: context.staffToken });
      expect((hidden.body as { data: Record<string, unknown>[] }).data[0]).toMatchObject({
        activeDressCount: 0,
        visibleOnWeb: false,
      });
      expect(
        (hidden.body as { data: Record<string, unknown>[] }).data[0]!.publishedAt,
      ).not.toBeNull();
    });
  });

  describe('publish', () => {
    it('names every missing requirement precisely', async () => {
      const bare = idOf(await createListing({ slug: 'dam-tran', photoUrls: [] }));
      const both = await publish(bare);
      expect(both.status).toBe(422);
      expect(both.body).toEqual({
        status: 'rejected_listing_not_publishable',
        missing: ['photo', 'active_dress'],
      });

      const retiredOnly = idOf(await createListing({ slug: 'dam-het' }));
      await setDresses(retiredOnly, [await context.db.seedDress('PB-001', { retired: true })]);
      const noActive = await publish(retiredOnly);
      expect(noActive.body).toEqual({
        status: 'rejected_listing_not_publishable',
        missing: ['active_dress'],
      });

      const noPhoto = idOf(await createListing({ slug: 'dam-khong-anh', photoUrls: [] }));
      await setDresses(noPhoto, [await context.db.seedDress('PB-002')]);
      expect((await publish(noPhoto)).body).toEqual({
        status: 'rejected_listing_not_publishable',
        missing: ['photo'],
      });

      expect((await publish('00000000-0000-4000-8000-00000000beef')).body).toEqual({
        status: 'rejected_listing_not_found',
      });
    });

    it('publish ∥ detaching the last dress: publish either lands first or is refused, never 5xx', async () => {
      for (let round = 0; round < 6; round += 1) {
        const id = idOf(await createListing({ slug: `dam-tach-${round}` }));
        const dressId = await context.db.seedDress(`DETACH-${round}`);
        expect((await setDresses(id, [dressId])).status).toBe(200);

        const [published, detached] = await Promise.all([publish(id), setDresses(id, [])]);
        expect(detached.status).toBe(200);
        const row = (await listingRow(id))!;
        if (published.status === 200) {
          // Serialised BEFORE the detach: legal, R5 hides a published listing without active dresses.
          expect(row.published_at).not.toBeNull();
        } else {
          // The detach committed first: the publish UPDATE's EXISTS matched nothing.
          expect(published.status).toBe(422);
          expect(published.body).toEqual({
            status: 'rejected_listing_not_publishable',
            missing: ['active_dress'],
          });
          expect(row.published_at).toBeNull();
          expect(row.first_published_at).toBeNull();
        }
        // Once the dress is gone, a new publish is always refused.
        expect((await publish(id)).status).toBe(422);
      }
    });

    it('publishing twice (and after unpublish) keeps first_published_at; staff may publish', async () => {
      const id = await publishedListing();
      const first = (await listingRow(id))!;
      expect(first.first_published_at).not.toBeNull();

      expect((await publish(id, context.staffToken)).status).toBe(200);
      expect((await unpublish(id)).status).toBe(200);
      expect((await listingRow(id))!.published_at).toBeNull();
      expect((await unpublish(id)).status).toBe(200); // idempotent
      expect((await publish(id)).status).toBe(200);

      const after = (await listingRow(id))!;
      expect(after.first_published_at).toEqual(first.first_published_at);
      expect(after.published_at).not.toBeNull();
    });
  });

  describe('R8 delete', () => {
    it('staff deleting an ever-published listing → 403 outcome and the row survives', async () => {
      const id = await publishedListing();
      const denied = await remove(id, context.staffToken);
      expect(denied.status).toBe(403);
      expect(denied.body).toEqual({ status: 'forbidden', reason: 'listing_published_owner_only' });

      await unpublish(id); // hiding does not unlock deletion (§6.M)
      expect((await remove(id, context.staffToken)).status).toBe(403);
      expect(await listingRow(id)).toBeDefined();
    });

    it('staff deletes a never-published draft → 204; its dresses are untouched', async () => {
      const id = idOf(await createListing({ slug: 'dam-xoa' }));
      const dressId = await context.db.seedDress('DEL-001');
      await setDresses(id, [dressId]);

      const response = await remove(id, context.staffToken);
      expect(response.status).toBe(204);
      expect(await listingRow(id)).toBeUndefined();
      const items = await context.db.query(
        'SELECT 1 FROM dress_listing_items WHERE listing_id = $1',
        [id],
      );
      expect(items.rowCount).toBe(0);
      const dress = await context.db.query('SELECT 1 FROM dresses WHERE id = $1', [dressId]);
      expect(dress.rowCount).toBe(1);
    });

    it('owner deletes a published listing → 204; a second delete → not_found', async () => {
      const id = await publishedListing();
      expect((await remove(id, context.token)).status).toBe(204);
      expect(await listingRow(id)).toBeUndefined();
      const again = await remove(id, context.token);
      expect(again.status).toBe(422);
      expect(again.body).toEqual({ status: 'rejected_listing_not_found' });
    });
  });
});
