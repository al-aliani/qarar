/**
 * حد معدّل عام مشترك لدوال Edge — تدقيق أمني 2026-08-21: create-checkout/
 * places-nearby/check-name-availability كانت بلا أي حد رغم استدعائها API خارجية
 * مدفوعة حقيقية (Moyasar/Stripe/Tamara، Google Places) أو كتابة صفوف orders بلا
 * سقف. نفس مبدأ whatsapp-otp-send (تهدئة + سقف نافذة زمنية) لكن معمَّم عبر
 * public.rate_limit_events بدل جدول مخصَّص لكل دالة.
 *
 * تدقيق 2026-08-29 (سباق تزامن): التنفيذ السابق كان SELECT count(*) ثم — فقط
 * إن كان دون الحد — INSERT منفصل، عبر استدعاءين شبكيين مستقلَّين. طلبان
 * متزامنان فعلياً من نفس المستخدم استطاعا كلاهما تنفيذ SELECT قبل أن يلتزم
 * (commit) أيّ منهما INSERT — فيريان معاً "دون الحد" ويتجاوز العدد الفعلي
 * الحدَّ المفروض. الإصلاح: استدعاء RPC ذرّي واحد (check_and_record_rate_limit،
 * migration 20260829030000) ينفّذ التحقق والتسجيل معاً محميَّين بقفل استشاري
 * (pg_advisory_xact_lock) بمفتاح (المستخدم، الدالة) — يُسلسِل الاستدعاءات
 * المتزامنة لنفس المفتاح فعلياً بدل تركها تتسابق. انظر تعليق الـmigration
 * لشرح لماذا تجميع الخطوتين في دالة واحدة بلا قفل ما كان يكفي وحده.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

/**
 * @param adminClient عميل service_role — check_and_record_rate_limit بلا grant
 *   execute لغير service_role (انظر migration)، فلا يمكن استدعاؤها من عميل آخر.
 * @param userId هوية المستخدم من JWT الجلسة (لا من جسم الطلب أبداً).
 * @param endpoint معرّف الدالة (مثال: 'create-checkout') — يفصل عدّادات كل دالة عن الأخرى.
 * @param maxRequests أقصى عدد طلبات مسموح خلال windowSeconds.
 * @param windowSeconds طول النافذة الزمنية المتحركة بالثواني.
 */
export async function checkRateLimit(
  adminClient: SupabaseClient,
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { data, error } = await adminClient
    .rpc('check_and_record_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })
    .single();

  if (error || !data) {
    // فشل الاستدعاء صمتاً = سماح — عطل بالحد نفسه لا يجوز أن يمنع خدمة شرعية
    // (نفس القرار الموثَّق أصلاً قبل هذا التغيير، بلا تعديل سلوكه).
    console.error(`[rateLimit] rpc failed for ${endpoint}:`, error);
    return { ok: true };
  }

  return data.allowed
    ? { ok: true }
    : { ok: false, retryAfterSeconds: data.retry_after_seconds };
}
