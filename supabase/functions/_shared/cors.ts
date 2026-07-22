/**
 * ترويسات CORS موحّدة لكل Edge Function يستدعيها المتصفح مباشرة (supabase.functions.invoke).
 * تدقيق حي 2026-07-22: لا ملف CORS ولا معالج OPTIONS كان موجوداً في أي دالة — supabase-js
 * يرسل ترويسة Authorization دائماً، فيُجبر المتصفح على preflight (OPTIONS) قبل أي POST فعلي؛
 * دالة لا تردّ على OPTIONS بترويسات CORS صريحة يُسقط المتصفح الطلب الفعلي قبل وصوله للخادم
 * إطلاقاً (405 من الدالة نفسها لا من البوابة) — يعطّل الدفع وOTP وكل نداء آخر من المتصفح
 * بصرف النظر عن صحة منطق الدالة.
 */
const ALLOWED_ORIGINS = new Set(
  [Deno.env.get('APP_ORIGIN'), 'https://sahib.sa', 'http://localhost:5173'].filter(Boolean),
);

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

/** ضعها أول سطر داخل Deno.serve: تردّ فوراً على preflight، وإلا تُرجع null لمتابعة المنطق. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  return null;
}
