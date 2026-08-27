/**
 * دفعة 9 (2026-08-27، تغطية اختبارات الوحدات المشتركة): rateLimit.ts تستخدمه
 * create-checkout/places-nearby/check-name-availability لمنع استدعاء API خارجية
 * مدفوعة (Moyasar/Stripe/Tamara، Google Places) بلا سقف — بلا أي اختبار وحدة رغم
 * أهميته الأمنية/المالية. لا تغيير سلوك هنا، فقط تثبيت السلوك الحالي — يشمل
 * تحديداً قرار "فشل قراءة الحد = سماح" الموثَّق صراحة في تعليق الملف الأصلي.
 */
import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit } from '../rateLimit.ts';

function fakeAdminClient({ selectResult, insertResult = { error: null } }) {
    const insert = vi.fn(async () => insertResult);
    const order = vi.fn(async () => selectResult);
    const gte = vi.fn(() => ({ order }));
    const eq2 = vi.fn(() => ({ gte }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn((table) => (table === 'rate_limit_events' ? { select, insert } : {}));
    return { client: { from }, from, select, insert, eq1, eq2, gte, order };
}

describe('checkRateLimit', () => {
    it('دون طلبات سابقة ضمن النافذة ⇒ ok:true ويُسجَّل الطلب الحالي فعلياً (insert)', async () => {
        const { client, insert, eq1 } = fakeAdminClient({ selectResult: { data: [], error: null } });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true });
        expect(insert).toHaveBeenCalledWith({ user_id: 'user-1', endpoint: 'create-checkout' });
        expect(eq1).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('عدد الطلبات ضمن النافذة أقل من الحد ⇒ ok:true، يستمر بتسجيل الطلب', async () => {
        const { client, insert } = fakeAdminClient({
            selectResult: { data: [{ created_at: new Date().toISOString() }], error: null },
        });

        const result = await checkRateLimit(client, 'user-1', 'places-nearby', 3, 60);

        expect(result.ok).toBe(true);
        expect(insert).toHaveBeenCalledTimes(1);
    });

    it('بلوغ الحد الأقصى فعلياً ⇒ ok:false مع retryAfterSeconds محسوب من أقدم طلب، وبلا تسجيل طلب جديد', async () => {
        const now = Date.now();
        const oldestCreatedAt = new Date(now - 30_000).toISOString(); // قبل 30 ثانية
        const { client, insert } = fakeAdminClient({
            selectResult: {
                data: [{ created_at: oldestCreatedAt }, { created_at: new Date(now - 10_000).toISOString() }],
                error: null,
            },
        });

        const result = await checkRateLimit(client, 'user-1', 'check-name-availability', 2, 60);

        expect(result.ok).toBe(false);
        // النافذة 60 ثانية، أقدم طلب قبل 30 ثانية ⇒ يتبقى ~30 ثانية لإعادة المحاولة
        expect(result.retryAfterSeconds).toBeGreaterThan(25);
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
        expect(insert).not.toHaveBeenCalled(); // رُفض الطلب — لا يُسجَّل كمحاولة ناجحة
    });

    it('[توثيق قرار مقصود] فشل قراءة سجل الحد نفسه ⇒ ok:true (سماح) لا حظر — عطل الحد لا يُسقط خدمة شرعية', async () => {
        const { client, insert } = fakeAdminClient({ selectResult: { data: null, error: new Error('db timeout') } });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true });
        expect(insert).not.toHaveBeenCalled(); // لا تسجيل عند فشل القراءة أصلاً — يعود فوراً
    });

    it('فشل تسجيل الطلب الحالي (insert) بعد اجتياز فحص الحد ⇒ لا يُسقط الطلب، يبقى ok:true', async () => {
        const { client } = fakeAdminClient({
            selectResult: { data: [], error: null },
            insertResult: { error: new Error('insert failed') },
        });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true }); // فشل تسجيل المحاولة نفسه لا يجوز أن يمنع المستخدم
    });

    it('يفصل عدّادات كل endpoint عن الآخر (فحص القيمة الممرَّرة فعلياً للاستعلام)', async () => {
        const { client, eq2 } = fakeAdminClient({ selectResult: { data: [], error: null } });

        await checkRateLimit(client, 'user-1', 'whatsapp-otp-send', 5, 3600);

        expect(eq2).toHaveBeenCalledWith('endpoint', 'whatsapp-otp-send');
    });
});
