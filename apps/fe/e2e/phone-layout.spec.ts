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
// A category name at the 50-char maximum: the filter trigger must truncate it, not grow with it.
const LONG_CATEGORY = `Danh mục rất dài để thử cắt chữ ${RUN}-`.padEnd(50, 'x');
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

const ids = { dressA: '', rentalToday: '', rentalPaidAhead: '', listing: '', longCategory: '' };

/** A valid 1×1 PNG — the photo field previews it locally; nothing uploads until Save. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

type Box = { x: number; y: number; width: number; height: number };

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
  ids.longCategory = await create('/api/v1/categories', { name: LONG_CATEGORY });
  const dressC = await create('/api/v1/dresses', {
    ...DRESS_C,
    ...dress,
    categoryId: ids.longCategory,
  });
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
  // After a viewport change (the keyboard proxy) the dialog's `100dvh` cap is re-resolved on a
  // later frame — the box keeps its old height for a moment — so the height is polled, not read
  // once. A dialog with no cap never settles and still fails.
  await expect
    .configure({ soft: true })
    .poll(
      async () => {
        const b = await dialog.boundingBox();
        return b ? b.y + b.height : Number.POSITIVE_INFINITY;
      },
      { message: `${what}: dialog never settled inside the ${height}px screen`, timeout: 3_000 },
    )
    .toBeLessThanOrEqual(height + 0.5);
  const box = await dialog.boundingBox();
  expect(box, `${what}: dialog has no box`).not.toBeNull();
  if (box) {
    // What the page itself believes the viewport is — tells "the CSS has no max-height" apart
    // from "100dvh did not follow the viewport".
    const metrics = await dialog.evaluate((el) => {
      const probe = (h: string) => {
        const div = document.createElement('div');
        div.style.cssText = `position:fixed;top:0;height:${h};visibility:hidden`;
        document.body.appendChild(div);
        const px = div.getBoundingClientRect().height;
        div.remove();
        return Math.round(px);
      };
      return `innerHeight=${window.innerHeight} visualViewport=${Math.round(window.visualViewport?.height ?? 0)} 100dvh=${probe('100dvh')} 100svh=${probe('100svh')} 100vh=${probe('100vh')} dialog max-height=${getComputedStyle(el).maxHeight}`;
    });
    expect
      .soft(box.y, `${what}: dialog top is above the screen (${metrics})`)
      .toBeGreaterThanOrEqual(-0.5);
    expect
      .soft(box.y + box.height, `${what}: dialog is taller than the ${height}px screen (${metrics})`)
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

  test('a long selected category stays inside its filter trigger', async ({ page }) => {
    // Selected through the URL (the filter is URL-owned) — the Radix popover is not under test.
    await page.goto(`/dresses?categoryId=${ids.longCategory}`);
    await expect(page.getByRole('heading', { name: 'Váy', exact: true })).toBeVisible();
    const trigger = page.getByRole('combobox', { name: 'Danh mục' });
    await expect(trigger).toContainText(LONG_CATEGORY);
    await expect(page.getByText(DRESS_C.code).first()).toBeVisible();
    await expectFitsWidth(page, 'dresses list (long category selected)', { stacked: true });
    const triggerBox = await trigger.boundingBox();
    const valueBox = await trigger.locator('[data-slot="select-value"]').boundingBox();
    expect(triggerBox && valueBox, 'filter trigger/value has no box').toBeTruthy();
    if (triggerBox && valueBox) {
      // Without the value's truncation (line-clamp ⇒ overflow hidden ⇒ min-width 0) the flex item
      // keeps its content width and the text spills out of the trigger's right edge.
      expect
        .soft(
          valueBox.x + valueBox.width,
          'the selected category spills out of the filter trigger (value no longer truncates)',
        )
        .toBeLessThanOrEqual(triggerBox.x + triggerBox.width + 0.5);
      expect
        .soft(triggerBox.x + triggerBox.width, 'the filter trigger is wider than the screen')
        .toBeLessThanOrEqual(viewportWidth(page));
    }
  });

  test('dress form: photo tile buttons are 44px thumb targets inside their tile', async ({
    page,
  }) => {
    await page.goto('/dresses');
    await expect(page.getByRole('heading', { name: 'Váy', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm váy' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Mã váy')).toBeVisible();
    // Three local photos: previewed only — nothing uploads before Save, which is never clicked.
    await dialog.getByLabel('Chọn ảnh để tải lên').setInputFiles(
      [1, 2, 3].map((n) => ({ name: `phone-${n}.png`, mimeType: 'image/png', buffer: TINY_PNG })),
    );
    const tiles = dialog.locator('li[data-status]');
    await expect(tiles).toHaveCount(3);
    const coarse = await isCoarsePointer(page);
    for (let i = 0; i < 3; i++) {
      const tile = tiles.nth(i);
      const tileBox = await tile.boundingBox();
      const buttons = tile.getByRole('button');
      await expect(buttons).toHaveCount(3);
      const boxes: Box[] = [];
      for (let b = 0; b < 3; b++) {
        const box = await buttons.nth(b).boundingBox();
        if (box) boxes.push(box);
      }
      expect(tileBox && boxes.length === 3, `photo ${i + 1}: tile or buttons have no box`).toBe(
        true,
      );
      if (!tileBox) continue;
      const where = `photo ${i + 1}`;
      boxes.forEach((box, b) => {
        if (coarse) {
          expect.soft(box.width, `${where} button ${b + 1} narrower than 44px`).toBeGreaterThanOrEqual(44);
          expect.soft(box.height, `${where} button ${b + 1} shorter than 44px`).toBeGreaterThanOrEqual(44);
        }
        expect
          .soft(box.x, `${where} button ${b + 1} sticks out left of its tile`)
          .toBeGreaterThanOrEqual(tileBox.x - 0.5);
        expect
          .soft(box.x + box.width, `${where} button ${b + 1} sticks out right of its tile`)
          .toBeLessThanOrEqual(tileBox.x + tileBox.width + 0.5);
      });
      const byX = [...boxes].sort((a, b) => a.x - b.x);
      for (let b = 1; b < byX.length; b++) {
        const prev = byX[b - 1];
        const cur = byX[b];
        if (!prev || !cur) continue;
        expect
          .soft(prev.x + prev.width, `${where}: buttons ${b} and ${b + 1} overlap`)
          .toBeLessThanOrEqual(cur.x + 0.5);
      }
    }
    if (!coarse) {
      test.info().annotations.push({
        type: 'touch target not checked',
        description: 'photo buttons: (pointer: coarse) does not match in this browser',
      });
    }
    await expectFitsWidth(page, 'dress form with 3 photos (dialog open)');
    await page.keyboard.press('Escape');
  });

  test('dress form with the keyboard up: dialog fits and "Lưu" is reachable', async ({ page }) => {
    const size = page.viewportSize();
    if (!size) throw new Error('phone project must set a viewport');
    await page.goto('/dresses');
    await expect(page.getByRole('heading', { name: 'Váy', exact: true })).toBeVisible();
    // Headless Chromium ignores `interactive-widget` (it has no keyboard), so the shrink below
    // only proves the dialog follows a smaller viewport. That the real keyboard DOES shrink it on
    // Android depends on this meta — guard it directly.
    await expect
      .soft(page.locator('meta[name="viewport"]'))
      .toHaveAttribute('content', /interactive-widget=resizes-content/);
    await page.getByRole('button', { name: 'Thêm váy' }).first().click();
    const code = page.getByRole('dialog').getByLabel('Mã váy');
    await code.focus();
    // Proxy for the on-screen keyboard: with `interactive-widget=resizes-content` Android Chrome
    // shrinks the LAYOUT viewport (and 100dvh) to what is left above the keyboard. Headless
    // Chromium has no keyboard, so shrink the viewport the same way.
    await page.setViewportSize({ width: size.width, height: 480 });
    try {
      await expectDialogFits(page, 'Lưu', 'dress form dialog, keyboard up (412×480)');
    } finally {
      await page.setViewportSize(size);
    }
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
    // The header's language switcher is a `size="sm"` select — the one most likely to stay small.
    await expectThumbTarget(
      page,
      page.getByRole('banner').getByRole('combobox', { name: 'Ngôn ngữ' }),
      'language switcher',
    );
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
