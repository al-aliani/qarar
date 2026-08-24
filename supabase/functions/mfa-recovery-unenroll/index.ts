/**
 * Edge Function: mfa-recovery-unenroll
 * تُستدعى من زر "فقدت جهاز المصادقة؟" الجديد داخل #authModalMfaPanel
 * (AuthModalStub.js) أثناء تحدي AAL2 عند الدخول. الجلسة عند هذه النقطة
 * موجودة فعلاً عند aal1 (signIn() نجح بكلمة المرور قبل الوصول لهذه اللوحة
 * أصلاً) — auth.getUser(jwt) أدناه وحده كافٍ لإثبات الهوية، لا حاجة لإعادة
 * طلب البريد/كلمة المرور.
 *
 * لا مسار عادي (auth.mfa.unenroll) هنا لأن ذاك يتطلب هو نفسه AAL2 من نفس
 * الجلسة — بالضبط ما لا يملكه من فقد جهازه فعلاً. الحذف هنا عبر
 * admin.mfa.deleteFactor (service_role) الذي لا يشترط AAL2 من جلسة المستخدم.
 *
 * ترتيب الخطوات أدناه مقصود ويهمّ: يُحذَف عامل TOTP أولاً (نداء شبكي خارجي
 * لواجهة GoTrue Admin API قد يفشل لأسباب عابرة)، ولا تُتلَف دفعة رموز
 * الاسترداد إلا بعد نجاح ذلك الحذف فعلياً. لو عُكس الترتيب (حذف الرموز أولاً
 * كما في نص التصميم الأصلي) وفشل حذف العامل بعدها، يُحرَم المستخدم من كل
 * مسار استرداد ممكن نهائياً: لا رمز استرداد صالح متبقٍّ، ولا عامل يمكنه هو
 * نفسه إلغاؤه (يتطلب AAL2 لا يملكه). هذا انحراف متعمَّد عن ترتيب الخطوة 6/7
 * في التصميم المعتمد لتفادي هذا الطريق المسدود بالكامل.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hashRecoveryCode } from '../_shared/mfaRecovery.ts';
import { timingSafeEqual } from '../_shared/webhookVerify.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

// يمنع تخمين رموز الاسترداد بالقوة الغاشمة عبر حلقة استدعاءات سريعة.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) return jsonResponse(req, { error: 'invalid_session' }, 401);
  const userId = userData.user.id;

  let body: { recoveryCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_json_body' }, 400);
  }
  const submittedCode = String(body.recoveryCode || '').trim();
  if (!submittedCode) return jsonResponse(req, { error: 'missing_recovery_code' }, 400);

  // عميل بصلاحية service_role — الوحيد المسموح له بلمس mfa_recovery_codes
  // إطلاقاً وباستدعاء admin.mfa.listFactors/deleteFactor.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const rateLimit = await checkRateLimit(adminClient, userId, 'mfa-recovery-unenroll', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
  if (!rateLimit.ok) {
    return jsonResponse(req, { error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429);
  }

  const { data: codeRows, error: codesError } = await adminClient
    .from('mfa_recovery_codes')
    .select('id, code_hash')
    .eq('user_id', userId)
    .is('used_at', null);

  if (codesError) {
    console.error('[mfa-recovery-unenroll] codes query failed:', codesError);
    return jsonResponse(req, { error: 'query_failed' }, 500);
  }

  const recoverySecret = Deno.env.get('RECOVERY_CODE_HASH_SECRET')!;
  const submittedHash = await hashRecoveryCode(submittedCode, recoverySecret);
  const matched = (codeRows || []).some((row) => timingSafeEqual(submittedHash, row.code_hash));

  // رسالة عامة عمداً — لا تكشف "لا رموز مولَّدة أصلاً" عن "رمز خاطئ"، فهذا
  // يمنع تسريب معلومة (هل هذا الحساب مفعَّل عليه 2FA أصلاً) لمهاجم يجرّب
  // حسابات عشوائية.
  if (!matched) return jsonResponse(req, { error: 'invalid_recovery_code' }, 400);

  const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({ userId });
  if (factorsError) {
    console.error('[mfa-recovery-unenroll] listFactors failed:', factorsError);
    return jsonResponse(req, { error: 'factor_removal_failed' }, 500);
  }
  const verifiedFactors = (factorsData?.factors || []).filter(
    (f: { status?: string }) => f.status === 'verified'
  );

  for (const factor of verifiedFactors) {
    const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (deleteError) {
      // نتوقف فوراً بلا لمس جدول رموز الاسترداد — راجع تعليق ترتيب الخطوات أعلى الملف.
      console.error('[mfa-recovery-unenroll] deleteFactor failed:', deleteError);
      return jsonResponse(req, { error: 'factor_removal_failed' }, 500);
    }
  }

  // كل عوامل TOTP الموثّقة (verified) أُزيلت بنجاح (أو لم تكن موجودة أصلاً) —
  // الآن فقط تُبطَل دفعة رموز الاسترداد كاملة (لا الرمز المُستهلَك وحده): العامل
  // المرتبط بها منطقياً صار ملغى في نفس العملية، وأي تفعيل TOTP جديد سيُنتج
  // دفعة رموز جديدة عبر mfa-recovery-generate أصلاً.
  const { error: purgeError } = await adminClient.from('mfa_recovery_codes').delete().eq('user_id', userId);
  if (purgeError) {
    console.error('[mfa-recovery-unenroll] purge recovery codes failed:', purgeError);
    // العامل أُزيل فعلاً بهذه اللحظة — لا خطر أمني إضافي حقيقي (لا مزيد من TOTP
    // نشط، والرموز المتبقية بلا فائدة أمنية لعامل لم يعد موجوداً)، لكن نُبلغ
    // العميل بالفشل ليعرض رسالة عامة بدل الإيحاء بنجاح كامل غير مؤكَّد.
    return jsonResponse(req, { error: 'cleanup_failed' }, 500);
  }

  return jsonResponse(req, { ok: true });
});
