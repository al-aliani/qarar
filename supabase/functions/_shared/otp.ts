/**
 * توليد وهاش رموز تحقق واتساب — منطق خالص عبر Web Crypto API القياسية فقط
 * (بلا أي API خاص بـDeno)، بنفس مبدأ webhookVerify.ts: قابل لاختبار Vitest
 * حقيقي مباشرة رغم أن الوجهة الفعلية Edge Functions/Deno. يعيد استخدام
 * hmacSha256Hex من webhookVerify.ts بدل تكرار منطق HMAC.
 */
import { hmacSha256Hex } from './webhookVerify.ts';

/**
 * رمز عشوائي حقيقي من 6 أرقام (Web Crypto لا Math.random — نفس معيار
 * الأمان المستخدم في timingSafeEqual/hmacSha256Hex).
 */
export function generateOtpCode(): string {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const n = new DataView(bytes.buffer).getUint32(0);
    return String(n % 1_000_000).padStart(6, '0');
}

/**
 * هاش الرمز بسرّ الخادم (OTP_HASH_SECRET) — يُخزَّن هذا الهاش فقط بقاعدة
 * البيانات (phone_otp_challenges.code_hash)، لا الرمز الخام أبداً.
 */
export async function hashOtpCode(code: string, secret: string): Promise<string> {
    return hmacSha256Hex(secret, code);
}
