/**
 * Edge Function: webhook-moyasar
 * نقطة عامة (بلا JWT — Moyasar تستدعيها مباشرة من خوادمها). التحقق من
 * secret_token يجب أن يسبق أي قراءة/كتابة على قاعدة البيانات — دونه يمكن لأي
 * طرف خارجي إرسال طلب مزيَّف "الدفع نجح" لأي طلب.
 * Idempotent: لا تعالج نفس provider_ref مرتين (تحديث مشروط بالحالة الحالية).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyMoyasarSecretToken } from '../_shared/webhookVerify.ts';
import { parseMoyasarWebhookStatus } from '../_shared/providers/moyasar.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('invalid_json', { status: 400 });
  }

  const configuredSecret = Deno.env.get('MOYASAR_WEBHOOK_SECRET')!;
  const verification = verifyMoyasarSecretToken(payload, configuredSecret);
  if (!verification.ok) {
    console.warn('[webhook-moyasar] signature rejected:', verification.reason);
    return new Response('invalid_signature', { status: 401 });
  }

  const status = parseMoyasarWebhookStatus(payload);
  const providerRef = String(payload?.data?.id || payload?.id || '');
  if (!providerRef) return new Response('missing_provider_ref', { status: 400 });
  if (status === 'unknown') return new Response('ok', { status: 200 }); // حدث لا يهمّنا (مثلاً invoice.created)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // شرط الحالة السابقة يمنع إعادة معالجة حدث مكرر (Moyasar تُعيد الإرسال عند عدم
  // استلام 200 سريع). يختلف بنوع الحدث: paid/failed يحدّثان طلباً pending فقط،
  // والاسترداد يحدّث طلباً paid فقط (استرداد طلب غير مدفوع لا معنى له) ويحافظ على
  // paid_at الأصلي للسجل المحاسبي. تحويل الحالة إلى 'refunded' يسحب الوصول تلقائياً
  // (PaymentService.hasActivePayment يشترط status='paid').
  const prevStatus = status === 'refunded' ? 'paid' : 'pending';
  const updateFields: Record<string, unknown> = { status, metadata: payload };
  if (status === 'paid') updateFields.paid_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from('orders')
    .update(updateFields)
    .eq('provider', 'moyasar')
    .eq('provider_ref', providerRef)
    .eq('status', prevStatus)
    .select('id');

  if (error) {
    console.error('[webhook-moyasar] update failed:', error);
    return new Response('db_error', { status: 500 });
  }
  if (!data || data.length === 0) {
    console.log('[webhook-moyasar] no matching pending order (already processed or unknown ref):', providerRef);
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
