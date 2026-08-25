/**
 * مسح 2026-08-26 [P0]: شريحة «أبرز المؤشرات المالية» في «عرض المستثمرين» كانت تطبع
 * «هامش الربح: 0.0%» **دائماً** — السطر يقرأ `results.incomeStatement[0].netMargin`
 * وهو مفتاح لا ينتجه المحرك إطلاقاً (صفوف قائمة الدخل تحوي revenue/netIncome ولا تحوي
 * netMargin)، فـ`|| 0` يبتلع undefined صامتاً. لا توجد أي مدخلات تجعل الرقم صحيحاً.
 *
 * والطرف المعاكس: بلا إيراد لا يجوز طباعة «0.0%» أيضاً — الهامش غير قابل للحساب فيُعرض «—».
 */
import { describe, it, expect } from 'vitest';
import { PitchDeckExporter } from '../PitchDeckExporter.js';
import { createEmptyStudy } from '../../js/core/schema.js';
import { calculateStudy } from '../../js/core/engine.js';

function fakeStore(state) {
    return { getState: () => state };
}

/** مقهى حقيقي: 3000 عميل/شهر × 25 ريال، معدات 400,000، 3 موظفين. */
function cafeState() {
    const s = createEmptyStudy();
    s.projectInfo.name = 'مقهى النرجس';
    s.revenue.streams = [
        { service: 'قهوة', customersPerMonth: 3000, avgPrice: 25, growthRate: 0.05, type: 'operating' }
    ];
    s.technical.equipment = [{ name: 'معدات', quantity: 1, price: 400000, depreciationRate: 0.15 }];
    s.hr.positions = [
        { position: 'باريستا', count: 3, months: 12, salary: 5000, nationality: 'saudi', isVariable: false }
    ];
    return s;
}

/** نفس المشروع بلا أي مصدر إيراد — الهامش غير قابل للحساب. */
function noRevenueState() {
    const s = cafeState();
    s.revenue.streams = [];
    return s;
}

/** قيمة بطاقة «هامش الربح» كما يراها المستثمر في الشريحة. */
function marginCardValue(html) {
    const m = html.match(/هامش الربح<\/div>\s*<div[^>]*>([^<]*)<\/div>/);
    return m ? m[1].trim() : null;
}

describe('PitchDeck — بطاقة هامش الربح', () => {
    it('تطبع هامش المحرك الحقيقي لا 0.0%', () => {
        const state = cafeState();
        const results = calculateStudy(state);
        const engineMargin = results.indicators.netMargin;
        const inc = results.incomeStatement[0];

        // شرطا البلاغ: المحرك يحسب هامشاً موجباً معتبراً، والمفتاح الذي كان يُقرأ غير موجود.
        expect(inc.netMargin).toBeUndefined();
        expect(engineMargin).toBeGreaterThan(0.1);
        expect(engineMargin).toBeCloseTo(inc.netIncome / inc.revenue, 10);

        const printed = marginCardValue(PitchDeckExporter.generateHTML(fakeStore(state)));
        expect(printed).toBe((engineMargin * 100).toFixed(1) + '%');
        expect(printed).not.toBe('0.0%');
    });

    it('تطبع «—» لا «0.0%» حين لا إيراد فلا هامش قابلاً للحساب', () => {
        const state = noRevenueState();
        const results = calculateStudy(state);
        expect(results.incomeStatement[0].revenue).toBe(0);
        expect(results.incomeStatement[0].netIncome).toBeLessThan(0);

        const printed = marginCardValue(PitchDeckExporter.generateHTML(fakeStore(state)));
        expect(printed).toBe('—');
    });
});
