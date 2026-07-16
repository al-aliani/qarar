/**
 * Edge Function: whatsapp-otp-verify
 * تتحقق من رمز واتساب مُرسَل عبر whatsapp-otp-send. عند النجاح تضبط
 * profiles.phone_verified=true — يسمح لها تريغر protect_phone_verified
 * (انظر migration الخاص به) لأنها service_role. الجسم {code} فقط، لا تثق
 * بأي phone مُرسَل من العميل.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hashOtpCode } from '../_shared/otp.ts';
import { timingSafeEqual } from '../_shared/webhookVerify.ts';

const MAX_ATTEMPTS = 5;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return jsonResponse({ error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonResponse({ error: 'invalid_session' }, 401);
  const userId = userData.user.id;

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, 400);
  }
  const submittedCode = String(body.code || '').trim();
  if (!submittedCode) return jsonResponse({ error: 'missing_code' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // آخر تحدٍّ غير منتهٍ الصلاحية وغير مُستهلَك مسبقاً لهذا المستخدم.
  const { data: challenge, error: challengeError } = await adminClient
    .from('phone_otp_challenges')
    .select('id, code_hash, attempts, expires_at, verified_at')
    .eq('user_id', userId)
    .is('verified_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (challengeError) {
    console.error('[whatsapp-otp-verify] challenge query failed:', challengeError);
    return jsonResponse({ error: 'query_failed' }, 500);
  }
  if (!challenge) return jsonResponse({ error: 'no_active_challenge' }, 400);

  if (challenge.attempts >= MAX_ATTEMPTS) {
    return jsonResponse({ error: 'too_many_attempts' }, 429);
  }

  const otpSecret = Deno.env.get('OTP_HASH_SECRET')!;
  const submittedHash = await hashOtpCode(submittedCode, otpSecret);
  const isMatch = timingSafeEqual(submittedHash, challenge.code_hash);

  if (!isMatch) {
    await adminClient
      .from('phone_otp_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challenge.id);
    return jsonResponse({ error: 'code_mismatch' }, 400);
  }

  const { error: verifyError } = await adminClient
    .from('phone_otp_challenges')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', challenge.id);

  if (verifyError) {
    console.error('[whatsapp-otp-verify] marking challenge verified failed:', verifyError);
    return jsonResponse({ error: 'verify_update_failed' }, 500);
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ phone_verified: true })
    .eq('id', userId);

  if (profileError) {
    console.error('[whatsapp-otp-verify] profiles update failed:', profileError);
    return jsonResponse({ error: 'profile_update_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});
