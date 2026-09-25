import { describe, expect, test } from 'vitest';

import { getPublicDress, listPublicDresses, listRelatedDresses } from './public-catalog';

describe('mock public catalogue', () => {
  test('lists every dress, or the first N with a limit, as summaries only', async () => {
    const all = await listPublicDresses();
    expect(all).toHaveLength(8);
    expect(await listPublicDresses({ limit: 4 })).toEqual(all.slice(0, 4));
    // summaries never carry the detail-only fields
    expect(all[0]).not.toHaveProperty('sizes');
    expect(all[0]).not.toHaveProperty('description');
  });

  test('slugs are unique and every detail has at least one image and a size list', async () => {
    const all = await listPublicDresses();
    expect(new Set(all.map((d) => d.slug)).size).toBe(all.length);
    for (const { slug } of all) {
      const dress = await getPublicDress(slug);
      expect(dress?.images.length).toBeGreaterThan(0);
      expect(dress?.images[0]).toEqual(dress?.cover);
      expect(dress?.sizes.length).toBeGreaterThan(0);
    }
  });

  test('an unknown slug is null (the page turns it into the 404)', async () => {
    expect(await getPublicDress('khong-ton-tai')).toBeNull();
  });

  test('related: same occasion first, never the dress itself, capped', async () => {
    const related = await listRelatedDresses('dam-da-hoi-long-lay');
    expect(related).toHaveLength(4);
    expect(related.map((d) => d.slug)).not.toContain('dam-da-hoi-long-lay');
    expect(related[0]).toMatchObject({ slug: 'dam-tulle-hong-phan', occasion: 'gala' });
    expect(await listRelatedDresses('dam-da-hoi-long-lay', 2)).toHaveLength(2);
  });
});
