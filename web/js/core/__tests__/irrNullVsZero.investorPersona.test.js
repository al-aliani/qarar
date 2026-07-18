/**
 * اختبار تجربة مستخدم 2026-07-19 (شخصية شريك/مستثمر): كان معدل العائد الداخلي (IRR)
 * وفترة الاسترداد يظهران "--" في كل دراسة (وفي «لوحة الإحصائيات الشاملة» عبر كل
 * الدراسات) رغم NPV موجب وصحي، ما دام جدول الأصول/التجهيزات (CAPEX) فارغاً —
 * لأن calculateIRR كانت تُعيد 0 (لا null) حين لا توجد قيمة سالبة في التدفقات، فيُقرأ
 * هذا الصفر كـ"عائد فعلي فاشل" لا كـ"غير قابل للحساب"، وتظهر توصية REVISE مضلِّلة
 * («معدل العائد الداخلي يجب أن يكون ≥ 15%») رغم أن IRR لم يُحسب أصلاً.
 * الجذر: financing.equity (سؤال رأس المال عند إنشاء الدراسة) حقل ميت لا يقرأه شيء —
 * انظر [[qarar-irr-payback-broken-capex-gap-2026-07-19]] في ذاكرة المشروع.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { calculateIRR } from '../financial/cashflow.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 800, avgPrice: 25, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: { equity: { amount: 150000 }, bankLoan: { amount: 100000, interestRate: 0.08 } } },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('calculateIRR — "لا تدفقات سالبة" يعني غير قابل للحساب (null)، لا عائد صفري (0)', () => {
    it('تدفقات كلها موجبة أو صفر: يعيد null (نفس اصطلاح calculatePaybackPeriod)', () => {
        expect(calculateIRR([0, 1000, 2000])).toBeNull();
        expect(calculateIRR([100, 1000, 2000])).toBeNull();
    });

    it('مصفوفة قصيرة جداً: null لا 0', () => {
        expect(calculateIRR([-1000])).toBeNull();
    });

    it('حالة حقيقية (تدفق سالب حقيقي): تبقى تحسب رقماً فعلياً كالمعتاد', () => {
        const irr = calculateIRR([-1000, 300, 400, 500, 600]);
        expect(irr).not.toBeNull();
        expect(irr).toBeGreaterThan(0);
    });
});

describe('محرك القرار — دراسة بإيراد وتمويل حقيقيين لكن بلا جدول CAPEX (سيناريو الفرز السريع للمستثمر)', () => {
    it('NPV موجب صحي، لكن IRR/الاسترداد "غير قابل للحساب" لا "فاشل"', () => {
        const r = calculateStudy(makeStudy());

        expect(r.indicators.npv).toBeGreaterThan(0);
        expect(r.indicators.irr).toBeNull();
        expect(r.indicators.paybackPeriod).toBeNull();
    });

    it('سبب REVISE الخاص بـIRR يذكر "غير قابل للحساب"، لا عتبة الـ15% المضلِّلة', () => {
        const r = calculateStudy(makeStudy());

        const irrReason = r.decisionReasons.find((x) => x.includes('العائد الداخلي'));
        expect(irrReason).toBeDefined();
        expect(irrReason).toContain('غير قابل للحساب');
        expect(irrReason).not.toContain('≥ 15%');
    });

    it('بمجرد إضافة CAPEX حقيقي (نفس المدخلات): IRR رقم حقيقي، والسبب (إن ظل REVISE) يعود لصيغة العتبة الفعلية', () => {
        const r = calculateStudy(makeStudy({
            [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] }
        }));

        expect(r.indicators.irr).not.toBeNull();
        expect(Number.isFinite(r.indicators.irr)).toBe(true);
        const irrReason = r.decisionReasons.find((x) => x.includes('العائد الداخلي'));
        if (irrReason) expect(irrReason).toContain('≥');
    });
});
