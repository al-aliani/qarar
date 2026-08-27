/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): 7 صفحات عامة (why/deliverables/
 * partners/experts/blog/experiences/suppliers) كانت بلا أي وسم Open Graph أو
 * Twitter Card إطلاقاً، وpricing.html — أهم صفحة تحويل في الموقع — بلا
 * og:image رغم امتلاكها بقية الوسوم، وabout/help/contact بوسوم جزئية (og:url
 * مفقود من اثنتين، لا twitter:image في أي منها). مشاركة أي من هذه الصفحات
 * على واتساب (قناة التواصل الأساسية سعودياً) كانت تظهر بلا صورة معاينة ولا
 * حتى عنوان/وصف في الحالات السبع.
 *
 * الحارس يقرأ HTML الخام لكل صفحة عامة (لا صفحات إدارية/تشخيصية) ويتحقق من
 * مجموعة وسوم دنيا كاملة، مع تطابق og:image عبر كل الصفحات (صورة واحدة موحّدة
 * — لا حاجة لصورة لكل صفحة الآن).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(WEB_DIR, name), 'utf-8');

// الصفحات العامة القابلة للمشاركة — لا admin/dashboard/smoke_test (مستثناة من
// sitemap.xml وrobots.txt أصلاً بقرار سابق، مشاركتها الاجتماعية غير ذات معنى).
const PUBLIC_PAGES = [
    'landing.html', 'pricing.html', 'about.html', 'help.html', 'contact.html',
    'why.html', 'deliverables.html', 'partners.html', 'experts.html',
    'blog.html', 'experiences.html', 'suppliers.html',
];

function extractMeta(html, attr, value) {
    const re = new RegExp(`<meta\\s+${attr}="${value}"\\s+content="([^"]*)"`, 'i');
    const m = html.match(re);
    return m ? m[1] : null;
}

describe('OG/Twitter — كل صفحة عامة قابلة للمشاركة تحمل مجموعة وسوم كاملة', () => {
    it.each(PUBLIC_PAGES)('%s: الملف موجود فعلاً (تحقق سلامة قائمة الاختبار نفسها)', (page) => {
        expect(existsSync(resolve(WEB_DIR, page)), `${page} غير موجود`).toBe(true);
    });

    it.each(PUBLIC_PAGES)('%s: og:title/og:description/og:type/og:url موجودة', (page) => {
        const html = read(page);
        expect(extractMeta(html, 'property', 'og:title'), 'og:title').toBeTruthy();
        expect(extractMeta(html, 'property', 'og:description'), 'og:description').toBeTruthy();
        expect(extractMeta(html, 'property', 'og:type'), 'og:type').toBe('website');
        expect(extractMeta(html, 'property', 'og:url'), 'og:url').toMatch(/^https:\/\/sahib\.sa\//);
    });

    it.each(PUBLIC_PAGES)('%s: og:image كامل (رابط + أبعاد) ويشير لنفس الصورة الموحّدة', (page) => {
        const html = read(page);
        expect(extractMeta(html, 'property', 'og:image')).toBe('https://sahib.sa/og-image.png');
        expect(extractMeta(html, 'property', 'og:image:width')).toBe('1200');
        expect(extractMeta(html, 'property', 'og:image:height')).toBe('630');
    });

    it.each(PUBLIC_PAGES)('%s: og:locale=ar_SA موجود', (page) => {
        expect(extractMeta(read(page), 'property', 'og:locale')).toBe('ar_SA');
    });

    it.each(PUBLIC_PAGES)('%s: بطاقة تويتر كاملة (card/title/description/image)', (page) => {
        const html = read(page);
        expect(extractMeta(html, 'name', 'twitter:card')).toBe('summary_large_image');
        expect(extractMeta(html, 'name', 'twitter:title'), 'twitter:title').toBeTruthy();
        expect(extractMeta(html, 'name', 'twitter:description'), 'twitter:description').toBeTruthy();
        expect(extractMeta(html, 'name', 'twitter:image')).toBe('https://sahib.sa/og-image.png');
    });

    it('صورة og-image.png المشار إليها موجودة فعلاً في web/public', () => {
        expect(existsSync(resolve(WEB_DIR, 'public/og-image.png'))).toBe(true);
    });

    it('[إثبات الحارس] صفحة بلا أي وسم OG (محاكاة الحالة الأصلية) تُفشل الفحص', () => {
        const bareHtml = '<!doctype html><html><head><title>صفحة بلا وسوم</title></head><body></body></html>';
        expect(extractMeta(bareHtml, 'property', 'og:image')).toBeNull();
    });
});
