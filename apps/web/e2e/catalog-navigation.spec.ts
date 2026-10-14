import { expect, test } from '@playwright/test';

test('the header Next Link clears query and style on the same collection route', async ({ page }) => {
  await page.goto('/bo-suu-tap');
  const input = page.getByRole('searchbox', { name: 'Tìm mẫu váy' });
  await expect(input).toHaveValue('');
  const allCount = await page.getByRole('status').textContent();
  await input.fill('ao dai');
  await expect(page).toHaveURL(/q=ao\+dai/);
  await page.getByRole('button', { name: 'Váy ngắn', exact: true }).click();
  await expect(page).toHaveURL(/style=short/);
  await page.locator('header').getByRole('link', { name: 'Bộ sưu tập', exact: true }).click();
  await expect(page).toHaveURL(/\/bo-suu-tap$/);
  await expect(input).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Tất Cả Thiết Kế' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveText(allCount!);
  await page.reload();
  await expect(input).toHaveValue('');
});

test('same-route Next Link navigation cancels a pending debounce', async ({ page }) => {
  await page.goto('/bo-suu-tap?q=ao+dai');
  const input = page.getByRole('searchbox', { name: 'Tìm mẫu váy' });
  await expect(input).toHaveValue('ao dai');
  // Pin the page clock to a known start, then pause a safe step AHEAD of it: `pauseAt(new Date())`
  // after a bare install() raced the test runner's clock against the page's ("Cannot fast-forward
  // to the past" in CI, 2026-10-15). No debounce is pending yet, so jumping 5 s fires nothing of ours.
  const start = Date.now();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 5_000);
  await input.fill('stale pending query');
  await page.locator('header').getByRole('link', { name: 'Bộ sưu tập', exact: true }).click();
  await expect(page).toHaveURL(/\/bo-suu-tap$/);
  await expect(input).toHaveValue('');
  await page.clock.runFor(400);
  await expect(page).toHaveURL(/\/bo-suu-tap$/);
  await expect(input).toHaveValue('');
});
