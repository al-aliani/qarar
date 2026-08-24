/**
 * @vitest-environment jsdom
 *
 * BreakEvenAnalysis — إيراد صفر لا يُنتج «هامش أمان» ناجحاً وهمياً.
 *
 * كان bepPercentage يُحسب كصفر عندما totalRevenue <= 0 (بدل تركه غير محسوب)، فيعرض
 * هامش الأمان = (1 - 0) * 100 = "100.0%" بلون نجاح أخضر ونص "المشروع في منطقة الأمان
 * بهامش 100%" رغم عدم وجود إيراد إطلاقاً. نفس العلة أُصلحت سابقاً في DecisionDashboard.js
 * (تدقيق 2026-07-20، الأسطر 97-101) عبر علَم المحرك breakEvenAchievable. هذا الاختبار
 * يثبت أن BreakEvenAnalysis.js تحديداً يعرض حالة محايدة (—) بدل النسبة الكاذبة.
 */
import { describe, it, expect } from 'vitest';
import { BreakEvenAnalysis } from '../BreakEvenAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state };
}

function zeroRevenueStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مشروع تجريبي', sector: 'مطاعم', businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 };
    data[SECTIONS.TECHNICAL] = {
        equipment: [{ name: 'معدات', price: 150000, quantity: 1 }],
        buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
    };
    data[SECTIONS.HR] = { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 10000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [] }; // لا إيراد إطلاقاً — الحالة الحرجة محل الاختبار
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: {} };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

describe('BreakEvenAnalysis — إيراد صفر لا يُنتج هامش أمان ناجحاً كاذباً', () => {
    it('إيراد السنة الأولى = 0 ⇒ لا تُعرض "100.0%" بلون نجاح، بل حالة محايدة (—)', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const study = zeroRevenueStudy();
        const results = calculateStudy(study);

        expect(results.incomeStatement[0].revenue).toBe(0);
        // تأكيد أن الحارس فعلاً غير محقق في هذه الحالة (لا معنى لتعادل بلا إيراد)
        expect(results.indicators.breakEvenAchievable).toBe(false);

        const view = new BreakEvenAnalysis('c', fakeStore(study));
        view.render();

        const safetyMarginEl = document.querySelectorAll('.bep-stat .value')[2];
        expect(safetyMarginEl.textContent.trim()).toBe('—');
        expect(safetyMarginEl.textContent.trim()).not.toBe('100.0%');
        expect(safetyMarginEl.classList.contains('text-success')).toBe(false);
        expect(safetyMarginEl.classList.contains('text-muted')).toBe(true);

        const interpretation = document.querySelector('.bep-interpretation').textContent;
        expect(interpretation).not.toContain('منطقة الأمان');
    });
});
