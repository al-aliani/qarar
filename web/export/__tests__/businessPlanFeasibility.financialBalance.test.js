/**
 * @vitest-environment jsdom
 *
 * مسح 2026-08-26 (P0): سطر «الملخص المالي» في الصفحة الأولى من «ملخص خطة عمل»
 * كان يقرأ year1.totalVariableCosts — وهو اسم متغيّر محلي داخل engine.js لا مفتاح
 * في صف قائمة الدخل (المفتاح الفعلي variableCosts) ⟶ undefined ⟶ 0 صامتاً.
 * فيستلم العميل ثلاثة أرقام مطبوعة متجاورة لا تتوازن: إيراد − تكلفة ≠ صافي،
 * والفجوة = كل التكاليف المتغيرة (+ الفوائد والزكاة والضريبة المُسقَطة أصلاً).
 *
 * هذا الاختبار يثبّت «المعادلة» لا القيمة: أياً كانت الدراسة، الأرقام الثلاثة
 * المطبوعة يجب أن تتوازن، لأن التكلفة تُشتقّ من الإيراد والصافي بحكم البناء.
 */
import { describe, it, expect } from 'vitest';
import { BusinessPlanFeasibilityExporter } from '../BusinessPlanFeasibilityExporter.js';
import { createEmptyStudy, SECTIONS } from '../../js/core/schema.js';
import { calculateStudy } from '../../js/core/engine.js';

/**
 * أرقام «ar-SA» تُطبع بأرقام هندية وفواصل خاصة ولاحقة «ر.س.» — نعيدها إلى Number.
 * formatCurrency هنا بلا كسور (maximumFractionDigits: 0) فنُسقط كل ما ليس رقماً أو سالباً.
 */
function parseArabicNumber(text) {
    const digits = String(text)
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
        .replace(/[^0-9-]/g, '');
    return Number(digits);
}

/** يلتقط الأرقام الثلاثة من سطر الملخص المالي المطبوع كما يقرؤه العميل. */
function readPrintedFinancialLine(html) {
    const match = html.match(/إيراد متوقع:\s*([^—]+)—\s*[^:]+:\s*([^—]+)—\s*صافي:\s*([^<.]+)/);
    if (!match) throw new Error('لم يُعثر على سطر الملخص المالي في المخرَج');
    return {
        revenue: parseArabicNumber(match[1]),
        cost: parseArabicNumber(match[2]),
        net: parseArabicNumber(match[3])
    };
}

/** مصنع تمور: إيراد 2,400,000 — تكاليف متغيرة 30% — معدات 660,000 (إهلاك 132,000/سنة). */
function dateFactoryStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مصنع تمور اختبار', concept: 'تعبئة وتغليف تمور' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 660000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'عامل إنتاج', count: 4, salary: 4500, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 10000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1000, avgPrice: 200, variableCostRate: 0.3, growthRate: 0.05 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 900000, percentage: 100 } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

/** مخبز مموَّل بقرض: يضيف فوائد وسداد أصل — بنود يُسقطها أي جمع يدوي للبنود. */
function loanFinancedStudy() {
    const data = dateFactoryStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], name: 'مخبز اختبار بقرض' };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 400000, percentage: 44 },
            bankLoan: { amount: 500000, percentage: 56, interestRate: 0.08, termYears: 5 }
        }
    };
    return data;
}

function storeFor(state) {
    return { getState: () => state };
}

describe('BusinessPlanFeasibilityExporter — سطر الملخص المالي يتوازن حسابياً', () => {
    it('مصنع تمور: إيراد − تكلفة = صافي في الأرقام المطبوعة فعلياً', () => {
        const state = dateFactoryStudy();
        const results = calculateStudy(state);
        const year1 = results.incomeStatement[0];

        // شروط السيناريو: تكاليف متغيرة حقيقية موجودة في نتيجة المحرك
        expect(year1.revenue).toBeGreaterThan(0);
        expect(year1.variableCosts).toBeGreaterThan(0);
        expect(year1.totalVariableCosts).toBeUndefined(); // المفتاح الذي كان يُقرأ لا وجود له

        const html = BusinessPlanFeasibilityExporter.generateHTML(storeFor(state));
        const printed = readPrintedFinancialLine(html);

        // الأرقام المطبوعة تطابق المحرك
        expect(printed.revenue).toBe(Math.round(year1.revenue));
        expect(printed.net).toBe(Math.round(year1.netIncome));

        // المعادلة — هي جوهر البلاغ: القارئ يطرح فيجب أن يصل إلى الصافي
        expect(Math.abs(printed.revenue - printed.cost - printed.net)).toBeLessThanOrEqual(1);

        // ولا تُسقط التكاليف المتغيرة: التكلفة المطبوعة تغطيها كلها
        expect(printed.cost).toBeGreaterThanOrEqual(Math.round(year1.variableCosts));
    });

    it('مخبز بقرض 500,000: الفوائد والزكاة لا تكسر التوازن أيضاً', () => {
        const state = loanFinancedStudy();
        const results = calculateStudy(state);
        const year1 = results.incomeStatement[0];
        expect(year1.interest).toBeGreaterThan(0);

        const html = BusinessPlanFeasibilityExporter.generateHTML(storeFor(state));
        const printed = readPrintedFinancialLine(html);

        expect(Math.abs(printed.revenue - printed.cost - printed.net)).toBeLessThanOrEqual(1);
        expect(printed.cost).toBeGreaterThanOrEqual(Math.round(year1.variableCosts + year1.fixedCosts));
    });

    it('دراسة خاسرة: التكلفة تتجاوز الإيراد والمعادلة تبقى صحيحة', () => {
        const state = dateFactoryStudy();
        state[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 100, avgPrice: 50, variableCostRate: 0.3, growthRate: 0 }] };
        const results = calculateStudy(state);
        const year1 = results.incomeStatement[0];
        expect(year1.netIncome).toBeLessThan(0);

        const html = BusinessPlanFeasibilityExporter.generateHTML(storeFor(state));
        const printed = readPrintedFinancialLine(html);

        expect(printed.cost).toBeGreaterThan(printed.revenue);
        expect(Math.abs(printed.revenue - printed.cost - printed.net)).toBeLessThanOrEqual(1);
    });
});
