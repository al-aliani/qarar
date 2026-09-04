/**
 * تدقيق 2026-07-10: opex.rentAnnual (يستهلكه costRatios.js/getCostRatios ومنه
 * BenchmarkingView.js وSmartAdvisor.js، وأيضاً sectorBenchmarks.js مباشرة) كان يُحسب
 * من annualLogisticsFixed — قسم اللوجستيات (SECTIONS.LOGISTICS) الذي صفه الافتراضي
 * "التوصيل والنقل" وليس إيجاراً. بند الإيجار الفعلي («إيجار المحل (الصالة/المطبخ)»)
 * يعيش في الموارد الإدارية (SECTIONS.ADMINISTRATIVE) ولم يكن يغذي rentAnnual إطلاقاً،
 * فمشروع إيجاره الحقيقي = 50% من الإيراد كان يُبلَّغ رسمياً بنسبة إيجار 0.0%.
 *
 * هذا اختبار تكاملي (calculateStudy الكاملة، لا وحدة costRatios.js المعزولة) يثبّت
 * الإصلاح: يملأ صف الإيجار الافتراضي في الموارد الإدارية بمبلغ معروف ويتحقق أن
 * opex.rentAnnual وgetCostRatios(results).rent يعكسانه بدقة، وأن opex.adminAnnual
 * لا يزدوج احتساب حصة الإيجار (يُخصم منه).
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { getCostRatios } from '../costRatios.js';
import { createEmptyStudy, SECTIONS } from '../schema.js';

function buildFixture({ rentMonthly, otherAdminMonthly = 0 }) {
    const study = createEmptyStudy();

    // إيراد شهري = 100,000 ريال (12 شهراً بلا نمو) ⇒ سنوي = 1,200,000 ريال.
    study[SECTIONS.REVENUE].streams = [
        { service: 'مبيعات', customersPerMonth: 100, avgPrice: 1000, variableCostRate: 0.30, growthRate: 0, type: 'operating' }
    ];

    // صف الإيجار الافتراضي الحقيقي (schema.js) — يُملأ برقم معروف بدل 0 الافتراضي.
    const rows = study[SECTIONS.ADMINISTRATIVE].administrative;
    const rentRow = rows.find(r => /إيجار|ايجار|rent|lease/i.test(r.name)); // نفس كشف المحرك (RENT_KEYWORDS_RE) لا تسمية العرض
    expect(rentRow).toBeTruthy(); // يثبّت أن الاختبار يستهدف نفس الصف الذي يراه المستخدم فعلاً
    rentRow.monthly = rentMonthly;

    if (otherAdminMonthly) {
        rows.push({ name: 'قرطاسية ومصاريف مكتبية', monthly: otherAdminMonthly, notes: '' });
    }

    // قسم اللوجستيات يبقى على صفه الافتراضي (توصيل/نقل، monthly:0) — يثبّت أنه
    // لم يعد يغذي rentAnnual إطلاقاً بعد الإصلاح.
    study[SECTIONS.LOGISTICS].logistics = [
        { name: 'التوصيل والنقل (منصات التوصيل/نقل مبرّد)', monthly: 3000, variablePercent: 0.5, notes: '' }
    ];

    study.assumptions = { ...study.assumptions, projectionYears: 3, discountRate: 0.10, inflationRate: 0, hiddenOverheadsRate: 0 };
    return study;
}

describe('opex.rentAnnual يُحسب من إيجار المحل الفعلي (الموارد الإدارية) لا من اللوجستيات', () => {
    it('إيجار شهري 50,000 (نصف الإيراد) ⇒ rentAnnual=600,000 ونسبة الإيجار 50% بالضبط', () => {
        const study = buildFixture({ rentMonthly: 50000 });
        const results = calculateStudy(study);

        // الإيراد السنوي المتوقع = 100 عميل × 1000 ريال × 12 شهر = 1,200,000
        const y1 = results.incomeStatement[0];
        expect(y1.revenue).toBeCloseTo(1200000, 2);

        // صلب الإصلاح: rentAnnual يساوي إيجار الموارد الإدارية (50,000×12) لا اللوجستيات.
        expect(results.opex.rentAnnual).toBeCloseTo(600000, 2);
        // اللوجستيات (بند التوصيل، 50% منه ثابت) لا تُحتسب ضمن rentAnnual بعد الإصلاح.
        expect(results.opex.rentAnnual).not.toBeCloseTo(3000 * 12 * 0.5, 2);

        const ratios = getCostRatios(results);
        expect(ratios.rent).toBeCloseTo(0.5, 6); // 600,000 / 1,200,000 = 50%

        // قبل الإصلاح كانت هذه القيمة 0 رغم إيجار حقيقي — لم تعد كذلك.
        expect(results.opex.rentAnnual).not.toBe(0);
        expect(ratios.rent).not.toBe(0);
    });

    it('لا ازدواج احتساب: adminAnnual = إجمالي الموارد الإدارية ناقص حصة الإيجار فقط', () => {
        const study = buildFixture({ rentMonthly: 20000, otherAdminMonthly: 1500 });
        const results = calculateStudy(study);

        const expectedRentAnnual = 20000 * 12;       // 240,000
        const expectedOtherAdminAnnual = 1500 * 12;  // 18,000

        expect(results.opex.rentAnnual).toBeCloseTo(expectedRentAnnual, 2);
        expect(results.opex.adminAnnual).toBeCloseTo(expectedOtherAdminAnnual, 2);

        // المجموع (rentAnnual + adminAnnual) يجب أن يساوي إجمالي بنود الموارد الإدارية
        // فقط (بلا ازدواج ولا فقدان) — يستثني اللوجستيات والمستهلكات هنا (كلاهما صفر إضافي).
        expect(results.opex.rentAnnual + results.opex.adminAnnual)
            .toBeCloseTo(expectedRentAnnual + expectedOtherAdminAnnual, 2);
    });

    it('إيجار صفري (الافتراضي) ⇒ rentAnnual=0 ونسبة الإيجار 0 دون كسر الحساب', () => {
        const study = buildFixture({ rentMonthly: 0 });
        const results = calculateStudy(study);
        expect(results.opex.rentAnnual).toBe(0);
        expect(getCostRatios(results).rent).toBe(0);
    });
});
