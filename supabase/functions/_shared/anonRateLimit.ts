/**
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16 (طبقة Rate limiting): حد معدّل
 * لمسارات عامة بلا تسجيل دخول (مثل public_applications) — نظير rateLimit.ts
 * لكن بمعرّف IP لا user_id. لم يُوسَّع rateLimit.ts/rate_limit_events نفسه
 * عمداً: عمود user_id فيه `not null references auth.users(id)` صريح، وتوثيق
 * الدالة نفسها يمنع تمرير أي معرّف غير مستخرَج من JWT — تمديده لمعرّف IP
 * يخالف قيداً بنيوياً موثَّقاً، لا مجرد تفصيل تنفيذي. جدول جديد معزول تماماً
 * (anon_endpoint_hits) أنظف وأكثر أماناً من كسر قيد قائم.
 *
 * الخصوصية: عنوان IP الخام لا يُخزَّن أبداً — يُجزَّأ بـHMAC-SHA256 بمفتاح
 * SUPABASE_SERVICE_ROLE_KEY نفسه (سرّ موجود أصلاً بلا أي إعداد إضافي) قبل
 * التخزين، لا SHA-256 عادي بلا ملح: مجال IPv4 (~4.3 مليار قيمة) قابل للقوة
 * الغاشمة على GPU عادي خلال ثوانٍ بلا مفتاح سرّي — HMAC يمنع هذا فعلياً.
 */
import { hmacSha256Hex } from './webhookVerify.ts';

export interface AnonRateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

/**
 * آخر عنوان في x-forwarded-for لا أوله: كل وسيط (proxy/edge) يُلحق عنوان
 * الجهة التي اتصلت به هو مباشرة — العنصر الأول قد يكون مُدرَجاً من العميل
 * نفسه (غير موثوق)، بينما الأخير هو ما ألحقه آخر وسيط قبل وصول الطلب لهذه
 * الدالة مباشرة (لا يتحكم فيه المتصل). افتراض موثَّق لا مؤكَّد 100% لبنية
 * Supabase Edge الحيّة تحديداً — تحقّق عند أول اختبار حي بطلب مباشر.
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'unknown';
}

/**
 * @param adminClient عميل service_role — anon_endpoint_hits بلا أي سياسة RLS لغيره.
 * @param clientIp عنوان IP الخام (يُجزَّأ داخلياً قبل أي استعلام/تخزين).
 * @param endpoint معرّف الدالة — يفصل عدّادات كل دالة عن الأخرى.
 */
export async function checkAnonRateLimit(
  adminClient: any,
  clientIp: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number
): Promise<AnonRateLimitResult> {
  const pepper = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-pepper-should-not-happen-in-production';
  const identifierHash = await hmacSha256Hex(pepper, `${endpoint}:${clientIp}`);
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { data, error } = await adminClient
    .from('anon_endpoint_hits')
    .select('created_at')
    .eq('endpoint', endpoint)
    .eq('identifier_hash', identifierHash)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    // فشل قراءة الحد صمتاً = سماح — عطل بالحد نفسه لا يجوز أن يمنع خدمة شرعية
    // (نفس فلسفة rateLimit.ts المعتمدة أصلاً في المشروع).
    console.error(`[anonRateLimit] query failed for ${endpoint}:`, error);
    return { ok: true };
  }

  const events = data || [];
  if (events.length >= maxRequests) {
    const oldest = new Date(events[0].created_at).getTime();
    const retryAfterMs = oldest + windowSeconds * 1000 - Date.now();
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  const { error: insertError } = await adminClient.from('anon_endpoint_hits').insert({ endpoint, identifier_hash: identifierHash });
  if (insertError) console.error(`[anonRateLimit] insert failed for ${endpoint}:`, insertError);
  return { ok: true };
}
