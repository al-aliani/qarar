/**
 * توليد وهاش رموز استرداد 2FA — منطق خالص عبر Web Crypto API القياسية فقط
 * (بلا أي API خاص بـDeno)، بنفس مبدأ otp.ts: قابل لاختبار Vitest حقيقي مباشرة
 * رغم أن الوجهة الفعلية Edge Functions/Deno. يعيد استخدام hmacSha256Hex من
 * webhookVerify.ts بدل تكرار منطق HMAC.
 *
 * سرّ منفصل عمداً (RECOVERY_CODE_HASH_SECRET) عن OTP_HASH_SECRET — رموز
 * الاسترداد طويلة العمر (تُستخدَم لأشهر/سنوات) بخلاف رموز OTP قصيرة العمر
 * (دقائق)، فلا يجوز مشاركة نفس السرّ بينهما.
 */
import { hmacSha256Hex } from './webhookVerify.ts';

// بلا 0/O و1/I/L — تفادي التباس عند نسخ الرمز يدوياً من الشاشة أو كتابته على ورقة.
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODES_PER_BATCH = 10;

/**
 * يزيل الفواصل/المسافات ويوحّد حالة الأحرف قبل الهاش — يسمح للمستخدم بإدخال
 * الرمز بأي شكل (بشرطة، بدونها، بأحرف صغيرة) دون أن يفشل التحقق شكلياً فقط.
 */
function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** رمز استرداد واحد بصيغة عرض XXXX-XXXX (Web Crypto — لا Math.random). */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => RECOVERY_CODE_ALPHABET[b % RECOVERY_CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** دفعة رموز استرداد فريدة (تصادم عملياً مستحيل بـ8 محارف من 31، لكن نضمنه صراحة). */
export function generateRecoveryCodeBatch(count: number = CODES_PER_BATCH): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return Array.from(codes);
}

/**
 * هاش رمز الاسترداد بسرّ الخادم — يُخزَّن هذا الهاش فقط بقاعدة البيانات
 * (mfa_recovery_codes.code_hash)، لا الرمز الخام أبداً. التطبيع (normalize)
 * قبل الهاش يعني أن نفس الرمز يُنتج نفس الهاش بصرف النظر عن شكل إدخاله.
 */
export async function hashRecoveryCode(code: string, secret: string): Promise<string> {
  return hmacSha256Hex(secret, normalizeRecoveryCode(code));
}
