/**
 * تدقيق 2026-07-08 (ملاحظة متوسطة #8): فحص DSCR الحرج (lib/calc/qaGate.js، تنبيه
 * عند 1.0-1.2) كان لا يعمل أبداً على أي دراسة حقيقية — loanExists() تبحث عن
 * inputs.financing.loan.amount بينما المخطط الفعلي financing.sources.bankLoan.amount،
 * وcomputeDscrMin() تبحث عن outputs.dscr (مصفوفة) أو outputs.kpis.dscrMin بينما
 * محرك الحسابات الفعلي يُخرج indicators.dscr (رقم سنة أولى) وdscrAnalysis (مصفوفة
 * سنوية {year,dscr,status}).
 * ملاحظة: هذا الملف يعيش تحت web/ (لا lib/calc/__tests__/) لأن vitest.config يحدد
 * root:'./web' — أي اختبار خارج web/ لا يُشغَّل إطلاقاً ضمن npm test الفعلي
 * (اكتُشف أثناء هذا الإصلاح أن lib/calc/__tests__/calc.test.js وverification.test.js
 * الحاليين يتيمان بنفس السبب — يُترَكان لملاحظة تنظيف منفصلة).
 */
import { describe, it, expect } from 'vitest';
import { qaGate } from '../../../../lib/calc/qaGate.js';

function studyWithLoan(amount = 500000) {
    return { financing: { sources: { bankLoan: { amount } } } };
}

describe('qaGate — قاعدة DSCR تعمل فعلياً على مخرجات المحرك الحقيقية (#8)', () => {
    it('DSCR سنوي (dscrAnalysis) أقل من 1.2: يُطلق تحذيراً (softWarning) في الوضع غير الصارم', () => {
        const outputs = {
            dscrAnalysis: [
                { year: 1, dscr: 1.05, status: 'يحتاج مراجعة' },
                { year: 2, dscr: 1.4, status: 'مريح للممول' }
            ]
        };
        const { hardErrors, softWarnings } = qaGate(studyWithLoan(), outputs, null, { strictMode: false });
        expect(hardErrors.length).toBe(0);
        expect(softWarnings.some(w => w.code === 'DSCR_BELOW_1_2')).toBe(true);
    });

    it('نفس الحالة في الوضع الصارم: تُطلق hardError لا softWarning', () => {
        const outputs = { dscrAnalysis: [{ year: 1, dscr: 1.05, status: 'يحتاج مراجعة' }] };
        const { hardErrors, softWarnings } = qaGate(studyWithLoan(), outputs, null, { strictMode: true });
        expect(hardErrors.some(w => w.code === 'DSCR_BELOW_1_2')).toBe(true);
        expect(softWarnings.length).toBe(0);
    });

    it('DSCR سنة أولى فقط (indicators.dscr) بلا dscrAnalysis: يُقرأ كمسار احتياطي صحيح', () => {
        const outputs = { indicators: { dscr: 1.1 } };
        const { softWarnings } = qaGate(studyWithLoan(), outputs, null, { strictMode: false });
        expect(softWarnings.some(w => w.code === 'DSCR_BELOW_1_2')).toBe(true);
    });

    it('DSCR ≥ 1.2 في كل السنوات: لا تحذير إطلاقاً', () => {
        const outputs = { dscrAnalysis: [{ year: 1, dscr: 1.3 }, { year: 2, dscr: 1.5 }] };
        const { hardErrors, softWarnings } = qaGate(studyWithLoan(), outputs, null, { strictMode: false });
        expect(hardErrors.length).toBe(0);
        expect(softWarnings.some(w => w.code === 'DSCR_BELOW_1_2')).toBe(false);
    });

    it('لا قرض إطلاقاً (financing.sources.bankLoan.amount=0): لا يُطلَق فحص DSCR بصرف النظر عن قيمته', () => {
        const outputs = { dscrAnalysis: [{ year: 1, dscr: 0.5 }] };
        const { hardErrors, softWarnings } = qaGate({ financing: { sources: { bankLoan: { amount: 0 } } } }, outputs, null, { strictMode: false });
        expect(hardErrors.length).toBe(0);
        expect(softWarnings.some(w => w.code === 'DSCR_BELOW_1_2')).toBe(false);
    });
});
