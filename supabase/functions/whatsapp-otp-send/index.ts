/**
 * Edge Function: whatsapp-otp-send
 * ترسل رمز تحقق واتساب حقيقي لجوال المستخدم الحالي (من profiles.phone —
 * أبداً من جسم الطلب، منعاً لإرسال رسائل مدفوعة لأرقام عشوائية بطلب مباشر
 * لواجهة الدالة). حدّ إرسال (تهدئة + سقف يومي) لأن كل رسالة واتساب لها
 * تكلفة فعلية عبر WhatsApp Business Platform.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateOtpCode, hashOtpCode } from '../_shared/otp.ts';
import { sendWhatsAppOtpTemplate } from '../_shared/providers/whatsapp.ts';

const RESEND_COOLDOWN_SECONDS = 60;
const DAILY_SEND_LIMIT = 5;
const CODE_EXPIRY_MINUTES = 5;

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

  // عميل بصلاحية service_role — الوحيد المسموح له بلمس phone_otp_challenges
  // إطلاقاً (بلا أي سياسة RLS لأي دور آخر، انظر migration الخاص بهذا الجدول).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || !profile?.phone) {
    return jsonResponse({ error: 'no_phone_on_file' }, 400);
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentChallenges, error: recentError } = await adminClient
    .from('phone_otp_challenges')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since24h)
    .order('created_at', { ascending: false });

  if (recentError) {
    console.error('[whatsapp-otp-send] recent challenges query failed:', recentError);
    return jsonResponse({ error: 'query_failed' }, 500);
  }

  const recent = recentChallenges || [];
  if (recent.length >= DAILY_SEND_LIMIT) {
    return jsonResponse({ error: 'daily_limit_reached' }, 429);
  }

  if (recent.length > 0) {
    const lastSentAt = new Date(recent[0].created_at).getTime();
    const cooldownEndsAt = lastSentAt + RESEND_COOLDOWN_SECONDS * 1000;
    if (Date.now() < cooldownEndsAt) {
      return jsonResponse(
        { error: 'cooldown_active', resendAvailableAt: new Date(cooldownEndsAt).toISOString() },
        429
      );
    }
  }

  const otpSecret = Deno.env.get('OTP_HASH_SECRET')!;
  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code, otpSecret);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await adminClient.from('phone_otp_challenges').insert({
    user_id: userId,
    phone: profile.phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error('[whatsapp-otp-send] insert challenge failed:', insertError);
    return jsonResponse({ error: 'challenge_creation_failed' }, 500);
  }

  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
    const templateName = Deno.env.get('WHATSAPP_TEMPLATE_NAME')!;
    const templateLang = Deno.env.get('WHATSAPP_TEMPLATE_LANG')!;

    await sendWhatsAppOtpTemplate(accessToken, phoneNumberId, {
      toE164Phone: profile.phone,
      code,
      templateName,
      templateLang,
    });
  } catch (e) {
    console.error('[whatsapp-otp-send] WhatsApp API call failed:', e);
    return jsonResponse({ error: 'send_failed' }, 502);
  }

  return jsonResponse({
    ok: true,
    expiresAt,
    resendAvailableAt: new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000).toISOString(),
  });
});
