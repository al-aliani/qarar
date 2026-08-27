/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): القاعدة الأخيرة في vercel.json كانت
 * `{ "src": "^/(.*)$", "dest": "/index.html" }` بلا أي استثناء — أي مسار غير
 * موجود فعلياً (خطأ إملائي في رابط، ملف قديم مُزال) يسقط بعد `handle: filesystem`
 * إلى هذه القاعدة ويحصل على 200 مع قشرة تطبيق SPA كاملة (canonical يشير للرئيسية)
 * بدل 404 حقيقية — soft-404 يُهدر ميزانية زحف محركات البحث ويحيّر زائراً أخطأ
 * الرابط بإدخاله داخل التطبيق بلا تفسير. `/app.html` و`/reviewer.html` (غير
 * موجودين كملفات، وبلا أي مرجع في الكود — grep تأكيدي) كانا أمثلة حية على هذا.
 *
 * الإصلاح: قاعدة جديدة قبل الالتقاط الأخير تُعيد 404 حقيقية لأي مسار بامتداد
 * ملف ثابت معروف (html/صور/مستندات/خطوط/js/css) لم يُخدَّم فعلياً عبر
 * `handle: filesystem` — تاركة المسارات بلا امتداد (تخمين آمن لروابط قديمة
 * محتملة) تسقط كما كانت إلى قشرة SPA.
 *
 * الحارس يحاكي دلالة `routes` بنفس منهجية vercelRoutes.cachePolicy.test.js
 * (تطبيق بالترتيب، `continue` يُكمل، اللاحقة تدهس السابقة عند تعارض ترويسة).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf-8'));

function resolveRequest(path, { existsOnDisk }) {
    const headers = {};
    let status = 200;
    let dest = path;

    for (const route of config.routes) {
        if (route.handle === 'filesystem') {
            if (existsOnDisk) break;
            continue;
        }
        if (!route.src) continue;
        if (Array.isArray(route.has) && route.has.length) continue;
        if (!new RegExp(route.src).test(path)) continue;

        Object.assign(headers, route.headers || {});
        if (route.status) status = route.status;
        if (route.dest) dest = route.dest;
        if (!route.continue) break;
    }
    return { status, headers, dest };
}

describe('vercel.json — مسار غير موجود بامتداد ملف ثابت معروف يعيد 404 حقيقية', () => {
    it.each([
        '/nonexistent-xyz-123.html',
        '/app.html',
        '/reviewer.html',
        '/img/definitely-missing-xyz.png',
        '/old-report.pdf',
    ])('%s ⟶ 404 بلا قشرة SPA (لا dest=/index.html)', (path) => {
        const r = resolveRequest(path, { existsOnDisk: false });
        expect(r.status).toBe(404);
        expect(r.dest).not.toBe('/index.html');
        expect(r.headers['Cache-Control']).toBe('no-store');
    });

    it('مسار بلا امتداد (بريد أمان لروابط قديمة محتملة) يبقى يسقط إلى قشرة SPA كما كان', () => {
        const r = resolveRequest('/totally/made/up/path-987', { existsOnDisk: false });
        expect(r.status).toBe(200);
        expect(r.dest).toBe('/index.html');
    });

    it('ملف حقيقي موجود بنفس الامتداد يُخدَّم طبيعياً (200) — القاعدة لا تكسر شيئاً حياً', () => {
        const r = resolveRequest('/pricing.html', { existsOnDisk: true });
        expect(r.status).toBe(200);
        expect(r.dest).not.toBe('/index.html');
    });

    it('/assets/*.js المفقود يبقى يأخذ حكم قاعدته الأسبق (404) لا القاعدة الجديدة', () => {
        const r = resolveRequest('/assets/main-OLDHASH.js', { existsOnDisk: false });
        expect(r.status).toBe(404);
    });

    it('[إثبات الحارس] حذف قاعدة الامتدادات الجديدة يُعيد soft-404 القديم', () => {
        const withoutNewRule = {
            ...config,
            routes: config.routes.filter(
                (r) => r.src !== '^/(.*)\\.(html|png|jpe?g|gif|svg|webp|avif|ico|pdf|xlsx|xls|docx|csv|woff2?|ttf|otf|js|css)$',
            ),
        };
        expect(withoutNewRule.routes.length).toBe(config.routes.length - 1);

        function resolveWithout(path) {
            let status = 200;
            let dest = path;
            for (const route of withoutNewRule.routes) {
                if (route.handle === 'filesystem') continue;
                if (!route.src) continue;
                if (Array.isArray(route.has) && route.has.length) continue;
                if (!new RegExp(route.src).test(path)) continue;
                if (route.status) status = route.status;
                if (route.dest) dest = route.dest;
                if (!route.continue) break;
            }
            return { status, dest };
        }
        const broken = resolveWithout('/nonexistent-xyz-123.html');
        expect(broken.status).toBe(200);
        expect(broken.dest).toBe('/index.html');
    });
});

describe('vercel.json — صفحات الإدارة/التشخيص تحمل X-Robots-Tag: noindex', () => {
    it.each(['/admin.html', '/dashboard.html', '/smoke_test.html', '/financial_charts.html'])(
        '%s ⟶ X-Robots-Tag: noindex',
        (path) => {
            const r = resolveRequest(path, { existsOnDisk: true });
            expect(r.headers['X-Robots-Tag']).toBe('noindex');
        },
    );

    it('صفحة عامة عادية لا تحمل noindex', () => {
        const r = resolveRequest('/pricing.html', { existsOnDisk: true });
        expect(r.headers['X-Robots-Tag']).toBeUndefined();
    });
});
