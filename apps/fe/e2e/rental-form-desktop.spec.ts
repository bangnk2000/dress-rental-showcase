import { expect, test } from '@playwright/test';

/**
 * rental-form-ux AC1 (docs/design/rental-form-ux.md P2, §5), project `chromium`: on a desktop the
 * new/edit rental form is two columns — fields on the left, the summary on the right — and the
 * summary (with the ONE submit) sticks under the header, so after scrolling to the end of a long
 * form the submit is still on screen.
 *
 * Fixtures through the API, names unique per run — the database is not assumed empty
 * (apps/fe/AGENTS.md deviation 5). Eight dresses make the form scroll further than the submit's
 * own offset from the top, so a submit that did NOT stick would leave the screen — the check is
 * not vacuous (asserted below, and verified red with `lg:sticky` removed).
 */

test.use({ viewport: { width: 1280, height: 800 } });

const RUN = Date.now().toString(36);
// Upper case: the API stores dress codes upper-cased.
const CODE_PREFIX = `DK-${RUN.toUpperCase()}`;
const DRESSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((suffix) => ({
  code: `${CODE_PREFIX}-${suffix}`,
  name: `Váy máy tính ${RUN} ${suffix}`,
}));

test.beforeAll(async ({ playwright }, testInfo) => {
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const login = await api.post('/api/v1/auth/login', {
    data: { username: 'owner', password: 'changeme' },
  });
  expect(login.ok(), `login as owner → HTTP ${login.status()}`).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  for (const dress of DRESSES) {
    const res = await api.post('/api/v1/dresses', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { ...dress, sizeLabel: 'M', rentalPrice: 1_000_000, depositAmount: 2_000_000 },
    });
    expect(res.ok(), `POST /dresses → ${res.status()} ${await res.text()}`).toBe(true);
  }
  await api.dispose();
});

test('new rental: summary in the right column, submit still on screen at the end of the form', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill('owner');
  await page.getByLabel('Mật khẩu').fill('changeme');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay', exact: true })).toBeVisible();

  await page.goto('/rentals/new');
  await expect(page.getByRole('heading', { name: 'Tạo lượt thuê', exact: true })).toBeVisible();
  const nameField = page.getByLabel('Tên khách');
  // A fill during the lazy-route swap can land on an input that gets replaced (happy path note).
  await expect(async () => {
    await nameField.fill(`Khách máy tính ${RUN}`);
    await expect(nameField).toHaveValue(`Khách máy tính ${RUN}`);
  }).toPass();
  for (const dress of DRESSES) {
    await page.getByPlaceholder('Tìm theo mã hoặc tên váy…').fill(dress.code);
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(page.getByText(dress.code, { exact: true })).toBeVisible();
  }

  const summary = page.getByRole('region', { name: 'Tóm tắt đơn thuê' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Tạm tính tiền thuê')).toBeVisible();
  await expect(summary.getByText(/^Khách trả/)).toBeVisible();
  const submit = page.getByRole('button', { name: 'Tạo lượt thuê', exact: true });
  await expect(submit).toHaveCount(1);

  // Two columns: the summary starts right of the fields (every field, so a wide one cannot hide).
  const summaryBox = await summary.boundingBox();
  expect(summaryBox, 'summary has no box').not.toBeNull();
  for (const label of ['Tên khách', 'Ngày nhận', 'Giảm giá (VND)', 'Ghi chú']) {
    const box = await page.getByLabel(label).boundingBox();
    expect(box, `${label} has no box`).not.toBeNull();
    if (box && summaryBox) {
      expect
        .soft(summaryBox.x, `summary is not right of "${label}"`)
        .toBeGreaterThanOrEqual(box.x + box.width);
    }
  }

  // Where the submit sits with the page at the top. The page must scroll FURTHER than the submit's
  // bottom edge, or a submit that merely stayed in the flow would still be on screen at the end and
  // "still visible after scrolling" would prove nothing.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const atTop = await submit.boundingBox();
  expect(atTop, 'submit has no box').not.toBeNull();
  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(maxScroll, 'the form is too short to prove stickiness — add fixtures').toBeGreaterThan(
    (atTop?.y ?? 0) + (atTop?.height ?? 0),
  );

  await page.getByLabel('Ghi chú').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThanOrEqual(maxScroll - 1);
  await expect(page.getByLabel('Ghi chú')).toBeInViewport();
  await expect(submit, 'submit scrolled away with the form').toBeInViewport({ ratio: 1 });
  // Sticky UNDER the sticky header, not behind it.
  const headerBox = await page.getByRole('banner').first().boundingBox();
  const stuckBox = await summary.boundingBox();
  expect(headerBox && stuckBox, 'header/summary has no box').toBeTruthy();
  if (headerBox && stuckBox) {
    expect
      .soft(stuckBox.y, 'summary slides under the sticky header')
      .toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  }
});
