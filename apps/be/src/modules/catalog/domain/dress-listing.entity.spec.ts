import { DressListingEntity } from './dress-listing.entity';
import {
  ListingDeleteOwnerOnlyError,
  ListingNotPublishableError,
  ListingPhotoRequiredError,
  ListingSlugLockedError,
} from './dress-listing.errors';
import { ListingContent } from './dress-listing.types';
import { ListingSlug } from './listing-slug.value-object';
import { Occasions } from './occasion.value-object';

const T0 = new Date('2026-09-01T00:00:00Z');
const T1 = new Date('2026-09-02T00:00:00Z');
const T2 = new Date('2026-09-03T00:00:00Z');

function content(overrides: Partial<ListingContent> = {}): ListingContent {
  return {
    name: 'Đầm Ánh Trăng',
    tagline: '',
    description: '',
    occasions: Occasions.create(['gala']),
    retailPrice: null,
    specs: { material: null, silhouette: null, length: null, color: null, occasionsText: null },
    photoUrls: ['https://img.test/1.jpg'],
    isHot: false,
    ...overrides,
  };
}

function draft(photoUrls = ['https://img.test/1.jpg']): DressListingEntity {
  return DressListingEntity.create(
    { ...content({ photoUrls }), slug: ListingSlug.create('dam-anh-trang') },
    'listing-1',
    T0,
  );
}

describe('DressListingEntity', () => {
  it('starts as a never-published draft with no dresses', () => {
    const listing = draft();
    expect(listing.isPublished).toBe(false);
    expect(listing.wasEverPublished).toBe(false);
    expect(listing.dressIds).toEqual([]);
  });

  describe('publish', () => {
    it('reports EVERY missing requirement at once', () => {
      const result = draft([]).publish(T1, 0);
      const error = result.unwrapErr() as ListingNotPublishableError;
      expect(error).toBeInstanceOf(ListingNotPublishableError);
      expect(error.missing).toEqual(['photo', 'active_dress']);
      expect(draft().publish(T1, 0).unwrapErr()).toMatchObject({ missing: ['active_dress'] });
      expect(draft([]).publish(T1, 3).unwrapErr()).toMatchObject({ missing: ['photo'] });
    });

    it('sets both timestamps once; publishing again keeps them (idempotent)', () => {
      const listing = draft();
      listing.publish(T1, 1).unwrap();
      listing.publish(T2, 1).unwrap();
      expect(listing.getProps().publishedAt).toEqual(T1);
      expect(listing.getProps().firstPublishedAt).toEqual(T1);
    });

    it('unpublish then republish keeps the FIRST publication date', () => {
      const listing = draft();
      listing.publish(T1, 1).unwrap();
      listing.unpublish(T2);
      expect(listing.isPublished).toBe(false);
      expect(listing.wasEverPublished).toBe(true);
      listing.publish(T2, 1).unwrap();
      expect(listing.getProps().publishedAt).toEqual(T2);
      expect(listing.getProps().firstPublishedAt).toEqual(T1);
    });
  });

  describe('R2 slug lock', () => {
    it('a draft may change its slug', () => {
      const listing = draft();
      expect(listing.changeSlug(ListingSlug.create('dam-moi'), T1).unwrap()).toBe(true);
      expect(listing.slug.unpack()).toBe('dam-moi');
    });

    it('an ever-published listing may not — even after being hidden again', () => {
      const listing = draft();
      listing.publish(T1, 1).unwrap();
      listing.unpublish(T2);
      const result = listing.changeSlug(ListingSlug.create('dam-moi'), T2);
      expect(result.unwrapErr()).toBeInstanceOf(ListingSlugLockedError);
      expect(listing.slug.unpack()).toBe('dam-anh-trang');
    });

    it('re-sending the SAME slug is not a change, even when locked', () => {
      const listing = draft();
      listing.publish(T1, 1).unwrap();
      expect(listing.changeSlug(ListingSlug.create('dam-anh-trang'), T2).unwrap()).toBe(false);
    });
  });

  describe('R3 photo', () => {
    it('a published listing cannot drop its last photo', () => {
      const listing = draft();
      listing.publish(T1, 1).unwrap();
      const result = listing.updateContent(content({ photoUrls: [] }), T2);
      expect(result.unwrapErr()).toBeInstanceOf(ListingPhotoRequiredError);
      expect(listing.getProps().photoUrls).toEqual(['https://img.test/1.jpg']);
    });

    it('a draft (or a hidden listing) may have no photo', () => {
      const listing = draft();
      expect(listing.updateContent(content({ photoUrls: [] }), T1).isOk()).toBe(true);
      const hidden = draft();
      hidden.publish(T1, 1).unwrap();
      hidden.unpublish(T2);
      expect(hidden.updateContent(content({ photoUrls: [] }), T2).isOk()).toBe(true);
    });
  });

  it('setDresses keeps a SET (duplicates collapse)', () => {
    const listing = draft();
    listing.setDresses(['a', 'b', 'a'], T1);
    expect(listing.dressIds).toEqual(['a', 'b']);
  });

  describe('R8 delete', () => {
    it('owner deletes anything; staff only a never-published listing', () => {
      const fresh = draft();
      expect(fresh.assertDeletableBy('staff').isOk()).toBe(true);
      const published = draft();
      published.publish(T1, 1).unwrap();
      expect(published.assertDeletableBy('owner').isOk()).toBe(true);
      expect(published.assertDeletableBy('staff').unwrapErr()).toBeInstanceOf(
        ListingDeleteOwnerOnlyError,
      );
      published.unpublish(T2); // hiding does not unlock it (§6.M)
      expect(published.assertDeletableBy('staff').isErr()).toBe(true);
    });
  });
});
