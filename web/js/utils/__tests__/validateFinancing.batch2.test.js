/**
 * تدقيق 2026-07-08 (دفعة 2):
 * ملاحظة متوسطة #36: لا تحقق يمنع فترة سماح ≥ مدة القرض بالأشهر — computeLoanSchedule
 * (lib/calc/loanSchedule.js) تعامل كل الأشهر كـ"سماح" فلا يُسدَّد أي أصل قرض إطلاقاً،
 * والرصيد الختامي يبقى كامل مبلغ القرض دون أي تنبيه للمستخدم.
 * ملاحظة متوسطة #38: التحقق من عدم سلبية مبالغ التمويل كان يغطي التمويل الذاتي
 * والقرض فقط؛ حقلا المستثمرون والدعم الحكومي بلا أي تحقق.
 */
import { describe, it, expect } from 'vitest';
import { validateFinancing } from '../validation.js';
import { computeLoanSchedule } from '../../../../lib/calc/loanSchedule.js';

describe('validateFinancing — فترة السماح يجب أن تكون أقل من مدة القرض (#36)', () => {
    it('فترة سماح ≥ مدة القرض بالأشهر: يُرفض بخطأ واضح', () => {
        const r = validateFinancing({ sources: { bankLoan: { amount: 500000, termYears: 1, gracePeriodMonths: 24 } } });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => e.includes('فترة السماح'))).toBe(true);
    });

    it('فترة سماح أقل من مدة القرض: يُقبَل بلا خطأ', () => {
        const r = validateFinancing({ sources: { bankLoan: { amount: 500000, termYears: 5, gracePeriodMonths: 6 } } });
        expect(r.valid).toBe(true);
    });

    it('يثبت المشكلة الفعلية عددياً: فترة سماح=24 مع مدة=سنة واحدة (12 شهراً) لا تُسدِّد أي أصل من القرض', () => {
        const result = computeLoanSchedule(500000, 0.08, 1, 24, 'equal');
        expect(result.monthlyPayment).toBe(0);
        const lastMonth = result.schedule[result.schedule.length - 1];
        expect(lastMonth.balance).toBe(500000); // الرصيد الختامي = كامل مبلغ القرض — لم يُسدَّد شيء
    });
});

describe('validateFinancing — عدم سلبية مبالغ المستثمرين والدعم الحكومي (#38)', () => {
    it('مبلغ مستثمرين سالب: يُرفض', () => {
        const r = validateFinancing({ sources: { investors: { amount: -50000 } } });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => e.includes('المستثمرين'))).toBe(true);
    });

    it('مبلغ دعم حكومي سالب: يُرفض', () => {
        const r = validateFinancing({ sources: { governmentSupport: { amount: -10000 } } });
        expect(r.valid).toBe(false);
        expect(r.errors.some(e => e.includes('الدعم الحكومي'))).toBe(true);
    });

    it('مبالغ موجبة لكل المصادر: يُقبَل بلا خطأ', () => {
        const r = validateFinancing({
            sources: {
                equity: { amount: 100000 },
                investors: { amount: 50000 },
                governmentSupport: { amount: 20000 },
                bankLoan: { amount: 300000, termYears: 5, gracePeriodMonths: 3 }
            }
        });
        expect(r.valid).toBe(true);
    });
});
