import { expect, test } from '@playwright/test';

/**
 * The whole staff day in one pass: sign in → add a dress → book it for TOMORROW → step the board
 * one day forward: hand out, take back with a settled deposit → the list shows the returned
 * rental and its payments. One test on purpose — each step depends on the state the previous one
 * created.
 *
 * The booking is for TOMORROW since FR-RENT-10: a same-day rental is born `out`, so the pickup
 * button would never exist for it. Booking ahead and stepping the board (+1) is the only flow
 * where the browser can prove the hand-out tap. Born-out itself is proven by unit, test:e2e and
 * smoke.sh.
 */

const RUN = Date.now().toString(36);
const DRESS_CODE = `E2E-${RUN}`;
const CUSTOMER = `Khách E2E ${RUN}`;

/**
 * The shop's calendar day (+offset) — the SAME day the browser sees (playwright.config pins its
 * timezone) and the same day the API compares a rental's start against (FR-RENT-10 `shopToday()`).
 * Computing it from the test process clock instead would book in UTC: on a UTC-evening run the
 * rental lands on yesterday and is born delivered.
 */
function shopDayIso(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

test('happy path: create dress → book tomorrow → pickup → return → settled list', async ({
  page,
}) => {
  await test.step('sign in', async () => {
    await page.goto('/');
    await page.getByLabel('Tên đăng nhập').fill('owner');
    await page.getByLabel('Mật khẩu').fill('changeme');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Hôm nay' })).toBeVisible();
  });

  await test.step('create the dress', async () => {
    await page.getByRole('link', { name: 'Váy' }).click();
    // empty catalog: the header AND the empty state both offer "Thêm váy"
    await page.getByRole('button', { name: 'Thêm váy' }).first().click();
    await page.getByLabel('Mã váy').fill(DRESS_CODE);
    await page.getByLabel('Tên váy').fill('Váy kiểm thử e2e');
    await page.getByLabel('Giá thuê (VND)').fill('1500000');
    await page.getByLabel('Tiền cọc (VND)').fill('3000000');
    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect(page.getByText('Đã thêm váy vào danh mục')).toBeVisible();
  });

  await test.step('book it for tomorrow (single-day rental)', async () => {
    await page.getByRole('link', { name: 'Thuê', exact: true }).click();
    // empty list: the header AND the empty state both offer "Tạo lượt thuê"
    await page.getByRole('link', { name: 'Tạo lượt thuê' }).first().click();
    // wait for the route to settle — a fill during the lazy-route/suspense
    // swap lands on an input that gets replaced (the value silently vanishes)
    await expect(page.getByRole('heading', { name: 'Tạo lượt thuê' })).toBeVisible();
    const nameField = page.getByLabel('Tên khách');
    await expect(async () => {
      await nameField.fill(CUSTOMER);
      await expect(nameField).toHaveValue(CUSTOMER);
    }).toPass();
    await page.getByLabel('Số điện thoại').fill('0901234567');
    await page.getByLabel('Ngày nhận').fill(shopDayIso(1));
    await page.getByLabel('Ngày trả').fill(shopDayIso(1));
    await page.getByPlaceholder('Tìm theo mã hoặc tên váy…').fill(DRESS_CODE);
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo lượt thuê' }).click();
    await expect(page.getByText('Đã tạo lượt thuê', { exact: true })).toBeVisible();
    // post-create landing: the rentals list shows the booked rental
    await expect(page.getByRole('row', { name: new RegExp(CUSTOMER) })).toContainText(
      'Đã đặt',
    );
  });

  await test.step('record the money taken at the counter (FR-PAY-02)', async () => {
    const row = page.getByRole('row', { name: new RegExp(CUSTOMER) });
    await row.getByRole('button', { name: /^Tiền/ }).click();
    // Pre-filled from the catalog standard and the agreed price…
    await expect(page.getByLabel('Tiền cọc')).toHaveValue('3000000');
    await expect(page.getByLabel('Tiền thuê')).toHaveValue('1500000');
    // …but the shop took less deposit than the standard, and the ledger records what was TAKEN.
    await page.getByLabel('Tiền cọc').fill('2000000');
    await page.getByRole('button', { name: 'Ghi nhận' }).click();
    await expect(page.getByText('Đã ghi nhận tiền.')).toBeVisible();
    // Both kinds are now on file, so the form gives way to the ledger it just wrote.
    await expect(
      page.getByText('Đã ghi nhận đủ tiền cọc và tiền thuê của lượt thuê này.'),
    ).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Tiền cọc' })).toContainText(
      '2.000.000 ₫',
    );
    await page.keyboard.press('Escape');
  });

  // Board rows of THIS run only: the board also shows whatever else the target database holds
  // (leftover or overdue rentals), so page-wide button lookups would be ambiguous.
  const ownRows = page.getByRole('listitem').filter({ hasText: CUSTOMER });

  await test.step('board stepped to tomorrow: hand out', async () => {
    await page.getByRole('link', { name: 'Hôm nay' }).click();
    await expect(page.getByRole('heading', { name: 'Hôm nay' })).toBeVisible();
    // The rental is TOMORROW's work — step the board one day forward (FR-RENT-10 moved the
    // same-day flow out of the pickup path, so the +1 button earns its keep here).
    await page.getByRole('button', { name: 'Ngày sau' }).click();
    // a single-day rental sits on BOTH lists (hand out and take back) — and since FR-RENT-10 a
    // BOOKED card on the take-back list offers a pickup too, so scope the click to due-out.
    await expect(page.getByText(CUSTOMER)).toHaveCount(2);
    const dueOut = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /Giao váy cho khách/ }) });
    await dueOut
      .getByRole('listitem')
      .filter({ hasText: CUSTOMER })
      .getByRole('button', { name: 'Đã giao váy' })
      .click();
    await expect(page.getByText('Đã ghi nhận giao váy cho khách.')).toBeVisible();
    // STILL on the hand-out list (the day's hand-outs stay visible, marked done and without the
    // button), still on take-back, both now marked out
    await expect(page.getByText(CUSTOMER)).toHaveCount(2);
    await expect(ownRows.getByText('Đang thuê')).toHaveCount(2);
    const handedOutCard = dueOut.getByRole('listitem').filter({ hasText: CUSTOMER });
    await expect(handedOutCard).toContainText('Đã giao cho khách');
    await expect(handedOutCard.getByRole('button')).toHaveCount(0);
  });

  await test.step('take back and settle the deposit', async () => {
    await ownRows.getByRole('button', { name: 'Nhận về & tất toán' }).click();
    // The refund is pre-filled from the deposit the shop ACTUALLY collected (2.000.000), not from
    // the catalog's 3.000.000 — refunding the standard would give away money never received.
    await expect(page.getByText('Đã thu cọc: 2.000.000 ₫')).toBeVisible();
    await expect(page.getByLabel('Hoàn cọc (VND)')).toHaveValue('2000000');
    await page.getByLabel('Ghi chú').fill('Trả đủ, cọc hoàn nguyên');
    await page.getByRole('button', { name: 'Xác nhận trả váy' }).click();
    await expect(page.getByText('Đã tất toán lượt thuê.')).toBeVisible();
    // a returned rental leaves the board entirely
    await expect(page.getByText(CUSTOMER)).toHaveCount(0);
  });

  await test.step('the list shows the returned rental and its payments', async () => {
    await page.getByRole('link', { name: 'Thuê', exact: true }).click();
    const row = page.getByRole('row', { name: new RegExp(CUSTOMER) });
    await expect(row).toContainText('Đã trả');
    await row.getByRole('button', { name: /^Tiền/ }).click();
    await expect(page.getByText('Hoàn cọc', { exact: true })).toBeVisible();
    // The note rides on EVERY movement row, so match the first — a settlement with a late fee
    // legitimately repeats it.
    await expect(page.getByText('Trả đủ, cọc hoàn nguyên').first()).toBeVisible();
    // Money in and money out are both on the ledger now: 2.000.000 + 1.500.000 collected,
    // 2.000.000 handed back. Before FR-PAY-02 the "in" half did not exist at all.
    await expect(page.getByText('Tổng đã thu')).toBeVisible();
    await expect(page.getByText('3.500.000 ₫')).toBeVisible();
  });
});
