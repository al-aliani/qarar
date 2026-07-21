import { test, expect } from '@playwright/test';

test('Financial charts render without external CDN dependencies', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  await page.goto('/financial_charts.html');
  const charts = page.locator('canvas');
  await expect(charts).toHaveCount(2);
  await expect.poll(async () => charts.evaluateAll((items) =>
    items.every((canvas) => canvas.width > 300 && canvas.height > 150)
  )).toBe(true);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
});

test('Interactive charts shortcut opens the current study dashboard', async ({ page }) => {
  await page.goto('/index.html#/step/0');
  const chartsShortcut = page.locator('#btnGoCharts');
  await expect(chartsShortcut).toBeAttached();
  await chartsShortcut.evaluate((button) => button.click());

  await expect(page.getByRole('heading', { name: 'لوحة المؤشرات المالية' }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/financial_charts\.html/);
});
