/**
 * `opex.fixedAnnual` = المصدر الواحد (قائمة الدخل) — لا مسار حساب موازٍ.
 *
 * العيب (2026-08-25): `opex.fixedAnnual` كان يُحسب من `totalFixedOpexYear1` — مجموع
 * البنود الخام قبل «الطوارئ التشغيلية المخفية» (hiddenOverheadsRate) وقبل مضاعِف
 * fixedMult — بينما قائمة الدخل تشحن `baseFixed × (1 + hiddenOverheadsRate)`. وبما أن
 * الافتراض **الإنتاجي** في `createEmptyStudy()` هو 5 (schema.js: `hiddenOverheadsRate: 5`)
 * كانت كل دراسة تعرض رقماً ثابتاً مُبخَّساً 5% يناقض قائمة الدخل لنفس السنة، ويصل
 * المستخدم في بطاقة «التكاليف الثابتة التشغيلية» وفي المصدّرات، ويُغذّي `monthlyFixed`
 * في اختبار التحمل فيُبالغ في «أشهر البقاء».
 *
 * لماذا لم تلتقطه المجموعة: **كل** فيكستشرات المستودع تثبّت `hiddenOverheadsRate: 0` —
 * عمى ممنهج عن الافتراض الإنتاجي. لذلك تبدأ كل حالة هنا من `createEmptyStudy()` الحقيقي
 * بافتراضه الإنتاجي، ولا تُصفَّر النسبة إلا في الحالة المضادة الصريحة.
 *
 * اختباران متعاكسان عمداً:
 *  - المُصلَح: بالنسبة الإنتاجية (5) الرقم المُصدَّر يطابق قائمة الدخل ويزيد على المجموع
 *    الخام بمقدار الطوارئ بالضبط.
 *  - العكس: بنسبة 0 يطابق قائمة الدخل أيضاً **بلا أي زيادة** — كي لا يمرّ إصلاح كسول
 *    يضرب في 1.05 ضرباً أعمى بدل القراءة من المصدر الواحد. وبنسبة 25 يتبع النسبة فعلياً.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { createEmptyStudy, SECTIONS } from '../schema.js';

// دراسة مقهى مبنية فوق createEmptyStudy() — الافتراضات المركزية تبقى كما يراها المستخدم
// الحقيقي (hiddenOverheadsRate = 5)، ولا يُلمس منها إلا ما تحتاجه هذه الحالة.
function makeCafeOnProductionDefaults() {
    const s = createEmptyStudy();
    s[SECTIONS.PROJECT_INFO] = { ...s[SECTIONS.PROJECT_INFO], name: 'كافيه', sector: 'مقهى', businessModel: 'Independent' };
    s.assumptions.projectionYears = 5;
    s.assumptions.discountRate = 0.10;
    s.assumptions.inflationRate = 0.02;
    s[SECTIONS.TECHNICAL] = {
        ...s[SECTIONS.TECHNICAL],
        equipment: [{ name: 'معدات', price: 400000, quantity: 1 }],
        buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
    };
    s[SECTIONS.HR] = {
        ...s[SECTIONS.HR],
        positions: [
            { position: 'مدير', count: 1, salary: 15000, months: 12, nationality: 'saudi' },
            { position: 'باريستا', count: 6, salary: 4500, months: 12, nationality: 'expat' }
        ]
    };
    s[SECTIONS.ADMINISTRATIVE] = { ...s[SECTIONS.ADMINISTRATIVE], administrative: [{ name: 'إيجار', monthly: 20000 }] };
    s[SECTIONS.MARKETING] = { ...s[SECTIONS.MARKETING], campaigns: [{ name: 'سوشال', monthly: 8000 }] };
    s[SECTIONS.REVENUE] = {
        ...s[SECTIONS.REVENUE],
        streams: [{ service: 'مشروبات', type: 'operating', customersPerMonth: 5000, avgPrice: 24, variableCostRate: 0.34, growthRate: 0.05 }]
    };
    return s;
}

describe('opex.fixedAnnual مشتق من قائمة الدخل لا من مسار موازٍ', () => {
    it('بالافتراض الإنتاجي (hiddenOverheadsRate = 5 من createEmptyStudy): fixedAnnual == incomeStatement[0].fixedCosts، ويشمل الطوارئ المخفية فعلاً', () => {
        const study = makeCafeOnProductionDefaults();
        // حارس على الافتراض نفسه: إن تغيّر الافتراض الإنتاجي يوماً يجب أن يفشل هنا صراحةً
        // بدل أن يصمت هذا الاختبار ويعود العمى الممنهج.
        expect(study.assumptions.hiddenOverheadsRate).toBe(5);

        const r = calculateStudy(study);
        const y1 = r.incomeStatement[0];

        expect(r.opex.fixedAnnual).toBeCloseTo(y1.fixedCosts, 6);

        // الطوارئ المخفية موجودة فعلاً وليست صفراً — وإلا كانت المطابقة أعلاه بلا معنى
        const hidden = y1.fixedCostsBreakdown.hiddenOverheads;
        expect(hidden).toBeGreaterThan(0);
        const baseFixed = y1.fixedCosts - hidden;
        expect(hidden).toBeCloseTo(baseFixed * 0.05, 6);
        // الرقم المُصدَّر أعلى من الأساس الخام بمقدار الطوارئ بالضبط (العيب كان يُصدِّر الأساس)
        expect(r.opex.fixedAnnual - baseFixed).toBeCloseTo(hidden, 6);

        // المستهلكون الآخرون (بطاقة لوحة التحكم، sectionExporter، excelExporter، monteCarloEnhanced)
        // يقرؤون totalAnnual أيضاً — يجب أن يبقى متسقاً مع نفس السنة من قائمة الدخل.
        expect(r.opex.variableAnnual).toBeCloseTo(y1.variableCosts, 6);
        expect(r.opex.totalAnnual).toBeCloseTo(y1.fixedCosts + y1.variableCosts, 6);
    });

    it('الحالة المعاكسة — hiddenOverheadsRate = 0: fixedAnnual == fixedCosts أيضاً وبلا أي زيادة (لا ضرب أعمى في 1.05)', () => {
        const study = makeCafeOnProductionDefaults();
        study.assumptions.hiddenOverheadsRate = 0;

        const r = calculateStudy(study);
        const y1 = r.incomeStatement[0];

        expect(y1.fixedCostsBreakdown.hiddenOverheads).toBe(0);
        expect(r.opex.fixedAnnual).toBeCloseTo(y1.fixedCosts, 6);
        // ولا زيادة مصطنعة: يساوي مجموع مكوّنات الثابتة الخام بالضبط
        const b = y1.fixedCostsBreakdown;
        expect(r.opex.fixedAnnual).toBeCloseTo(b.payroll + b.rentAndAdmin + b.marketing + b.servicesFixed, 6);
    });

    it('الرقم يتبع النسبة فعلياً — 25% تُنتج فجوة خمسة أضعاف فجوة 5% على نفس الدراسة', () => {
        const at = (rate) => {
            const s = makeCafeOnProductionDefaults();
            s.assumptions.hiddenOverheadsRate = rate;
            const r = calculateStudy(s);
            return { fixedAnnual: r.opex.fixedAnnual, y1Fixed: r.incomeStatement[0].fixedCosts };
        };
        const zero = at(0);
        const five = at(5);
        const twentyFive = at(25);

        [zero, five, twentyFive].forEach(x => expect(x.fixedAnnual).toBeCloseTo(x.y1Fixed, 6));
        expect(five.fixedAnnual - zero.fixedAnnual).toBeCloseTo(zero.fixedAnnual * 0.05, 6);
        expect(twentyFive.fixedAnnual - zero.fixedAnnual).toBeCloseTo(zero.fixedAnnual * 0.25, 6);
    });
});
