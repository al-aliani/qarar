/**
 * CAPTCHA (reCAPTCHA v3) — معيار حرج
 * تنفيذ غير مرئي قبل تسجيل الدخول/التسجيل.
 * يحتاج VERIFY_SITE_KEY على السيرفر للتحقق.
 */

const SITE_KEY = window.RECAPTCHA_SITE_KEY || localStorage.getItem('RECAPTCHA_SITE_KEY') || '';
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
  const key = typeof localStorage !== 'undefined' ? localStorage.getItem('RECAPTCHA_SITE_KEY') : '';
  return !!(SITE_KEY || (key && key.trim()));
}
