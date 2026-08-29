/**
 * Edge Function: process-account-deletions
 * تنفيذ فعلي لحذف الحساب بعد فترة سماح 7 أيام — تفويض مالك صريح 2026-08-29
 * (انظر output/2026-08-27/DECISIONS.md §4: كان القرار الجزئي وقتها إصلاح CASCADE
 * فقط؛ فترة السماح ونطاق الاحتفاظ 6 سنوات للفواتير كانا معلَّقين بانتظار تفويض
 * صريح — صار لهما اليوم).
 *
 * آلية الاستدعاء: GitHub Actions مجدولة يومياً (process-account-deletions.yml)
 * تستدعي هذه الدالة عبر HTTP بسرّ مخصص (ACCOUNT_DELETION_CRON_SECRET) — لا
 * pg_cron رغم أنه مُفعَّل فعلاً بهذا المشروع (check-stale-studies-daily،
 * 20260716000002_dashboard_experience.sql): pg_cron ينفّذ SQL خام فقط، وحذف
 * auth.users الفعلي يتطلب واجهة GoTrue الإدارية (supabase-js
 * auth.admin.deleteUser) غير المتاحة من SQL خالص بلا امتداد pg_net (غير
 * مستخدَم إطلاقاً بهذا المستودع حالياً) — إضافته فقط لهذا الغرض تُدخِل نمطاً
 * جديداً (استدعاء HTTP غير متزامن من داخل Postgres) بلا أي سابقة تثبته هنا،
 * بينما GitHub Actions المجدولة نمط مُختبَر وموثَّق فعلاً بهذا المستودع
 * (supabase-functions-deploy.yml وe2e.yml).
 *
 * تسلسل الحذف الفعلي: grep شامل على supabase/migrations يؤكد أن
 * studies.user_id وnotifications.user_id وsupport_tickets.user_id
 * وconsultation_requests.user_id وprofiles.id (وmfa_recovery_codes.user_id
 * وrate_limit_events.user_id وwhatsapp_otp_verification.user_id وadmins.id)
 * كلها `on delete cascade` نحو auth.users(id) مباشرة، وstudy_versions.study_id
 * وstudy_shares.study_id كلاهما `on delete cascade` نحو studies(id) — فحذف
 * auth.users عبر auth.admin.deleteUser() وحده يكفي لحذف كل هذه الجداول
 * تلقائياً وذرّياً (معاملة واحدة على مستوى Postgres، لا خطوات يدوية متعددة قد
 * تفشل جزئياً في منتصف الطريق). orders وaccount_deletion_requests نفسها
 * مُستثناتان صراحة عبر `on delete set null`
 * (20260827010000_orders_survive_user_deletion.sql) — هذه الدالة لا تحذف
 * منهما أي صف إطلاقاً، فقط تُحدِّث status هنا على account_deletion_requests.
 *
 * خطر متبقٍّ موثَّق (لم يُعالَج، نادر): support_ticket_messages.sender_id
 * يشير لـauth.users(id) بلا cascade/set null (افتراضي NO ACTION). لو المستخدم
 * المحذوف ردّ يوماً على تذكرة دعم لا يملكها (أي أدمن ردّ على تذكرة عميل آخر)،
 * auth.admin.deleteUser() سيفشل بخطأ قيد مرجعي. مسار الفشل أدناه (sendAlert +
 * إبقاء status='requested' للمحاولة لاحقاً) هو المعالجة الآمنة الصحيحة لهذه
 * الحالة تحديداً — البديل (حذف رسائل ذلك الأدمن من تذاكر عملاء آخرين تلقائياً)
 * يُفقِد محتوى محادثة طرف ثالث بلا داعٍ، فلم يُختَر هنا.
 *
 * فشل جزئي: لو نجح الحذف نفسه لكن فشل تحديث status لاحقاً، user_id في الصف
 * يكون قد صار null فعلاً (SET NULL من القيد أعلاه) — المعالجة أدناه تتعامل مع
 * هذه الحالة ذاتياً في التشغيلة التالية (user_id فارغ ⇒ لا شيء لحذفه، تُستكمَل
 * فقط بتحديث status إلى completed) بدل محاولة حذف مستخدم محذوف أصلاً فتفشل.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendAlert } from '../_shared/alerting.ts';
import { timingSafeEqual } from '../_shared/webhookVerify.ts';

const GRACE_PERIOD_DAYS = 7;

function isAuthorizedCronCaller(req: Request, configuredSecret: string): boolean {
  if (!configuredSecret) return false;
  const header = req.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  return timingSafeEqual(token, configuredSecret);
}

Deno.serve(async (req: Request) => {
  const sentryDsn = Deno.env.get('SENTRY_DSN');
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });

  const configuredSecret = Deno.env.get('ACCOUNT_DELETION_CRON_SECRET') || '';
  if (!isAuthorizedCronCaller(req, configuredSecret)) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const cutoffIso = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueRequests, error: fetchError } = await adminClient
    .from('account_deletion_requests')
    .select('id, user_id, created_at')
    .eq('status', 'requested')
    .lt('created_at', cutoffIso);

  if (fetchError) {
    console.error('[process-account-deletions] fetch failed:', fetchError);
    await sendAlert(sentryDsn, {
      message: `[process-account-deletions] fetch failed: ${fetchError.message || fetchError}`,
      level: 'error',
      tags: { source: 'process-account-deletions', kind: 'fetch_failed' },
    });
    return new Response('fetch_failed', { status: 500 });
  }

  let processed = 0;
  let failed = 0;

  for (const request of (dueRequests || []) as Array<{ id: string; user_id: string | null; created_at: string }>) {
    try {
      // user_id فارغ يعني auth.users محذوف فعلاً (SET NULL أطلقته مسبقاً عبر
      // مسار آخر) — لا شيء لحذفه، فقط إغلاق الطلب.
      if (request.user_id) {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(request.user_id);
        if (deleteError) throw deleteError;
      }

      const { error: updateError } = await adminClient
        .from('account_deletion_requests')
        .update({ status: 'completed' })
        .eq('id', request.id);
      if (updateError) throw updateError;

      processed++;
    } catch (e) {
      failed++;
      const message = (e as { message?: string })?.message || String(e);
      console.error(`[process-account-deletions] failed to process request ${request.id}:`, e);
      await sendAlert(sentryDsn, {
        message: `[process-account-deletions] failed to process request ${request.id} (user_id=${request.user_id}): ${message}`,
        level: 'error',
        tags: { source: 'process-account-deletions', kind: 'deletion_failed' },
      });
      // status يبقى عمداً 'requested' — لا تحديث هنا — لتُعاد المحاولة بالتشغيلة
      // التالية بدل أن يبدو الطلب منجزاً وهو ليس كذلك (نفس درس "يبدو منجزاً لكنه
      // صمت عن العمل" الموثَّق تكراراً بهذا المشروع).
    }
  }

  return new Response(
    JSON.stringify({ ok: true, total: (dueRequests || []).length, processed, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
