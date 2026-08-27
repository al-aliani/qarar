/**
 * إدراج إشعار داخلي في public.notifications (نفس الجدول/القناة الموجودة أصلاً —
 * انظر 20260716000002_dashboard_experience.sql وweb/js/ui/NotificationsView.js.
 * لا بريد/واتساب/Slack هنا؛ ذلك قرار قناة منفصل مؤجَّل عمداً من تحقق سابق.
 *
 * فشل إدراج الإشعار نفسه لا يجب أن يُسقط الحدث الذي استدعاه (دفع ناجح تحقّق من
 * توقيعه فعلاً، أو ادّعاء/إنهاء مراجعة نجح فعلاً على orders) — تلك هي المعالجة
 * الحرجة وقد اكتملت بالفعل؛ إشعار متأخر أو مفقود لا يبرر إفشال webhook كامل أو
 * استجابة claim/submit. لذلك هذه الدالة لا ترمي أبداً (نفس مبدأ sendAlert في
 * alerting.ts) — كل مسار فشل يُسجَّل عبر console.error فقط.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type NotificationType = 'payment' | 'review' | 'reminder' | 'system';

export interface NotifyParams {
  userId: string | null | undefined;
  type: NotificationType;
  title: string;
  body?: string | null;
  studyId?: string | null;
}

export async function insertNotification(
  adminClient: SupabaseClient,
  params: NotifyParams,
  source: string
): Promise<void> {
  if (!params.userId) {
    console.error(`[notify:${source}] تخطي إدراج إشعار (type=${params.type}) — userId مفقود`);
    return;
  }
  try {
    const { error } = await adminClient.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      study_id: params.studyId ?? null,
    });
    if (error) {
      console.error(`[notify:${source}] فشل إدراج الإشعار (type=${params.type}):`, error);
    }
  } catch (e) {
    console.error(`[notify:${source}] استثناء أثناء إدراج الإشعار (type=${params.type}):`, e);
  }
}
