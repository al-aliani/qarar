/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26 — بلاغان مؤكَّدان على «لوحة المؤشرات المالية»:
 *
 * (1) FinancialDashboard.js:102 — البوابة كانت hasMinimumRevenueData وحدها (وجود مصدر
 *     إيراد واحد). دراسة فيها مصدر إيراد وحيد (300 عميل × 20 ريال) بلا أي أصل رأسمالي
 *     ولا موظف ولا تمويل كانت تجتازها، فتعرض اللوحة «صافي القيمة الحالية 193,441 ريال»
 *     و«فترة الاسترداد 0.1 سنة» — أرقام يبنى عليها قرار استثماري لدراسة عبّأ صاحبها
 *     3 خطوات من 40. في نفس اللحظة لوحة القرار (DecisionDashboard.js:54-56) ترفض إصدار
 *     أي حكم لأنها تشترط hasMinimumFinancialData أيضاً. تعليق dataSufficiency.js:20-28
 *     يوثّق أن hasMinimumFinancialData أُنشئت لهذه الحالة بالذات.
 *
 * (2) FinancialDashboard.js:179 — بانر القرار كان يُعلن «المشروع غير مجدٍ» بالأحمر على
 *     دراسة إيراد سنتها الأولى = صفر (مستخدم أضاف مصدر إيراد وترك حقوله صفراً ثم أدرج
 *     معدات)، بينما بوابة الجودة الرسمية تُصدر خطأً حرجاً NO_REVENUE فتحجب القرار في
 *     لوحة القرار ونظرة المشروع («القرار محجوب مؤقتاً»). حكم قاطع على لا شيء.
 *
 * الأرقام أدناه من تشغيل calculateStudy الحقيقي (لا محاكاة).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';
import { runQAChecks } from '../../utils/qaChecks.js';
import { buildDecisionQualityGate } from '../../utils/decisionQuality.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

/** مصدر إيراد واحد فقط (300 عميل × 20 ريال) — بلا أصول ولا موظفين ولا تمويل. */
function revenueOnlyStudy() {
    const d = createEmptyStudy();
    d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'مشروعي' };
    d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 300, avgPrice: 20 }] };
    return d;
}

/** مصدر إيراد بحقول صفرية + معدات — يجتاز البوابة المزدوجة لكن إيراده صفر فعلاً. */
function zeroRevenueWithAssetsStudy() {
    const d = createEmptyStudy();
    d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'مشروعي' };
    d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 0, avgPrice: 0 }] };
    d[SECTIONS.TECHNICAL] = { ...d[SECTIONS.TECHNICAL], equipment: [{ price: 100000, quantity: 1 }] };
    return d;
}

describe('FinancialDashboard — بوابة كفاية البيانات المزدوجة (نفس لوحة القرار)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('المحرك فعلاً يُخرج NPV واسترداداً «حقيقيَّين» لهذه الدراسة (تثبيت المدخل)', () => {
        const r = calculateStudy(revenueOnlyStudy());
        expect(r.indicators.npv).toBeGreaterThan(100000);
        expect(r.indicators.paybackPeriod).toBeLessThan(0.5);
    });

    it('إيراد بلا أي تكلفة/أصل/تمويل: لا بطاقات مؤشرات ولا رقم NPV — رسالة نقص بيانات التكلفة', () => {
        new FinancialDashboard('c', fakeStore(revenueOnlyStudy())).render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('لا توجد بيانات تكلفة');
        expect(document.querySelector('#unifiedKpiPanel')).toBeNull();
        expect(document.querySelector('.decision-banner')).toBeNull();
        // الرقم الفعلي الذي كان يُعرض (193,441) لا يظهر بأي تنسيق
        expect(html).not.toMatch(/193[,٬]?441/);
    });

    it('دراسة فارغة تماماً: رسالة «لا توجد بيانات إيرادات» كما كانت', () => {
        const empty = createEmptyStudy();
        new FinancialDashboard('c', fakeStore(empty)).render();

        expect(document.getElementById('c').innerHTML).toContain('لا توجد بيانات إيرادات');
        expect(document.querySelector('.decision-banner')).toBeNull();
    });
});

describe('FinancialDashboard — لا حكم «مجدٍ/غير مجدٍ» حين تحجب بوابة الجودة القرار', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('بوابة الجودة فعلاً مقفلة بـNO_REVENUE والمحرك يقول NO-GO (تثبيت المدخل)', async () => {
        const study = zeroRevenueWithAssetsStudy();
        const results = calculateStudy(study);
        expect(results.incomeStatement[0].revenue).toBe(0);
        expect(results.decision).toBe('NO-GO');

        const gate = buildDecisionQualityGate(await runQAChecks(study, results));
        expect(gate.locked).toBe(true);
        expect(gate.hardItems.map(i => i.code)).toContain('NO_REVENUE');
    });

    it('إيراد السنة الأولى صفر: البانر يقرأ «القرار محجوب مؤقتاً» لا «المشروع غير مجدٍ»', () => {
        new FinancialDashboard('c', fakeStore(zeroRevenueWithAssetsStudy())).render();

        const banner = document.querySelector('.decision-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('القرار محجوب مؤقتاً');
        expect(banner.textContent).not.toContain('المشروع غير مجدٍ');
        expect(banner.className).not.toContain('is-nogo');
        expect(document.getElementById('decisionWithheldNote')).not.toBeNull();
    });

    it('دراسة بإيراد حقيقي: البانر ما زال يُصدر قرار المحرك كما كان', () => {
        const d = zeroRevenueWithAssetsStudy();
        d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30 }] };
        const decision = calculateStudy(d).decision;

        new FinancialDashboard('c', fakeStore(d)).render();

        const banner = document.querySelector('.decision-banner');
        const expected = decision === 'GO' ? 'المشروع مجدٍ' : (decision === 'REVISE' ? 'المشروع يحتاج مراجعة' : 'المشروع غير مجدٍ');
        expect(banner.textContent).toContain(expected);
        expect(document.getElementById('decisionWithheldNote')).toBeNull();
    });
});
