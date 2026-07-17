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

/**
 * Supabase Send SMS Hook: يوقّع طلباته بمعيار Standard Webhooks — المحتوى الموقَّع
 * هو "{webhook-id}.{webhook-timestamp}.{raw body}"، والتوقيع HMAC-SHA256 بترميز
 * base64 (لا hex، بخلاف Stripe أعلاه)، ورأس webhook-signature قد يحمل عدة توقيعات
 * مفصولة بمسافات بصيغة "v1,<sig>" لدعم تدوير المفاتيح.
 *
 * فخّ المفتاح: Supabase يعرض السرّ بصيغة "v1,whsec_<base64>"، والمفتاح الفعلي هو
 * ناتج فكّ base64 لما بعد "whsec_" — لا النص كما هو. استخدامه كما هو يجعل كل
 * توقيع يفشل صامتاً.
 *
 * لماذا التحقق إلزامي: بدونه يستطيع أي طرف استدعاء عنوان الدالة برقم ورمز من
 * اختياره، فيُرسل رسائل واتساب على حساب المالك (استنزاف رصيد Meta + انتحال).
 */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256Base64(keyBytes: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}

export async function verifyStandardWebhookSignature(
  configuredSecret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!configuredSecret) return { ok: false, reason: 'missing_configured_secret' };
  const { id, timestamp, signature } = headers;
  if (!id) return { ok: false, reason: 'missing_webhook_id' };
  if (!timestamp) return { ok: false, reason: 'missing_webhook_timestamp' };
  if (!signature) return { ok: false, reason: 'missing_webhook_signature' };

  // يرفض الطلبات القديمة/المستقبلية — يقلّل نافذة إعادة الإرسال (replay).
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return { ok: false, reason: 'invalid_webhook_timestamp' };
  if (Math.abs(Date.now() / 1000 - tsSeconds) > 300) return { ok: false, reason: 'timestamp_out_of_tolerance' };

  const rawKey = configuredSecret.replace(/^v1,/, '').replace(/^whsec_/, '');
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(rawKey);
  } catch {
    return { ok: false, reason: 'secret_not_base64' };
  }

  const expected = await hmacSha256Base64(keyBytes, `${id}.${timestamp}.${rawBody}`);
  const provided = signature.split(' ').map((part) => part.split(',')[1] ?? '');
  const match = provided.some((sig) => sig && timingSafeEqual(sig, expected));
  return match ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}

export { hmacSha256Hex, timingSafeEqual };
