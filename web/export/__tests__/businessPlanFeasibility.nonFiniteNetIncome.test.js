/**
 * @vitest-environment jsdom
 *
 * انحدار 2026-08-26: إصلاح توازن سطر الملخص المالي غيّر
 * `year1.netIncome != null ? … : 0` إلى `year1.netIncome || 0` — فصار الصافي
 * غير المنتهي (NaN) يُطبع «٠» بدل «—».
 *
 * قياس المُدقِّق على نفس الحالة (revenue = 0، netIncome = NaN):
 *   قبل: «إيراد متوقع: ٠ ر.س. — تكلفة: … — صافي: —»   (formatters.js:7 safeNum ⟶ «—»)
 *   بعد: «٠ — ٠ — ٠»  ⟵ سطر متوازن لكنه مُلفَّق يُخفي أن الحساب فشل
 *
 * «—» أصدق من «٠» في منتج كل قيمته أن أرقامه صادقة. المحرك نفسه يُعقّم NaN
 * (تُحقِّق منه probe حي: مدخل NaN ⟶ 0) فلا مسار واجهي يصله اليوم — لذلك نحقن
 * الحالة عبر تغليف calculateStudy، مع إبقاء بقية النتائج حقيقية كي يعمل
 * ReportGenerator المُستدعى داخل نفس المخرَج.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../js/core/engine.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        calculateStudy: (state) => {
            const results = actual.calculateStudy(state);
            if (state?.__forceYear1) {
                results.incomeStatement[0] = { ...results.incomeStatement[0], ...state.__forceYear1 };
            }
            return results;
        }
    };
});

import { BusinessPlanFeasibilityExporter } from '../BusinessPlanFeasibilityExporter.js';
import { createEmptyStudy, SECTIONS } from '../../js/core/schema.js';

function baseStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مصنع تمور اختبار' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0, taxRate: 0, currency: 'SAR' };
    data[SECTIONS.TECHNICAL] = { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [] };
    data[SECTIONS.REVENUE] = { streams: [] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 900000, percentage: 100 } } };
    return data;
}

/** سطر الملخص المالي كما يقرؤه العميل (فقرة واحدة بلا وسوم داخلية). */
function financialLine(html) {
    const match = html.match(/<p>إيراد متوقع:[^<]*<\/p>/);
    if (!match) throw new Error('لم يُعثر على سطر الملخص المالي في المخرَج');
    return match[0];
}

describe('BusinessPlanFeasibilityExporter — الصافي غير المنتهي يُطبع «—» لا «٠»', () => {
    it('netIncome = NaN مع إيراد ٠: الصافي «—» ولا يُلفَّق صفر', () => {
        const state = baseStudy();
        state.__forceYear1 = { revenue: 0, netIncome: NaN };

        const line = financialLine(BusinessPlanFeasibilityExporter.generateHTML({ getState: () => state }));

        expect(line).toContain('صافي: —.');
        // التكلفة مشتقّة من الصافي — فشلُه يُسقطها معه بدل اختلاق رقم متوازن
        expect(line).toContain('إجمالي التكاليف والأعباء: —');
    });

    it('netIncome مفقود (undefined) يبقى صفراً — لا نحوّل الفراغ إلى «—»', () => {
        const state = baseStudy();
        state.__forceYear1 = { revenue: 1000, netIncome: undefined };

        const line = financialLine(BusinessPlanFeasibilityExporter.generateHTML({ getState: () => state }));

        expect(line).not.toContain('صافي: —.');
        // التوازن الذي أضافه إصلاح الليلة محفوظ: إيراد − تكلفة = صافي (1000 − 1000 = 0)
        expect(line).toMatch(/إجمالي التكاليف والأعباء: [^—]+—\s*صافي: [^—]+\./);
    });
});
