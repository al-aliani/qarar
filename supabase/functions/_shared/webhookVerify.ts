/**
 * تحقق توقيع الـWebhook لكل من Stripe وMoyasar — مبني على Web Crypto API
 * (crypto.subtle) المتاحة في كل من Deno (بيئة Edge Functions الفعلية) وNode 18+
 * (بيئة اختبارات Vitest) بلا أي تعديل، لضمان اختبار المنطق الحرج فعلياً بدل
 * تركه غير مُختبَر لتعذّر تشغيل Deno محلياً في هذه الجلسة.
 *
 * أمني: التحقق من التوقيع قبل أي تحديث لقاعدة البيانات هو ما يمنع أي طرف
 * خارجي من تزييف "دفع ناجح" بإرسال طلب مزيَّف مباشرة لعنوان الـwebhook.
 */

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Stripe: رأس Stripe-Signature بصيغة "t=<unix_ts>,v1=<hex_hmac>[,v0=...]".
 * الرسالة الموقَّعة الفعلية هي "<timestamp>.<rawBody>" — يجب استخدام النص
 * الخام (rawBody) لا JSON.parse ثم إعادة التسلسل (ترتيب المفاتيح قد يتغيّر
 * فيفشل التحقق صامتاً لأسباب لا علاقة لها بصحة الحدث فعلياً).
 * toleranceSeconds يرفض أحداثاً قديمة جداً (هجوم إعادة تشغيل replay).
 */
export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<{ ok: boolean; reason?: string }> {
  if (!signatureHeader) return { ok: false, reason: 'missing_signature_header' };
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v];
    })
  );
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return { ok: false, reason: 'malformed_signature_header' };

  const age = Math.abs(nowSeconds - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, v1)) return { ok: false, reason: 'signature_mismatch' };
  return { ok: true };
}

/**
 * Moyasar: يرسل حقل secret_token ضمن جسم الحدث نفسه (وليس توقيعاً مبنياً على
 * HMAC للجسم الكامل) — يُقارَن بالقيمة التي أُدخلت عند تسجيل عنوان الـwebhook
 * في لوحة تحكم Moyasar. تحقّق من هذا مقابل التوثيق الفعلي الحيّ عند الربط
 * بمفاتيح حقيقية — هذا التنفيذ مبنيّ على الصيغة الموثّقة عاماً وقد تتغيّر.
 */
export function verifyMoyasarSecretToken(
  payload: { secret_token?: string; [k: string]: unknown },
  configuredSecret: string
): { ok: boolean; reason?: string } {
  const token = payload?.secret_token;
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_secret_token' };
  if (!timingSafeEqual(token, configuredSecret)) return { ok: false, reason: 'secret_token_mismatch' };
  return { ok: true };
}

/**
 * Tamara: ترسل رأس Authorization بصيغة "Bearer <notification_token>" مع كل
 * webhook — التوكن نفسه يُضبَط عند تسجيل عنوان الإشعارات في لوحة تحكم تمارا
 * (ليس توقيع HMAC محسوباً). تحقّق من هذا مقابل التوثيق الفعلي الحيّ عند الربط
 * بمفاتيح Sandbox حقيقية — هذا التنفيذ مبنيّ على الصيغة الموثّقة عاماً.
 */
export function verifyTamaraNotificationToken(
  authorizationHeader: string | null,
  configuredToken: string
): { ok: boolean; reason?: string } {
  if (!authorizationHeader) return { ok: false, reason: 'missing_authorization_header' };
  const token = authorizationHeader.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, reason: 'missing_notification_token' };
  if (!timingSafeEqual(token, configuredToken)) return { ok: false, reason: 'notification_token_mismatch' };
  return { ok: true };
}

export { hmacSha256Hex, timingSafeEqual };
