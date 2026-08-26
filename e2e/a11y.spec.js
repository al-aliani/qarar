/**
 * فحص إمكانية الوصول الآلي (WCAG 2.1 AA) — بوابة انحدار عبر axe-core
 * التشغيل: npm run test:e2e -- e2e/a11y.spec.js
 *
 * 2026-08-26: لا يوجد فحص a11y آلي بالمشروع قبل هذا الملف (تحقق يدوي لمرة واحدة فقط
 * سابقاً — انظر MEMORY). يغطي الصفحات العامة الرئيسية الثلاث المذكورة بمهمة التدقيق:
 * landing.html وpricing.html وhelp.html. يقيّد المعايير لـwcag2a/wcag2aa/wcag21a/
 * wcag21aa فقط — لا `best-practice` (كثيرة الإيجابيات الكاذبة، ليست معياراً ملزِماً).
 *
 * الوضع الداكن أُزيل من الموقع بقرار مالك (2026-08-22)، وtheme-init.js يفرض
 * data-theme="light" دوماً بلا شرط على تفضيل النظام — فلا فحوصات لون/تباين هنا يمكن
 * أن تتأثر بمحاكاة نظام داكن خاطئة أصلاً. colorScheme:'light' أدناه توثيق صريح لهذا
 * الضمان (Playwright يستخدم 'light' افتراضياً بلا هذا السطر أيضاً) — أي اختبار في هذا
 * الملف يفحص الصفحة كما يراها المستخدم الفعلي دائماً: فاتحة.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ colorScheme: 'light' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const PAGES = [
    { name: 'landing.html', path: '/landing.html' },
    { name: 'pricing.html', path: '/pricing.html' },
    { name: 'help.html', path: '/help.html' },
];

/** رسالة فشل مفصَّلة: القاعدة، الوصف، والعناصر المخالِفة — لتشخيص فوري بلا فتح تقرير HTML. */
function formatViolations(violations) {
    return violations
        .map((v) => {
            const nodes = v.nodes.map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, '\n      ')}`).join('\n');
            return `[${v.id}] (${v.impact}) ${v.help}\n  ${v.helpUrl}\n${nodes}`;
        })
        .join('\n\n');
}

test.describe('WCAG 2.1 AA — axe-core', () => {
    for (const { name, path } of PAGES) {
        test(`${name} — بلا مخالفات WCAG 2.1 AA`, async ({ page }) => {
            await page.addInitScript(() => localStorage.setItem('qarar_cookie_consent', 'granted'));
            await page.goto(path);
            await page.waitForLoadState('networkidle');

            const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

            expect(results.violations, formatViolations(results.violations)).toEqual([]);
        });
    }
});
