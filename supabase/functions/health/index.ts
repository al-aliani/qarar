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
    return new Response(
      JSON.stringify({ status: 'error', db: 'unreachable', message: String(e instanceof Error ? e.message : e), timestamp: new Date().toISOString() }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
