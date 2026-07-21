import { describe, it, expect } from 'vitest';
import { PRICING_DISPLAY, REFUND_POLICY } from '../config.js';

describe('رسائل التسعير والاسترجاع', () => {
    it('لا يعد المجاني بدراسة كاملة بلا اشتراك خلافاً للواجهة الحالية', () => {
        expect(PRICING_DISPLAY.freeTrial).toContain('ابدأ مجاناً');
        expect(PRICING_DISPLAY.freeTrial).toContain('المخرجات المدفوعة');
        expect(PRICING_DISPLAY.freeTrial).not.toContain('دراسة كاملة بدون اشتراك');
    });

    it('يقصر الاسترجاع على الباقات المدفوعة ويشرح وضع المجاني', () => {
        expect(REFUND_POLICY.fullText).toContain('جميع الباقات المدفوعة');
        expect(REFUND_POLICY.fullText).toContain('الباقة المجانية');
        expect(REFUND_POLICY.fullText).not.toContain('دراسة كاملة بدون اشتراك');
    });
});
