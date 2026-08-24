/**
 * تدقيق 2026-08-24: renderFundingValidation كانت تحسب totalCapex - totalFunded وتعتبره
 * "متطابقاً" (isBalanced) عند |الفرق| < 1 — عندما totalCapex=0 وtotalFunded=0 معاً (لم
 * تُدخل أي تكلفة استثمارية بعد)، الفرق=0 فتظهر رسالة نجاح خضراء كاذبة رغم عدم وجود بيانات.
 */
import { describe, it, expect } from 'vitest';
import { FinancingStructure } from '../FinancingStructure.js';

const fs = Object.create(FinancingStructure.prototype);
fs.formatCurrency = (n) => `${Math.round(n)} ر.س`;

const emptySources = { equity: { amount: 0 }, bankLoan: { amount: 0 }, investors: { amount: 0 }, governmentSupport: { amount: 0 } };

describe('FinancingStructure.renderFundingValidation — totalCapex=0', () => {
    it('لا يعرض "متطابق"/"مكتمل" ناجحاً عندما totalCapex=0 وtotalFunded=0', () => {
        const html = fs.renderFundingValidation(emptySources, 0);
        expect(html).not.toContain('التمويل مكتمل ويطابق الاستثمار المطلوب');
        expect(html).not.toContain('text-success');
    });

    it('يعرض رسالة محايدة توجّه المستخدم لإدخال بيانات التكلفة الاستثمارية', () => {
        const html = fs.renderFundingValidation(emptySources, 0);
        expect(html).toContain('لم تُدخل بعد بيانات التكلفة الاستثمارية');
        expect(html).toContain('text-muted');
    });

    it('نفس السلوك المحايد عندما totalCapex سالب أو غير رقمي', () => {
        expect(fs.renderFundingValidation(emptySources, -100)).not.toContain('text-success');
        expect(fs.renderFundingValidation(emptySources, NaN)).not.toContain('text-success');
    });

    it('لا يعرض زر "سدّ الفجوة" عندما totalCapex=0 (لا معنى لفجوة بلا استثمار مطلوب)', () => {
        const html = fs.renderFundingValidation(emptySources, 0);
        expect(html).not.toContain('btnAutoBalanceFunding');
    });
});

describe('FinancingStructure.renderFundingValidation — السلوك الحالي محفوظ عند totalCapex>0', () => {
    it('لا يزال يعرض نجاح "متطابق" عندما التمويل يطابق الاستثمار المطلوب فعلياً', () => {
        const sources = { equity: { amount: 500000 }, bankLoan: { amount: 0 }, investors: { amount: 0 }, governmentSupport: { amount: 0 } };
        const html = fs.renderFundingValidation(sources, 500000);
        expect(html).toContain('التمويل مكتمل ويطابق الاستثمار المطلوب');
        expect(html).toContain('text-success');
    });

    it('لا يزال يعرض تحذير النقص عندما التمويل أقل من الاستثمار المطلوب', () => {
        const sources = { equity: { amount: 300000 }, bankLoan: { amount: 0 }, investors: { amount: 0 }, governmentSupport: { amount: 0 } };
        const html = fs.renderFundingValidation(sources, 500000);
        expect(html).toContain('ناقص');
        expect(html).toContain('text-danger');
    });
});
