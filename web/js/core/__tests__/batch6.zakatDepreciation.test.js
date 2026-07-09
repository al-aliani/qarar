/**
 * دفعة 6 — تصحيح الوعاء الزكوي: تراكم الإهلاك الفعلي غير الخطي
 * -----------------------------------------------------------------
 * الخلل: صافي الأصول الثابتة أول السنة (netFixedStart) في حساب الزكاة كان يُقرَّب خطياً
 * (annualDepreciation × yearIndex) بينما الإهلاك الفعلي المُحمَّل في قائمة الدخل غير خطي
 * (يتوقف الجزء القابل للإحلال عن الإهلاك الدفتري بعد استنفاد عمره الأصلي — Bug B).
 * لمشروع فيه أصل قابل للإحلال بعمر أقصر من أفق الدراسة، الرقمان يتباعدان مع الزمن
 * فيُحرِّف الوعاء الزكوي بطريقة مصادر الأموال في السنوات المتأخرة.
 *
 * هذا الاختبار يبني دراسة واقعية بأفق 6 سنوات فيها معدة (equipment) بعمر سنتين
 * (depreciationRate: 0.5 ⇒ life = round(1/0.5) = 2)، فتُستبدل نقداً في السنة 3 و5
 * بينما يتوقف إهلاكها الدفتري تماماً بعد السنة 2 (حسب تصميم replaceableDepAtYear
 * الموثق في engine.js — "Bug B"). هذا يجعل incomeStatement[j].depreciation
 * غير ثابت عبر السنوات (ينخفض بعد السنة 2)، خلافاً لـ annualDepreciation الخطي
 * الثابت المُستخدم في التقريب القديم.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { calculateZakatAndTax } from '../financial/tax.js';
import { SECTIONS } from '../schema.js';

function makeStudy(overrides = {}) {
    const base = {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: {
            projectionYears: 6,
            discountRate: 0.10,
            inflationRate: 0.02,
            hiddenOverheadsRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            // معدة قابلة للإحلال بعمر سنتين (rate=0.5 ⇒ life=2) — تتوقف عن الإهلاك الدفتري
            // بعد السنة 2 رغم استبدالها نقداً لاحقاً (Bug B / replaceableDepAtYear).
            equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }],
            buildings: [{ price: 300000, quantity: 1 }], // أصل دائم (لا قابل للإحلال) يستمر إهلاكه
            furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [{ position: 'موظف', count: 3, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 8000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 800, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        // بلا قرض وبلا مساهمة مُدخلة صراحة ⇒ paidCapital = equityOutlay = totalInvestment (r.capex.total)
        // وloanBalanceStart = 0 لكل السنوات — يُبسّط إعادة بناء الوعاء الزكوي في الاختبار.
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
    return { ...base, ...overrides };
}

describe('دفعة 6 — الوعاء الزكوي: صافي الأصول الثابتة تراكمي حقيقي لا تقريب خطي', () => {
    it('الإهلاك الفعلي للمعدة القابلة للإحلال غير خطي عبر السنوات (شرط عدم-عبثية الأصل)', () => {
        const r = calculateStudy(makeStudy());
        // السنة 1-2: إهلاك المعدة فعّال. السنة 4 (index 3): استُنفد عمر المعدة (life=2) فتوقف
        // إهلاكها الدفتري ⇒ إهلاك السنة الأولى أعلى بوضوح من إهلاك السنة الرابعة.
        expect(r.incomeStatement[0].depreciation).toBeGreaterThan(r.incomeStatement[3].depreciation + 1000);
    });

    it('صافي الأصول الثابتة والزكاة في سنة متأخرة (5) يطابقان التراكم الحقيقي لا annualDepreciation×yearIndex', () => {
        const r = calculateStudy(makeStudy());
        const totalCapex = r.capex.subtotal;
        // بلا قرض وبلا مساهمة مُدخلة صراحة ⇒ paidCapital = equityOutlay = totalInvestment
        const paidCapital = r.capex.total;
        const linearAnnualDep = r.depreciation; // annualDepreciation الخطي — التقريب القديم

        const targetYearIdx = 4; // السنة 5 (index 4) — بعد استنفاد عمر المعدة بسنتين كاملتين

        // إعادة بناء التراكم الحقيقي (الصحيح) من نفس أرقام قائمة الدخل التي يصدّرها المحرك:
        // مجموع incomeStatement[j].depreciation لِـ j = 0..targetYearIdx-1 (سنوات 1..4)
        let realCumulativeDep = 0;
        let retainedEarningsStart = 0; // نفس ترحيل المحرك: مجموع netIncome للسنوات السابقة
        for (let j = 0; j < targetYearIdx; j++) {
            realCumulativeDep += r.incomeStatement[j].depreciation;
            retainedEarningsStart += r.incomeStatement[j].netIncome;
        }
        const linearCumulativeDep = linearAnnualDep * targetYearIdx; // annualDepreciation × yearIndex (الخاطئ القديم)

        // إثبات عدم-عبثية الاختبار: التراكمان (الصحيح والخطي) يختلفان اختلافاً معنوياً لهذا
        // المُعطى — لولا ذلك لن يميّز الاختبار بين السلوك الصحيح والخاطئ.
        expect(Math.abs(realCumulativeDep - linearCumulativeDep)).toBeGreaterThan(1000);

        const netFixedStartCorrect = Math.max(0, totalCapex - realCumulativeDep);
        const netFixedStartBuggy = Math.max(0, totalCapex - linearCumulativeDep);
        expect(Math.abs(netFixedStartCorrect - netFixedStartBuggy)).toBeGreaterThan(1000);

        const y = r.incomeStatement[targetYearIdx];

        const correct = calculateZakatAndTax({
            paidCapital,
            retainedEarningsStart,
            loanBalanceStart: 0,
            netFixedStart: netFixedStartCorrect,
            taxDepY: y.taxDepreciation,
            ebt: y.ebt,
            depreciation: y.depreciation,
            zakatRate: 0.025,
            foreignShare: 0,
            taxRate: 0.20
        });

        const buggy = calculateZakatAndTax({
            paidCapital,
            retainedEarningsStart,
            loanBalanceStart: 0,
            netFixedStart: netFixedStartBuggy,
            taxDepY: y.taxDepreciation,
            ebt: y.ebt,
            depreciation: y.depreciation,
            zakatRate: 0.025,
            foreignShare: 0,
            taxRate: 0.20
        });

        // الوعاء المحسوب بالتقريب الخطي القديم يختلف فعلاً عن الصحيح لهذا المُعطى
        // (لولا ذلك، التصحيح لن يكون له أثر ملموس وسيكون الاختبار عديم الجدوى).
        expect(Math.abs(correct.zakatBase - buggy.zakatBase)).toBeGreaterThan(500);

        // مخرج المحرك الفعلي (بعد التصحيح) يطابق الحساب الصحيح المبني على التراكم الحقيقي
        expect(y.zakatBase).toBeCloseTo(correct.zakatBase, 4);
        expect(y.zakat).toBeCloseTo(correct.zakat, 4);

        // ...ولا يطابق التقريب الخطي القديم (كان هذا هو سلوك الخلل قبل التصحيح)
        expect(Math.abs(y.zakatBase - buggy.zakatBase)).toBeGreaterThan(500);
    });
});
