/**
 * حد معدّل عام مشترك لدوال Edge — تدقيق أمني 2026-08-21: create-checkout/
 * places-nearby/check-name-availability كانت بلا أي حد رغم استدعائها API خارجية
 * مدفوعة حقيقية (Moyasar/Stripe/Tamara، Google Places) أو كتابة صفوف orders بلا
 * سقف. نفس مبدأ whatsapp-otp-send (تهدئة + سقف نافذة زمنية) لكن معمَّم عبر
 * public.rate_limit_events بدل جدول مخصَّص لكل دالة.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

/**
 * @param adminClient عميل service_role — rate_limit_events بلا أي سياسة RLS لغيره.
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
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { data, error } = await adminClient
    .from('rate_limit_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    // فشل قراءة الحد صمتاً = سماح — عطل بالحد نفسه لا يجوز أن يمنع خدمة شرعية.
    console.error(`[rateLimit] query failed for ${endpoint}:`, error);
    return { ok: true };
  }

  const events = data || [];
  if (events.length >= maxRequests) {
    const oldest = new Date(events[0].created_at).getTime();
    const retryAfterMs = oldest + windowSeconds * 1000 - Date.now();
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  const { error: insertError } = await adminClient.from('rate_limit_events').insert({ user_id: userId, endpoint });
  if (insertError) console.error(`[rateLimit] insert failed for ${endpoint}:`, insertError);
  return { ok: true };
}
