/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-29: عميل Supabase (getSupabaseClient) كان يُنشأ بلا أي مهلة على fetch —
 * تعليق شبكي فعلي لدى Supabase (حفظ/تحميل دراسة، مصادقة...) كان يُعلّق العملية للأبد
 * بلا أي ملاحظة للمستخدم. الإصلاح: fetchWithTimeout() مُصدَّرة من supabaseClient.js،
 * مُمرَّرة عبر خيار global.fetch الموثَّق في supabase-js.
 *
 * ملاحظة اختبار: تعمّدنا عدم استخدام AbortSignal.timeout() في الكود المصدري (رغم
 * استخدامها في supabase/functions/_shared/nameAvailability.ts على جانب الخادم) — تجربة
 * فعلية أثبتت أنها لا تتأثر بمؤقّتات Vitest الوهمية (vi.useFakeTimers)، فتعذّر اختبار
 * إطلاقها الفعلي دون انتظار حقيقي (15+ ثانية) يُبطئ المجموعة. النمط المُستخدَم هنا
 * (AbortController + setTimeout يدوياً، مطابق لـ AIConnector.js._postJson) يتأثر
 * بمؤقّتات Vitest الوهمية فعلياً — أثبتنا هذا تجريبياً قبل الاختيار — فيُختبَر بسرعة
 * ودون أي انتظار حقيقي أدناه.
 *
 * getSupabaseClient() نفسها (تخزين مؤقّت بمستوى الوحدة/Promise مشترك) صعبة العزل الكامل
 * بين اختبارات متعددة في نفس الملف (انظر ملاحظة المهمة الأصلية) — لذا نختبر fetchWithTimeout
 * مباشرة كوحدة مستقلة (الاختبارات 2-4)، إضافةً لاختبار وحيد (1) يثبت فعلاً أنها المُمرَّرة
 * إلى createClient عبر global.fetch (لا مجرّد دالة موجودة في الملف بلا استخدام).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(() => ({ auth: {} })),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: mocks.createClient,
}));

describe('supabaseClient.js — مهلة افتراضية على fetch', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.createClient.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('يُمرَّر إلى createClient عبر global.fetch فعلياً (لا دالة معزولة بلا استخدام)', async () => {
        const { getSupabaseClient, fetchWithTimeout } = await import('../supabaseClient.js');
        await getSupabaseClient();

        expect(mocks.createClient).toHaveBeenCalledTimes(1);
        const [, , options] = mocks.createClient.mock.calls[0];
        expect(options.global.fetch).toBe(fetchWithTimeout);
    });

    it('يُلغي طلباً مُعلَّقاً تلقائياً بعد المهلة الافتراضية (لا يبقى مُعلَّقاً للأبد)', async () => {
        vi.useFakeTimers();
        const hangingFetch = vi.fn((url, init) => new Promise((resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }));
        vi.stubGlobal('fetch', hangingFetch);

        const { fetchWithTimeout } = await import('../supabaseClient.js');
        const promise = fetchWithTimeout('https://test.supabase.co/rest/v1/studies');
        const assertion = expect(promise).rejects.toThrow();

        // نتقدّم بما يتجاوز أي مهلة معقولة مضبوطة (ثوانٍ معدودة إلى ~30 ثانية) — الهدف
        // إثبات أن الإلغاء يُطلَق فعلاً، لا قياس الرقم بالمللي ثانية الحرفي.
        await vi.advanceTimersByTimeAsync(60000);
        await assertion;

        expect(hangingFetch).toHaveBeenCalledTimes(1);
        const [, init] = hangingFetch.mock.calls[0];
        expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('لا يتدخل حين يمرّر المستدعي signal خاصاً به بالفعل (لا يستبدله بمهلته)', async () => {
        const customController = new AbortController();
        const passthroughFetch = vi.fn(async (url, init) => {
            expect(init.signal).toBe(customController.signal);
            return { ok: true };
        });
        vi.stubGlobal('fetch', passthroughFetch);

        const { fetchWithTimeout } = await import('../supabaseClient.js');
        await fetchWithTimeout('https://test.supabase.co/x', { signal: customController.signal });

        expect(passthroughFetch).toHaveBeenCalledTimes(1);
    });

    it('لا يُطلق أي إلغاء متأخر بعد نجاح الطلب فعلياً (المهلة الداخلية تُلغى بعد الاستجابة)', async () => {
        vi.useFakeTimers();
        const okFetch = vi.fn(async () => ({ ok: true, status: 200 }));
        vi.stubGlobal('fetch', okFetch);

        const { fetchWithTimeout } = await import('../supabaseClient.js');
        const result = await fetchWithTimeout('https://test.supabase.co/x');
        expect(result.ok).toBe(true);

        // بعد النجاح، حتى لو تقدّم الوقت الوهمي كثيراً، لا شيء يُفترض أن يحدث (لا رفض
        // متأخر، لا استثناء غير مُعالَج) لأن clearTimeout استُدعيت فعلياً.
        await vi.advanceTimersByTimeAsync(120000);
    });
});
