import { expect, test } from '@playwright/test';

/**
 * The whole staff day in one pass: sign in → add a dress → book it for today
 * → morning board: hand out, take back with a settled deposit → the list
 * shows the returned rental and its payments. One test on purpose — each
 * step depends on the state the previous one created.
 */

const RUN = Date.now().toString(36);
const DRESS_CODE = `E2E-${RUN}`;
const CUSTOMER = `Khách E2E ${RUN}`;

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

test('happy path: create dress → rent today → pickup → return → settled list', async ({
  page,
}) => {
  await test.step('sign in', async () => {
    await page.goto('/');
    await page.getByLabel('Email').fill('owner@example.com');
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

  await test.step('book it for today (single-day rental)', async () => {
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
    await page.getByLabel('Ngày nhận').fill(todayIso());
    await page.getByLabel('Ngày trả').fill(todayIso());
    await page.getByPlaceholder('Tìm theo mã hoặc tên váy…').fill(DRESS_CODE);
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo lượt thuê' }).click();
    await expect(page.getByText('Đã tạo lượt thuê')).toBeVisible();
    // post-create landing: the rentals list shows the booked rental
    await expect(page.getByRole('row', { name: new RegExp(CUSTOMER) })).toContainText(
      'Đã đặt',
    );
  });

  // Board rows of THIS run only: the board also shows whatever else the target database holds
  // (leftover or overdue rentals), so page-wide button lookups would be ambiguous.
  const ownRows = page.getByRole('listitem').filter({ hasText: CUSTOMER });

  await test.step('morning board: hand out', async () => {
    await page.getByRole('link', { name: 'Hôm nay' }).click();
    // a single-day rental sits on BOTH lists (hand out and take back)
    await expect(page.getByText(CUSTOMER)).toHaveCount(2);
    await ownRows.getByRole('button', { name: 'Đã giao váy' }).click();
    await expect(page.getByText('Đã ghi nhận giao váy cho khách.')).toBeVisible();
    // out of the hand-out list, still on take-back, now marked out
    await expect(page.getByText(CUSTOMER)).toHaveCount(1);
    await expect(ownRows.getByText('Đang thuê')).toBeVisible();
  });

  await test.step('take back and settle the deposit', async () => {
    await ownRows.getByRole('button', { name: 'Nhận về & tất toán' }).click();
    await page.getByLabel('Hoàn cọc (VND)').fill('3000000');
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
    await row.getByRole('button', { name: 'Thanh toán' }).click();
    await expect(page.getByText('Hoàn cọc', { exact: true })).toBeVisible();
    await expect(page.getByText('Trả đủ, cọc hoàn nguyên')).toBeVisible();
  });
});
