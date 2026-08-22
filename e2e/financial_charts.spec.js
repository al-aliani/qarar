import { test, expect } from '@playwright/test';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

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
  // تدقيق 2026-08-22: #/step/N صارت تتطلب تسجيل دخول أيضاً.
  test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
  await page.goto('/index.html');
  await page.waitForLoadState('domcontentloaded');
  await loginTestUser(page);
  await page.evaluate(() => { window.location.hash = '#/step/0'; });
  const chartsShortcut = page.locator('#btnGoCharts');
  await expect(chartsShortcut).toBeAttached();
  await chartsShortcut.evaluate((button) => button.click());

  await expect(page.getByRole('heading', { name: 'لوحة المؤشرات المالية' }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/financial_charts\.html/);
});
