/**
 * CAPTCHA (reCAPTCHA v3) — معيار حرج
 * تنفيذ غير مرئي قبل تسجيل الدخول/التسجيل.
 * يحتاج VERIFY_SITE_KEY على السيرفر للتحقق.
 * تدقيق 2026-08-24: Site Key يُضبط الآن فقط وقت البناء عبر VITE_RECAPTCHA_SITE_KEY
 * (نفس نمط VITE_WHATSAPP_NUMBER في config.js) — كان قابلاً للتعديل من متصفح أي
 * مستخدم عبر localStorage في صفحة التكاملات رغم أنه إعداد مركزي يحمي تسجيل
 * الدخول لكل المستخدمين، لا إعداد شخصي.
 */

function envVar(name) {
  try {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) || '';
  } catch (_) {
    return '';
  }
}

const SITE_KEY = envVar('VITE_RECAPTCHA_SITE_KEY');
const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js?render=' + SITE_KEY;

let grecaptchaReady = false;

export async function executeCaptcha(action = 'submit') {
  if (!SITE_KEY) return null;
  try {
    if (!window.grecaptcha || !window.grecaptcha.execute) {
      await loadScript();
    }
    const token = await window.grecaptcha.execute(SITE_KEY, { action });
    return token;
  } catch (e) {
    console.warn('reCAPTCHA v3 failed:', e);
    return null;
  }
}

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.execute) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => {
      grecaptchaReady = true;
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function isCaptchaConfigured() {
  return !!SITE_KEY;
}
