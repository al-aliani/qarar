/**
 * اختبار منطق توليد/هاش رموز واتساب عبر Vitest (Node) — نفس مبدأ
 * webhookVerify.test.js: الملف المصدر Web Crypto قياسي بحت فيعمل بلا تعديل.
 */
import { describe, it, expect } from 'vitest';
import { generateOtpCode, hashOtpCode } from '../otp.ts';

describe('generateOtpCode', () => {
    it('يُرجع نصاً من 6 أرقام بالضبط', () => {
        for (let i = 0; i < 50; i++) {
            const code = generateOtpCode();
            expect(code).toMatch(/^\d{6}$/);
        }
    });

    it('لا يُهمل الأصفار البادئة (padStart)', () => {
        // نتحقق من الشكل فقط — لا سيطرة مباشرة على القيمة العشوائية.
        for (let i = 0; i < 200; i++) {
            const code = generateOtpCode();
            expect(code.length).toBe(6);
        }
    });

    it('يولّد قيماً مختلفة عبر استدعاءات متعددة (ليس ثابتاً)', () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
        expect(codes.size).toBeGreaterThan(1);
    });
});

describe('hashOtpCode', () => {
    it('يُرجع نفس الهاش لنفس الرمز والسرّ (حتمي)', async () => {
        const h1 = await hashOtpCode('123456', 'secret-a');
        const h2 = await hashOtpCode('123456', 'secret-a');
        expect(h1).toBe(h2);
    });

    it('يُرجع هاشاً مختلفاً لرمز مختلف بنفس السرّ', async () => {
        const h1 = await hashOtpCode('123456', 'secret-a');
        const h2 = await hashOtpCode('654321', 'secret-a');
        expect(h1).not.toBe(h2);
    });

    it('يُرجع هاشاً مختلفاً لنفس الرمز بسرّ مختلف', async () => {
        const h1 = await hashOtpCode('123456', 'secret-a');
        const h2 = await hashOtpCode('123456', 'secret-b');
        expect(h1).not.toBe(h2);
    });

    it('لا يُرجع الرمز الخام ضمن الهاش الناتج', async () => {
        const h = await hashOtpCode('123456', 'secret-a');
        expect(h).not.toContain('123456');
    });
});
