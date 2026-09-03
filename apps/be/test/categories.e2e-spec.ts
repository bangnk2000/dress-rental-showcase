import { E2eContext, startE2eApp } from './e2e-app';

/**
 * catalog/dress-category invariant proofs (docs/design/catalog/dress-category.md): UNIQUE
 * lower(name) under race and raw SQL, the FK ON DELETE RESTRICT, assignment lifecycle, and the
 * staff-manage / owner-delete policy split.
 */
describe('dress categories (real Postgres)', () => {
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

  const createCategory = (name: string, token?: string) =>
    context.request('/api/v1/categories', {
      method: 'POST',
      body: { name },
      token: token ?? context.token,
    });

  async function categoryId(name: string): Promise<string> {
    const response = await createCategory(name);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  it('AC1: names are unique case-insensitively — API, race, and raw INSERT', async () => {
    await categoryId('Dạ Hội');

    const duplicate = await createCategory('dạ hội');
    expect(duplicate.status).toBe(422);
    expect(duplicate.body).toEqual({ status: 'rejected_category_name_taken', name: 'dạ hội' });

    const body = { name: 'Trùng Tên' };
    const [first, second] = await Promise.all([
      context.request('/api/v1/categories', { method: 'POST', body, token: context.token }),
      context.request('/api/v1/categories', { method: 'POST', body, token: context.token }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 422]);

    await expect(
      context.db.query(
        `INSERT INTO categories (id, name) VALUES (gen_random_uuid(), $1)`,
        ['TRÙNG TÊN'],
      ),
    ).rejects.toThrow(/unique|categories_name_lower_key/i);
  });

  it('AC2: a dress joins a category, moves, and clears back to unclassified', async () => {
    const daHoi = await categoryId('Dạ hội');
    const cuoi = await categoryId('Cưới');
    const dressId = await context.db.seedDress('CAT-001');

    const assign = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: daHoi },
      token: context.token,
    });
    expect(assign.status).toBe(200);

    const move = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: cuoi },
      token: context.token,
    });
    expect(move.status).toBe(200);

    const detail = await context.request(`/api/v1/dresses/${dressId}`, { token: context.token });
    expect((detail.body as { categoryId: string }).categoryId).toBe(cuoi);

    const clear = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: null },
      token: context.token,
    });
    expect(clear.status).toBe(200);
    const cleared = await context.request(`/api/v1/dresses/${dressId}`, { token: context.token });
    expect((cleared.body as { categoryId: string | null }).categoryId).toBeNull();
  });

  it('assigning a category that no longer exists is refused by name', async () => {
    const dressId = await context.db.seedDress('CAT-002');
    const response = await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: '00000000-0000-4000-8000-000000000999' },
      token: context.token,
    });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ status: 'rejected_category_not_found' });
  });

  it('AC3: deleting a category in use is refused with the count; the FK blocks raw SQL; an empty one deletes', async () => {
    const id = await categoryId('Sắp xoá');
    const dressId = await context.db.seedDress('CAT-003');
    await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: id },
      token: context.token,
    });

    const refused = await context.request(`/api/v1/categories/${id}`, {
      method: 'DELETE',
      token: context.token,
    });
    expect(refused.status).toBe(422);
    expect(refused.body).toEqual({ status: 'rejected_category_in_use', dressCount: 1 });

    await expect(
      context.db.query('DELETE FROM categories WHERE id = $1', [id]),
    ).rejects.toThrow(/foreign key|violates/i);

    await context.request(`/api/v1/dresses/${dressId}`, {
      method: 'PATCH',
      body: { categoryId: null },
      token: context.token,
    });
    const deleted = await context.request(`/api/v1/categories/${id}`, {
      method: 'DELETE',
      token: context.token,
    });
    expect(deleted.status).toBe(200);
  });

  it('AC4: the dress list filters by category and the category list carries counts', async () => {
    const id = await categoryId('Lọc');
    const inCategory = await context.db.seedDress('CAT-004');
    await context.db.seedDress('CAT-005'); // unclassified
    await context.request(`/api/v1/dresses/${inCategory}`, {
      method: 'PATCH',
      body: { categoryId: id },
      token: context.token,
    });

    const filtered = await context.request(`/api/v1/dresses?categoryId=${id}`, {
      token: context.token,
    });
    const list = filtered.body as { count: number; data: { id: string }[] };
    expect(list.count).toBe(1);
    expect(list.data[0]!.id).toBe(inCategory);

    const categories = await context.request('/api/v1/categories', { token: context.token });
    const rows = (categories.body as { data: { name: string; dressCount: number }[] }).data;
    expect(rows.find((row) => row.name === 'Lọc')?.dressCount).toBe(1);
  });

  it('policy split (§6.Q1): staff create and rename; only the owner deletes', async () => {
    const created = await createCategory('Của staff', context.staffToken);
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;

    const renamed = await context.request(`/api/v1/categories/${id}`, {
      method: 'PATCH',
      body: { name: 'Staff đổi tên' },
      token: context.staffToken,
    });
    expect(renamed.status).toBe(200);

    const staffDelete = await context.request(`/api/v1/categories/${id}`, {
      method: 'DELETE',
      token: context.staffToken,
    });
    expect(staffDelete.status).toBe(403);
    expect(staffDelete.body).toMatchObject({ error: { code: 'GENERIC.FORBIDDEN' } });

    const ownerDelete = await context.request(`/api/v1/categories/${id}`, {
      method: 'DELETE',
      token: context.token,
    });
    expect(ownerDelete.status).toBe(200);
  });
});
