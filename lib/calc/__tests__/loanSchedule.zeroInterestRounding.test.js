/**
 * تدقيق ٢٠٢٦-٠٧-٠٩ — قرض بفائدة 0% (قروض حكومية سعودية ميسّرة، بنك التنمية الاجتماعية/
 * الزراعية — مذكور صراحة في engine.js كحالة "يجب أن تبقى 0%، لا تتحول افتراضياً لـ8%")
 * كان يُسبّب انحرافاً تراكمياً بلا حد بين annualSummary.totalPrincipal وendingBalance
 * الفعلي: القسط الشهري ثابت في قرض 0% فائدة (loanAmount ÷ عدد الأشهر)، فيُقرَّب نفس
 * الكسر (مثلاً 5208.333) لنفس الاتجاه في كل شهر — خطأ تدوير ثابت الاتجاه لا يُلغي بعضه
 * حين يُجمع عبر جدول السنة، وينمو الانحراف خطياً مع طول القرض/مبلغه. هذا يكسر الهوية
 * المحاسبية Σ(totalPrincipal) + endingBalance === loanAmount التي تعتمد عليها الميزانية
 * العمومية (lib/calc/balanceSheet.js). الإصلاح: أصل كل سنة يُشتق من فرق الأرصدة الدقيقة
 * (telescoping) لا من جمع أصل كل شهر بعد تدويره منفرداً.
 */
import { describe, it, expect } from 'vitest';
import { computeLoanSchedule } from '../loanSchedule.js';

describe('computeLoanSchedule — قرض 0% فائدة لا ينحرف تراكمياً (#zero-interest-rounding)', () => {
    it('250,000 ريال / 4 سنوات / 0% فائدة: مجموع أصل كل السنوات + الرصيد النهائي = مبلغ القرض تماماً', () => {
        const ls = computeLoanSchedule(250000, 0, 4, 0, 'equal');
        const sumPrincipal = ls.annualSummary.reduce((s, y) => s + y.totalPrincipal, 0);
        const finalBalance = ls.annualSummary.at(-1).endingBalance;
        expect(finalBalance).toBe(0);
        expect(Math.abs(sumPrincipal + finalBalance - 250000)).toBeLessThanOrEqual(1);
    });

    it('5,000,000 ريال / 10 سنوات / 0% فائدة: لا انحراف متنامٍ (كان ~40 ريالاً قبل الإصلاح)', () => {
        const ls = computeLoanSchedule(5000000, 0, 10, 0, 'equal');
        const sumPrincipal = ls.annualSummary.reduce((s, y) => s + y.totalPrincipal, 0);
        const finalBalance = ls.annualSummary.at(-1).endingBalance;
        expect(Math.abs(sumPrincipal + finalBalance - 5000000)).toBeLessThanOrEqual(1);
    });

    it('كل سنة على حدة: أصل السنة + الرصيد المتبقي في نهايتها = رصيد بداية السنة (لا انحراف تراكمي عبر السنوات)', () => {
        const ls = computeLoanSchedule(433320, 0, 7, 6, 'equal');
        let expectedStart = 433320;
        ls.annualSummary.forEach(y => {
            expect(Math.abs((expectedStart - y.totalPrincipal) - y.endingBalance)).toBeLessThanOrEqual(1);
            expectedStart = y.endingBalance;
        });
    });

    it('قرض بفائدة موجبة (8%) لا يزال يتوازن كما كان (لا تراجع في السلوك الأصلي)', () => {
        const ls = computeLoanSchedule(433320, 0.08, 5, 6, 'equal');
        const sumPrincipal = ls.annualSummary.reduce((s, y) => s + y.totalPrincipal, 0);
        const finalBalance = ls.annualSummary.at(-1).endingBalance;
        expect(finalBalance).toBe(0);
        expect(Math.abs(sumPrincipal + finalBalance - 433320)).toBeLessThanOrEqual(2);
    });

    it('قرض دفعة أخيرة (bullet) 0% فائدة: لا أصل قبل الشهر الأخير، وكامل الأصل فيه', () => {
        const ls = computeLoanSchedule(300000, 0, 5, 0, 'bullet');
        expect(ls.annualSummary.slice(0, -1).every(y => y.totalPrincipal === 0)).toBe(true);
        expect(ls.annualSummary.at(-1).endingBalance).toBe(0);
        const sumPrincipal = ls.annualSummary.reduce((s, y) => s + y.totalPrincipal, 0);
        expect(Math.abs(sumPrincipal - 300000)).toBeLessThanOrEqual(1);
    });
});
