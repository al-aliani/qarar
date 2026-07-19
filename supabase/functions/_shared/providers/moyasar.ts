/**
 * مزوّد Moyasar — بوابة سعودية (مدى/Apple Pay/STC Pay/بطاقات) تدعم الريال مباشرة.
 * يستخدم Invoice API (صفحة دفع مُستضافة من Moyasar — لا نتعامل مع بيانات البطاقة
 * إطلاقاً في أي طرف من أطرافنا، لا عميل ولا خادم — يقلّل نطاق PCI-DSS للحد الأدنى).
 *
 * ملاحظة صادقة: هذا التنفيذ مبنيّ على الصيغة الموثَّقة عاماً لواجهة Moyasar
 * (Basic Auth بالمفتاح السرّي، Invoice API لصفحة دفع مُستضافة). تحقّق من مطابقتها
 * للتوثيق الحيّ الفعلي (https://docs.moyasar.com) عند الربط بمفاتيح تجريبية حقيقية
 * قبل أي استخدام إنتاجي — لا تفترض صحتها 100% بلا اختبار فعلي بمفاتيح حقيقية.
 */

const MOYASAR_API_BASE = 'https://api.moyasar.com/v1';

export interface MoyasarCheckoutParams {
  amountSar: number;
  description: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface MoyasarCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
}

export async function createMoyasarCheckout(
  secretKey: string,
  params: MoyasarCheckoutParams
): Promise<MoyasarCheckoutResult> {
  const amountHalalas = Math.round(params.amountSar * 100);
  const basicAuth = btoa(`${secretKey}:`);

  const res = await fetch(`${MOYASAR_API_BASE}/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountHalalas,
      currency: 'SAR',
      description: params.description,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Moyasar invoice creation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data?.id || !data?.url) {
    throw new Error('Moyasar invoice response missing id/url');
  }
  return { providerRef: String(data.id), checkoutUrl: String(data.url) };
}

/** استخراج الحالة من حمولة webhook فاتورة Moyasar (type: 'invoice_paid' وغيرها). */
export function parseMoyasarWebhookStatus(payload: any): 'paid' | 'failed' | 'refunded' | 'unknown' {
  const type = payload?.type;
  const status = payload?.data?.status;
  if (type === 'invoice_paid' || status === 'paid') return 'paid';
  // الاسترداد يصل بنفس معرّف الفاتورة (provider_ref) — يُربط مباشرةً بالطلب المدفوع
  // فيُسحب الوصول (hasActivePayment يتحقق من status='paid' حصراً).
  if (type === 'invoice_refunded' || status === 'refunded') return 'refunded';
  if (type === 'invoice_failed' || status === 'failed') return 'failed';
  return 'unknown';
}
