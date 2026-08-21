import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { loginTestUser, hasE2ECredentials } from './helpers/auth.js';

/**
 * التقاط شامل لواجهة الموقع كاملة + رحلة المستخدم من البداية للنهاية.
 * يحفظ اللقطات في مجلد منظّم: لقطات_الموقع/ مع أقسام مرقّمة.
 *
 * التشغيل: npx playwright test e2e/full-journey.spec.js --project=chromium
 */

const ROOT = path.join(process.cwd(), 'لقطات_الموقع');

function dir(name) {
    const p = path.join(ROOT, name);
    fs.mkdirSync(p, { recursive: true });
    return p;
}

async function shoot(page, folder, name, opts = {}) {
    await page.waitForTimeout(opts.wait ?? 900);
    const fullPage = opts.fullPage !== false;
    if (fullPage) {
        // التطبيق يستخدم حاوية داخلية (.main-stage) تُمرَّر بدل الـ body،
        // فالتقاط fullPage العادي يقتصر على ارتفاع الشاشة فقط. نلغي ذلك مؤقتاً
        // قبل اللقطة كي يمتد الـ document الفعلي بكامل المحتوى.
        await page.addStyleTag({
            content: `body, .app-shell, .main-stage { overflow: visible !important; height: auto !important; }`,
        }).catch(() => {});
    }
    await page.screenshot({
        path: path.join(folder, `${name}.png`),
        fullPage,
    });
    console.log(`  ✓ ${name}`);
}

test.describe('التقاط رحلة المستخدم الكاملة', () => {
    test.setTimeout(300000);

    test('capture full site + journey', async ({ page }) => {
        // تدقيق 2026-08-21: #/home تتطلب تسجيل دخول إلزامياً الآن — بلا حساب تجريبي
        // تلتقط أقسام لوحة التحكم/الدراسة نافذة تسجيل الدخول بدل المحتوى الفعلي.
        test.skip(!hasE2ECredentials(), 'يتطلب E2E_CUSTOMER_EMAIL و E2E_CUSTOMER_PASSWORD');
        fs.mkdirSync(ROOT, { recursive: true });

        // ================================================================
        // القسم 1: الصفحات التسويقية (سطح المكتب + الجوال)
        // ================================================================
        const marketing = dir('01_الصفحات_التسويقية');
        const marketingPages = [
            { name: '01_صفحة_الهبوط', url: '/landing.html' },
            { name: '02_صفحة_المستثمر', url: '/investor.html' },
            { name: '03_صفحة_الشركاء', url: '/partners.html' },
            { name: '04_الشروط_والأحكام', url: '/terms.html' },
            { name: '05_سياسة_الخصوصية', url: '/privacy.html' },
        ];

        // سطح المكتب
        await page.setViewportSize({ width: 1440, height: 1024 });
        for (const p of marketingPages) {
            await page.goto(p.url);
            await page.waitForLoadState('networkidle').catch(() => {});
            await shoot(page, marketing, `desktop_${p.name}`);
        }

        // الجوال
        const mobileMarketing = dir('01_الصفحات_التسويقية/جوال');
        await page.setViewportSize({ width: 390, height: 844 });
        for (const p of marketingPages) {
            await page.goto(p.url);
            await page.waitForLoadState('networkidle').catch(() => {});
            await shoot(page, mobileMarketing, `mobile_${p.name}`);
        }

        // ================================================================
        // القسم 2: الصفحة الرئيسية للتطبيق (لوحة التحكم)
        // ================================================================
        const homeDir = dir('02_الصفحة_الرئيسية_للتطبيق');

        // سطح المكتب
        await page.setViewportSize({ width: 1440, height: 1024 });
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle').catch(() => {});
        await loginTestUser(page);
        await page.waitForTimeout(1500);
        await shoot(page, homeDir, 'desktop_01_لوحة_التحكم');

        // التبويبات العلوية للتنقل
        const tabs = page.locator('[role="tab"]');
        const tabCount = await tabs.count();
        for (let i = 0; i < tabCount; i++) {
            try {
                const label = (await tabs.nth(i).innerText()).trim().replace(/\s+/g, '_').slice(0, 30) || `tab_${i}`;
                await tabs.nth(i).click();
                await shoot(page, homeDir, `desktop_02_تبويب_${i + 1}_${label}`);
            } catch { /* تجاهل التبويب غير القابل للنقر */ }
        }

        // الجوال — لوحة التحكم
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1500);
        await shoot(page, homeDir, 'mobile_01_لوحة_التحكم');

        // ================================================================
        // القسم 3: بدء دراسة جديدة (نافذة القوالب / اختيار نقطة البداية)
        // ================================================================
        const startDir = dir('03_بدء_دراسة');
        await page.setViewportSize({ width: 1440, height: 1024 });
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);

        // نافذة «جدوى سريعة (٣ خطوات)»
        try {
            await page.getByRole('button', { name: /جدوى سريعة/ }).first().click();
            await shoot(page, startDir, '01_جدوى_سريعة', { fullPage: false, wait: 1200 });
            // محاولة التقدّم بخطوات الجدوى السريعة
            for (let s = 2; s <= 4; s++) {
                const next = page.getByRole('button', { name: /التالي|استمرار|التالِ/ }).first();
                if (await next.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await next.click();
                    await shoot(page, startDir, `0${s}_جدوى_سريعة_خطوة_${s}`, { fullPage: false, wait: 1000 });
                } else break;
            }
        } catch (e) {
            console.log('  ! جدوى سريعة:', e.message);
        }

        // نافذة «دراسة جديدة» (اختيار القالب)
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
        try {
            await page.getByRole('button', { name: /^دراسة جديدة$/ }).first().click();
            await shoot(page, startDir, '05_نافذة_اختيار_القالب', { fullPage: false, wait: 1200 });
        } catch (e) {
            console.log('  ! نافذة القوالب:', e.message);
        }

        // ================================================================
        // القسم 4: رحلة الدراسة الكاملة (الـ 8 تصنيفات = كل الخطوات)
        // ================================================================
        const studyDir = dir('04_رحلة_الدراسة_الكاملة');
        await page.goto('/index.html');
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);

        // افتح دراسة قائمة إن وُجدت (تعرض عرض التصنيفات معبّأً)، وإلا أنشئ جديدة
        let inStudy = false;
        const openExisting = page.getByRole('button', { name: /^فتح دراسة/ }).first();
        if (await openExisting.isVisible({ timeout: 2000 }).catch(() => false)) {
            await openExisting.click();
            inStudy = true;
        } else {
            // إنشاء دراسة جديدة واختيار أول قالب متاح
            await page.getByRole('button', { name: /^دراسة جديدة$/ }).first().click();
            await page.waitForTimeout(1000);
            const firstTemplate = page.locator('#btnStartBlank, [role="listitem"], .template-card, [data-template]').first();
            if (await firstTemplate.isVisible({ timeout: 2000 }).catch(() => false)) {
                await firstTemplate.click();
                inStudy = true;
            }
        }

        await page.waitForTimeout(1500);

        if (inStudy) {
            for (let c = 1; c <= 8; c++) {
                // اسم التصنيف من الترويسة إن أمكن
                let label = '';
                try {
                    label = (await page.locator('.category-page__title h2, .category-page h2').first().innerText())
                        .trim().replace(/\s+/g, '_').slice(0, 30);
                } catch { /* لا شيء */ }
                const nn = String(c).padStart(2, '0');
                await shoot(page, studyDir, `${nn}_تصنيف_${label || c}`);

                const nextCat = page.locator('[data-category-next]').first();
                if (await nextCat.isEnabled().catch(() => false)) {
                    await nextCat.click();
                    await page.waitForTimeout(1200);
                } else {
                    break;
                }
            }

            // ============================================================
            // القسم 5: أدوات القرار (الافتراضات المركزية + التصدير)
            // ============================================================
            const decisionDir = dir('05_القرار_والتصدير');

            // لوحة الافتراضات المركزية
            try {
                await page.getByRole('button', { name: /الافتراضات المركزية/ }).first().click();
                await shoot(page, decisionDir, '01_لوحة_الافتراضات_المركزية', { fullPage: false, wait: 1200 });
                await page.keyboard.press('Escape').catch(() => {});
            } catch (e) { console.log('  ! الافتراضات:', e.message); }

            // قائمة التصدير
            try {
                await page.getByRole('button', { name: /^تصدير$/ }).first().click();
                await shoot(page, decisionDir, '02_قائمة_التصدير', { fullPage: false, wait: 1000 });
            } catch (e) { console.log('  ! التصدير:', e.message); }
        }

        console.log(`\n✅ تم الحفظ في: ${ROOT}`);
    });
});
