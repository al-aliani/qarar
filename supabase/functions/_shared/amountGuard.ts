/**
 * دفعة 2 من خطة إغلاق فجوات الطبقات الـ16 (لوحة تقييم 2026-08-27، طبقة Payments
 * correctness): كل webhook دفع كان يمنح status='paid' بمجرد تحقق التوقيع/التوكن،
 * بلا مقارنة المبلغ المؤكَّد من المزوّد بما يستحقه الطلب فعلياً (orders.amount_sar).
 * السيناريو المدافَع عنه: مهاجم ينشئ جلسة دفع بمبلغ منخفض مباشرة لدى المزوّد
 * (يتجاوز create-checkout كلياً) ثم يوجّه webhook حقيقياً (توقيعه صالح فعلاً من
 * حسابه الخاص) إلى نقطتنا مع provider_ref يطابق طلباً pending بمبلغ أعلى.
 *
 * تصميم متعمَّد: **فشل تفسير المبلغ من الحمولة (fail-open)** — التحقق من التوقيع/
 * التوكن يبقى البوابة الأساسية الحقيقية؛ هذا دفاع إضافي بالعمق فقط. حمولات
 * Tamara تحديداً موثَّقة في providers/tamara.ts بأنها "غير مؤكدة 100% بلا اختبار
 * فعلي بمفاتيح حقيقية" — رفض الدفع لعدم فهمي لشكل حقل قد يكون خاطئاً أخطر من
 * تفويت هذا الفحص الإضافي مرة. لا نمنع الدفع أبداً بسبب غموض في القراءة نفسها،
 * فقط عند مطابقة رقمية واضحة وصريحة.
 */
export interface AmountCheckParams {
  provider: string;
  providerRef: string;
  confirmedAmountSar: number | null;
}

export interface AmountCheckResult {
  ok: boolean;
  reason?: 'unparseable_amount' | 'no_matching_order' | 'mismatch' | 'match';
  expectedAmountSar?: number;
}

const TOLERANCE_SAR = 0.01;

export async function verifyOrderAmount(
  adminClient: any,
  params: AmountCheckParams
): Promise<AmountCheckResult> {
  if (params.confirmedAmountSar == null || !Number.isFinite(params.confirmedAmountSar)) {
    return { ok: true, reason: 'unparseable_amount' };
  }

  const { data: existingOrder } = await adminClient
    .from('orders')
    .select('amount_sar')
    .eq('provider', params.provider)
    .eq('provider_ref', params.providerRef)
    .maybeSingle();

  // لا طلب مطابق: المسار القائم أصلاً (data.length === 0 بعد محاولة التحديث) يتولى
  // هذه الحالة (سجلّ + لا منح وصول) — هذا الفحص لا يضيف رفضاً مبكراً هنا كي لا
  // يُخفي رسالة الخطأ الأوضح القائمة أصلاً خلف رسالة "عدم تطابق مبلغ" مضلِّلة.
  if (!existingOrder) {
    return { ok: true, reason: 'no_matching_order' };
  }

  const expected = Number(existingOrder.amount_sar);
  if (!Number.isFinite(expected)) {
    return { ok: true, reason: 'unparseable_amount' };
  }

  const matches = Math.abs(expected - params.confirmedAmountSar) <= TOLERANCE_SAR;
  return { ok: matches, reason: matches ? 'match' : 'mismatch', expectedAmountSar: expected };
}
