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
import { parseStripeWebhookStatus, getStripeSessionId } from '../_shared/providers/stripe.ts';

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
  const providerRef = getStripeSessionId(event);
  if (!providerRef) return new Response('missing_provider_ref', { status: 400 });
  if (status === 'unknown') return new Response('ok', { status: 200 }); // حدث لا يهمّنا

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await adminClient
    .from('orders')
    .update({
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      metadata: event,
    })
    .eq('provider', 'stripe')
    .eq('provider_ref', providerRef)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[webhook-stripe] update failed:', error);
    return new Response('db_error', { status: 500 });
  }
  if (!data || data.length === 0) {
    console.log('[webhook-stripe] no matching pending order (already processed or unknown ref):', providerRef);
  }

  return new Response('ok', { status: 200 });
});
