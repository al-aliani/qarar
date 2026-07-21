/**
 * مزوّد Tamara — خدمة "اشترِ الآن وادفع لاحقاً" (BNPL) سعودية، تسمح للعميل
 * بتقسيط سعر الدراسة على دفعات بدل الدفع الكامل فوراً (فجوة تحويل محتملة
 * مقابل منافسين يوفرونها بالفعل، مثل "جدوى تك" عبر تمارا).
 *
 * ملاحظة صادقة (بنفس تحفّظ moyasar.ts): هذا التنفيذ مبنيّ على الصيغة
 * الموثَّقة عاماً لواجهة Tamara Checkout API (مصادقة Bearer بالتوكن، نقطة
 * /checkout لإنشاء جلسة، صفحة دفع مُستضافة من تمارا). تحقّق من مطابقتها
 * للتوثيق الحيّ الفعلي (https://docs.tamara.co) عند الربط بمفاتيح Sandbox
 * حقيقية قبل أي استخدام إنتاجي — لا تفترض صحتها 100% بلا اختبار فعلي.
 */

const TAMARA_API_BASE = 'https://api.tamara.co';

export interface TamaraCheckoutParams {
  amountSar: number;
  description: string;
  callbackUrl: string;
  /**
   * رابط إشعار الخادم-إلى-خادم (webhook-tamara)، منفصل عمداً عن callbackUrl
   * (صفحة SPA بالمتصفح). خلطهما كان بلوكر #12: تمارا كانت تُرسل الإشعار
   * الحقيقي لصفحة أمامية لا تستقبله أبداً، فلا يصل التأكيد للخادم إطلاقاً.
   */
  notificationUrl: string;
  metadata: Record<string, string>;
}

export interface TamaraCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
}

export async function createTamaraCheckout(
  apiToken: string,
  params: TamaraCheckoutParams
): Promise<TamaraCheckoutResult> {
  const res = await fetch(`${TAMARA_API_BASE}/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      total_amount: { amount: params.amountSar.toFixed(2), currency: 'SAR' },
      shipping_amount: { amount: '0.00', currency: 'SAR' },
      tax_amount: { amount: '0.00', currency: 'SAR' },
      order_reference_id: params.metadata?.orderId || '',
      description: params.description,
      country_code: 'SA',
      items: [
        {
          name: params.description,
          type: 'Digital',
          reference_id: params.metadata?.orderId || '',
          quantity: 1,
          unit_price: { amount: params.amountSar.toFixed(2), currency: 'SAR' },
          total_amount: { amount: params.amountSar.toFixed(2), currency: 'SAR' },
        },
      ],
      merchant_url: {
        success: params.callbackUrl,
        failure: params.callbackUrl,
        cancel: params.callbackUrl,
        notification: params.notificationUrl,
      },
      metadata: params.metadata,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Tamara checkout creation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data?.order_id || !data?.checkout_url) {
    throw new Error('Tamara checkout response missing order_id/checkout_url');
  }
  return { providerRef: String(data.order_id), checkoutUrl: String(data.checkout_url) };
}

/** استخراج الحالة من حمولة webhook تمارا (order_status: approved/captured/declined/...). */
export function parseTamaraWebhookStatus(payload: any): 'paid' | 'failed' | 'refunded' | 'unknown' {
  const status = String(payload?.order_status || payload?.status || '').toLowerCase();
  // بلوكر #12: 'approved' يعني تمارا وافقت/حجزت المبلغ فقط — القبض الفعلي (capture)
  // خطوة منفصلة قد لم تصل بعد. اعتبارها 'paid' كان يفتح تصدير التقرير قبل تأكيد قبض
  // المبلغ فعلياً. ننتظر فقط captured/fully_captured (الإشارة الوحيدة لقبض حقيقي حسب
  // توثيق تمارا) — سواء وصلت تلقائياً (حساب auto-capture) أو لاحقاً بعد Capture API
  // يدوي، لا نفترض أياً منهما، ننتظر الحدث الفعلي فقط.
  if (status === 'captured' || status === 'fully_captured') return 'paid';
  // الاسترداد (كلي أو جزئي) يصل بنفس order_id (provider_ref) — يُسحب الوصول.
  if (status === 'refunded' || status === 'partially_refunded') return 'refunded';
  if (status === 'declined' || status === 'canceled' || status === 'cancelled' || status === 'expired') return 'failed';
  return 'unknown';
}
