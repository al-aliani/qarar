/**
 * مزوّد Stripe — للبطاقات الدولية (عملاء خارج السعودية أو يفضّلون Stripe).
 * يستخدم Checkout Sessions API (صفحة دفع مُستضافة من Stripe — نفس منطق تقليل
 * نطاق PCI-DSS المتّبع مع Moyasar: لا نلمس بيانات البطاقة في أي طرف من أطرافنا).
 *
 * ملاحظة صادقة: مبنيّ على واجهة Stripe Checkout Sessions الموثَّقة (مستقرة منذ
 * سنوات، ثقة عالية في الشكل العام)، لكن تحقّق دوماً من https://stripe.com/docs
 * الحيّ عند الربط بمفاتيح تجريبية حقيقية قبل أي استخدام إنتاجي.
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export interface StripeCheckoutParams {
  amountSar: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface StripeCheckoutResult {
  providerRef: string;
  checkoutUrl: string;
}

function toFormBody(obj: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parts.push(...toFormBody(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === 'object') {
          parts.push(...toFormBody(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

export async function createStripeCheckout(
  secretKey: string,
  params: StripeCheckoutParams
): Promise<StripeCheckoutResult> {
  // المبلغ بأصغر وحدة عملة (هللة للريال، مثل السنت للدولار) — Stripe يتطلب هذا التمثيل.
  const unitAmount = Math.round(params.amountSar * 100);

  const body = toFormBody({
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'sar',
          unit_amount: unitAmount,
          product_data: { name: params.description },
        },
      },
    ],
    metadata: params.metadata,
  }).join('&');

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Stripe checkout session creation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  if (!data?.id || !data?.url) {
    throw new Error('Stripe checkout session response missing id/url');
  }
  return { providerRef: String(data.id), checkoutUrl: String(data.url) };
}

/** استخراج الحالة من حدث webhook (checkout.session.completed يعني دفعاً ناجحاً). */
export function parseStripeWebhookStatus(event: any): 'paid' | 'failed' | 'unknown' {
  const type = event?.type;
  if (type === 'checkout.session.completed') {
    const paymentStatus = event?.data?.object?.payment_status;
    return paymentStatus === 'paid' ? 'paid' : 'unknown';
  }
  if (type === 'checkout.session.async_payment_failed' || type === 'payment_intent.payment_failed') {
    return 'failed';
  }
  return 'unknown';
}

export function getStripeSessionId(event: any): string | null {
  return event?.data?.object?.id || null;
}
