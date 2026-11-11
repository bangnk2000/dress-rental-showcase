import { expect, test, type Locator, type Page } from '@playwright/test';

import { formatOffenders, probeLayout } from './layout-probe';

/**
 * NFR-06 layout proof (docs/design/cms-mobile-ux.md §5, `fe:mobile-ux` AC1/AC2): at a phone
 * viewport (project `phone`, Chromium Pixel 7) no main screen scrolls sideways or pushes content
 * off either edge, a tall dialog stays inside the screen with its last button reachable, and every
 * nav destination is reachable by thumb.
 *
 * One test per screen ON PURPOSE: each layout check is independent, so a red screen must not hide
 * the state of the next one. The fixtures are created once through the API (a layout proof is not
 * the place to re-prove the create flows the desktop happy path already drives), with names unique
 * per run — the target database is not assumed empty (apps/fe/AGENTS.md deviation 5).
 */

const RUN = Date.now().toString(36);
const DRESS_A = { code: `PH-${RUN}-A`, name: `Váy điện thoại ${RUN} A` };
const DRESS_B = { code: `PH-${RUN}-B`, name: `Váy điện thoại ${RUN} B` };
const CUSTOMER_TODAY = `Khách ĐT hôm nay ${RUN}`;
const DRESS_C = { code: `PH-${RUN}-C`, name: `Váy điện thoại ${RUN} C` };
const CUSTOMER_TOMORROW = `Khách ĐT ngày mai ${RUN}`;
const CUSTOMER_PAID_AHEAD = `Khách ĐT trả trước ${RUN}`;
const LISTING = `Mẫu điện thoại ${RUN}`;
const STAFF_USERNAME = `ph-${RUN}`;

/** Same helper as the happy path: the shop's calendar day, which the browser also sees. */
function shopDayIso(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

const ids = { dressA: '', rentalToday: '', rentalPaidAhead: '', listing: '' };

test.beforeAll(async ({ playwright }, testInfo) => {
  // `request` is test-scoped; beforeAll builds its own context. The FE preview proxies /api to the
  // BE (vite.config.ts), so the FE base URL serves the API too.
  const api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const login = await api.post('/api/v1/auth/login', {
    data: { username: 'owner', password: 'changeme' },
  });
  expect(login.ok(), `login as owner → HTTP ${login.status()}`).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };

  async function create(path: string, data: object): Promise<string> {
    const res = await api.post(path, { headers, data });
    expect(res.ok(), `POST ${path} → ${res.status()} ${await res.text()}`).toBe(true);
    return ((await res.json()) as { id: string }).id;
  }

  const dress = { sizeLabel: 'M', rentalPrice: 1_500_000, depositAmount: 3_000_000 };
  ids.dressA = await create('/api/v1/dresses', { ...DRESS_A, ...dress });
  const dressB = await create('/api/v1/dresses', { ...DRESS_B, ...dress });
  // Today → born `out` (FR-RENT-10): sits on the take-back list with the return action.
  ids.rentalToday = await create('/api/v1/rentals', {
    customerName: CUSTOMER_TODAY,
    customerPhone: '0901234567',
    startDate: shopDayIso(0),
    endDate: shopDayIso(0),
    items: [{ dressId: ids.dressA }],
    collect: { deposit: 3_000_000, rentalFee: 1_500_000 },
  });
  // Tomorrow → `booked`: on the stepped board its hand-out card renders the pickup action row.
  await create('/api/v1/rentals', {
    customerName: CUSTOMER_TOMORROW,
    customerPhone: '0907654321',
    startDate: shopDayIso(1),
    endDate: shopDayIso(2),
    items: [{ dressId: dressB }],
  });
  // Booked AND paid ahead → its cancel opens the refund variant (the tallest alert dialog).
  const dressC = await create('/api/v1/dresses', { ...DRESS_C, ...dress });
  ids.rentalPaidAhead = await create('/api/v1/rentals', {
    customerName: CUSTOMER_PAID_AHEAD,
    customerPhone: '0909999999',
    startDate: shopDayIso(5),
    endDate: shopDayIso(6),
    items: [{ dressId: dressC }],
    collect: { deposit: 2_000_000, rentalFee: 1_500_000 },
  });
  ids.listing = await create('/api/v1/listings', { name: LISTING, styles: ['short', 'silk'] });
  // Attached dresses give the edit page's "Size & váy" table real rows to stack.
  const attach = await api.put(`/api/v1/listings/${ids.listing}/dresses`, {
    headers,
    data: { dressIds: [ids.dressA, dressB] },
  });
  expect(attach.ok(), `PUT listing dresses → ${attach.status()} ${await attach.text()}`).toBe(true);
  await create('/api/v1/users', {
    username: STAFF_USERNAME,
    name: `Nhân viên ĐT ${RUN}`,
    password: 'changeme-phone',
  });
  await api.dispose();
});

function viewportWidth(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error('phone project must set a viewport');
  return size.width;
}

/**
 * AC1 for the screen currently shown. Soft, so a later check in the same test (dialog, touch
 * target) still runs and the report lists everything that is wrong on this screen.
 */
async function expectFitsWidth(
  page: Page,
  screen: string,
  { stacked = false }: { stacked?: boolean } = {},
): Promise<void> {
  const width = viewportWidth(page);
  const probe = await probeLayout(page, width);
  if (stacked) {
    // D2: a list screen's table STACKS its rows on a phone. A table that merely scrolls inside
    // its own box passes the page-level checks below while hiding its action column, so on
    // these screens no inner box may scroll sideways (the header nav strip is exempt — D1).
    expect
      .soft(
        probe.scrollers,
        `${screen}: boxes scroll sideways inside the page (D2 wants stacked rows):\n${formatOffenders(probe.scrollers)}`,
      )
      .toEqual([]);
  } else if (probe.scrollers.length > 0) {
    // Elsewhere an inner sideways scroller is not ruled out by the design — record it only.
    test.info().annotations.push({
      type: 'side-scrolling container',
      description: `${screen}\n${formatOffenders(probe.scrollers)}`,
    });
  }
  expect
    .soft(
      probe.scrollWidth,
      `${screen}: page is ${probe.scrollWidth}px wide at a ${width}px viewport. Sticking out:\n${formatOffenders(probe.offenders)}`,
    )
    .toBeLessThanOrEqual(width);
  expect
    .soft(
      probe.offenders,
      `${screen}: elements cross the screen edge (left < 0 or right > ${width}):\n${formatOffenders(probe.offenders)}`,
    )
    .toEqual([]);
}

async function isCoarsePointer(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
}

/** D5: only a touch screen gets the 44px targets, so the check only applies there. */
async function expectThumbTarget(page: Page, target: Locator, what: string) {
  if (!(await isCoarsePointer(page))) {
    test.info().annotations.push({
      type: 'touch target not checked',
      description: `${what}: (pointer: coarse) does not match in this browser`,
    });
    return;
  }
  const box = await target.boundingBox();
  expect(box, `${what} has no box`).not.toBeNull();
  expect.soft(box?.height ?? 0, `${what} is shorter than 44px`).toBeGreaterThanOrEqual(44);
}

/**
 * AC1 for dialogs: the open dialog fits the screen height, and its LAST action (when given) can be
 * scrolled into view — a dialog without a max-height is cut off below the fold and never scrolls.
 */
async function expectDialogFits(
  page: Page,
  lastButton: string | null,
  what: string,
  role: 'dialog' | 'alertdialog' = 'dialog',
): Promise<void> {
  const dialog = page.getByRole(role);
  await expect(dialog).toBeVisible();
  const height = page.viewportSize()?.height ?? 0;
  const box = await dialog.boundingBox();
  expect(box, `${what}: dialog has no box`).not.toBeNull();
  if (box) {
    expect.soft(box.y, `${what}: dialog top is above the screen`).toBeGreaterThanOrEqual(-0.5);
    expect
      .soft(box.y + box.height, `${what}: dialog is taller than the ${height}px screen`)
      .toBeLessThanOrEqual(height + 0.5);
  }
  if (lastButton) {
    const button = dialog.getByRole('button', { name: lastButton, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect
      .soft(button, `${what}: "${lastButton}" cannot be scrolled on screen`)
      .toBeInViewport({ ratio: 1 });
  }
  await expectFitsWidth(page, `${what} (dialog open)`);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Tên đăng nhập').fill('owner');
  await page.getByLabel('Mật khẩu').fill('changeme');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay', exact: true })).toBeVisible();
}

/** A data row — by tag, not role: a stacked (display: block) table may drop its ARIA table roles. */
function firstBodyRow(page: Page) {
  return page.locator('tbody tr').first();
}

test('sign-in fits the phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expectFitsWidth(page, 'sign-in');
});

test.describe('signed in as owner', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('today board fits; return action is a thumb target; return dialog fits', async ({
    page,
  }) => {
    const returnButton = page.getByRole('button', {
      name: `Nhận về & tất toán cho ${CUSTOMER_TODAY}`,
    });
    await expect(returnButton).toBeVisible();
    await expectFitsWidth(page, 'today board');
    await expectThumbTarget(page, returnButton, 'board return button');
    await returnButton.click();
    await expect(page.getByText('Đã thu cọc: 3.000.000 ₫')).toBeVisible();
    await expectDialogFits(page, 'Xác nhận trả váy', 'return dialog');
  });

  test('today board stepped to tomorrow (hand-out card actions) fits', async ({ page }) => {
    await page.getByRole('button', { name: 'Ngày sau' }).click();
    await expect(
      page.getByRole('button', { name: `Đã giao váy cho ${CUSTOMER_TOMORROW}` }),
    ).toBeVisible();
    await expectFitsWidth(page, 'today board +1');
  });

  test('rentals list fits', async ({ page }) => {
    await page.goto('/rentals');
    await expect(page.getByRole('heading', { name: 'Thuê váy', exact: true })).toBeVisible();
    await expect(firstBodyRow(page)).toBeVisible();
    await expectFitsWidth(page, 'rentals list', { stacked: true });
  });

  test('new rental form fits', async ({ page }) => {
    await page.goto('/rentals/new');
    await expect(page.getByRole('heading', { name: 'Tạo lượt thuê', exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên khách')).toBeVisible();
    await expectFitsWidth(page, 'new rental');
  });

  test('rental detail fits; money dialog fits', async ({ page }) => {
    await page.goto(`/rentals/${ids.rentalToday}`);
    await expect(
      page.getByRole('heading', { name: `Lượt thuê của ${CUSTOMER_TODAY}` }),
    ).toBeVisible();
    await expect(page.getByText(DRESS_A.code).first()).toBeVisible();
    await expectFitsWidth(page, 'rental detail');
    await page.getByRole('button', { name: `Tiền của lượt thuê — ${CUSTOMER_TODAY}` }).click();
    await expect(
      page.getByText('Đã ghi nhận đủ tiền cọc và tiền thuê của lượt thuê này.'),
    ).toBeVisible();
    await expectDialogFits(page, null, 'money dialog');
  });

  test('dresses list fits; "Thêm váy" dialog fits', async ({ page }) => {
    await page.goto('/dresses');
    await expect(page.getByRole('heading', { name: 'Váy', exact: true })).toBeVisible();
    await expect(firstBodyRow(page)).toBeVisible();
    await expectFitsWidth(page, 'dresses list', { stacked: true });
    await page.getByRole('button', { name: 'Thêm váy' }).first().click();
    await expect(page.getByLabel('Mã váy')).toBeVisible();
    await expectDialogFits(page, 'Lưu', 'dress form dialog');
  });

  test('dress detail fits', async ({ page }) => {
    await page.goto(`/dresses/${ids.dressA}`);
    await expect(
      page.getByRole('heading', { name: `${DRESS_A.code} — ${DRESS_A.name}` }),
    ).toBeVisible();
    await expectFitsWidth(page, 'dress detail');
  });

  test('website listings fit', async ({ page }) => {
    await page.goto('/website');
    await expect(page.getByRole('heading', { name: 'Website', exact: true })).toBeVisible();
    await expect(firstBodyRow(page)).toBeVisible();
    await expectFitsWidth(page, 'website listings', { stacked: true });
  });

  test('new listing form fits', async ({ page }) => {
    await page.goto('/website/new');
    await expect(page.getByRole('heading', { name: 'Tạo mẫu', exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên mẫu')).toBeVisible();
    await expectFitsWidth(page, 'new listing');
  });

  test('edit listing fits', async ({ page }) => {
    await page.goto(`/website/${ids.listing}`);
    // The edit page is titled by the listing's own name ("Sửa mẫu trên website" is its subtitle).
    await expect(page.getByRole('heading', { name: LISTING, exact: true })).toBeVisible();
    await expect(page.getByLabel('Tên mẫu')).toHaveValue(LISTING);
    await expect(page.getByRole('heading', { name: 'Size & váy' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Bỏ ${DRESS_A.code}` })).toBeVisible();
    await expectFitsWidth(page, 'edit listing (Size & váy section)', { stacked: true });
  });

  test('users fit (owner only)', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Nhân viên', exact: true })).toBeVisible();
    await expect(page.getByText(STAFF_USERNAME, { exact: true })).toBeVisible();
    await expectFitsWidth(page, 'users', { stacked: true });
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    await expect(page.getByRole('heading', { name: 'Thêm nhân viên' })).toBeVisible();
    await expectDialogFits(page, 'Tạo tài khoản', 'user-create dialog');
  });

  test('cancel-with-refund dialog fits (booked rental paid ahead)', async ({ page }) => {
    await page.goto(`/rentals/${ids.rentalPaidAhead}`);
    await expect(
      page.getByRole('heading', { name: `Lượt thuê của ${CUSTOMER_PAID_AHEAD}` }),
    ).toBeVisible();
    await expectFitsWidth(page, 'rental detail (booked, paid ahead)');
    await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
    // The refund variant: money was taken, so the dialog asks what goes back to the customer.
    await expect(page.getByText('Huỷ đơn & hoàn tiền')).toBeVisible();
    await expect(page.getByText('Đã thu cọc: 2.000.000 ₫')).toBeVisible();
    await expectDialogFits(page, 'Hoàn tiền & huỷ đơn', 'cancel-with-refund dialog', 'alertdialog');
  });

  test('every nav destination is reachable by thumb (AC2)', async ({ page }) => {
    const destinations = [
      { label: 'Váy', path: /\/dresses$/ },
      { label: 'Thuê', path: /\/rentals$/ },
      { label: 'Website', path: /\/website$/ },
      { label: 'Nhân viên', path: /\/users$/ },
      { label: 'Hôm nay', path: /\/$/ },
    ];
    for (const { label, path } of destinations) {
      // First navigation landmark = the app header; a list page may add its own (pagination).
      const link = page.getByRole('navigation').first().getByRole('link', { name: label, exact: true });
      await link.scrollIntoViewIfNeeded();
      await expect(link, `nav "${label}" is not on screen`).toBeInViewport({ ratio: 1 });
      await expectThumbTarget(page, link, `nav "${label}"`);
      await link.click();
      await expect(page).toHaveURL(path);
    }
  });
});
