import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(120000);

test('capture decision & export tools', async ({ page }) => {
    const out = path.join(process.cwd(), 'لقطات_الموقع', '05_القرار_والتصدير');
    fs.mkdirSync(out, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1024 });

    await page.goto('/index.html');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);

    // افتح دراسة قائمة إن وُجدت، وإلا أنشئ جديدة من قالب
    const openExisting = page.getByRole('button', { name: /^فتح دراسة/ }).first();
    if (await openExisting.isVisible({ timeout: 2500 }).catch(() => false)) {
        await openExisting.click();
    } else {
        await page.getByRole('button', { name: /^دراسة جديدة$/ }).first().click();
        await page.waitForTimeout(1200);
        // «ابدأ من الصفر» → نموذج اختيار الوضع → إنشاء الدراسة
        await page.locator('#btnStartBlank').first().click();
        await page.waitForTimeout(800);
        await page.locator('.mode-card').first().click().catch(() => {});
        await page.locator('#btnBlankCreate').click();
    }
    await page.waitForTimeout(2200);

    // لوحة الافتراضات المركزية
    try {
        await page.locator('#headerAssumptionsPanel').click({ timeout: 5000 });
        await page.waitForTimeout(1300);
        await page.screenshot({ path: path.join(out, '01_لوحة_الافتراضات_المركزية.png') });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
    } catch (e) { console.log('assumptions:', e.message); }

    // قائمة التصدير
    try {
        await page.getByRole('button', { name: /^تصدير$/ }).first().click({ timeout: 5000 });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(out, '02_قائمة_التصدير.png') });
    } catch (e) { console.log('export:', e.message); }

    console.log('done');
});
