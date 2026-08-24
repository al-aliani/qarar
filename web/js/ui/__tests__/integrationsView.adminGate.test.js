/**
 * @vitest-environment jsdom
 *
 * تدقيق أمني 2026-08-24: IntegrationsView كانت تعرض تعليمات إعداد تقنية موجَّهة
 * لمطوّر/مسؤول نظام (Supabase Authentication → Providers، رابط docs/إعداد_Supabase.md،
 * "راجع docs/INTEGRATION_FEATURES.md") وحقل إدخال reCAPTCHA Site Key لأي مستخدم عادي
 * يفتح "حسابي" ← "التكاملات"، بلا أي فحص صلاحية. الآن خلف AuthGuard.isAdmin
 * (نفس نمط AdminDashboardView.js) — غير الأدمن يرى حالة مبسّطة فقط، وحقل
 * reCAPTCHA حُذف نهائياً حتى للأدمن (إعداد بناء لا وقت تشغيل).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const isAdmin = vi.fn();
vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin } }));

const { IntegrationsView } = await import('../IntegrationsView.js');

describe('IntegrationsView — بوابة isAdmin على المحتوى التقني', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="c"></div>';
        localStorage.clear();
        isAdmin.mockReset();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('غير الأدمن: عرض مبسّط فقط، بلا تعليمات إعداد تقنية أو روابط docs/ داخلية', async () => {
        isAdmin.mockResolvedValue(false);
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).not.toContain('Authentication → Providers');
        expect(html).not.toContain('docs/إعداد_Supabase.md');
        expect(html).not.toContain('docs/INTEGRATION_FEATURES.md');
        expect(html).not.toContain('id="inpRecaptchaKey"');
        expect(html).not.toContain('id="inpGSheetsUrl"');

        // لا يزال يعرض أسماء التكاملات وحالتها فقط
        expect(html).toContain('Supabase');
        expect(html).toContain('reCAPTCHA v3');
        expect(html).toMatch(/غير مفعّل|مفعّل/);
    });

    it('الأدمن: يرى المحتوى التقني الكامل كما هو', async () => {
        isAdmin.mockResolvedValue(true);
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        const html = document.getElementById('c').innerHTML;

        // نص الإعداد غير مشروط بحالة Supabase (بخلاف رابط docs/إعداد_Supabase.md
        // الذي لا يظهر إلا حين Supabase غير مهيأ في بيئة التشغيل الحالية).
        expect(html).toContain('Authentication → Providers');
        expect(html).toContain('docs/INTEGRATION_FEATURES.md');
    });

    it('حقل reCAPTCHA Site Key محذوف نهائياً حتى للأدمن', async () => {
        isAdmin.mockResolvedValue(true);
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).not.toContain('id="inpRecaptchaKey"');
        expect(html).not.toContain('id="btnSaveRecaptcha"');
    });
});
