/**
 * Edge Function: mfa-recovery-generate
 * تُستدعى من TwoFactorModal.js فور نجاح أول mfaChallengeAndVerify (تفعيل عامل
 * TOTP جديد)، وأيضاً من زر "إعادة توليد الرموز" في وضع الإدارة — كلا مساري
 * الاستدعاء يفترضان جلسة aal2 فعلية أصلاً (التفعيل الأول يرفع الجلسة aal2
 * فوراً بعد نجاح التحقق، ووضع الإدارة نفسه لا يُعرَض إلا بعد اجتياز أول
 * تحدٍّ ناجح في نفس الجلسة).
 *
 * أمني: فحص AAL2 هنا إلزامي رغم أن الواجهة "من المفترض" ألا تستدعيه إلا من
 * جلسة aal2 — بدونه تقدر جلسة aal1 مسروقة بكلمة مرور فقط (بلا تحقق TOTP
 * فعلي) أن تولّد دفعة رموز استرداد لعامل TOTP لا تملكه فعلياً، ثم تستخدمها
 * لاحقاً عبر mfa-recovery-unenroll لإسقاط 2FA الحقيقي لصاحب الحساب.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateRecoveryCodeBatch, hashRecoveryCode } from '../_shared/mfaRecovery.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

// 3 مرات/يوم يكفي بسخاء لأي إعادة توليد مشروعة (تفعيل أول + إعادة توليد يدوية
// نادرة)، ويمنع استنزاف الجدول بحلقة استدعاءات.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 86400;

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

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return jsonResponse(req, { error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // عميل بصلاحية المستخدم نفسه (anon key + JWT) — للتحقق من هويته ومستوى AAL
  // لجلسته فقط، لا للكتابة.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonResponse(req, { error: 'invalid_session' }, 401);
  const userId = userData.user.id;

  const { data: aalData, error: aalError } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(jwt);
  if (aalError || !aalData || aalData.currentLevel !== 'aal2') {
    return jsonResponse(req, { error: 'aal2_required' }, 403);
  }

  // عميل بصلاحية service_role — الوحيد المسموح له بلمس mfa_recovery_codes
  // إطلاقاً (بلا أي سياسة RLS لأي دور آخر، انظر migration الخاص بهذا الجدول)
  // وباستدعاء admin.mfa.listFactors.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const rateLimit = await checkRateLimit(adminClient, userId, 'mfa-recovery-generate', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.ok) {
    return jsonResponse(req, { error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429);
  }

  const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({ userId });
  if (factorsError) {
    console.error('[mfa-recovery-generate] listFactors failed:', factorsError);
    return jsonResponse(req, { error: 'query_failed' }, 500);
  }
  const hasVerifiedTotp = (factorsData?.factors || []).some(
    (f: { factor_type?: string; status?: string }) => f.factor_type === 'totp' && f.status === 'verified'
  );
  if (!hasVerifiedTotp) return jsonResponse(req, { error: 'no_verified_totp_factor' }, 400);

  const recoverySecret = Deno.env.get('RECOVERY_CODE_HASH_SECRET')!;
  const codes = generateRecoveryCodeBatch();
  const rows = await Promise.all(
    codes.map(async (code) => ({ user_id: userId, code_hash: await hashRecoveryCode(code, recoverySecret) }))
  );

  // دفعة جديدة تُبطل القديمة بالكامل — لا تراكم صفوف يتيمة عبر إعادات توليد متكررة.
  const { error: deleteError } = await adminClient.from('mfa_recovery_codes').delete().eq('user_id', userId);
  if (deleteError) {
    console.error('[mfa-recovery-generate] delete old codes failed:', deleteError);
    return jsonResponse(req, { error: 'generation_failed' }, 500);
  }

  const { error: insertError } = await adminClient.from('mfa_recovery_codes').insert(rows);
  if (insertError) {
    console.error('[mfa-recovery-generate] insert codes failed:', insertError);
    return jsonResponse(req, { error: 'generation_failed' }, 500);
  }

  // الرموز الصريحة تُعاد مرة واحدة فقط هنا — لا تُسجَّل أبداً بـconsole.error/log
  // ولا تُخزَّن نصاً صريحاً في أي جدول (code_hash فقط أعلاه).
  return jsonResponse(req, { ok: true, codes });
});
