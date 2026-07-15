/**
 * Supabase client (browser, ESM — مُجمَّع عبر Vite).
 *
 * - supabase-js تبعية محلية مُجمَّعة (لا CDN) — يعمل دون اتصال ولا يُكسره حجب CDN.
 * - يُقرأ الإعداد بالأولوية التالية:
 *   1. متغيّرات بناء Vite: import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   2. window.SUPABASE_URL / window.SUPABASE_ANON_KEY (حقن وقت التشغيل)
 *   3. localStorage: SUPABASE_URL / SUPABASE_ANON_KEY (تجاوز يدوي)
 *   4. القيم الافتراضية أدناه (مشروع feasibility-platform)
 *
 * Notes:
 * - RLS policies require authenticated user for studies (see docs/supabase_setup.sql).
 * - If not configured or not authenticated, app will fall back to local draft cache.
 */
import { createClient } from "@supabase/supabase-js";

/** قراءة متغيّر بيئة Vite بأمان (import.meta.env قد لا يوجد في بيئة اختبار Node) */
function envVar(name) {
  try {
    return (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name]) || "";
  } catch (_) {
    return "";
  }
}

/** قيم افتراضية لمشروع Supabase (قرار) — المفتاح anon عمومي وآمن في بناء الواجهة (محمي بـ RLS).
 *  تُتجاوز عبر env (VITE_SUPABASE_*) أو window أو localStorage. */
const DEFAULT_SUPABASE_URL = "https://ykvcshxcjjicujayfwxg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrdmNzaHhjamppY3VqYXlmd3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjM1MjksImV4cCI6MjA5ODczOTUyOX0.VJ0_MQeYX9Audzjg1F9pqW3b1NdL5HnsFBxH3snG3lw";

/** شريط تحذير ثابت (مرة واحدة فقط) في وضع التطوير حين لا يوجد إعداد Supabase محلي. */
function showDevProdWarningBanner() {
  if (typeof document === "undefined" || document.getElementById("devProdDbWarningBanner")) return;
  const show = () => {
    if (document.getElementById("devProdDbWarningBanner")) return;
    const bar = document.createElement("div");
    bar.id = "devProdDbWarningBanner";
    bar.setAttribute("role", "alert");
    // z-index أقل من طبقة التنبيهات (toast: 10000) كي لا يحجبها؛ حجم خط متجاوب
    // للجوال (clamp) كي لا يفيض النص على شاشة ضيقة. pointer-events:none على الشريط
    // نفسه (مع إعادة تفعيله على الزر فقط) — كان يغطي أزرار الترويسة (تصدير/حفظ..)
    // ويعترض نقراتها فعلياً (اكتُشف عبر فشل اختبارات Playwright الحالية)، فيمنع
    // المستخدم من التفاعل مع أي عنصر يقع تحته أعلى الصفحة.
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9998;background:#7a1f1f;color:#fff;" +
      "font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;font-size:clamp(11px,2.6vw,13px);" +
      "padding:8px 12px;text-align:center;direction:rtl;box-shadow:0 2px 8px rgba(0,0,0,.2);" +
      "line-height:1.6;pointer-events:none;";
    bar.innerHTML =
      "⚠️ وضع تطوير بلا إعداد Supabase محلي — تم تعطيل الاتصال بقاعدة الإنتاج الافتراضية لحماية البيانات. " +
      "اضبط VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY محلياً لتفعيل الحفظ السحابي في التطوير. " +
      "<button id='devProdDbWarningDismiss' style='pointer-events:auto;margin-inline-start:10px;background:#fff;color:#7a1f1f;" +
      "border:none;border-radius:6px;padding:2px 10px;cursor:pointer;'>إخفاء</button>";
    document.body.appendChild(bar);
    document.getElementById("devProdDbWarningDismiss")?.addEventListener("click", () => bar.remove());
  };
  if (document.body) show();
  else document.addEventListener("DOMContentLoaded", show, { once: true });
}

let _client = null;
let _lastError = "";
/** Promise of the first client creation — avoids multiple GoTrueClient when getSupabaseClient() is called concurrently */
let _clientPromise = null;

function isDevRuntime() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) return true;
  } catch (_) { }
  try {
    const host = typeof location !== "undefined" ? location.hostname : "";
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch (_) {
    return false;
  }
}

function allowDefaultSupabaseInDev() {
  return String(envVar("VITE_ALLOW_DEFAULT_SUPABASE_IN_DEV") || "").toLowerCase() === "true";
}

function readConfig() {
  const fromEnvUrl = String(envVar("VITE_SUPABASE_URL") || "").trim();
  const fromWindowUrl = typeof window !== "undefined" && (window.SUPABASE_URL || window.__SUPABASE_URL__);
  const fromStorageUrl = typeof localStorage !== "undefined" ? (localStorage.getItem("SUPABASE_URL") || "").trim() : "";
  const url = fromEnvUrl || (fromWindowUrl && String(fromWindowUrl).trim()) || (fromStorageUrl || DEFAULT_SUPABASE_URL);

  const fromEnvKey = String(envVar("VITE_SUPABASE_ANON_KEY") || "").trim();
  const fromWindowKey = typeof window !== "undefined" && (window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__);
  const fromStorageKey = typeof localStorage !== "undefined" ? (localStorage.getItem("SUPABASE_ANON_KEY") || "").trim() : "";
  const anonKey = fromEnvKey || (fromWindowKey && String(fromWindowKey).trim()) || (fromStorageKey || DEFAULT_SUPABASE_ANON_KEY);

  // تدقيق أمني (دفعة 6): القيم الافتراضية أعلاه تشير فعلياً لمشروع الإنتاج الحقيقي
  // ولا يوجد أي تحذير وقت التشغيل حين تُستخدم (أي حين لا يوجد أي تجاوز بيئي/نافذة/تخزين).
  // تشغيل محلي دون .env كان يكتب صامتاً في قاعدة بيانات الإنتاج الفعلية دون أي تنبيه.
  const usingDefaultUrl = !fromEnvUrl && !fromWindowUrl && !fromStorageUrl;
  const usingDefaultKey = !fromEnvKey && !fromWindowKey && !fromStorageKey;
  const usingDefaultConfig = usingDefaultUrl || usingDefaultKey;
  if (usingDefaultConfig) {
    console.warn(
      "[Supabase] لا توجد متغيرات بيئة/إعداد محلي (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY أو window.*/localStorage) — " +
      "يُستخدم الإعداد الافتراضي المُضمَّن في الكود، وهو يشير إلى مشروع Supabase الحقيقي في الإنتاج. " +
      "سيتم تعطيل الاتصال في التطوير المحلي ما لم تضبط VITE_ALLOW_DEFAULT_SUPABASE_IN_DEV=true صراحة."
    );
    // تحذير في console وحده كان يُفوَّت بسهولة (كما حدث فعلياً) — في وضع التطوير
    // (import.meta.env.DEV) نعرض أيضاً شريطاً ثابتاً في الصفحة، لا يمكن تفويته،
    // كي لا يُختبر أي تدفّق حفظ/تعديل بيانات ضد قاعدة الإنتاج الحقيقية بالخطأ.
    try {
      if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) {
        showDevProdWarningBanner();
      }
    } catch (_) { /* بيئة اختبار بلا import.meta — تجاهل */ }
  }

  return {
    url: (String(url || "").trim() || DEFAULT_SUPABASE_URL),
    anonKey: (String(anonKey || "").trim() || DEFAULT_SUPABASE_ANON_KEY),
    usingDefaultConfig,
    blockedInDev: isDevRuntime() && usingDefaultConfig && !allowDefaultSupabaseInDev()
  };
}

export function getSupabaseConfigStatus() {
  const cfg = readConfig();
  return {
    configured: !cfg.usingDefaultConfig,
    usingDefaultConfig: cfg.usingDefaultConfig,
    blockedInDev: cfg.blockedInDev,
    url: cfg.url
  };
}

export async function getSupabaseClient() {
  if (_client) return { supabase: _client, ok: true, error: "" };

  if (_clientPromise) return _clientPromise;

  const { url, anonKey, blockedInDev } = readConfig();
  if (blockedInDev) {
    _lastError =
      "Supabase blocked in local development because the embedded production defaults are active. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for a local/dev project.";
    return { supabase: null, ok: false, error: _lastError, blockedInDev: true };
  }
  if (!url || !anonKey) {
    _lastError =
      "Supabase غير مهيأ. ضع SUPABASE_URL و SUPABASE_ANON_KEY (window.* أو localStorage) لتفعيل الحفظ على قاعدة البيانات.";
    return { supabase: null, ok: false, error: _lastError };
  }

  _clientPromise = (async () => {
    try {
      const supabase = createClient(url, anonKey, {
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
      _lastError = `تعذر تهيئة عميل Supabase: ${String(e?.message || e)}`;
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
 * تدقيق 2026-07-08 (ملاحظة عالية #44): كان يمسح مفاتيح sb-* فقط، تاركاً مسودات
 * الدراسات المحلية (feas_project_*، بما فيها actuals حساسة بعد الإطلاق) ظاهرة
 * لأي مستخدم لاحق على جهاز مشترك. نمسحها الآن أيضاً عند الخروج صراحة.
 */
export async function signOut() {
  const { supabase } = await getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  _client = null;
  _clientPromise = null;
  if (typeof localStorage !== "undefined") {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.startsWith("feas_project_"))
      .forEach((k) => localStorage.removeItem(k));
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
 *
 * تدقيق 2026-07-09 (توحيد المصادقة): redirectTo كان يشير لمسار '/reset-password' غير
 * موجود إطلاقاً في المشروع (لا صفحة HTML، لا مسار SPA، لا معالج لحدث PASSWORD_RECOVERY)
 * — أي أن كل رابط استعادة فعلي يُرسِله Supabase كان يقود لصفحة لا تفعل شيئاً، فيتعذّر
 * إكمال إعادة التعيين نهائياً بعد إرسال البريد. الجذر (origin) هو نفسه SPA الرئيسي؛
 * detectSessionInUrl:true (مُفعَّل أعلاه) يلتقط رمز الاستعادة من الرابط تلقائياً ويُطلق
 * حدث PASSWORD_RECOVERY (معالجته في AuthGuard.js → NewPasswordModal.js).
 */
export async function resetPassword(email) {
  const { supabase, ok, error } = await getSupabaseClient();
  if (!ok) return { ok: false, error };

  const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
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


