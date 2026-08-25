/**
 * مسارات موازية كانت تحمل عيوب المحرك المُصحَّحة في 2026-08-25 وهي — لا المحرك — ما يراه
 * المستخدم على الشاشة:
 *
 * (1) BenchmarkingView: الشاشة الوحيدة التي تعرض «مجمل الربح %» مقابل نطاق القطاع كانت
 *     تحسبه محلياً = grossProfit ÷ الإيراد الكلي (شامل غير التشغيلي)، بينما
 *     indicators.grossMargin المُصحَّح في المحرك لا يقرأه شيء ⟶ 91% معروضة لمشروع هامشه 65%.
 * (2) ServiceAnalysis: فترة استرداد كل خدمة عبر calculatePaybackPeriod (المسار الموازي).
 * (3) `|| 0.10` يبتلع معدل خصم صفر الصريح في ثلاث شاشات حيّة بينما المحرك يحترمه
 *     (rateOrDefault) ⟶ قيمتا NPV مختلفتان لدراسة واحدة.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS } from '../../core/schema.js';
import { renderBenchmarkingSection } from '../BenchmarkingView.js';
import { ServiceAnalysis } from '../ServiceAnalysis.js';
import { ValuationAnalysis } from '../ValuationAnalysis.js';
import { InvestorAnalysis } from '../InvestorAnalysis.js';

const PRICE = 100;
const CUSTOMERS_PER_MONTH = 300;
const VC_RATE = 0.35;              // ⟶ الهامش التشغيلي الحقيقي = 65%
const NON_OPERATING_ANNUAL = 1000000;

/** نفس بناء دراسة engine.breakEvenNonOperating.test.js: تشغيلي 360,000 + غير تشغيلي ضخم. */
function makeStudy(nonOperatingAnnual = 0) {
    const streams = [
        { type: 'operating', customersPerMonth: CUSTOMERS_PER_MONTH, avgPrice: PRICE, variableCostRate: VC_RATE, growthRate: 0 }
    ];
    if (nonOperatingAnnual > 0) {
        streams.push({ type: 'non-operating', customersPerMonth: 1, avgPrice: nonOperatingAnnual / 12, growthRate: 0 });
    }
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent', concept: 'مطعم شعبي' },
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

/** القيمة المعروضة في صف «مجمل الربح» من جدول Benchmarking. */
function shownGrossMargin(html) {
    const m = html.match(/مجمل الربح \(Gross Margin %\)<\/td>\s*<td class="text-mono">([\d.]+)%/);
    return m ? Number(m[1]) : null;
}

describe('(1) BenchmarkingView — «مجمل الربح» المعروض = هامش المحرك لا حساباً محلياً', () => {
    const studyData = { projectInfo: { concept: 'مطعم شعبي' } };

    it('إيراد غير تشغيلي ضخم: الشاشة تعرض 65.0% (هامش المحرك) لا ~90.7% (الحساب المحلي القديم)', () => {
        const results = calculateStudy(makeStudy(NON_OPERATING_ANNUAL));
        const y1 = results.incomeStatement[0];

        // شرط السيناريو: المصدران يتباعدان فعلاً، وإلا فالاختبار بلا معنى.
        const localOld = (y1.grossProfit / y1.revenue) * 100;
        expect(results.indicators.grossMargin * 100).toBeCloseTo(65, 6);
        expect(localOld).toBeGreaterThan(85);

        const html = renderBenchmarkingSection(results, studyData);
        expect(shownGrossMargin(html)).toBeCloseTo(65.0, 6);
        expect(shownGrossMargin(html)).not.toBeCloseTo(localOld, 1);

        // ونطاق قطاع المطاعم [65-72]: الرقم الصحيح داخل النطاق، والقديم كان يُعلَن «خارج النطاق»
        expect(html).toContain('ضمن النطاق');
    });

    it('بلا إيراد غير تشغيلي: المصدران متطابقان (لا انحدار في الحالة الشائعة)', () => {
        const results = calculateStudy(makeStudy(0));
        const y1 = results.incomeStatement[0];
        const html = renderBenchmarkingSection(results, studyData);
        expect(shownGrossMargin(html)).toBeCloseTo((y1.grossProfit / y1.revenue) * 100, 6);
        expect(shownGrossMargin(html)).toBeCloseTo(65.0, 6);
    });

    it('نتيجة مُخزَّنة قديمة بلا حقل grossMargin: الاحتياطي المحلي يعمل (لا صف مفقود ولا NaN)', () => {
        const results = calculateStudy(makeStudy(0));
        const legacy = { ...results, indicators: { ...results.indicators } };
        delete legacy.indicators.grossMargin;
        const y1 = legacy.incomeStatement[0];

        const html = renderBenchmarkingSection(legacy, studyData);
        expect(shownGrossMargin(html)).toBeCloseTo((y1.grossProfit / y1.revenue) * 100, 6);
    });
});

describe('(2) ServiceAnalysis — فترة استرداد الخدمة تحترم الانتكاس', () => {
    const view = Object.create(ServiceAnalysis.prototype);
    // خدمة تربح في سنتها الأولى فتعبر الصفر، ثم ينهار طلبها (نمو −90%) فتعود سالبة للأبد.
    const service = {
        name: 'خدمة موسمية', capex: 10000, fixedCosts: 5000,
        variableCostPerUnit: 40, pricePerUnit: 100, customersPerMonth: 100, growthRate: -0.9
    };
    const assumptions = { projectionYears: 5, discountRate: 0.10, foreignOwnershipRate: 0 };

    it('عبور مبكر ثم انتكاس: paybackPeriod = null وتُعرض «غير محسوب» لا رقم مطمئن', () => {
        const a = view.analyzeService(service, assumptions);
        const cum = a.cashFlows.map(cf => cf.cashFlow).reduce((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);

        // شرط السيناريو: يعبر فعلاً في السنة الأولى ثم ينتهي الأفق سالباً.
        expect(cum[0]).toBeLessThan(0);
        expect(cum[1]).toBeGreaterThan(0);
        expect(cum.at(-1)).toBeLessThan(0);

        expect(a.paybackPeriod).toBeNull();
        expect(view.formatPayback(a.paybackPeriod)).toBe('غير محسوب');
    });

    it('خدمة رابحة مستقرة: رقم استرداد صحيح كما كان', () => {
        const a = view.analyzeService({ ...service, growthRate: 0 }, assumptions);
        expect(Number.isFinite(a.paybackPeriod)).toBe(true);
        expect(a.paybackPeriod).toBeGreaterThan(0);
    });
});

describe('(3) معدل خصم 0 الصريح يُحترم في الشاشات الثلاث (كما في المحرك)', () => {
    it('ServiceAnalysis: NPV بمعدل 0 = مجموع التدفقات، ويختلف عن NPV بـ10%', () => {
        const view = Object.create(ServiceAnalysis.prototype);
        const service = {
            name: 'خدمة', capex: 100000, fixedCosts: 0,
            variableCostPerUnit: 40, pricePerUnit: 100, customersPerMonth: 100, growthRate: 0
        };
        const base = { projectionYears: 3, foreignOwnershipRate: 0 };

        const zero = view.analyzeService(service, { ...base, discountRate: 0 });
        const ten = view.analyzeService(service, { ...base, discountRate: 0.10 });

        const undiscounted = zero.cashFlows.reduce((acc, cf) => acc + cf.cashFlow, 0);
        expect(zero.npv).toBeCloseTo(undiscounted, 6);
        expect(zero.npv).not.toBeCloseTo(ten.npv, 2);
    });

    it('ValuationAnalysis: خصم 0 صريح يُحترم — بسيناريو يستطيع المحرك إنتاجه فعلاً', () => {
        // أُعيدت صياغة هذا الاختبار (2026-08-25): صيغته الأولى كانت تضع
        // assumptionsApplied.discountRate = 0.25 بجوار assumptions.discountRate = 0 —
        // تركيبة لا ينتجها المحرك إلا عبر مسار costOfEquity، وهو المسار الذي يجب أن
        // يفوز فيه المعدل المطبَّق. فكانت خضراء بلا أن تقيس السلوك الحقيقي.
        // الصيغة الحالية تعكس ما يحدث فعلاً: حين يحترم المحرك الصفر، يُصدّره في
        // assumptionsApplied فتتبعه الشاشة.
        const va = Object.create(ValuationAnalysis.prototype);
        const results = {
            incomeStatement: [{ ebitda: 100000, netIncome: 20000, interest: 5000, depreciation: 10000, replacementCost: 0 }],
            assumptionsApplied: { discountRate: 0, discountRateSource: 'assumptions' }
        };
        const state = {
            projectInfo: { sector: 'مطعم صغير' },
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };

        const zero = va.calculateValuation({ ...state, assumptions: { discountRate: 0 } }, results);
        // baseRate = 0 ⟶ wacc = max(0 + 0.08, 0.18) = 0.18 (أرضية علاوة المنشأة الصغيرة)
        expect(zero.dcf.wacc).toBeCloseTo(0.18, 12);

        // وبلا أي معدل مطبَّق ولا خام (نتيجة قديمة) ⟶ الافتراضي 0.10 ⟶ 0.18 كذلك بحكم
        // الأرضية؛ فالتمييز الحقيقي يظهر عند معدل مرتفع:
        const high = va.calculateValuation(
            { ...state, assumptions: {} },
            { ...results, assumptionsApplied: { discountRate: 0.25 } }
        );
        expect(high.dcf.wacc).toBeCloseTo(0.33, 12);
        expect(zero.dcf.wacc).not.toBeCloseTo(high.dcf.wacc, 6);
    });

    it('InvestorAnalysis: IRR = 5% فوق معدل خصم 0 ⟶ نقاط IRR تُحتسب ولا فجوة', () => {
        const ia = Object.create(InvestorAnalysis.prototype);
        const ctx = {
            npv: 1, irr: 0.05, payback: 2, maxPayback: 3.5, roi: 0.5, minROI: 0.20,
            profitMargin: 0.2, hasMarket: true, hasRisks: true, hasProjectInfo: true
        };

        const zero = ia.calcInvestabilityScore({ ...ctx, discountRate: 0 });
        const ten = ia.calcInvestabilityScore({ ...ctx, discountRate: 0.10 });

        expect(zero.gaps).not.toContain('رفع IRR فوق معدل الخصم');
        expect(ten.gaps).toContain('رفع IRR فوق معدل الخصم');   // 5% < 10% — فجوة حقيقية
        expect(zero.percent - ten.percent).toBe(15);
    });
});

/**
 * الحالات الثلاث التي أفلتت من الدفعة الأولى — كشفها تحقق عدائي، وكلها مقاسة لا مفترَضة.
 * كل واحدة تُغلق ثغرة في *الفحص* نفسه لا في المنطق فقط.
 */
describe('(4) الحالات الحدّية التي أفلتت من فحص الدفعة الأولى', () => {
    it('BenchmarkingView: grossMargin=null (بلا إيراد تشغيلي) لا يسقط للحساب المحلي فيعرض 100%', () => {
        // `typeof null === 'object'` كان يُفشل حارس `typeof === 'number'` فتسقط الشاشة
        // للحساب المحلي grossProfit÷الإيراد الكلي = 100% لمشروع لا يبيع شيئاً (تأجير عقاري).
        const studyData = { projectInfo: { concept: 'مطعم شعبي' } };

        // ترتيب الوسائط (results, studyData) — معكوس عمّا يوحي به الاسم.
        const notApplicable = renderBenchmarkingSection({
            incomeStatement: [{ revenue: 200000, operatingRevenue: 0, grossProfit: 200000, netIncome: 50000 }],
            indicators: { grossMargin: null }
        }, studyData);
        expect(shownGrossMargin(notApplicable)).toBeNull();
        expect(notApplicable).not.toMatch(/مجمل الربح \(Gross Margin %\)<\/td>\s*<td class="text-mono">100\.0%/);

        // وفي المقابل: غياب الحقل كلياً (نتيجة مُخزَّنة قبل التصحيح) يبقى على الاحتياطي المحلي.
        const legacy = renderBenchmarkingSection({
            incomeStatement: [{ revenue: 400000, operatingRevenue: 400000, grossProfit: 260000, netIncome: 50000 }],
            indicators: {}
        }, studyData);
        expect(shownGrossMargin(legacy)).toBeCloseTo(65, 1);
    });

    it('ValuationAnalysis: الأولوية لمعدل المحرك المطبَّق لا لخام الفروض', () => {
        // خانة «استخدام تكلفة حقوق الملكية كمعدل الخصم» تجعل المحرك يتجاهل
        // assumptions.discountRate ويشتق المعدل من costOfEquity — فتقديم الخام كان
        // يُنتج «قيمتان لدراسة واحدة» بالاتجاه المعكوس (المحرك 0.15 والشاشة 0).
        const va = Object.create(ValuationAnalysis.prototype);
        const results = {
            incomeStatement: [{ netProfit: 100000, revenue: 500000 }],
            indicators: { npv: 1, irr: 0.2 },
            assumptionsApplied: { discountRate: 0.15, discountRateSource: 'costOfEquity' }
        };
        const state = {
            projectInfo: { sector: 'مطعم صغير' },
            assumptions: { discountRate: 0 },   // خام: تجاهله المحرك
            financing: { sources: { bankLoan: { amount: 0 } }, totalInvestment: 500000 }
        };

        // المطبَّق 0.15 ⟶ wacc = max(0.23, 0.18) = 0.23، لا 0.18 القادمة من الخام.
        expect(va.calculateValuation(state, results).dcf.wacc).toBeCloseTo(0.23, 12);
    });

    it('ServiceAnalysis: معدل خصم سالب لا يُنتج NPV = Infinity ولا جدوى كاذبة', () => {
        const sa = Object.create(ServiceAnalysis.prototype);
        // أسماء الحقول كما يفكّكها analyzeService بالضبط — pricePerUnit/variableCostPerUnit/
        // customersPerMonth (لا price/variableCost/monthlyCustomers)، وإلا كان الإيراد صفراً
        // و`hasAllocatedInvestment` لا يكفي وحده فيعود npv = null ويمرّ الاختبار كاذباً.
        const service = { name: 'خدمة', pricePerUnit: 100, variableCostPerUnit: 35, customersPerMonth: 300 };
        const base = { projectionYears: 5, foreignOwnershipRate: 0, taxRate: 0.20 };

        // allocated كائن {capex, fixedAnnual} لا رقم — تمريره رقماً يجعل capexEff صفراً
        // فيعود npv = null ويمرّ الاختبار كاذباً بلا أن يقيس شيئاً.
        const alloc = { capex: 200000, fixedAnnual: 0 };
        const negative = sa.analyzeService(service, { ...base, discountRate: -1 }, alloc);
        const negativeHalf = sa.analyzeService(service, { ...base, discountRate: -0.5 }, alloc);
        const fallback = sa.analyzeService(service, { ...base }, alloc);

        expect(Number.isFinite(negative.npv)).toBe(true);
        expect(Number.isFinite(negativeHalf.npv)).toBe(true);
        // السالب يسقط لافتراضي المحرك نفسه (0.10) ⟹ مطابق لحالة الغياب
        expect(negative.npv).toBeCloseTo(fallback.npv, 6);
        expect(negativeHalf.npv).toBeCloseTo(fallback.npv, 6);
        // والصفر يبقى محترَماً (لا يُقصّ) ⟹ مختلف عن 0.10
        const zero = sa.analyzeService(service, { ...base, discountRate: 0 }, alloc);
        expect(zero.npv).not.toBeCloseTo(fallback.npv, 2);
    });
});
