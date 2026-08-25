/**
 * تصحيح 2026-08-25: نقطة التعادل بالريال كانت تناقض نقطة التعادل بالوحدات في نفس النتيجة.
 *
 * الجذر: cmRatio كان = (الإيراد الكلي − التكاليف المتغيرة) ÷ الإيراد **الكلي** (تشغيلي +
 * غير تشغيلي)، بينما هامش المساهمة للوحدة يُحسب من الإيراد التشغيلي وتكاليفه وحدها.
 * كل ريال إيراد غير تشغيلي كان ينفخ cmRatio (لأن مقامه يكبر بلا تكلفة متغيرة مقابلة)
 * فيصغّر breakEvenPointValue = ثوابت ÷ cmRatio — تعادل يبدو أقرب مما هو فعلاً، وهو
 * الاتجاه المُطَمئِن زوراً للمستخدم والممول. ونفس الكسر كان يُنشر كـ indicators.grossMargin
 * (99% لمشروع هامشه التشغيلي 65%).
 *
 * الإصلاح: cmRatio وgrossMargin وcontributionMarginPerUnit من نفس البسط التشغيلي
 * (operatingRevenue − variableCosts)، والإيراد غير التشغيلي يُخصم من التكاليف الثابتة
 * في بسط التعادل — على المسارين معاً (بالريال وبالوحدات).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

const PRICE = 100;
const CUSTOMERS_PER_MONTH = 300;
const VC_RATE = 0.35;

// اشتقاق تحليلي لكل الأرقام المتوقعة أدناه (كلها من مدخلات هذه الدراسة وحدها):
//   الإيراد التشغيلي (سنة 1) = 300 × 12 × 100                          = 360,000
//   الوحدات التشغيلية (سنة 1) = 300 × 12                               =   3,600
//   التكاليف المتغيرة        = 360,000 × 0.35                          = 126,000
//   هامش المساهمة            = 360,000 − 126,000                       = 234,000
//   ⇒ نسبة هامش المساهمة = 234,000 ÷ 360,000 = 0.65، وللوحدة = 234,000 ÷ 3,600 = 65
//   التكاليف الثابتة (إداري) = 8,000 × 12                              =  96,000
//   الإهلاك (سنة 1) = 100,000 × 1.10 (طوارئ) × 15% (معدات)             =  16,500
//   ⇒ ثوابت التعادل = 96,000 + 16,500                                  = 112,500
// (معدل التضخم = 0 ومضاعِفات السيناريو = 1 في الحالة الأساسية، فلا شيء يزيح هذه الأرقام)
const OPERATING_REVENUE = CUSTOMERS_PER_MONTH * 12 * PRICE;   // 360,000
const OPERATING_UNITS = CUSTOMERS_PER_MONTH * 12;             // 3,600
const CM_RATIO = 1 - VC_RATE;                                 // 0.65
const CM_PER_UNIT = (OPERATING_REVENUE * CM_RATIO) / OPERATING_UNITS; // 65
const FIXED_FOR_BE = 96000 + 16500;                           // 112,500

function makeStudy(nonOperatingAnnual = 0) {
    const streams = [
        { type: 'operating', customersPerMonth: CUSTOMERS_PER_MONTH, avgPrice: PRICE, variableCostRate: VC_RATE, growthRate: 0 }
    ];
    if (nonOperatingAnnual > 0) {
        // مصدر غير تشغيلي (إيجار عقار/دعم…): بلا تكلفة متغيرة وبلا وحدات تشغيلية بحكم بناء
        // buildRevenueModel (vc1 = 0 لغير التشغيلي، وunits1 لا تدخل مجموع الوحدات التشغيلية).
        streams.push({ type: 'non-operating', customersPerMonth: 1, avgPrice: nonOperatingAnnual / 12, growthRate: 0 });
    }
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 100000, quantity: 1 }],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 8000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('المحرك — نقطة التعادل مع إيراد غير تشغيلي', () => {
    it('الأساس التحليلي مطابق لمخرجات المحرك (يوثّق مصدر كل رقم متوقَّع أدناه)', () => {
        const y1 = calculateStudy(makeStudy(0)).incomeStatement[0];
        expect(y1.operatingRevenue).toBeCloseTo(OPERATING_REVENUE, 6);
        expect(y1.operatingUnits).toBeCloseTo(OPERATING_UNITS, 6);
        expect(y1.variableCosts).toBeCloseTo(OPERATING_REVENUE * VC_RATE, 6);
        expect(y1.fixedCosts + y1.depreciation).toBeCloseTo(FIXED_FOR_BE, 6);
    });

    it('بلا إيراد غير تشغيلي: المساران متطابقان والهامش الإجمالي = الهامش التشغيلي', () => {
        const i = calculateStudy(makeStudy(0)).indicators;
        // 112,500 ÷ 0.65 = 173,076.92 ريال ⟵ 112,500 ÷ 65 = 1,730.77 وحدة ⟹ ceil = 1,731
        expect(i.breakEvenPointValue).toBeCloseTo(FIXED_FOR_BE / CM_RATIO, 6);
        expect(i.breakEvenUnits).toBe(Math.ceil(FIXED_FOR_BE / CM_PER_UNIT));
        // الوحدات تُقرَّب لأعلى (لا يتعادل مشروع بجزء وحدة)، فحاصل الضرب لا يقلّ أبداً عن
        // قيمة الريال ولا يتجاوزها بأكثر من سعر وحدة واحدة — انظر engine.breakEvenUnitsRounding.
        const diff = i.breakEvenUnits * PRICE - i.breakEvenPointValue;
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThan(PRICE);
        expect(i.grossMargin).toBeCloseTo(CM_RATIO, 10);
        expect(i.breakEvenReason).toBeNull();
        expect(i.breakEvenAchievable).toBe(true);
    });

    it('مع إيراد غير تشغيلي كبير: المساران يبقيان متطابقين، والإيراد غير التشغيلي يُخصم من الثوابت', () => {
        const NON_OP = 50000;
        const i = calculateStudy(makeStudy(NON_OP)).indicators;
        // بسط التعادل = 112,500 − 50,000 = 62,500 ⇒ 62,500 ÷ 0.65 = 96,153.85 ريال
        //                                          ⇒ 62,500 ÷ 65   = 961.54 وحدة
        const numerator = FIXED_FOR_BE - NON_OP;
        expect(i.breakEvenPointValue).toBeCloseTo(numerator / CM_RATIO, 6);
        expect(i.breakEvenUnits).toBe(Math.ceil(numerator / CM_PER_UNIT)); // ceil(961.54) = 962
        const diff = i.breakEvenUnits * PRICE - i.breakEvenPointValue;
        expect(diff).toBeGreaterThanOrEqual(0);
        expect(diff).toBeLessThan(PRICE);
        // الانحدار الأساسي: الهامش الإجمالي هو الهامش التشغيلي الحقيقي 65%، لا الكسر المنفوخ
        // بالإيراد غير التشغيلي (410,000 − 126,000) ÷ 410,000 = 0.6927 الذي كان يُنشر سابقاً.
        expect(i.grossMargin).toBeCloseTo(CM_RATIO, 10);
        expect(i.grossMargin).not.toBeCloseTo((OPERATING_REVENUE + NON_OP - OPERATING_REVENUE * VC_RATE) / (OPERATING_REVENUE + NON_OP), 4);
        expect(i.breakEvenReason).toBeNull();
    });

    it('إيراد غير تشغيلي ضخم (74% من الإيراد): grossMargin يبقى 65% لا 91%', () => {
        // نفس القياس المُبلَّغ: تشغيلي 360,000 بهامش 65% + غير تشغيلي 1,000,000.
        const i = calculateStudy(makeStudy(1000000)).indicators;
        expect(i.grossMargin).toBeCloseTo(CM_RATIO, 10);
        // (1,360,000 − 126,000) ÷ 1,360,000 = 0.9074 — الكسر الخاطئ السابق
        expect(i.grossMargin).toBeLessThan(0.9);
    });

    it('إيراد غير تشغيلي يفوق كل الثوابت: تعادل محقق أصلاً (صفر + سبب صريح، لا رقم مضلِّل)', () => {
        const i = calculateStudy(makeStudy(200000)).indicators; // 200,000 > 112,500
        expect(i.breakEvenPointValue).toBe(0);
        expect(i.breakEvenUnits).toBe(0);
        expect(i.breakEvenReason).toBe('covered_by_non_operating');
        // ليس «تعادلاً مستحيلاً»: هامش المساهمة موجب — العلَمان يميّزان الحالتين
        expect(i.breakEvenAchievable).toBe(true);
    });

    it('هامش مساهمة سالب مع ثوابت غير مغطاة: السبب no_contribution_margin (لا يختلط بحالة التغطية)', () => {
        const study = makeStudy(0);
        // 0.90 + 0.30 = 1.20 من الإيراد (نسبة > 1 في حقل واحد تُفسَّر كنسبة مئوية خام
        // فتُقسم على 100 — انظر revenue.js — لذا نوزّعها على حقلين كسريين)
        study[SECTIONS.REVENUE].streams[0].variableCostRate = 0.9;
        study[SECTIONS.REVENUE].streams[0].wasteRate = 0.3;
        const i = calculateStudy(study).indicators;
        expect(i.breakEvenPointValue).toBe(0);
        expect(i.breakEvenAchievable).toBe(false);
        expect(i.breakEvenReason).toBe('no_contribution_margin');
    });
});

/**
 * تصحيح 2026-08-25 (ترتيب الفحص): `cmRatio <= 0` كان يُفحص **قبل** حالة التغطية الكاملة
 * بالإيراد غير التشغيلي. مشروع كل إيراده غير تشغيلي (تأجير عقار مثلاً) يغطي كل ثوابته
 * كان يُصنَّف 'no_contribution_margin' وbreakEvenAchievable=false — أي «يخسر على كل وحدة
 * ولا يمكنه التعادل أبداً» عن مشروع رابح لا يبيع وحدات أصلاً: وصف معكوس تماماً.
 *
 * قياس الانقطاع الذي كشف العيب: إضافة **12 ريالاً** من إيراد تشغيلي سنوي (بلا أي أثر
 * اقتصادي) كانت تقلب breakEvenAchievable من false إلى true وbreakEvenReason من
 * 'no_contribution_margin' إلى 'covered_by_non_operating' — وهو بالضبط ما يثبت أن
 * التصنيف كان يتبع ترتيب الشرطين لا واقع المشروع.
 */
function makeNonOperatingOnlyStudy(nonOperatingAnnual, operatingUnitPrice = 0) {
    const study = makeStudy(nonOperatingAnnual);
    study[SECTIONS.REVENUE].streams = study[SECTIONS.REVENUE].streams.filter(s => s.type === 'non-operating');
    if (operatingUnitPrice > 0) {
        // إيراد تشغيلي رمزي: 1 عميل/شهر × 12 شهراً × السعر
        study[SECTIONS.REVENUE].streams.push({ type: 'operating', customersPerMonth: 1, avgPrice: operatingUnitPrice, variableCostRate: VC_RATE, growthRate: 0 });
    }
    return study;
}

describe('المحرك — تصنيف مشروع بلا إيراد تشغيلي (ترتيب فحص التعادل)', () => {
    it('صفر إيراد تشغيلي والثوابت مغطاة بالكامل: التعادل محقق، لا «يخسر على كل وحدة»', () => {
        // غير تشغيلي 200,000 > ثوابت التعادل 112,500 (96,000 إيجار + 16,500 إهلاك)
        const i = calculateStudy(makeNonOperatingOnlyStudy(200000)).indicators;
        expect(i.breakEvenReason).toBe('covered_by_non_operating');
        expect(i.breakEvenAchievable).toBe(true);   // كان false — الانحدار الأساسي
        expect(i.breakEvenPointValue).toBe(0);
        expect(i.breakEvenUnits).toBe(0);
    });

    it('قياس الانقطاع: 12 ريالاً من إيراد تشغيلي لا تغيّر التصنيف (كانت تقلبه كلياً)', () => {
        const without = calculateStudy(makeNonOperatingOnlyStudy(200000)).indicators;
        const withTwelve = calculateStudy(makeNonOperatingOnlyStudy(200000, 1)).indicators; // 1 × 12 = 12 ريالاً
        expect(withTwelve.breakEvenReason).toBe(without.breakEvenReason);
        expect(withTwelve.breakEvenAchievable).toBe(without.breakEvenAchievable);
        expect(withTwelve.breakEvenPointValue).toBe(without.breakEvenPointValue);
    });

    it('صفر إيراد تشغيلي والثوابت غير مغطاة: التعادل غير قابل للتحقيق فعلاً (لا انقلاب)', () => {
        // غير تشغيلي 50,000 < 112,500 ⟹ لا يمكن سدّ الفجوة بلا مبيعات ذات هامش
        const i = calculateStudy(makeNonOperatingOnlyStudy(50000)).indicators;
        expect(i.breakEvenAchievable).toBe(false);
        expect(i.breakEvenReason).toBe('no_contribution_margin');
        expect(i.breakEvenPointValue).toBe(0);
    });

    it('grossMargin = null (لا صفر) عند غياب الإيراد التشغيلي — 0÷0 غير معرَّف', () => {
        // «هامش إجمالي 0%» ادّعاء موضوعي كاذب («يبيع بالتكلفة») عن مشروع لا يبيع شيئاً؛
        // null = غير منطبق، على نفس نهج payback/dscr/irr في هذا المحرك.
        expect(calculateStudy(makeNonOperatingOnlyStudy(200000)).indicators.grossMargin).toBeNull();
        expect(calculateStudy(makeNonOperatingOnlyStudy(50000)).indicators.grossMargin).toBeNull();
        // وبمجرد وجود إيراد تشغيلي يعود رقماً حقيقياً (الهامش التشغيلي 65%)
        expect(calculateStudy(makeNonOperatingOnlyStudy(200000, 1)).indicators.grossMargin).toBeCloseTo(CM_RATIO, 10);
    });
});

describe('توثيق: تعليق grossMargin يذكر الرقم المقيس فعلياً', () => {
    it('لا يدّعي 99% — القياس المذكور (1,360,000 − 126,000) ÷ 1,360,000 = 0.9074 ≈ 91%', () => {
        const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'engine.js'), 'utf8');
        const block = src.slice(src.indexOf('// هامش إجمالي تشغيلي'), src.indexOf('grossMargin: year1OperatingRevenue'));
        expect(block).not.toContain('99%');
        expect(block).toContain('91%');
    });
});
