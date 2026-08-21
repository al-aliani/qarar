/**
 * Edge Function: health
 * نقطة فحص صحّي عامة (بلا JWT) لمراقبة خارجية (UptimeRobot/Sentry Cron وغيرها) —
 * تتحقق أن الدالة نفسها تعمل وأن الاتصال بقاعدة البيانات سليم، بدون كشف أي بيانات.
 * انشرها بـ: supabase functions deploy health --no-verify-jwt
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    if (error) throw error;

    return new Response(
      JSON.stringify({ status: 'ok', db: 'reachable', latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    // تدقيق أمني 2026-08-21: نقطة عامة بلا JWT — رسالة Postgres الخام قد تكشف تفاصيل
    // بنيوية داخلية (اسم جدول/عمود، نص hint) لأي طالب مجهول وقت عطل حقيقي. رسالة عامة
    // بالاستجابة، والتفصيل الكامل بالسجلات الداخلية فقط.
    console.error('[health] db check failed:', e);
    return new Response(
      JSON.stringify({ status: 'error', db: 'unreachable', message: 'db_unreachable', timestamp: new Date().toISOString() }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
