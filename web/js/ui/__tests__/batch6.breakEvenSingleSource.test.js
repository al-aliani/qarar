/**
 * @vitest-environment jsdom
 *
 * دفعة 6 — نقطة التعادل: مصدر واحد فقط.
 *
 * BreakEvenAnalysis.js كان يعيد حساب fixedCosts/contributionMarginRatio/bepValue
 * محلياً من حقول قائمة الدخل للسنة الأولى، رغم أن engine.js يملك تعريفاً قانونياً
 * واحداً لنقطة التعادل (indicators.breakEvenPointValue) — والتعليق في engine.js
 * يوثّق علة تاريخية: ثلاث شاشات أظهرت ثلاث نقاط تعادل مختلفة لنفس الدراسة بسبب
 * هذا النوع من التكرار المحلي.
 *
 * الاختباران أدناه:
 *  1) حالة عادية (هامش مساهمة موجب) — يتحقق أن الرقم المعروض يطابق تماماً
 *     results.indicators.breakEvenPointValue.
 *  2) حالة تمايز حقيقية (هامش مساهمة سالب في السنة الأولى، إذ variableCostRate
 *     يتجاوز 100%): هنا يتباعد الحسابان فعلياً — الحساب المحلي القديم كان يسقط
 *     إلى fixedCosts (رقم موجب) بينما تعريف المحرك القانوني يُرجع صفراً صراحة
 *     (لا معنى لنقطة تعادل عندما لا يوجد هامش مساهمة موجب أصلاً). هذا الاختبار
 *     كان سيفشل مع الكود القديم (يعرض fixedCosts لا 0) ويثبت أن الشاشة تقرأ
 *     فعلياً من indicators.breakEvenPointValue لا من حساب مستقل قد يتباعد.
 */
import { describe, it, expect } from 'vitest';
import { BreakEvenAnalysis } from '../BreakEvenAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state };
}

function baseStudy(revenueOverrides = {}) {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مطعم تجريبي', sector: 'مطاعم', businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 };
    data[SECTIONS.TECHNICAL] = {
        equipment: [{ name: 'معدات', price: 150000, quantity: 1 }],
        buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
    };
    data[SECTIONS.HR] = { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 10000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = {
        streams: [{ service: 'وجبات', type: 'operating', customersPerMonth: 1000, avgPrice: 50, variableCostRate: 0.30, growthRate: 0.05, ...revenueOverrides }]
    };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: {} };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

function readBepValueFromDom() {
    // نفس منطق formatCurrency في BreakEvenAnalysis.js — أول بطاقة "بطاقة نقطة التعادل"
    return document.querySelector('.bep-stat .value.text-gold')?.textContent.trim();
}

describe('BreakEvenAnalysis — نقطة التعادل من مصدر واحد (indicators.breakEvenPointValue)', () => {
    it('حالة عادية: الرقم المعروض مطابق تماماً لمؤشر المحرك', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const study = baseStudy();
        const results = calculateStudy(study);
        expect(results.indicators.breakEvenPointValue).toBeGreaterThan(0);

        const view = new BreakEvenAnalysis('c', fakeStore(study));
        view.render();

        const expectedText = view.formatCurrency(results.indicators.breakEvenPointValue);
        expect(readBepValueFromDom()).toBe(expectedText);
    });

    it('حالة تمايز حقيقية: هامش مساهمة سالب ⇒ المحرك يُرجع 0 صراحة، والشاشة يجب أن تعرض 0 أيضاً (لا fixedCosts القديمة)', () => {
        document.body.innerHTML = '<div id="c2"></div>';
        // variableCostRate > 1 يُقرأ كنسبة مئوية (٪150) في financial/revenue.js ⇒ vcr = 1.5
        // (تكلفة متغيرة تفوق الإيراد) — هامش مساهمة سالب في السنة الأولى.
        const study = baseStudy({ variableCostRate: 150 });
        const results = calculateStudy(study);

        const year1 = results.incomeStatement[0];
        expect(year1.revenue - year1.variableCosts).toBeLessThan(0); // تأكيد فعلي أن الهامش سالب

        // تعريف المحرك القانوني: cmRatio <= 0 ⇒ breakEvenValue = 0 صراحة (لا قيمة موجبة مضلِّلة)
        expect(results.indicators.breakEvenPointValue).toBe(0);

        // الحساب المحلي القديم (المُزال) كان سيُنتج fixedCosts هنا بدل 0 — نتحقق أنه فعلاً موجب
        // (أي أن الاختبار كان سيفشل مع الكود القديم لأنه يعرض هذا الرقم لا صفراً)
        const oldLocalFixedCostsFallback = (year1.fixedCosts || 0) + (year1.depreciation || 0);
        expect(oldLocalFixedCostsFallback).toBeGreaterThan(0);

        const view = new BreakEvenAnalysis('c2', fakeStore(study));
        view.render();

        const expectedText = view.formatCurrency(0);
        expect(readBepValueFromDom()).toBe(expectedText);
        expect(readBepValueFromDom()).not.toBe(view.formatCurrency(oldLocalFixedCostsFallback));
    });
});
