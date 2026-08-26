/**
 * مسح ليلة 2026-08-26: جدول «هيكل التمويل» كان يطبع رقمين لشيء واحد.
 *
 * `financing.totalInvestment` لقطة تُثبَّت مرة عند فتح خطوة التمويل، فمن يعود بعدها
 * ويضيف معدات يرفع `capex.total` وحده. «النسخة الاحترافية للمراجعة» كانت تنادي
 * `_renderFinancingRows(financing)` بوسيط واحد فتُقسَم النسب على اللقطة القديمة،
 * بينما صف «الإجمالي» في نفس الجدول يطبع إجمالي المحرك — نسبٌ لا تنتمي إلى إجماليها،
 * وتقرير التمويل البنكي لنفس الدراسة يطبع نسباً أخرى.
 *
 * ما يثبّته الاختبار هو المعادلة لا رقماً بعينه: كل نسبة مطبوعة = مبلغها ÷ الإجمالي
 * المطبوع في نفس الجدول، وكلا المصدِّرَين يطبعان الجدول نفسه حرفاً بحرف.
 */
import { describe, it, expect } from 'vitest';
import { BankReportGenerator } from '../BankReportGenerator.js';
import { ProfessionalReviewReportGenerator } from '../ProfessionalReviewReportGenerator.js';
import { calculateStudy } from '../../js/core/engine.js';

const store = (state) => ({ getState: () => state });

/** يحوّل خلية بالأرقام العربية-الهندية (ورموز الاتجاه والعملة) إلى عدد. */
function toNumber(text) {
    const ascii = String(text).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
    const digits = ascii.replace(/[^\d-]/g, '');
    return digits === '' ? NaN : Number(digits);
}

/** يستخرج جدول هيكل التمويل من HTML أيّ مصدِّر: صفوف المصادر + صف الإجمالي. */
function financingTable(html) {
    const table = html.match(/<table class="[^"]*">\s*<tr><th>المصدر<\/th>[\s\S]*?<\/table>/);
    if (!table) throw new Error('لم يُعثر على جدول هيكل التمويل في مخرَج المصدِّر');
    const cells = [...table[0].matchAll(/<tr(?: class="total-row")?><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)]
        .map((m) => ({ label: m[1].trim(), amount: toNumber(m[2]), pct: m[3].trim() }));
    const total = cells.find((c) => c.label === 'الإجمالي');
    return { sources: cells.filter((c) => c !== total), total };
}

/** المشروع نفسه في كل الحالات؛ المتغيّر الوحيد هو هيكل التمويل. */
function studyWith(financing) {
    return {
        projectInfo: { name: 'مشروع اختبار هيكل التمويل', businessModel: 'Independent' },
        assumptions: { projectionYears: 3, discountRate: 0.1, inflationRate: 0 },
        technical: { equipment: [{ price: 900000, quantity: 1, life: 7 }], buildings: [], furniture: [], vehicles: [], establishmentCosts: [], capacityUtilization: [] },
        hr: { positions: [] },
        logistics: { logistics: [] },
        administrative: { administrative: [] },
        marketing: { campaigns: [] },
        revenue: { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 200, variableCostRate: 0.3, growthRate: 0 }] },
        services: { items: [] },
        financing,
        techResources: { techResources: [] },
        legal: { licenses: [] }
    };
}

/** الحالة الموصوفة في البلاغ: لقطة تمويل قديمة (674,000) وCAPEX ارتفع بعدها. */
const STALE_SNAPSHOT = {
    totalInvestment: 674000,
    sources: {
        equity: { amount: 200000 },
        bankLoan: { amount: 300000, interestRate: 0.08, termYears: 5 }
    }
};

describe('جدول هيكل التمويل — النسب ومقامها المطبوع', () => {
    it('لقطة تمويل قديمة: كل نسبة = مبلغها ÷ الإجمالي المطبوع، في المصدِّرَين', () => {
        const state = studyWith(STALE_SNAPSHOT);
        const capTotal = calculateStudy(state).capex.total;
        // شرط الحالة: الإجمالي المطبوع (المحرك) يختلف عن اللقطة المخزّنة
        expect(capTotal).toBeGreaterThan(0);
        expect(capTotal).not.toBe(STALE_SNAPSHOT.totalInvestment);

        for (const [name, html] of [
            ['التقرير البنكي', BankReportGenerator.generateHTML(store(state))],
            ['النسخة الاحترافية', ProfessionalReviewReportGenerator.generateHTML(store(state))]
        ]) {
            const { sources, total } = financingTable(html);
            expect(sources.length, name).toBeGreaterThan(0);
            expect(total.amount, name).toBe(capTotal);
            for (const row of sources) {
                expect(row.pct, `${name} — ${row.label}`)
                    .toBe(((row.amount / total.amount) * 100).toFixed(1) + '%');
            }
        }
    });

    it('المصدِّران يطبعان الجدول نفسه لنفس الدراسة', () => {
        const state = studyWith(STALE_SNAPSHOT);
        const bank = financingTable(BankReportGenerator.generateHTML(store(state)));
        const pro = financingTable(ProfessionalReviewReportGenerator.generateHTML(store(state)));
        expect(pro).toEqual(bank);
    });

    it('مصادر تغطي الاستثمار بالكامل: النسب تجمع إلى 100%', () => {
        const capTotal = calculateStudy(studyWith(STALE_SNAPSHOT)).capex.total;
        const state = studyWith({
            totalInvestment: 674000,
            sources: {
                equity: { amount: capTotal * 0.4 },
                bankLoan: { amount: capTotal * 0.6, interestRate: 0.08, termYears: 5 }
            }
        });
        expect(calculateStudy(state).capex.total).toBe(capTotal); // التمويل لا يغيّر CAPEX

        for (const [name, html] of [
            ['التقرير البنكي', BankReportGenerator.generateHTML(store(state))],
            ['النسخة الاحترافية', ProfessionalReviewReportGenerator.generateHTML(store(state))]
        ]) {
            const { sources, total } = financingTable(html);
            expect(total.amount, name).toBe(capTotal);
            const sum = sources.reduce((s, r) => s + parseFloat(r.pct), 0);
            expect(sum, name).toBeCloseTo(100, 1);
        }
    });

    it('بلا مصادر مُدخَلة: الصف الوحيد يحمل الإجمالي المطبوع نفسه', () => {
        const state = studyWith({ totalInvestment: 674000, sources: {} });
        const capTotal = calculateStudy(state).capex.total;

        for (const [name, html] of [
            ['التقرير البنكي', BankReportGenerator.generateHTML(store(state))],
            ['النسخة الاحترافية', ProfessionalReviewReportGenerator.generateHTML(store(state))]
        ]) {
            const { sources, total } = financingTable(html);
            expect(sources.length, name).toBe(1);
            expect(sources[0].pct, name).toBe('100%');
            expect(sources[0].amount, name).toBe(total.amount);
            expect(total.amount, name).toBe(capTotal);
        }
    });
});

/**
 * إضافة 2026-08-26: الحارس أعلاه يثبّت الاتساق **داخل** المصدِّر الواحد. لكن مُدقِّقاً
 * مستقلاً شغّل المصدِّرَين على الدراسة نفسها في اللحظة نفسها فوجد:
 *   تقرير منشآت: «تمويل ذاتي 29.7%» · «قرض بنكي 44.5%»
 *   التقرير البنكي: «18.5%»            · «27.8%»
 * نفس السطر، نفس الدراسة، رقمان متناقضان — لأن منشآت كان يحسب المقام محلياً.
 * العميل يستلم مستندين يناقض أحدهما الآخر، وهو ما لا يلتقطه حارس داخلي مهما اشتدّ.
 */
describe('اتساق نسب التمويل عبر المصدّرات — لا داخل كلٍّ منها فقط', () => {
    // ملاحظة منهجية: حاولتُ أولاً مقارنة مخرَج المصدِّرَين مباشرةً، فوجدتُ أن ذلك يتطلب
    // بناء دراسة كاملة وتشغيل المحرك داخل كل منهما — وأي اختصار (استدعاء الدالة المشتركة
    // مرتين) يقارن الشيء بنفسه ويمرّ دائماً. الحارس الفعلي أدناه يفحص المصدر: أن منشآت
    // يستدعي الجدول المشترك ولا يحتفظ بمقام محلي. أضعف من مقارنة مخرَجين، وأصدق من
    // اختبار أجوف.

    it('MonshaatReportGenerator يستدعي الجدول المشترك ولا يحسب مقاماً محلياً', async () => {
        const { readFileSync } = await import('node:fs');
        const { resolve, dirname } = await import('node:path');
        const { fileURLToPath } = await import('node:url');
        const src = readFileSync(
            resolve(dirname(fileURLToPath(import.meta.url)), '../MonshaatReportGenerator.js'), 'utf8');
        const kpis = src.slice(src.indexOf("case 'financial_kpis'"), src.indexOf("case 'risks'"));
        expect(kpis, 'منشآت ما زال يحسب مقام النسب محلياً').toContain('_renderFinancingTable');
        expect(kpis, 'مقام محلي متبقٍّ في منشآت').not.toMatch(/amount\s*\/\s*total/);
    });
});
