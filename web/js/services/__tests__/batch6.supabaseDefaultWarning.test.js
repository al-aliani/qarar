/**
 * دفعة 6 — FIX C: web/supabaseClient.js تحتوي على DEFAULT_SUPABASE_URL/ANON_KEY
 * التي تشير فعلياً لمشروع الإنتاج الحقيقي، بلا أي تحذير وقت التشغيل حين تُستخدم
 * (أي حين لا توجد متغيرات بيئة VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ولا
 * window أو localStorage يتجاوزانها). تشغيل محلي دون .env كان يكتب صامتاً في
 * قاعدة بيانات الإنتاج الفعلية.
 *
 * ملاحظة تقنية: هذا الملف لا يُموّه (vi.mock) استيراد supabaseClient.js عمداً —
 * يختبر السلوك الحقيقي لـreadConfig() عبر console.warn ومتغيرات البيئة المُثبَّتة
 * (vi.stubEnv) مع vi.resetModules() لضمان حالة وحدة نظيفة (_client/_clientPromise)
 * في كل اختبار.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('FIX C — تحذير استخدام إعداد Supabase الافتراضي (إنتاج حقيقي)', () => {
    let warnSpy;

    beforeEach(() => {
        vi.resetModules();
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    });

    afterEach(() => {
        warnSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it('يحذّر حين لا يوجد أي تجاوز بيئي (يُستخدم الإعداد الافتراضي المُضمَّن)', async () => {
        const mod = await import('../../../supabaseClient.js');
        await mod.getSupabaseClient();
        expect(warnSpy).toHaveBeenCalled();
        const warnedText = warnSpy.mock.calls.map(c => c.join(' ')).join('\n');
        expect(warnedText).toMatch(/الإنتاج/);
        expect(warnedText).toMatch(/Supabase/);
    });

    it('لا يحذّر حين يوجد تجاوز بيئي كامل (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY)', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example-project.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-dev-anon-key');
        const mod = await import('../../../supabaseClient.js');
        await mod.getSupabaseClient();
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
