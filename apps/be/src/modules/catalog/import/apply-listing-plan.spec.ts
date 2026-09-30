import { Err, Ok } from 'oxide.ts';
import { ListingPlanWriter, applyListingPlan } from './apply-listing-plan';
import { ListingPlan } from './listings-from-dresses';

const plan: ListingPlan = {
  baseCode: 'VAY02',
  codes: ['VAY02', 'VAY02_1'],
  name: 'Váy có tay',
  slug: 'vay-co-tay',
  styles: ['sleeved'],
  stylesDefaulted: false,
  photoUrls: [],
  dressIds: ['d1', 'd2'],
};

function writer(overrides: Partial<ListingPlanWriter> = {}): jest.Mocked<ListingPlanWriter> {
  return {
    listedDressIds: jest.fn().mockResolvedValue(new Set()),
    create: jest.fn().mockResolvedValue(Ok('listing-1')),
    attach: jest.fn().mockResolvedValue(Ok('listing-1')),
    discard: jest.fn().mockResolvedValue(Ok('listing-1')),
    ...overrides,
  } as jest.Mocked<ListingPlanWriter>;
}

describe('applyListingPlan', () => {
  it('creates, then attaches the whole group', async () => {
    const w = writer();
    await expect(applyListingPlan(plan, w)).resolves.toEqual({
      kind: 'created',
      listingId: 'listing-1',
    });
    expect(w.attach).toHaveBeenCalledWith('listing-1', ['d1', 'd2']);
    expect(w.discard).not.toHaveBeenCalled();
  });

  it('skips without writing when a dress got listed since the plan was read (C1)', async () => {
    const w = writer({ listedDressIds: jest.fn().mockResolvedValue(new Set(['d2'])) });
    await expect(applyListingPlan(plan, w)).resolves.toMatchObject({ kind: 'skipped' });
    expect(w.create).not.toHaveBeenCalled();
  });

  it('reports a refused create, nothing to discard', async () => {
    const w = writer({ create: jest.fn().mockResolvedValue(Err(new Error('slug taken'))) });
    await expect(applyListingPlan(plan, w)).resolves.toEqual({
      kind: 'failed',
      message: 'slug taken',
    });
    expect(w.attach).not.toHaveBeenCalled();
    expect(w.discard).not.toHaveBeenCalled();
  });

  it('reports a create that throws (VO validation)', async () => {
    const w = writer({ create: jest.fn().mockRejectedValue(new Error('bad name')) });
    await expect(applyListingPlan(plan, w)).resolves.toEqual({
      kind: 'failed',
      message: 'bad name',
    });
  });

  it.each([
    ['returns Err', jest.fn().mockResolvedValue(Err(new Error('dress not found')))],
    ['throws', jest.fn().mockRejectedValue(new Error('dress not found'))],
  ])('discards the fresh draft when attach %s — no orphan for the next run (C2)', async (_, attach) => {
    const w = writer({ attach });
    const outcome = await applyListingPlan(plan, w);
    expect(w.discard).toHaveBeenCalledWith('listing-1');
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'gắn váy thất bại, đã xoá nháp vừa tạo — dress not found',
    });
  });

  it('names the orphan draft when the discard fails too', async () => {
    const w = writer({
      attach: jest.fn().mockResolvedValue(Err(new Error('dress not found'))),
      discard: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const outcome = await applyListingPlan(plan, w);
    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.message).toContain('listing-1');
    expect(outcome.kind === 'failed' && outcome.message).toContain('db down');
  });
});
