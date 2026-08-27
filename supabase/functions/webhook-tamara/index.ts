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
import { sendAlert } from '../_shared/alerting.ts';
import { insertNotification } from '../_shared/notify.ts';

Deno.serve(async (req: Request) => {
  const sentryDsn = Deno.env.get('SENTRY_DSN');
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
    // رفض توكن حقيقي هنا قد يعني هجوم انتحال أو تغيّر التوكن لدى Tamara دون تحديث
    // TAMARA_NOTIFICATION_TOKEN — تنبيه فعلي (لا سجلّ فقط) عبر Sentry إن SENTRY_DSN مضبوط.
    const refForLog = String(payload?.order_id || payload?.data?.order_id || 'unknown');
    console.warn(`[webhook-tamara] token rejected (provider_ref=${refForLog}, reason=${verification.reason})`);
    await sendAlert(sentryDsn, {
      message: `[webhook-tamara] token rejected (provider_ref=${refForLog}, reason=${verification.reason})`,
      level: 'warning',
      tags: { source: 'webhook-tamara', kind: 'signature_rejected' },
    });
    return new Response('invalid_signature', { status: 401 });
  }

  const status = parseTamaraWebhookStatus(payload);
  const providerRef = String(payload?.order_id || payload?.data?.order_id || '');
  if (!providerRef) return new Response('missing_provider_ref', { status: 400 });
  if (status === 'unknown') return new Response('ok', { status: 200 }); // حدث لا يهمّنا

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // شرط الحالة السابقة يمنع إعادة معالجة حدث مكرر. paid/failed يحدّثان طلباً pending
  // فقط؛ والاسترداد يحدّث طلباً paid فقط ويحافظ على paid_at الأصلي. تحويل الحالة إلى
  // 'refunded' يسحب الوصول تلقائياً (hasActivePayment يشترط status='paid').
  const prevStatus = status === 'refunded' ? 'paid' : 'pending';
  const updateFields: Record<string, unknown> = { status, metadata: payload };
  if (status === 'paid') updateFields.paid_at = new Date().toISOString();

  const { data, error } = await adminClient
    .from('orders')
    .update(updateFields)
    .eq('provider', 'tamara')
    .eq('provider_ref', providerRef)
    .eq('status', prevStatus)
    .select('id, user_id, study_id');

  if (error) {
    // يعني عميلاً دفع فعلياً (Tamara أكّدت الحدث) لكن سجلّ الطلب لم يُحدَّث — طلب
    // مدفوع بلا وصول ممنوح. تنبيه فعلي (لا سجلّ فقط) عبر Sentry إن SENTRY_DSN مضبوط.
    console.error(`[webhook-tamara] order update failed (provider_ref=${providerRef}, status=${status}):`, error);
    await sendAlert(sentryDsn, {
      message: `[webhook-tamara] order update failed (provider_ref=${providerRef}, status=${status}): ${error.message || error}`,
      level: 'error',
      tags: { source: 'webhook-tamara', kind: 'order_update_failed' },
    });
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

    // إعلام العميل بنجاح الدفع — لا يُسقط استجابة الـwebhook إن فشل (انظر notify.ts).
    for (const row of data as Array<{ id: string; user_id: string; study_id: string | null }>) {
      await insertNotification(
        adminClient,
        {
          userId: row.user_id,
          type: 'payment',
          title: 'تم تأكيد دفعتك',
          body: 'وصلتنا دفعتك بنجاح، ويمكنك الآن تنزيل دراستك.',
          studyId: row.study_id,
        },
        'webhook-tamara'
      );
    }
  }

  return new Response('ok', { status: 200 });
});
