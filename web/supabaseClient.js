/**
 * Supabase client (browser, ESM).
 *
 * This project is a static site (no bundler). So we:
 * - Load supabase-js via CDN ESM import.
 * - Read config from:
 *   - window.SUPABASE_URL / window.SUPABASE_ANON_KEY
 *   - OR localStorage keys: SUPABASE_URL / SUPABASE_ANON_KEY
 *   - OR defaults below (مشروع feasibility-platform)
 *
 * Notes:
 * - RLS policies require authenticated user for studies/study_inputs.
 * - If not configured or not authenticated, app will fall back to local draft cache.
 */

/** قيم افتراضية لمشروع Supabase (feasibility-platform) — يمكن تجاوزها عبر window أو localStorage */
const DEFAULT_SUPABASE_URL = "https://ljvskvzvgrpawyexetzv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdnNrdnp2Z3JwYXd5ZXhldHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NDE1NDMsImV4cCI6MjA4NTQxNzU0M30.UzitNpUhroHsoMXAqZmaal34N9eHrly4A_IzAmi1lbM";

let _client = null;
let _lastError = "";
/** Promise of the first client creation — avoids multiple GoTrueClient when getSupabaseClient() is called concurrently */
let _clientPromise = null;

function readConfig() {
  const fromWindowUrl = typeof window !== "undefined" && (window.SUPABASE_URL || window.__SUPABASE_URL__);
  const fromStorageUrl = typeof localStorage !== "undefined" ? (localStorage.getItem("SUPABASE_URL") || "").trim() : "";
  const url = (fromWindowUrl && String(fromWindowUrl).trim()) || (fromStorageUrl || DEFAULT_SUPABASE_URL);
  const fromWindowKey = typeof window !== "undefined" && (window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__);
  const fromStorageKey = typeof localStorage !== "undefined" ? (localStorage.getItem("SUPABASE_ANON_KEY") || "").trim() : "";
  const anonKey = (fromWindowKey && String(fromWindowKey).trim()) || (fromStorageKey || DEFAULT_SUPABASE_ANON_KEY);
  return {
    url: (String(url || "").trim() || DEFAULT_SUPABASE_URL),
    anonKey: (String(anonKey || "").trim() || DEFAULT_SUPABASE_ANON_KEY)
  };
}

export async function getSupabaseClient() {
  if (_client) return { supabase: _client, ok: true, error: "" };

  if (_clientPromise) return _clientPromise;

  const { url, anonKey } = readConfig();
  if (!url || !anonKey) {
    _lastError =
      "Supabase غير مهيأ. ضع SUPABASE_URL و SUPABASE_ANON_KEY (window.* أو localStorage) لتفعيل الحفظ على قاعدة البيانات.";
    return { supabase: null, ok: false, error: _lastError };
  }

  _clientPromise = (async () => {
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const supabase = mod.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      _client = supabase;
      _lastError = "";
      return { supabase, ok: true, error: "" };
    } catch (e) {
      _clientPromise = null;
      _lastError = `تعذر تحميل supabase-js من CDN: ${String(e?.message || e)}`;
      return { supabase: null, ok: false, error: _lastError };
    }
  })();

  return _clientPromise;
}

export async function getAuthUser() {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok || !supabase) return { user: null, ok: false, error };
  try {
    const { data, error: e } = await supabase.auth.getUser();
    if (e) return { user: null, ok: false, error: e.message };
    return { user: data?.user || null, ok: Boolean(data?.user), error: data?.user ? "" : "Not authenticated" };
  } catch (e) {
    return { user: null, ok: false, error: String(e?.message || e) };
  }
}

export async function signIn(email, password) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function signUp(email, password) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.signUp({ email, password });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

/**
 * تسجيل الخروج: مسح الجلسة محلياً والسيرفر، ثم إعادة التحميل.
 * نمسح كاش العميل وكل مفاتيح جلسة Supabase من localStorage حتى لا يُعاد تسجيل الدخول بعد reload.
 */
export async function signOut() {
  const { supabase } = await getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  _client = null;
  _clientPromise = null;
  if (typeof localStorage !== "undefined") {
    Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
  }
  location.reload();
}

/**
 * OAuth sign in (Google, Apple, Microsoft, etc.)
 * المرحلة 4+ — المصادقة المتقدمة
 */
export async function signInWithOAuth(provider) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  
  const { data, error: e } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin
    }
  });
  
  if (e) {
    const msg = (e.message || String(e)).toLowerCase();
    const friendly =
      msg.includes("provider is not enabled") || msg.includes("unsupported provider")
        ? "مزود الدخول (مثل Google) غير مفعّل في مشروع Supabase. فعّله من: لوحة Supabase → Authentication → Providers → Google، ثم أضف Client ID و Client Secret من Google Cloud."
        : e.message;
    return { ok: false, error: friendly };
  }
  return { ok: true, data };
}

/**
 * Reset password for email
 */
export async function resetPassword(email) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password'
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true };
}

/**
 * Update user password (after reset)
 */
export async function updatePassword(newPassword) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { error: e } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true };
}

/**
 * تحديث اسم العرض (يُخزّن في user_metadata.full_name)
 */
export async function updateUserDisplayName(displayName) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { data, error: e } = await supabase.auth.updateUser({
    data: { full_name: (displayName || '').trim() || null }
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true, user: data?.user };
}

/**
 * إرسال رمز OTP إلى رقم الجوال (دخول بالجوال)
 * الرقم بصيغة E.164 مثل +966501234567
 */
export async function signInWithOtpPhone(phone) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  let raw = (phone || '').trim().replace(/\s/g, '');
  if (raw.startsWith('05')) raw = '+966' + raw.slice(1); // 05xxxxxxxx → +9665xxxxxxxx
  else if (raw.startsWith('5') && raw.length <= 10) raw = '+966' + raw;
  else if (!raw.startsWith('+')) raw = '+' + raw;
  const e164 = raw;

  const { data, error: e } = await supabase.auth.signInWithOtp({
    phone: e164
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

/**
 * التحقق من رمز OTP المرسل للجوال
 */
export async function verifyOtpPhone(phone, token) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  let raw = (phone || '').trim().replace(/\s/g, '');
  if (raw.startsWith('05')) raw = '+966' + raw.slice(1);
  else if (raw.startsWith('5') && raw.length <= 10) raw = '+966' + raw;
  else if (!raw.startsWith('+')) raw = '+' + raw;
  const e164 = raw;

  const { data, error: e } = await supabase.auth.verifyOtp({
    phone: e164,
    token: (token || '').trim(),
    type: 'sms'
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

/**
 * Resend confirmation email
 * المرحلة 4+ (معيار مهم)
 */
export async function resendConfirmationEmail(email) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { error: e } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (e) return { ok: false, error: e.message };
  return { ok: true };
}

/**
 * Get user profile from profiles table
 */
export async function getUserProfile() {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, error: 'Not authenticated' };

  const { data, error: e } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (e) return { ok: false, error: e.message };
  return { ok: true, profile: data };
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, error: 'Not authenticated' };

  const { data, error: e } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userData.user.id)
    .select()
    .single();

  if (e) return { ok: false, error: e.message };
  return { ok: true, profile: data };
}

/**
 * MFA (2FA) — المصادقة الثنائية TOTP
 * تفعيل، تحقق، إلغاء
 */
export async function mfaEnrollTOTP(friendlyName = 'تطبيق المصادقة') {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: friendlyName
  });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function mfaChallenge(factorId) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.challenge({ factorId });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function mfaVerify(factorId, challengeId, code) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: String(code).trim()
  });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

/** تحدي + تحقق في خطوة واحدة (TOTP) */
export async function mfaChallengeAndVerify(factorId, code) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: String(code).trim()
  });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function mfaListFactors() {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.listFactors();
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function mfaGetAAL() {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

export async function mfaUnenroll(factorId) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };
  const { data, error: e } = await supabase.auth.mfa.unenroll({ factorId });
  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

/**
 * Subscribe to auth state changes
 */
export async function onAuthStateChange(callback) {
  const { supabase, ok } = await getSupabaseClient();
  if (!ok || !supabase) return () => {};

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription?.unsubscribe();
}

/**
 * Expected Table Schema (Supabase):
 * Table Name: studies
 * Columns:
 * - id: uuid (Primary Key, default: gen_random_uuid())
 * - user_id: uuid (Foreign Key to auth.users.id)
 * - title: text
 * - data: jsonb   ← مطلوب؛ إن ظهر خطأ "Could not find the 'data' column" نفّذ docs/supabase_add_data_column.sql
 * - updated_at: timestamptz
 *
 * RLS Policies:
 * - INSERT: auth.uid() = user_id
 * - SELECT: auth.uid() = user_id
 * - UPDATE: auth.uid() = user_id
 */
export async function saveStudy(studyId, studyData) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return { ok: false, error: 'User not authenticated' };

  // Prepare payload
  const payload = {
    updated_at: new Date(),
    title: studyData.projectInfo?.name || 'مشروع جديد',
    data: studyData,
    user_id: user.id
  };

  // If we have a stable ID for the study in the database, we use it.
  // However, the current app generates a random ID for the study object itself.
  // Ideally we map local study.id to DB id. For now, let's use the local ID as the DB ID if it's a valid UUID, 
  // or rely on a separate column. Simpler: We upsert based on a specific logic.
  // Let's assume one main study per user for this MVP or use the local ID.

  // We will use upsert. 
  // If studyId exists, it updates. If not, it inserts.
  // Note: studyId coming from the store is likely a UUID generated by createEmptyStudy()

  const { data, error: e } = await supabase
    .from('studies')
    .upsert({ id: studyId, ...payload })
    .select();

  if (e) {
    const msg = e.message || '';
    const hint = msg.includes("'data'") && msg.includes('schema cache')
      ? ' — نفّذ في Supabase → SQL Editor ملف docs/supabase_add_data_column.sql (أو أضف عمود data jsonb لجدول studies).'
      : '';
    return { ok: false, error: msg + hint };
  }
  return { ok: true, data };
}

export async function loadStudies() {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { data, error: e } = await supabase
    .from('studies')
    .select('*')
    .order('updated_at', { ascending: false });

  if (e) return { ok: false, error: e.message };
  return { ok: true, data };
}

