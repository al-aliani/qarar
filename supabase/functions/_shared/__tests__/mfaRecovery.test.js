/**
 * اختبار منطق توليد/هاش رموز استرداد 2FA عبر Vitest (Node) — نفس مبدأ
 * otp.test.js/webhookVerify.test.js: الملف المصدر Web Crypto قياسي بحت
 * فيعمل بلا تعديل.
 */
import { describe, it, expect } from 'vitest';
import { generateRecoveryCode, generateRecoveryCodeBatch, hashRecoveryCode } from '../mfaRecovery.ts';

describe('generateRecoveryCode', () => {
    it('يُرجع نصاً بصيغة XXXX-XXXX من محارف الأبجدية المسموحة فقط', () => {
        for (let i = 0; i < 50; i++) {
            const code = generateRecoveryCode();
            expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
        }
    });

    it('لا يحتوي أبداً على المحارف الملتبسة 0/O/1/I/L', () => {
        for (let i = 0; i < 200; i++) {
            const code = generateRecoveryCode();
            expect(code).not.toMatch(/[01ILO]/);
        }
    });

    it('يولّد قيماً مختلفة عبر استدعاءات متعددة (ليس ثابتاً)', () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateRecoveryCode()));
        expect(codes.size).toBeGreaterThan(1);
    });
});

describe('generateRecoveryCodeBatch', () => {
    it('يُرجع 10 رموز بالضبط افتراضياً', () => {
        const batch = generateRecoveryCodeBatch();
        expect(batch.length).toBe(10);
    });

    it('كل رموز الدفعة فريدة (بلا تكرار)', () => {
        const batch = generateRecoveryCodeBatch();
        expect(new Set(batch).size).toBe(batch.length);
    });

    it('يحترم عدد الرموز المطلوب عند تمريره صراحة', () => {
        const batch = generateRecoveryCodeBatch(3);
        expect(batch.length).toBe(3);
    });
});

describe('hashRecoveryCode', () => {
    it('يُرجع نفس الهاش لنفس الرمز والسرّ (حتمي)', async () => {
        const h1 = await hashRecoveryCode('ABCD-1234', 'secret-a');
        const h2 = await hashRecoveryCode('ABCD-1234', 'secret-a');
        expect(h1).toBe(h2);
    });

    it('يتجاهل شكل الإدخال (شرطة/حالة الأحرف/مسافات) عند الهاش', async () => {
        const h1 = await hashRecoveryCode('ABCD-1234', 'secret-a');
        const h2 = await hashRecoveryCode('abcd1234', 'secret-a');
        const h3 = await hashRecoveryCode(' abcd 1234 ', 'secret-a');
        expect(h2).toBe(h1);
        expect(h3).toBe(h1);
    });

    it('يُرجع هاشاً مختلفاً لرمز مختلف بنفس السرّ', async () => {
        const h1 = await hashRecoveryCode('ABCD-1234', 'secret-a');
        const h2 = await hashRecoveryCode('WXYZ-6789', 'secret-a');
        expect(h1).not.toBe(h2);
    });

    it('يُرجع هاشاً مختلفاً لنفس الرمز بسرّ مختلف', async () => {
        const h1 = await hashRecoveryCode('ABCD-1234', 'secret-a');
        const h2 = await hashRecoveryCode('ABCD-1234', 'secret-b');
        expect(h1).not.toBe(h2);
    });

    it('لا يُرجع الرمز الخام ضمن الهاش الناتج', async () => {
        const h = await hashRecoveryCode('ABCD-1234', 'secret-a');
        expect(h).not.toContain('ABCD1234');
    });
});
