/**
 * دفعة 6 — ذمم العملاء (Accounts Receivable) في الميزانية العمومية.
 *
 * lib/calc/balanceSheet.js كان يضع accountsReceivable = 0 دائماً ("// Simplified")
 * حتى عندما تُدخِل الدراسة سياسة تحصيل آجل صريحة (DSO) يحسب المحرك (engine.js)
 * من أجلها رقماً حقيقياً في study.cashCycle.receivables. نقطة الاستدعاء
 * (generateBalanceSheets) لم تكن تُمرّر cashCycle إطلاقاً.
 *
 * هذا الاختبار يتحقق من طرفين:
 *  1) دراسة بلا سياسة تحصيل آجل (DSO/DIO/DPO كلها صفر/غائبة) ⇒ لا يوجد cashCycle
 *     ⇒ accountsReceivable تبقى 0 بحق (لا افتراضات مصطنعة).
 *  2) دراسة B2B بتحصيل آجل 60 يوماً ⇒ accountsReceivable في الميزانية العمومية
 *     تطابق تحليلياً إيراد كل سنة الفعلي × DSO/365، والميزانية تبقى متوازنة.
 *
 * ⚠️ تحديث سلوك منتج متعمَّد (2026-08-24) — لا إصلاح خلل: بعد إدخال cashCycleByYear
 * (ΔNWC سنوي، قرار مالك المنتج) صار المحرك يحسب دورة نقدية فعلية لكل سنة إسقاط بدل
 * تجميد رقم السنة الأولى عبر كل الأفق. التوكيد الثاني أدناه كان يفترض accountsReceivable
 * ثابتة بنفس القيمة عبر السنوات الخمس رغم growthRate:0.05 في الـfixture — هذا الافتراض
 * لم يعد صحيحاً بعد هذا التغيير المتعمَّد: AR تكبر الآن مع نمو الإيراد الفعلي 5% سنوياً
 * (rev(year) = rev1 × (1.05)^(year-1))، تماماً كما تتطلب تجارة B2B حقيقية. أُعيدت كتابة
 * التوكيد ليحسب القيمة الصحيحة تحليلياً لكل سنة من نفس بيانات الـfixture ويتحقق منها،
 * بدل افتراض الثبات القديم.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('balanceSheet — accountsReceivable من الدورة النقدية الفعلية (لا صفر ثابت)', () => {
    it('بلا سياسة DSO ⇒ لا cashCycle ⇒ accountsReceivable تبقى 0 (لا تغيير قسري)', () => {
        const r = calculateStudy(makeStudy());
        expect(r.cashCycle).toBeNull();
        expect(r.balanceSheets.length).toBeGreaterThan(0);
        r.balanceSheets.forEach(bs => {
            expect(bs.assets.current.accountsReceivable).toBe(0);
        });
    });

    it('B2B بتحصيل آجل 60 يوماً ⇒ accountsReceivable لكل سنة = إيراد تلك السنة الفعلي × DSO/365 (ينمو مع growthRate 5%)، والميزانية متوازنة', () => {
        const r = calculateStudy(makeStudy({
            assumptions: {
                projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0,
                workingCapitalPolicy: { dsoDays: 60, dpoDays: 30, dioDays: 15 }
            }
        }));

        expect(r.cashCycle).toBeTruthy();
        expect(r.cashCycle.receivables).toBeGreaterThan(0);
        expect(r.balanceSheets.length).toBe(5);

        // إيراد سنة الأساس الخام من الـfixture (لا نمو، لا مضاعِفات): 3000 عميل/شهر × 12 ×
        // 22 ريال = 792000. المصدر التشغيلي الوحيد وحيد أيضاً في هذا الـfixture (لا خدمات
        // مفصَّلة ولا إيراد غير تشغيلي)، فـ«إيراد السنة» في المحرك = هذا الرقم × (1+growth)^(year-1)
        // بلا أي معامل آخر (revMult/priceMult/volumeMult/utilRate/rampFactor كلها 1 هنا).
        const rev1Base = 792000;
        const growthRate = 0.05;
        const dsoDays = 60;

        const accountsReceivableByYear = r.balanceSheets.map(bs => bs.assets.current.accountsReceivable);

        r.balanceSheets.forEach((bs, idx) => {
            const year = idx + 1;
            const expectedRevenue = rev1Base * Math.pow(1 + growthRate, year - 1);
            const expectedAR = Math.round(expectedRevenue * dsoDays / 365);
            expect(bs.assets.current.accountsReceivable, `AR السنة ${year}`).toBe(expectedAR);
            // AR ليست صفراً (العلة الأصلية) وتساهم فعلياً في إجمالي الأصول المتداولة
            expect(bs.assets.current.accountsReceivable).toBeGreaterThan(0);
            // الميزانية تبقى متوازنة رغم إضافة سطر AR صريح (لم تُحتسب مرتين)
            expect(bs.isBalanced, `السنة ${bs.year} غير متوازنة بفرق ${bs.imbalance}`).toBe(true);
        });

        // تأكيد صريح للسلوك الجديد المتعمَّد: AR تنمو فعلياً عاماً بعد عام (لا تبقى مجمَّدة
        // على رقم السنة الأولى كما كان الافتراض القديم في هذا الاختبار).
        for (let i = 1; i < accountsReceivableByYear.length; i++) {
            expect(accountsReceivableByYear[i]).toBeGreaterThan(accountsReceivableByYear[i - 1]);
        }
    });
});
