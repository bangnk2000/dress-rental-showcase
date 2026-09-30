import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fixtureDresses, fixtureSummaries } from '@/test/fixtures/public-dresses';

import { getPublicDressHttpControllerGet, listPublicDressesHttpControllerList } from './generated/catalog/catalog';
import { HttpError } from './mutator/custom-fetch';
import { getPublicDress, listPublicDresses } from './public-catalog';

vi.mock('server-only', () => ({}));
vi.mock('./generated/catalog/catalog', () => ({
  listPublicDressesHttpControllerList: vi.fn(),
  getPublicDressHttpControllerGet: vi.fn(),
}));

const list = vi.mocked(listPublicDressesHttpControllerList);
const get = vi.mocked(getPublicDressHttpControllerGet);
const isr = { cache: 'force-cache', next: { revalidate: 300, tags: ['public-dresses'] } };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe('public catalogue over the generated client', () => {
  test('lists through the Next Data Cache with a 5-minute revalidate', async () => {
    list.mockResolvedValue(fixtureSummaries);
    expect(await listPublicDresses({ limit: 8 })).toBe(fixtureSummaries);
    expect(list).toHaveBeenCalledWith({ limit: 8 }, isr);
    await listPublicDresses();
    expect(list).toHaveBeenLastCalledWith(undefined, isr);
  });

  test('detail: a 404 is null (the page renders the 404); other errors propagate', async () => {
    get.mockResolvedValueOnce(fixtureDresses[0]!);
    expect(await getPublicDress('dam-da-hoi-long-lay')).toBe(fixtureDresses[0]);
    expect(get).toHaveBeenCalledWith('dam-da-hoi-long-lay', isr);

    get.mockRejectedValueOnce(new HttpError(404, undefined));
    expect(await getPublicDress('an')).toBeNull();
    get.mockRejectedValueOnce(new HttpError(500, undefined));
    await expect(getPublicDress('loi')).rejects.toThrow('HTTP 500');
  });

  test('an unreachable BE empties the list only during next build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    list.mockRejectedValue(new TypeError('fetch failed'));
    await expect(listPublicDresses({ limit: 1 })).rejects.toThrow('fetch failed');

    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    expect(await listPublicDresses({ limit: 2 })).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();

    list.mockRejectedValue(new HttpError(500, undefined));
    await expect(listPublicDresses({ limit: 3 })).rejects.toThrow('HTTP 500');
  });
});
