/**
 * تحقق مشترك من هوية "مراجع نشط" — تُستخدمه الثلاث دوال reviewer-queue/
 * claim/submit كلها بنفس الطريقة، بدل تكرار نفس منطق auth.getUser + استعلام
 * reviewers في كل ملف (نفس أسلوب إعادة استخدام _shared/pricing.ts).
 *
 * لا تُثق بأي reviewerId يصل ضمن جسم الطلب — الهوية تُشتقّ حصراً من JWT
 * الجلسة نفسها، ثم تُطابَق ضد جدول reviewers (عضوية صريحة، active=true).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface ReviewerAuthResult {
  ok: boolean;
  reviewerId?: string;
  errorStatus?: number;
  errorBody?: { error: string };
}

export async function verifyReviewer(
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  jwt: string
): Promise<ReviewerAuthResult> {
  if (!jwt) return { ok: false, errorStatus: 401, errorBody: { error: 'missing_auth' } };

  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return { ok: false, errorStatus: 401, errorBody: { error: 'invalid_session' } };
  }
  const userId = userData.user.id;

  // service_role هنا لأن RLS على reviewers يسمح للمستخدم برؤية صفّه فقط أصلاً —
  // لكن نستخدم adminClient لتفادي أي اعتماد ضمني على تمرير JWT لهذا الاستعلام
  // الداخلي، ولضمان أن "active=false" يُرفض حتى لو تغيّرت سياسات RLS مستقبلاً.
  const { data: reviewerRow, error: reviewerError } = await adminClient
    .from('reviewers')
    .select('id, active')
    .eq('id', userId)
    .maybeSingle();

  if (reviewerError || !reviewerRow || !reviewerRow.active) {
    return { ok: false, errorStatus: 403, errorBody: { error: 'not_a_reviewer' } };
  }

  return { ok: true, reviewerId: userId };
}
