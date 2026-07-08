/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #37): FinancingStructure.js كانت تستخدم
 * (loan.interestRate || 0.08) في عرض حقل الفائدة وفي حساب تكلفة الدين لـWACC —
 * قرض بفائدة 0% صريحة (بنك تنمية اجتماعية/زراعية) يُعامَل كقيمة مفقودة فيُعاد
 * عرضها 8% بعد كل إعادة رسم، رغم أن المحرك الفعلي (engine.js rateOrDefault)
 * يحترم الصفر الصريح بشكل صحيح — تناقض بين ما يُعرض وما يُحسَب فعلياً.
 */
import { describe, it, expect } from 'vitest';
import { rateOrDefault } from '../../core/engine.js';
import { FinancingStructure } from '../FinancingStructure.js';

const fs = Object.create(FinancingStructure.prototype);
fs.store = { getState: () => ({ assumptions: {} }) };

describe('rateOrDefault (engine.js) — مُصدَّرة ومُشتركة بلا نسخة محلية مكرَّرة', () => {
    it('يحترم الصفر الصريح (لا يعيده للافتراضي)', () => {
        expect(rateOrDefault(0, 0.08)).toBe(0);
    });
    it('null/undefined/فراغ تُعيد الافتراضي', () => {
        expect(rateOrDefault(null, 0.08)).toBe(0.08);
        expect(rateOrDefault(undefined, 0.08)).toBe(0.08);
        expect(rateOrDefault('', 0.08)).toBe(0.08);
    });
    it('قيمة حقيقية غير صفرية تمر كما هي', () => {
        expect(rateOrDefault(0.05, 0.08)).toBe(0.05);
    });
});

describe('FinancingStructure — حقل الفائدة وWACC يحترمان القرض 0% الصريح (#37)', () => {
    it('renderLoanDetails: قرض بفائدة 0% صريحة يُعرَض 0 لا 8', () => {
        const html = fs.renderLoanDetails({ sources: { bankLoan: { amount: 300000, interestRate: 0 } } });
        expect(html).toContain('value="0"');
        expect(html).not.toContain('value="8"');
    });

    it('renderLoanDetails: بلا فائدة مُدخَلة إطلاقاً (undefined) يُعرَض الافتراضي 8%', () => {
        const html = fs.renderLoanDetails({ sources: { bankLoan: { amount: 300000 } } });
        expect(html).toContain('value="8"');
    });

    it('renderWACC: قرض بفائدة 0% صريحة يجعل تكلفة الدين بعد الضريبة 0.00% في معادلة WACC (لا نسبة مبنية على 8%)', () => {
        const html = fs.renderWACC({ sources: { bankLoan: { amount: 300000, interestRate: 0 }, equity: { amount: 200000 } } }, 500000);
        expect(html).toMatch(/تكلفة الدين بعد الضريبة[^]*?0\.00%/);
    });
});

describe('FinancingStructure — قائمة البنوك موحَّدة بعد اندماج الأهلي/سامبا (#63)', () => {
    it('لا يعرض "بنك سامبا" ككيان منفصل، ويعرض التسمية المدمجة (SNB) بدلاً من "البنك الأهلي" وحدها', () => {
        const html = fs.renderLoanDetails({ sources: { bankLoan: { amount: 300000 } } });
        expect(html).not.toContain('بنك سامبا');
        expect(html).toContain('البنك الأهلي السعودي (SNB)');
    });

    it('دراسة قديمة محفوظة بـ loan.bank="samba" تبقى محدَّدة على خيار SNB المدمج (لا تفقد اختيارها)', () => {
        const html = fs.renderLoanDetails({ sources: { bankLoan: { amount: 300000, bank: 'samba' } } });
        const ncbOption = html.match(/<option value="ncb"[^>]*>/)[0];
        expect(ncbOption).toContain('selected');
    });
});

describe('FinancingStructure — زر «سدّ الفجوة» يميّز الفائض القابل للحل من غير القابل (#65)', () => {
    it('فائض ناتج عن التمويل الذاتي وحده: الزر يظهر ويحل المشكلة فعلياً', () => {
        // equity=600000 وحدها تتجاوز totalCapex=500000؛ القرض/المستثمرون/الدعم = 0
        const html = fs.renderFundingValidation({ equity: { amount: 600000 } }, 500000);
        expect(html).toContain('id="btnAutoBalanceFunding"');
        expect(html).toContain('استخدم زر «سدّ الفجوة»');
    });

    it('فائض ناتج عن القرض وحده (يتجاوز الاستثمار المطلوب بمفرده): الزر لا يظهر، ورسالة توجّه لتخفيض القرض تحديداً', () => {
        // bankLoan=700000 وحده > totalCapex=500000؛ تصفير equity لن يحل شيئاً
        const html = fs.renderFundingValidation({ equity: { amount: 0 }, bankLoan: { amount: 700000 } }, 500000);
        expect(html).not.toContain('id="btnAutoBalanceFunding"');
        expect(html).toContain('القرض/المستثمرين/الدعم الحكومي لا التمويل الذاتي');
    });

    it('عجز (نقص تمويل): الزر يظهر كالمعتاد', () => {
        const html = fs.renderFundingValidation({ equity: { amount: 100000 } }, 500000);
        expect(html).toContain('id="btnAutoBalanceFunding"');
        expect(html).toContain('ناقص');
    });

    it('توازن تام: لا يظهر الزر ولا أي تحذير', () => {
        const html = fs.renderFundingValidation({ equity: { amount: 500000 } }, 500000);
        expect(html).not.toContain('id="btnAutoBalanceFunding"');
        expect(html).toContain('التمويل مكتمل');
    });
});
