/**
 * Edge Function: webhook-tamara
 * نقطة عامة (بلا JWT — Tamara تستدعيها مباشرة من خوادمها). التحقق من رأس
 * Authorization (Bearer notification_token) يجب أن يسبق أي قراءة/كتابة على
 * قاعدة البيانات — دونه يمكن لأي طرف خارجي إرسال طلب مزيَّف "الدفع نجح".
 * Idempotent: لا تعالج نفس provider_ref مرتين (تحديث مشروط بالحالة الحالية).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyTamaraNotificationToken } from '../_shared/webhookVerify.ts';
import { parseTamaraWebhookStatus } from '../_shared/providers/tamara.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid_json', { status: 400 });
  }

  const configuredToken = Deno.env.get('TAMARA_NOTIFICATION_TOKEN')!;
  const verification = verifyTamaraNotificationToken(req.headers.get('Authorization'), configuredToken);
  if (!verification.ok) {
    console.warn('[webhook-tamara] token rejected:', verification.reason);
    return new Response('invalid_signature', { status: 401 });
  }

  const status = parseTamaraWebhookStatus(payload);
  const providerRef = String(payload?.order_id || payload?.data?.order_id || '');
  if (!providerRef) return new Response('missing_provider_ref', { status: 400 });
  if (status === 'unknown') return new Response('ok', { status: 200 }); // حدث لا يهمّنا

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // شرط "status='pending'" في التحديث يمنع إعادة معالجة حدث مكرر من الكتابة
  // فوق سجل مدفوع/فاشل مسبقاً.
  const { data, error } = await adminClient
    .from('orders')
    .update({
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      metadata: payload,
    })
    .eq('provider', 'tamara')
    .eq('provider_ref', providerRef)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[webhook-tamara] update failed:', error);
    return new Response('db_error', { status: 500 });
  }
  if (!data || data.length === 0) {
    console.log('[webhook-tamara] no matching pending order (already processed or unknown ref):', providerRef);
  } else if (status === 'paid') {
    // إدخال طلبات "مراجَع بخبير" المدفوعة حديثاً إلى طابور المراجعين تلقائياً
    // (نفس منطق webhook-moyasar/webhook-stripe).
    await adminClient
      .from('orders')
      .update({ review_status: 'queued' })
      .in('id', data.map((row: { id: string }) => row.id))
      .eq('tier', 'reviewed')
      .eq('review_status', 'none');
  }

  return new Response('ok', { status: 200 });
});
