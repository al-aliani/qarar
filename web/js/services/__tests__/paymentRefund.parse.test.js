/**
 * تدقيق 2026-07-19 (سحب الوصول عند الاسترداد): قبل هذا كانت مُحلِّلات أحداث webhook
 * تكشف paid/failed فقط، فالاسترداد من لوحة المزوّد لا ينعكس على orders.status ويبقى
 * الوصول للتقرير بعد استرجاع المال. هذا الحارس يثبت أن الأحداث الاستردادية تُصنّف
 * 'refunded' لكل مزوّد (المعالجة الفعلية في معالجات webhook تحوّل paid إلى refunded).
 *
 * ملاحظة: vitest لا يستورد .ts من supabase/functions (خارج جذر Vite)، فنستخرج جسم
 * الدالة النقية من المصدر وننفّذه — اختبار سلوكي فعلي على منطق الكود لا فحص نصّي.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readFn = (rel) => readFileSync(join(__dirname, '../../../../supabase/functions/', rel), 'utf8');

/** يستخرج جسم دالة نقية (بلا type annotations داخلية) من مصدر .ts وينفّذها. */
function loadParser(relPath, fnName) {
  const src = readFn(relPath);
  const startRe = new RegExp(`export function ${fnName}\\((\\w+)[^)]*\\)[^{]*\\{`);
  const m = startRe.exec(src);
  if (!m) throw new Error(`تعذّر إيجاد ${fnName} في ${relPath}`);
  const paramName = m[1];
  let depth = 1;
  let i = m.index + m[0].length;
  const bodyStart = i;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  // eslint-disable-next-line no-new-func
  return new Function(paramName, src.slice(bodyStart, i - 1));
}

const parseMoyasar = loadParser('_shared/providers/moyasar.ts', 'parseMoyasarWebhookStatus');
const parseStripe = loadParser('_shared/providers/stripe.ts', 'parseStripeWebhookStatus');
const stripePI = loadParser('_shared/providers/stripe.ts', 'getStripePaymentIntent');
const parseTamara = loadParser('_shared/providers/tamara.ts', 'parseTamaraWebhookStatus');

describe('كشف الاسترداد في مُحلِّلات أحداث المزودين', () => {
  it('Moyasar: invoice_refunded أو status=refunded → refunded (وتبقى paid/failed كما هي)', () => {
    expect(parseMoyasar({ type: 'invoice_refunded', data: { id: 'inv_1' } })).toBe('refunded');
    expect(parseMoyasar({ data: { status: 'refunded' } })).toBe('refunded');
    expect(parseMoyasar({ type: 'invoice_paid' })).toBe('paid');
    expect(parseMoyasar({ type: 'invoice_failed' })).toBe('failed');
    expect(parseMoyasar({ type: 'invoice.created' })).toBe('unknown');
  });

  it('Stripe: charge.refunded → refunded، مع payment_intent للربط بالطلب الأصلي', () => {
    const refundEvent = { type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_123' } } };
    expect(parseStripe(refundEvent)).toBe('refunded');
    expect(stripePI(refundEvent)).toBe('pi_123'); // الجسر الوحيد لربط الاسترداد (charge بلا session id)
    expect(parseStripe({ type: 'checkout.session.completed', data: { object: { payment_status: 'paid' } } })).toBe('paid');
    expect(parseStripe({ type: 'payment_intent.payment_failed' })).toBe('failed');
  });

  it('Tamara: refunded/partially_refunded → refunded (وapproved لم يعد يُعامَل كـpaid — بلوكر #12)', () => {
    expect(parseTamara({ order_status: 'refunded' })).toBe('refunded');
    expect(parseTamara({ order_status: 'partially_refunded' })).toBe('refunded');
    // بلوكر #12 (تدقيق 2026-07-21): 'approved' موافقة/حجز فقط لا قبض فعلي — لم يعد
    // يُعامَل كـ'paid' (كان يفتح تصدير التقرير قبل تأكيد قبض المبلغ فعلياً).
    expect(parseTamara({ order_status: 'approved' })).toBe('unknown');
    expect(parseTamara({ order_status: 'captured' })).toBe('paid');
    expect(parseTamara({ order_status: 'declined' })).toBe('failed');
  });
});
