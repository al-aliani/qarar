/**
 * حارس سياسة الكاش في vercel.json — يحاكي دلالة `routes` بدل قراءتها بالعين.
 *
 * الدلالة المُحاكاة (مؤكَّدة حيّاً على sahib.sa بـcurl): القواعد تُطبَّق بالترتيب،
 * وقاعدة بـ`continue: true` تُضيف ترويساتها ثم يُكمَل المسار، و**اللاحقة تدهس السابقة**
 * عند تعارض نفس الترويسة.
 *
 * العيبان اللذان يحرسهما هذا الملف:
 *
 * 1) **404 مُخزَّن سنة كاملة** (تدقيق مستقل 2026-08-25، صُنِّف أخطر عيب توفّر):
 *    قاعدة `^/assets/(.*)$` تضع `immutable` بـ`continue` **قبل** `handle: filesystem`،
 *    فطلب أصل غير موجود (تبويب قديم يطلب حزمة كسولة بعد نشر جديد) يلتقط الترويسة ثم
 *    يسقط إلى قاعدة الـ404 — فيُخزَّن الـ404 نفسه سنة. النتيجة: تطبيق مكسور **دائماً**
 *    لذلك المستخدم حتى يمسح بيانات الموقع، بلا أي أثر يُشخَّص منه.
 *
 * 2) **قلب السياسة**: ملفات الإعداد بلا بصمة محتوى (رقم واتساب الدعم، التحويل البنكي،
 *    theme-init) كانت `immutable` سنة — تغيير رقم الدعم ما كان ليصل لزائر سابق أبداً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf-8'));

/**
 * يحاكي مرور طلب عبر `routes`.
 * @param {string} path مسار الطلب
 * @param {boolean} existsOnDisk هل يجد `handle: filesystem` ملفاً فعلياً بهذا الاسم
 */
function resolveRequest(path, { existsOnDisk }) {
    const headers = {};
    let status = 200;
    let handled = false;

    for (const route of config.routes) {
        if (route.handle === 'filesystem') {
            // الملف موجود ⟹ يُخدَّم هنا وتتوقف السلسلة. غير موجود ⟹ تكمل للقواعد التالية.
            if (existsOnDisk) { handled = true; break; }
            continue;
        }
        if (!route.src) continue;
        // `has` شروط سياقية (مضيف/كوكي) — نحاكي الطلبات على النطاق القانوني sahib.sa
        // وحده، فقواعد إعادة التوجيه المشروطة بـwww لا تنطبق هنا.
        if (Array.isArray(route.has) && route.has.length) continue;
        if (!new RegExp(route.src).test(path)) continue;

        Object.assign(headers, route.headers || {});
        if (route.status) status = route.status;
        if (!route.continue) { handled = true; break; }
    }
    return { status, headers, handled, cacheControl: headers['Cache-Control'] };
}

const isImmutable = (cc) => typeof cc === 'string' && /immutable/.test(cc);

describe('vercel.json — استجابة 404 لأصل مفقود لا تُخزَّن', () => {
    it('أصل مبصوم غير موجود (تبويب قديم بعد نشر): 404 وبلا immutable', () => {
        const r = resolveRequest('/assets/main-OLDHASH123.js', { existsOnDisk: false });
        expect(r.status).toBe(404);
        // العيب: كانت تلتقط immutable من قاعدة /assets السابقة فيُخزَّن الـ404 سنة
        expect(isImmutable(r.cacheControl)).toBe(false);
        expect(r.cacheControl).toBe('no-store');
    });

    it('نفس الأصل حين يكون موجوداً فعلاً: 200 مع immutable (لم ينكسر)', () => {
        const r = resolveRequest('/assets/main-ABC12345.js', { existsOnDisk: true });
        expect(r.status).toBe(200);
        expect(isImmutable(r.cacheControl)).toBe(true);
    });
});

describe('vercel.json — الإعداد القابل للتغيير ليس immutable أبداً', () => {
    const mutableConfigFiles = [
        '/whatsapp-config.js',
        '/bank-transfer-config.js',
        '/js/theme-init.js',
        '/sw.js',
        '/manifest.json'
    ];

    it.each(mutableConfigFiles)('%s قابل لإعادة التحقق', (path) => {
        const r = resolveRequest(path, { existsOnDisk: true });
        expect(isImmutable(r.cacheControl)).toBe(false);
        expect(r.cacheControl).toMatch(/max-age=0|no-store|no-cache/);
    });

    it('الخطوط: كاش طويل لكن **بلا** immutable — أسماؤها ليست مبصومة بالمحتوى', () => {
        const r = resolveRequest('/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2', { existsOnDisk: true });
        expect(isImmutable(r.cacheControl)).toBe(false);
        expect(r.cacheControl).toMatch(/stale-while-revalidate/);
    });

    it('صفحات HTML لا تُخزَّن طويلاً', () => {
        const r = resolveRequest('/landing.html', { existsOnDisk: true });
        expect(isImmutable(r.cacheControl)).toBe(false);
    });
});
