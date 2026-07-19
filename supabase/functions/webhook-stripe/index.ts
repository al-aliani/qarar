/**
 * Edge Function: webhook-stripe
 * نقطة عامة (بلا JWT — Stripe تستدعيها مباشرة). يجب قراءة الجسم كنص خام (rawBody)
 * قبل أي JSON.parse — التحقق من التوقيع يعتمد على البايتات الحرفية المُرسَلة،
 * وأي إعادة تسلسل JSON قد تُغيّر ترتيب المفاتيح فيفشل التحقق لأسباب لا علاقة
 * لها بصحة الحدث فعلياً.
 * Idempotent: تحديث مشروط بالحالة الحالية (pending) لتفادي معالجة نفس الحدث مرتين.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyStripeSignature } from '../_shared/webhookVerify.ts';
import { parseStripeWebhookStatus, getStripeSessionId, getStripePaymentIntent } from '../_shared/providers/stripe.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('Stripe-Signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  const verification = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.ok) {
    console.warn('[webhook-stripe] signature rejected:', verification.reason);
    return new Response('invalid_signature', { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('invalid_json', { status: 400 });
  }

  const status = parseStripeWebhookStatus(event);
  if (status === 'unknown') return new Response('ok', { status: 200 }); // حدث لا يهمّنا

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const updateFields: Record<string, unknown> = { status, metadata: event };
  let matcher = adminClient.from('orders').update(updateFields).eq('provider', 'stripe');

  if (status === 'refunded') {
    // حدث charge.refunded يحمل كائن charge (بـ payment_intent) لا session، فلا يطابق
    // provider_ref (session id). نربطه بالطلب عبر provider_payment_intent المحفوظ وقت
    // الدفع، ونحدّث طلباً paid فقط. تحويل الحالة إلى 'refunded' يسحب الوصول تلقائياً.
    const paymentIntent = getStripePaymentIntent(event);
    if (!paymentIntent) return new Response('missing_payment_intent', { status: 400 });
    matcher = matcher.eq('provider_payment_intent', paymentIntent).eq('status', 'paid');
  } else {
    // paid/failed: الربط عبر session id (provider_ref)، وتحديث طلب pending فقط (idempotency).
    const sessionId = getStripeSessionId(event);
    if (!sessionId) return new Response('missing_provider_ref', { status: 400 });
    if (status === 'paid') {
      updateFields.paid_at = new Date().toISOString();
      // نحفظ payment_intent الآن ليتيح ربط أي استرداد لاحق (charge.refunded) بهذا الطلب.
      const paymentIntent = getStripePaymentIntent(event);
      if (paymentIntent) updateFields.provider_payment_intent = paymentIntent;
    }
    matcher = matcher.eq('provider_ref', sessionId).eq('status', 'pending');
  }

  const { data, error } = await matcher.select('id');

  if (error) {
    console.error('[webhook-stripe] update failed:', error);
    return new Response('db_error', { status: 500 });
  }
  if (!data || data.length === 0) {
    // المرجع المستخدم في المطابقة يختلف بحسب الفرع (payment_intent للاسترداد، session id
    // للدفع/الفشل). كان السطر يشير إلى متغيّر providerRef محذوف بعد إعادة الهيكلة →
    // ReferenceError/500 على كل مسار «لا مطابقة» (إعادة تسليم مكرّرة أو استرداد بلا طلب).
    const logRef = status === 'refunded' ? getStripePaymentIntent(event) : getStripeSessionId(event);
    console.log('[webhook-stripe] no matching order (already processed or unknown ref):', logRef);
  } else if (status === 'paid') {
    // إدخال طلبات "مراجَع بخبير" المدفوعة حديثاً إلى طابور المراجعين تلقائياً —
    // شرط review_status='none' يمنع إعادة إدخال طلب سبق أن دخل السير (استقبال
    // مكرر للحدث بعد الدفع لا يجب أن يعيد طلباً مُعتمَداً/قيد المراجعة إلى الطابور.
    await adminClient
      .from('orders')
      .update({ review_status: 'queued' })
      .in('id', data.map((row: { id: string }) => row.id))
      .eq('tier', 'reviewed')
      .eq('review_status', 'none');
  }

  return new Response('ok', { status: 200 });
});
