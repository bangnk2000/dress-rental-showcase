import { E2eContext, startE2eApp } from './e2e-app';

/**
 * catalog/public-listing — the ANONYMOUS catalogue (`/public/dresses`), the BE's first endpoints
 * without a session (docs/design/catalog/public-listing.md R5, R6, R7, §Contract).
 */
describe('public catalogue — anonymous reads (real Postgres)', () => {
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

  const PHOTOS = ['https://img.test/p1.jpg', 'https://img.test/p2.jpg', 'https://img.test/p3.jpg'];

  /** Anonymous GET — deliberately NO token. */
  const anon = (path: string) => context.request(`/api/v1/public/dresses${path}`, { token: null });

  async function seedSizedDress(
    code: string,
    sizeLabel: string | null,
    rentalPrice: number,
    retired = false,
  ): Promise<string> {
    const id = await context.db.seedDress(code, { retired });
    await context.db.query('UPDATE dresses SET size_label = $2, rental_price = $3 WHERE id = $1', [
      id,
      sizeLabel,
      rentalPrice,
    ]);
    return id;
  }

  async function listing(
    slug: string,
    options: {
      styles?: string[];
      dressIds?: string[];
      publish?: boolean;
      isHot?: boolean;
      extra?: Record<string, unknown>;
    } = {},
  ): Promise<string> {
    const created = await context.request('/api/v1/listings', {
      method: 'POST',
      body: {
        name: `Mẫu ${slug}`,
        slug,
        tagline: `Tagline ${slug}`,
        description: `Mô tả ${slug}`,
        styles: options.styles ?? ['short'],
        photoUrls: PHOTOS,
        isHot: options.isHot ?? false,
        ...options.extra,
      },
      token: context.token,
    });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;
    const dressIds = options.dressIds ?? [await context.db.seedDress(`D-${slug.toUpperCase()}`)];
    const attached = await context.request(`/api/v1/listings/${id}/dresses`, {
      method: 'PUT',
      body: { dressIds },
      token: context.token,
    });
    expect(attached.status).toBe(200);
    if (options.publish ?? true) {
      const published = await context.request(`/api/v1/listings/${id}/publish`, {
        method: 'POST',
        token: context.token,
      });
      expect(published.status).toBe(200);
    }
    return id;
  }

  const slugs = (body: unknown) => (body as { slug: string }[]).map((row) => row.slug);

  describe('R5 visibility', () => {
    it('draft → 404 and absent; publish → 200 without a token; last active dress retired → 404', async () => {
      const dressId = await context.db.seedDress('VIS-001');
      const id = await listing('dam-vis', { dressIds: [dressId], publish: false });

      const draft = await anon('/dam-vis');
      expect(draft.status).toBe(404);
      expect((draft.body as { error: { code: string } }).error.code).toBe('GENERIC.NOT_FOUND');
      expect(slugs((await anon('')).body)).toEqual([]);

      await context.request(`/api/v1/listings/${id}/publish`, {
        method: 'POST',
        token: context.token,
      });
      expect((await anon('/dam-vis')).status).toBe(200);
      expect(slugs((await anon('')).body)).toEqual(['dam-vis']);

      // Retire the only dress (owner, through the API): the listing leaves the web by itself…
      const retired = await context.request(`/api/v1/dresses/${dressId}/retire`, {
        method: 'POST',
        token: context.token,
      });
      expect(retired.status).toBeLessThan(300);
      expect((await anon('/dam-vis')).status).toBe(404);
      expect(slugs((await anon('')).body)).toEqual([]);
      // …without being unpublished (R5: not an error, not an auto-unpublish).
      const row = await context.db.query<{ published_at: Date | null }>(
        'SELECT published_at FROM dress_listings WHERE id = $1',
        [id],
      );
      expect(row.rows[0]!.published_at).not.toBeNull();

      // Unpublished → gone too.
      const other = await listing('dam-an');
      expect((await anon('/dam-an')).status).toBe(200);
      await context.request(`/api/v1/listings/${other}/unpublish`, {
        method: 'POST',
        token: context.token,
      });
      expect((await anon('/dam-an')).status).toBe(404);
    });

    it('?style= keeps every listing that CONTAINS the style; an unknown one is 400', async () => {
      await listing('mau-nhieu-dip', { styles: ['short', 'silk', 'off-shoulder'] });
      await listing('mau-ao-dai', { styles: ['ao-dai'] });
      await listing('mau-sinh-nhat', { styles: ['silk'] });
      await listing('mau-phu-kien', { styles: ['accessory'] });

      expect(slugs((await anon('?style=silk')).body).sort()).toEqual([
        'mau-nhieu-dip',
        'mau-sinh-nhat',
      ]);
      expect(slugs((await anon('?style=off-shoulder')).body)).toEqual(['mau-nhieu-dip']);
      expect(slugs((await anon('?style=ao-dai')).body)).toEqual(['mau-ao-dai']);
      expect(slugs((await anon('?style=strappy-strapless')).body)).toEqual([]);
      expect(slugs((await anon('?style=accessory')).body)).toEqual(['mau-phu-kien']);
      expect((await anon('?style=prom')).status).toBe(400);
      expect(slugs((await anon('?limit=2')).body)).toHaveLength(2);
    });

    it('orders hot first, then most recently first-published', async () => {
      const old = await listing('mau-cu');
      const recent = await listing('mau-moi');
      await listing('mau-hot', { isHot: true });
      await context.db.query(
        "UPDATE dress_listings SET first_published_at = now() - interval '10 days' WHERE id = $1",
        [old],
      );
      await context.db.query(
        "UPDATE dress_listings SET first_published_at = now() - interval '5 days' WHERE id = $1",
        [recent],
      );
      await context.db.query(
        "UPDATE dress_listings SET first_published_at = now() - interval '40 days' WHERE slug = 'mau-hot'",
      );
      expect(slugs((await anon('')).body)).toEqual(['mau-hot', 'mau-moi', 'mau-cu']);
    });
  });

  describe('R6 whitelist + contract shape', () => {
    it('summary and detail carry EXACTLY the contract keys — nothing internal leaks', async () => {
      const m = await seedSizedDress('WL-M', 'M', 1_500_000);
      const s = await seedSizedDress('WL-S', 'S', 1_200_000, true); // retired: size shown, not available, price ignored
      const free = await seedSizedDress('WL-F', null, 1_800_000);
      const xl = await seedSizedDress('WL-XL', 'XL', 1_600_000);
      await context.db.query("UPDATE dresses SET notes = 'SECRET-NOTE', purchase_price = 777 WHERE id = $1", [m]);
      const id = await listing('dam-whitelist', {
        styles: ['short', 'sleeved'],
        dressIds: [m, s, free, xl],
        extra: {
          retailPrice: 4_500_000,
          specs: { material: 'Lụa', silhouette: 'Chữ A', color: 'Đỏ', stylesText: 'Dạ tiệc' },
        },
      });

      const list = await anon('');
      expect(list.status).toBe(200);
      const [summary] = list.body as Record<string, unknown>[];
      expect(Object.keys(summary!).sort()).toEqual(
        ['badge', 'cover', 'name', 'styles', 'rentalPrice', 'retailPrice', 'slug', 'tagline'].sort(),
      );
      expect(Object.keys(summary!.cover as object).sort()).toEqual(['alt', 'src']);
      expect(summary).toEqual({
        slug: 'dam-whitelist',
        name: 'Mẫu dam-whitelist',
        tagline: 'Tagline dam-whitelist',
        styles: ['short', 'sleeved'],
        badge: 'new',
        rentalPrice: 1_500_000, // min over ACTIVE dresses (the retired 1.2M is ignored)
        retailPrice: 4_500_000,
        cover: { src: PHOTOS[0], alt: 'Mẫu dam-whitelist' },
      });

      const detail = await anon('/dam-whitelist');
      expect(detail.status).toBe(200);
      const body = detail.body as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(
        [
          'badge',
          'cover',
          'description',
          'images',
          'name',
          'styles',
          'rentalPrice',
          'retailPrice',
          'sizes',
          'slug',
          'specs',
          'tagline',
        ].sort(),
      );
      expect(Object.keys(body.specs as object).sort()).toEqual(
        ['color', 'length', 'material', 'styles', 'silhouette'].sort(),
      );
      expect(body.specs).toEqual({
        material: 'Lụa',
        silhouette: 'Chữ A',
        length: null,
        color: 'Đỏ',
        styles: 'Dạ tiệc',
      });
      expect(body.images).toEqual([
        { src: PHOTOS[0], alt: 'Mẫu dam-whitelist' },
        { src: PHOTOS[1], alt: 'Mẫu dam-whitelist — ảnh 2' },
        { src: PHOTOS[2], alt: 'Mẫu dam-whitelist — ảnh 3' },
      ]);
      expect(body.sizes).toEqual([
        { label: 'S', available: false },
        { label: 'M', available: true },
        { label: 'XL', available: true },
        { label: 'Freesize', available: true },
      ]);
      expect(body.description).toBe('Mô tả dam-whitelist');

      const raw = JSON.stringify([list.body, detail.body]);
      for (const secret of [id, m, 'WL-M', 'SECRET-NOTE', '777', '3000000']) {
        expect(raw).not.toContain(secret);
      }
    });

    it('sends Cache-Control: public, max-age=60 on both endpoints', async () => {
      await listing('dam-cache');
      for (const path of ['', '/dam-cache']) {
        const response = await fetch(`${context.baseUrl}/api/v1/public/dresses${path}`);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('public, max-age=60');
      }
    });

    it('badge: hot > new (≤ 30 days since FIRST publish) > available', async () => {
      const id = await listing('dam-badge');
      const badge = async () => ((await anon('/dam-badge')).body as { badge: string }).badge;
      expect(await badge()).toBe('new');
      await context.db.query(
        "UPDATE dress_listings SET first_published_at = now() - interval '31 days' WHERE id = $1",
        [id],
      );
      expect(await badge()).toBe('available');
      await context.request(`/api/v1/listings/${id}`, {
        method: 'PATCH',
        body: { isHot: true },
        token: context.token,
      });
      expect(await badge()).toBe('hot');
    });
  });

  it('R7: duplicating a dress that is in two listings puts the copy in both; the new size shows publicly', async () => {
    const sourceId = await seedSizedDress('R7-001', 'M', 1_500_000);
    const a = await listing('mau-a', { dressIds: [sourceId] });
    const b = await listing('mau-b', { dressIds: [sourceId] });

    const copy = await context.request(`/api/v1/dresses/${sourceId}/duplicate`, {
      method: 'POST',
      body: { sizeLabel: 'L' },
      token: context.staffToken,
    });
    expect(copy.status).toBe(201);
    const copyId = (copy.body as { id: string }).id;

    const detail = await context.request(`/api/v1/dresses/${copyId}`, { token: context.token });
    expect(
      ((detail.body as { listings: { id: string }[] }).listings.map((row) => row.id)).sort(),
    ).toEqual([a, b].sort());

    for (const slug of ['mau-a', 'mau-b']) {
      const publicDetail = await anon(`/${slug}`);
      expect((publicDetail.body as { sizes: unknown }).sizes).toEqual([
        { label: 'M', available: true },
        { label: 'L', available: true },
      ]);
    }
  });
});
