/**
 * دفعة 9 (2026-08-27، تغطية اختبارات الوحدات المشتركة): rateLimit.ts تستخدمه
 * create-checkout/places-nearby/check-name-availability لمنع استدعاء API خارجية
 * مدفوعة (Moyasar/Stripe/Tamara، Google Places) بلا سقف — بلا أي اختبار وحدة رغم
 * أهميته الأمنية/المالية.
 *
 * تدقيق 2026-08-29 (سباق تزامن): checkRateLimit لم يعد يستدعي .from()...insert()
 * مباشرة — التحقق والتسجيل صارا داخل استدعاء RPC ذرّي واحد (check_and_record_
 * rate_limit، migration 20260829030000) محميّ بقفل استشاري في قاعدة البيانات.
 * هذه الاختبارات تُثبِّت سلوك *غلاف* checkRateLimit (تمرير المعاملات الصحيحة،
 * تفسير النتيجة، fail-open عند فشل RPC) عبر عميل مموَّه — لا يمكنها إثبات
 * الذرّية نفسها (ذلك يتطلب تنفيذاً متزامناً فعلياً ضد حالة مشتركة، بلا تزييف
 * أحادي الاستدعاء)؛ انظر rateLimitConcurrency.test.js للإثبات الفعلي بمحاكاة
 * تزامن حقيقية (Promise.all + جدولة تحكُّم) تُثبت السباق القديم والإصلاح الجديد معاً.
 */
import { describe, it, expect, vi } from 'vitest';
import { checkRateLimit } from '../rateLimit.ts';

function fakeAdminClient({ rpcResult }) {
    const single = vi.fn(async () => rpcResult);
    const rpc = vi.fn(() => ({ single }));
    return { client: { rpc }, rpc, single };
}

describe('checkRateLimit', () => {
    it('دون طلبات سابقة ضمن النافذة ⇒ ok:true (RPC الذرّي يُرجِع allowed:true بعد تسجيله فعلياً)', async () => {
        const { client, rpc } = fakeAdminClient({ rpcResult: { data: { allowed: true, retry_after_seconds: null }, error: null } });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true });
        expect(rpc).toHaveBeenCalledWith('check_and_record_rate_limit', {
            p_user_id: 'user-1',
            p_endpoint: 'create-checkout',
            p_max_requests: 3,
            p_window_seconds: 60,
        });
    });

    it('عدد الطلبات ضمن النافذة أقل من الحد ⇒ ok:true', async () => {
        const { client } = fakeAdminClient({ rpcResult: { data: { allowed: true, retry_after_seconds: null }, error: null } });

        const result = await checkRateLimit(client, 'user-1', 'places-nearby', 3, 60);

        expect(result.ok).toBe(true);
    });

    it('بلوغ الحد الأقصى فعلياً ⇒ ok:false مع retryAfterSeconds من الدالة الذرّية', async () => {
        const { client } = fakeAdminClient({ rpcResult: { data: { allowed: false, retry_after_seconds: 28 }, error: null } });

        const result = await checkRateLimit(client, 'user-1', 'check-name-availability', 2, 60);

        expect(result.ok).toBe(false);
        expect(result.retryAfterSeconds).toBe(28);
    });

    it('[توثيق قرار مقصود] فشل استدعاء RPC ⇒ ok:true (سماح) لا حظر — عطل الحد نفسه لا يُسقط خدمة شرعية', async () => {
        const { client } = fakeAdminClient({ rpcResult: { data: null, error: new Error('db timeout') } });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true });
    });

    it('استجابة بلا بيانات (data فارغة) رغم عدم وجود خطأ صريح ⇒ ok:true (fail-open دفاعي)', async () => {
        const { client } = fakeAdminClient({ rpcResult: { data: null, error: null } });

        const result = await checkRateLimit(client, 'user-1', 'create-checkout', 3, 60);

        expect(result).toEqual({ ok: true });
    });

    it('يفصل عدّادات كل endpoint عن الآخر (فحص المعامل الممرَّر فعلياً لاستدعاء RPC)', async () => {
        const { client, rpc } = fakeAdminClient({ rpcResult: { data: { allowed: true, retry_after_seconds: null }, error: null } });

        await checkRateLimit(client, 'user-1', 'whatsapp-otp-send', 5, 3600);

        expect(rpc).toHaveBeenCalledWith('check_and_record_rate_limit', expect.objectContaining({ p_endpoint: 'whatsapp-otp-send' }));
    });
});
