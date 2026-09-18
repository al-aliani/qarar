import { describe, expect, it } from 'vitest';
import { computeLoanSchedule } from '../loanSchedule.js';

describe('مصالحة جدول القرض', () => {
    const cases = [
        { amount: 125000, rate: 0, years: 2, grace: 0, type: 'equal' },
        { amount: 300000, rate: 0.08, years: 5, grace: 3, type: 'equal' },
        { amount: 275555, rate: 0.0715, years: 7, grace: 6, type: 'declining' },
        { amount: 900000, rate: 0.06, years: 4, grace: 0, type: 'bullet' }
    ];

    it.each(cases)('يطابق كل إجمالي سنوي الأصل + الفائدة: $type / $years سنوات', ({ amount, rate, years, grace, type }) => {
        const result = computeLoanSchedule(amount, rate, years, grace, type);

        result.annualSummary.forEach(year => {
            expect(year.totalPayment).toBe(year.totalPrincipal + year.totalInterest);
        });
    });

    it.each(cases)('يطابق الإجمالي العام مجموع السنوات ومبلغ القرض: $type / $years سنوات', ({ amount, rate, years, grace, type }) => {
        const result = computeLoanSchedule(amount, rate, years, grace, type);
        const yearsPayment = result.annualSummary.reduce((sum, year) => sum + year.totalPayment, 0);
        const yearsPrincipal = result.annualSummary.reduce((sum, year) => sum + year.totalPrincipal, 0);
        const yearsInterest = result.annualSummary.reduce((sum, year) => sum + year.totalInterest, 0);

        expect(yearsPrincipal).toBe(amount);
        expect(result.totalInterest).toBe(yearsInterest);
        expect(result.totalPayment).toBe(yearsPayment);
        expect(result.totalPayment).toBe(amount + result.totalInterest);
    });
});
