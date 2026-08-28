/**
 * Edge Function: submit-application
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16 (طبقة Rate limiting). تحل محل
 * الإدراج المباشر من المتصفح إلى public_applications (كان بلا أي حدّ معدّل
 * خادمي — انظر migration 20260827030000). عامة بلا تسجيل دخول عمداً (نموذج
 * انضمام خبير/مورّد مفتوح للجميع)؛ التحقق الافتراضي من JWT على مستوى منصّة
 * Supabase يبقى مفعَّلاً (مفتاح anon نفسه JWT صالح موقَّع من المشروع)، فهذا
 * يحجب فقط طلبات بلا أي مفتاح Supabase صالح إطلاقاً — الحماية الحقيقية هنا
 * حدّ المعدّل بمعرّف IP + فحص honeypot الخادمي.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkAnonRateLimit, extractClientIp } from '../_shared/anonRateLimit.ts';

// 3 طلبات لكل IP خلال 24 ساعة: يكفي بسخاء لمتقدّم حقيقي (قد يحاول أكثر من
// مرة بسبب خطأ إدخال)، ويمنع إغراقاً آلياً للجدول.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 86400;
const VALID_APPLICATION_TYPES = new Set(['expert', 'supplier']);

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(req, { error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_body' }, 400);
  }

  // honeypot خادمي حقيقي — كان أمامياً فقط سابقاً (web/js/public-applications.js)
  // فطلب API مباشر يتجاوزه بالكامل. نجاح وهمي متعمَّد لا رسالة خطأ: لا نُخبر
  // برنامجاً آلياً أن الفخّ اكتُشف.
  if (body?.website) {
    return jsonResponse(req, { ok: true }, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const clientIp = extractClientIp(req);
  const rateLimit = await checkAnonRateLimit(adminClient, clientIp, 'submit-application', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.ok) {
    return jsonResponse(req, { error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429);
  }

  const applicationType = String(body?.application_type || '');
  if (!VALID_APPLICATION_TYPES.has(applicationType)) {
    return jsonResponse(req, { error: 'invalid_application_type' }, 400);
  }

  const { error } = await adminClient.from('public_applications').insert({
    application_type: applicationType,
    full_name: String(body?.full_name || '').trim(),
    phone: String(body?.phone || '').trim(),
    email: String(body?.email || '').trim() || null,
    sector: String(body?.sector || '').trim(),
    summary: String(body?.summary || '').trim(),
  });

  if (error) {
    // نفس درس تدقيق 2026-07-22 (كان الخطأ الفعلي يُبتلَع بصمت خلف رسالة عامة
    // واحدة) — رسالة الخطأ الحقيقية (قيد قاعدة بيانات مثلاً) تصل للمتصل الآن.
    console.error('[submit-application] insert failed:', error);
    return jsonResponse(req, { error: error.message || 'insert_failed' }, 400);
  }

  return jsonResponse(req, { ok: true }, 200);
});
