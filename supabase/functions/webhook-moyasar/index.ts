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

  // شرط "status='pending'" في التحديث يمنع إعادة معالجة حدث مكرر (Moyasar تُعيد
  // الإرسال عند عدم استلام 200 سريع) من الكتابة فوق سجل مدفوع/فاشل مسبقاً.
  const { data, error } = await adminClient
    .from('orders')
    .update({
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      metadata: payload,
    })
    .eq('provider', 'moyasar')
    .eq('provider_ref', providerRef)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[webhook-moyasar] update failed:', error);
    return new Response('db_error', { status: 500 });
  }
  if (!data || data.length === 0) {
    console.log('[webhook-moyasar] no matching pending order (already processed or unknown ref):', providerRef);
  }

  return new Response('ok', { status: 200 });
});
