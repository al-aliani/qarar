import { describe, it, expect } from 'vitest';
import { formatIrrPct } from '../indicatorFormat.js';

/**
 * تدقيق جولة الموقع 2026-07-20 (بندا #1 و#13): توحيد دلالة IRR غير المحقّق. المخالفون
 * (InvestorDashboard/BankReport/PresentationView/results/shareUtils) كانوا يعرضونه
 * «0.0%» عبر (irr||0)*100 بينما لوحة القرار تقول «غير محقق». الآن مصدر واحد.
 */
describe('formatIrrPct — دلالة IRR غير المحقّق موحّدة', () => {
    it('null/undefined/غير منتهٍ → «غير محقق» (لا 0.0%)', () => {
        expect(formatIrrPct(null)).toBe('غير محقق');
        expect(formatIrrPct(undefined)).toBe('غير محقق');
        expect(formatIrrPct(NaN)).toBe('غير محقق');
        expect(formatIrrPct(Infinity)).toBe('غير محقق');
    });
    it('كسر حقيقي من المحرك → نسبة (خانة واحدة افتراضياً)', () => {
        expect(formatIrrPct(0.28)).toBe('28.0%');
        expect(formatIrrPct(0.155, 2)).toBe('15.50%');
    });
    it('صفر حقيقي مُدخَل يبقى «0.0%» (≠ غير محقّق)', () => {
        expect(formatIrrPct(0)).toBe('0.0%');
    });
});
