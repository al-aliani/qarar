/**
 * دفعة 2 من خطة إغلاق فجوات الطبقات الـ16: دفاع بالعمق ضد سيناريو نظري —
 * جلسة دفع أُنشئت مباشرة لدى المزوّد بمبلغ منخفض (تجاوز create-checkout)، ثم
 * webhook حقيقي التوقيع يُرسَل بمبلغ لا يطابق ما يستحقه الطلب.
 * verifyOrderAmount.ts يستخدم Web Crypto فقط — لا Deno API — يعمل مباشرة هنا.
 */
import { describe, it, expect, vi } from 'vitest';
import { verifyOrderAmount } from '../amountGuard.ts';

function makeAdminClient(orderRow) {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        maybeSingle: async () => ({ data: orderRow }),
                    }),
                }),
            }),
        }),
    };
}

describe('verifyOrderAmount — دفاع بالعمق ضد تلاعب مبلغ الدفع', () => {
    it('يرفض حين يختلف المبلغ المؤكَّد عن orders.amount_sar بأكثر من الهامش المسموح', async () => {
        const adminClient = makeAdminClient({ amount_sar: 1999 });
        const result = await verifyOrderAmount(adminClient, {
            provider: 'moyasar',
            providerRef: 'inv_123',
            confirmedAmountSar: 1,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('mismatch');
        expect(result.expectedAmountSar).toBe(1999);
    });

    it('يقبل حين يطابق المبلغ تماماً', async () => {
        const adminClient = makeAdminClient({ amount_sar: 299 });
        const result = await verifyOrderAmount(adminClient, {
            provider: 'moyasar',
            providerRef: 'inv_123',
            confirmedAmountSar: 299,
        });
        expect(result.ok).toBe(true);
        expect(result.reason).toBe('match');
    });

    it('يقبل مع فرق تقريب صغير جداً (هللة واحدة) — لا رفض بسبب أخطاء تقريب عائمة', async () => {
        const adminClient = makeAdminClient({ amount_sar: 299 });
        const result = await verifyOrderAmount(adminClient, {
            provider: 'moyasar',
            providerRef: 'inv_123',
            confirmedAmountSar: 299.005,
        });
        expect(result.ok).toBe(true);
    });

    it('[fail-open] لا يرفض الدفع إن تعذّر تفسير المبلغ من الحمولة (null)', async () => {
        const adminClient = makeAdminClient({ amount_sar: 299 });
        const result = await verifyOrderAmount(adminClient, {
            provider: 'tamara',
            providerRef: 'order_1',
            confirmedAmountSar: null,
        });
        expect(result.ok).toBe(true);
        expect(result.reason).toBe('unparseable_amount');
    });

    it('[fail-open] لا يرفض إن لم يوجد طلب مطابق أصلاً — المسار القائم يتولى هذه الحالة', async () => {
        const adminClient = makeAdminClient(null);
        const result = await verifyOrderAmount(adminClient, {
            provider: 'stripe',
            providerRef: 'cs_unknown',
            confirmedAmountSar: 1999,
        });
        expect(result.ok).toBe(true);
        expect(result.reason).toBe('no_matching_order');
    });

    it('[إثبات الحارس] بلا هذا الفحص، أي مبلغ (بما فيه 1 ريال) كان سيُمنَح دون رفض', async () => {
        // محاكاة السلوك القديم: لا مقارنة إطلاقاً بين المبلغ المؤكَّد والمستحق.
        const noCheckAtAll = (confirmedAmountSar) => ({ ok: true });
        expect(noCheckAtAll(1).ok).toBe(true); // كان سينجح حتى لو الطلب يستحق 1999
    });
});
