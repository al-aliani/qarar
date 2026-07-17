/**
 * تدقيق 2026-07-17: إضافة الباقة المجانية (price: 0) جعلت PRICE_MIN المشتقّ
 * بـMath.min يساوي صفراً، فصارت صفحة الهبوط تعلن حرفياً «من 0 ريالاً» —
 * تأكّد حياً في المتصفح: landing.html:1244 يكتب PRICE_MIN فوق النص الثابت
 * «249» في [data-price-min] (سطرا 839 و931).
 * PRICE_MIN/PRICE_MAX يصفان نطاق السعر *المعلن للبيع*، فالباقة المجانية
 * ليست سعراً معلناً بل غياب سعر.
 */
import { describe, it, expect } from 'vitest';
import { PRICING_PACKAGES, PRICE_MIN, PRICE_MAX } from '../pricing.js';

describe('نطاق السعر المعلن (PRICE_MIN/PRICE_MAX)', () => {
    it('PRICE_MIN هو أرخص باقة مدفوعة، لا الصفر', () => {
        expect(PRICE_MIN).toBeGreaterThan(0);
        const cheapestPaid = Math.min(
            ...PRICING_PACKAGES.filter((p) => p.price > 0).map((p) => p.price)
        );
        expect(PRICE_MIN).toBe(cheapestPaid);
    });

    it('PRICE_MAX هو أغلى باقة', () => {
        expect(PRICE_MAX).toBe(Math.max(...PRICING_PACKAGES.map((p) => p.price)));
    });

    it('وجود باقة مجانية لا يُفسد النطاق المعلن', () => {
        expect(PRICING_PACKAGES.some((p) => p.price === 0)).toBe(true);
        expect(PRICE_MIN).not.toBe(0);
    });
});
