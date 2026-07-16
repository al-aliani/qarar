/**
 * توصية مصدر التمويل الأنسب لسدّ فجوة التمويل (2026-07-16) — تُضاف بجانب زر
 * «سدّ الفجوة من التمويل الذاتي» الحالي لأنه يعدّل التمويل الذاتي فقط بصرف النظر
 * عن حجم الفجوة، بينما فجوة كبيرة عملياً تحتاج أداة تمويل خارجية لا مجرد رفع حصة الملّاك.
 */
import { describe, it, expect } from 'vitest';
import { FinancingStructure } from '../FinancingStructure.js';

const fs = Object.create(FinancingStructure.prototype);
fs.formatCurrency = (n) => `${Math.round(n)} ر.س`;

describe('FinancingStructure.recommendFundingSource', () => {
    it('فجوة صغيرة (≤15% من الاستثمار): يوصي بتمويل ذاتي إضافي', () => {
        const html = fs.recommendFundingSource(50000, 500000); // 10%
        expect(html).toContain('تمويل ذاتي إضافي');
    });

    it('فجوة متوسطة (15-40%): يوصي بقرض بنكي/صندوق تنمية', () => {
        const html = fs.recommendFundingSource(150000, 500000); // 30%
        expect(html).toContain('صندوق التنمية');
    });

    it('فجوة كبيرة (>40%): يوصي بمستثمرين/تمويل حكومي لا تعديل حصة الملّاك فقط', () => {
        const html = fs.recommendFundingSource(300000, 500000); // 60%
        expect(html).toContain('مستثمرين');
    });

    it('بلا فجوة (gap<=0): لا يُرجع شيئاً', () => {
        expect(fs.recommendFundingSource(0, 500000)).toBe('');
        expect(fs.recommendFundingSource(-1000, 500000)).toBe('');
    });

    it('renderFundingValidation يضمّن التوصية فعلياً عند وجود فجوة موجبة', () => {
        const html = fs.renderFundingValidation({ equity: { amount: 100000 }, bankLoan: { amount: 0 }, investors: { amount: 0 }, governmentSupport: { amount: 0 } }, 500000);
        expect(html).toContain('funding-source-hint');
    });
});
