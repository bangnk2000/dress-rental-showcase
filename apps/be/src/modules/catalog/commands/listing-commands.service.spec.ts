import { DressListingRepositoryPort } from '../application/ports/dress-listing.repository.port';
import {
  ListingGoneError,
  ListingPhotoCheckError,
  ListingSlugConflictError,
  ListingSlugLockedConflictError,
} from '../application/ports/listing-write-conflict.errors';
import { DressListingEntity } from '../domain/dress-listing.entity';
import {
  ListingDeleteOwnerOnlyError,
  ListingDressesNotFoundError,
  ListingNotFoundError,
  ListingNotPublishableError,
  ListingPhotoRequiredError,
  ListingSlugLockedError,
  ListingSlugTakenError,
} from '../domain/dress-listing.errors';
import { ListingSlug } from '../domain/listing-slug.value-object';
import { Occasions } from '../domain/occasion.value-object';
import { CreateListingCommand } from './create-listing/create-listing.command';
import { CreateListingService } from './create-listing/create-listing.service';
import { DeleteListingCommand } from './delete-listing/delete-listing.command';
import { DeleteListingService } from './delete-listing/delete-listing.service';
import { PublishListingCommand } from './publish-listing/publish-listing.command';
import { PublishListingService } from './publish-listing/publish-listing.service';
import { SetListingDressesCommand } from './set-listing-dresses/set-listing-dresses.command';
import { SetListingDressesService } from './set-listing-dresses/set-listing-dresses.service';
import { UnpublishListingCommand } from './unpublish-listing/unpublish-listing.command';
import { UnpublishListingService } from './unpublish-listing/unpublish-listing.service';
import { UpdateListingCommand } from './update-listing/update-listing.command';
import { UpdateListingService } from './update-listing/update-listing.service';

const LISTING_ID = '00000000-0000-4000-8000-00000000a001';
const DRESS_A = '00000000-0000-4000-8000-00000000d001';
const DRESS_B = '00000000-0000-4000-8000-00000000d002';
const NO_SPECS = {
  material: null,
  silhouette: null,
  length: null,
  color: null,
  occasionsText: null,
};

function makeListing(state: 'draft' | 'published' | 'hidden' = 'draft'): DressListingEntity {
  const listing = DressListingEntity.create(
    {
      slug: ListingSlug.create('dam-anh-trang'),
      name: 'Đầm Ánh Trăng',
      tagline: '',
      description: '',
      occasions: Occasions.create(['gala']),
      retailPrice: null,
      specs: NO_SPECS,
      photoUrls: ['https://img.test/1.jpg'],
      isHot: false,
    },
    LISTING_ID,
    new Date('2026-09-01T00:00:00Z'),
  );
  if (state !== 'draft') listing.publish(new Date('2026-09-02T00:00:00Z'), 1).unwrap();
  if (state === 'hidden') listing.unpublish(new Date('2026-09-03T00:00:00Z'));
  return listing;
}

function makeRepo(
  overrides: Partial<DressListingRepositoryPort> = {},
): jest.Mocked<DressListingRepositoryPort> {
  return {
    nextId: jest.fn().mockReturnValue(LISTING_ID),
    findOneById: jest.fn().mockResolvedValue(makeListing()),
    slugTaken: jest.fn().mockResolvedValue(false),
    insert: jest.fn().mockResolvedValue(undefined),
    updateContent: jest.fn().mockResolvedValue(undefined),
    replaceDresses: jest.fn().mockResolvedValue(undefined),
    findExistingDressIds: jest.fn().mockImplementation(async (ids: string[]) => ids),
    countActiveDresses: jest.fn().mockResolvedValue(1),
    markPublished: jest.fn().mockResolvedValue(undefined),
    markUnpublished: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(1),
    ...overrides,
  } as jest.Mocked<DressListingRepositoryPort>;
}

const createCommand = (slug?: string) =>
  new CreateListingCommand({
    name: 'Đầm dạ hội Ánh Trăng',
    slug,
    tagline: '',
    description: '',
    occasions: ['gala', 'birthday'],
    retailPrice: null,
    specs: NO_SPECS,
    photoUrls: [],
    isHot: false,
  });

describe('CreateListingService', () => {
  it('derives the slug from the name when omitted and inserts a draft', async () => {
    const repo = makeRepo();
    const result = await new CreateListingService(repo).execute(createCommand());
    expect(result.unwrap()).toBe(LISTING_ID);
    const inserted = repo.insert.mock.calls[0]![0];
    expect(inserted.slug.unpack()).toBe('dam-da-hoi-anh-trang');
    expect(inserted.isPublished).toBe(false);
  });

  it('pre-check: a taken slug → ListingSlugTakenError carrying the slug, nothing written', async () => {
    const repo = makeRepo({ slugTaken: jest.fn().mockResolvedValue(true) });
    const result = await new CreateListingService(repo).execute(createCommand('dam-x'));
    const error = result.unwrapErr();
    expect(error).toBeInstanceOf(ListingSlugTakenError);
    expect(error.slug).toBe('dam-x');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('race: UNIQUE refusal → the SAME ListingSlugTakenError', async () => {
    const repo = makeRepo({ insert: jest.fn().mockRejectedValue(new ListingSlugConflictError()) });
    const result = await new CreateListingService(repo).execute(createCommand('dam-x'));
    expect(result.unwrapErr()).toMatchObject({ slug: 'dam-x' });
    expect(result.unwrapErr()).toBeInstanceOf(ListingSlugTakenError);
  });
});

describe('UpdateListingService', () => {
  const update = (props: Partial<ConstructorParameters<typeof UpdateListingCommand>[0]>) =>
    new UpdateListingCommand({ listingId: LISTING_ID, ...props });

  it('not found', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
    const result = await new UpdateListingService(repo).execute(update({ name: 'x' }));
    expect(result.unwrapErr()).toBeInstanceOf(ListingNotFoundError);
  });

  it('R2: slug change of an ever-published listing → locked, nothing written', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(makeListing('hidden')) });
    const result = await new UpdateListingService(repo).execute(update({ slug: 'dam-moi' }));
    expect(result.unwrapErr()).toBeInstanceOf(ListingSlugLockedError);
    expect(repo.updateContent).not.toHaveBeenCalled();
  });

  it('R2 race: the guarded UPDATE matched 0 rows → the SAME locked error', async () => {
    const repo = makeRepo({
      updateContent: jest.fn().mockRejectedValue(new ListingSlugLockedConflictError()),
    });
    const result = await new UpdateListingService(repo).execute(update({ slug: 'dam-moi' }));
    expect(result.unwrapErr()).toBeInstanceOf(ListingSlugLockedError);
    expect(repo.updateContent).toHaveBeenCalledWith(expect.anything(), { slugChanged: true });
  });

  it('R1: pre-check and UNIQUE race both answer slug_taken with the slug', async () => {
    const taken = makeRepo({ slugTaken: jest.fn().mockResolvedValue(true) });
    const r1 = await new UpdateListingService(taken).execute(update({ slug: 'dam-moi' }));
    expect(r1.unwrapErr()).toMatchObject({ slug: 'dam-moi' });
    expect(taken.slugTaken).toHaveBeenCalledWith('dam-moi', LISTING_ID);

    const race = makeRepo({
      updateContent: jest.fn().mockRejectedValue(new ListingSlugConflictError()),
    });
    const r2 = await new UpdateListingService(race).execute(update({ slug: 'dam-moi' }));
    expect(r2.unwrapErr()).toBeInstanceOf(ListingSlugTakenError);
    expect(r2.unwrapErr()).toMatchObject({ slug: 'dam-moi' });
  });

  it('R3: emptying the photos of a published listing → photo_required (entity and CHECK)', async () => {
    const entity = makeRepo({ findOneById: jest.fn().mockResolvedValue(makeListing('published')) });
    const r1 = await new UpdateListingService(entity).execute(update({ photoUrls: [] }));
    expect(r1.unwrapErr()).toBeInstanceOf(ListingPhotoRequiredError);

    const check = makeRepo({
      updateContent: jest.fn().mockRejectedValue(new ListingPhotoCheckError()),
    });
    const r2 = await new UpdateListingService(check).execute(update({ photoUrls: [] }));
    expect(r2.unwrapErr()).toBeInstanceOf(ListingPhotoRequiredError);
  });

  it('omitted fields are kept, null spec cells clear, and the slug write is skipped', async () => {
    const repo = makeRepo();
    const result = await new UpdateListingService(repo).execute(
      update({ tagline: 'Mới', specs: { color: 'Đỏ' }, retailPrice: 100 }),
    );
    expect(result.isOk()).toBe(true);
    const [saved, options] = repo.updateContent.mock.calls[0]!;
    const props = saved.getProps();
    expect(props.name).toBe('Đầm Ánh Trăng');
    expect(props.tagline).toBe('Mới');
    expect(props.specs.color).toBe('Đỏ');
    expect(props.specs.material).toBeNull();
    expect(props.retailPrice?.amount).toBe(100);
    expect(options).toEqual({ slugChanged: false });
  });
});

describe('SetListingDressesService', () => {
  it('names exactly the unknown dress ids', async () => {
    const repo = makeRepo({ findExistingDressIds: jest.fn().mockResolvedValue([DRESS_A]) });
    const result = await new SetListingDressesService(repo).execute(
      new SetListingDressesCommand({ listingId: LISTING_ID, dressIds: [DRESS_A, DRESS_B] }),
    );
    const error = result.unwrapErr() as ListingDressesNotFoundError;
    expect(error).toBeInstanceOf(ListingDressesNotFoundError);
    expect(error.dressIds).toEqual([DRESS_B]);
    expect(repo.replaceDresses).not.toHaveBeenCalled();
  });

  it('replaces with the de-duplicated set', async () => {
    const repo = makeRepo();
    await new SetListingDressesService(repo).execute(
      new SetListingDressesCommand({ listingId: LISTING_ID, dressIds: [DRESS_A, DRESS_A, DRESS_B] }),
    );
    expect(repo.replaceDresses).toHaveBeenCalledWith(LISTING_ID, [DRESS_A, DRESS_B]);
  });

  it('listing gone (not found / FK race) → not found', async () => {
    const missing = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
    const r1 = await new SetListingDressesService(missing).execute(
      new SetListingDressesCommand({ listingId: LISTING_ID, dressIds: [] }),
    );
    expect(r1.unwrapErr()).toBeInstanceOf(ListingNotFoundError);
    const race = makeRepo({ replaceDresses: jest.fn().mockRejectedValue(new ListingGoneError()) });
    const r2 = await new SetListingDressesService(race).execute(
      new SetListingDressesCommand({ listingId: LISTING_ID, dressIds: [] }),
    );
    expect(r2.unwrapErr()).toBeInstanceOf(ListingNotFoundError);
  });
});

describe('PublishListingService', () => {
  const publish = () => new PublishListingCommand({ listingId: LISTING_ID });

  it('no active dress → not_publishable naming active_dress, nothing written', async () => {
    const repo = makeRepo({ countActiveDresses: jest.fn().mockResolvedValue(0) });
    const result = await new PublishListingService(repo).execute(publish());
    expect((result.unwrapErr() as ListingNotPublishableError).missing).toEqual(['active_dress']);
    expect(repo.markPublished).not.toHaveBeenCalled();
  });

  it('the photo CHECK firing (photos removed meanwhile) → not_publishable [photo]', async () => {
    const repo = makeRepo({
      markPublished: jest.fn().mockRejectedValue(new ListingPhotoCheckError()),
    });
    const result = await new PublishListingService(repo).execute(publish());
    expect((result.unwrapErr() as ListingNotPublishableError).missing).toEqual(['photo']);
  });

  it('happy path writes through the COALESCE publish', async () => {
    const repo = makeRepo();
    const result = await new PublishListingService(repo).execute(publish());
    expect(result.unwrap()).toBe(LISTING_ID);
    expect(repo.markPublished).toHaveBeenCalledWith(LISTING_ID, expect.any(Date));
  });
});

describe('UnpublishListingService', () => {
  it('only rejects not_found', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(null) });
    const result = await new UnpublishListingService(repo).execute(
      new UnpublishListingCommand({ listingId: LISTING_ID }),
    );
    expect(result.unwrapErr()).toBeInstanceOf(ListingNotFoundError);
    const ok = makeRepo({ findOneById: jest.fn().mockResolvedValue(makeListing('published')) });
    const r2 = await new UnpublishListingService(ok).execute(
      new UnpublishListingCommand({ listingId: LISTING_ID }),
    );
    expect(r2.isOk()).toBe(true);
    expect(ok.markUnpublished).toHaveBeenCalled();
  });
});

describe('DeleteListingService (R8)', () => {
  const remove = (actorRole: 'owner' | 'staff') =>
    new DeleteListingCommand({ listingId: LISTING_ID, actorRole });

  it('staff + ever-published → owner-only denial, nothing deleted', async () => {
    const repo = makeRepo({ findOneById: jest.fn().mockResolvedValue(makeListing('hidden')) });
    const result = await new DeleteListingService(repo).execute(remove('staff'));
    expect(result.unwrapErr()).toBeInstanceOf(ListingDeleteOwnerOnlyError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('staff + draft → conditional delete; owner → unconditional', async () => {
    const staff = makeRepo();
    expect((await new DeleteListingService(staff).execute(remove('staff'))).isOk()).toBe(true);
    expect(staff.delete).toHaveBeenCalledWith(LISTING_ID, { onlyIfNeverPublished: true });

    const owner = makeRepo({ findOneById: jest.fn().mockResolvedValue(makeListing('published')) });
    expect((await new DeleteListingService(owner).execute(remove('owner'))).isOk()).toBe(true);
    expect(owner.delete).toHaveBeenCalledWith(LISTING_ID, { onlyIfNeverPublished: false });
  });

  it('staff race: a publish landed first (0 rows, row still there) → the SAME denial', async () => {
    const repo = makeRepo({ delete: jest.fn().mockResolvedValue(0) });
    const result = await new DeleteListingService(repo).execute(remove('staff'));
    expect(result.unwrapErr()).toBeInstanceOf(ListingDeleteOwnerOnlyError);
  });

  it('0 rows because the row is gone → not found', async () => {
    const repo = makeRepo({
      delete: jest.fn().mockResolvedValue(0),
      findOneById: jest.fn().mockResolvedValueOnce(makeListing()).mockResolvedValueOnce(null),
    });
    const result = await new DeleteListingService(repo).execute(remove('staff'));
    expect(result.unwrapErr()).toBeInstanceOf(ListingNotFoundError);
  });
});
