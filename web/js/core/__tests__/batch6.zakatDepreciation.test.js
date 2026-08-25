/**
 * دفعة 6 — تصحيح الوعاء الزكوي: تراكم الإهلاك الفعلي غير الخطي
 * -----------------------------------------------------------------
 * الخلل: صافي الأصول الثابتة أول السنة (netFixedStart) في حساب الزكاة كان يُقرَّب خطياً
 * (annualDepreciation × yearIndex) بينما الإهلاك الفعلي المُحمَّل في قائمة الدخل غير خطي
 * (ينخفض بعد استنفاد عمر الأصل الأصلي لأن أساس الأصل البديل أصغر — لا خصم/طوارئ/مضاعِف).
 * لمشروع فيه أصل قابل للإحلال بعمر أقصر من أفق الدراسة، الرقمان يتباعدان مع الزمن
 * فيُحرِّف الوعاء الزكوي بطريقة مصادر الأموال في السنوات المتأخرة.
 *
 * تحديث 2026-08-25 (إصلاح الإحلال + توحيد الوعاء الزكوي مع الميزانية):
 * كان هذا الملف يوثّق سلوكاً معطوباً في ترويسته: «يتوقف إهلاكها الدفتري تماماً بعد السنة 2»
 * (Bug B). هذا لم يكن سلوكاً صحيحاً يُوثَّق بل عيباً — الأصل البديل كان يُشترى ويُرسمَل نقداً
 * ولا يُهلَك أبداً. صار الآن كل جيل بديل يُهلَك من سنة شرائه على نفس العمر
 * (replaceableItemDepAtYear في financial/depreciation.js).
 * وبالتوازي: netFixedStart في المحرك صار يشمل الإحلال المُرسمَل في السنوات السابقة، تطابقاً
 * حرفياً مع تعريف fixedAssetsGross في lib/calc/balanceSheet.js:45.
 *
 * تحديث ثانٍ 2026-08-25 (ع-1 + ع-2 + ع-4) — تغيير مقصود لمُدخل الفيكستشر:
 * كانت نسبة استهلاك المعدة 0.5، ومصدر لا-خطية الإهلاك في هذا الفيكستشر كان **العيب نفسه**
 * (أساس البديل الخام 200,000 أصغر من الأساس المُقيَّس 220,000 ⇒ 125,000 ثم 115,000). بعد
 * ع-2 صار أساس كل جيل واحداً، فالإهلاك ثابت 125,000 ويساوي annualDepreciation بالضبط —
 * وعندها يفقد هذا الاختبار قدرته على التمييز بين التراكم الحقيقي والتقريب الخطي (فرق صفر).
 * لذا غُيّرت النسبة إلى 0.4 (⇒ life = round(2.5) = 3) كي تبقى اللا-خطية قائمة لسبب مشروع:
 * متبقي التقريب الذي تستوعبه السنة الأخيرة من كل جيل (3 × 0.4 = 1.2 > 1 — فرع «التجاوز»
 * الذي كان يعمل قبل ع-1 ويجب ألا يتغيّر بعده؛ فرع «النقص» مُغطّى في
 * financial/__tests__/depreciation.test.js).
 *
 * الدراسة أدناه: أفق 6 سنوات، معدة بعمر 3 سنوات (depreciationRate: 0.4 ⇒ life = 3) تُستبدل
 * نقداً في السنة 4، ومبنى دائم (life = 20) يستمر إهلاكه. الإهلاك غير خطي
 * (103,000 / 103,000 / 59,000 — انظر الاشتقاق في الاختبار الأول)، خلافاً لـ
 * annualDepreciation الخطي الثابت (103,000) المُستخدم في التقريب القديم.
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
            // معدة قابلة للإحلال بعمر 3 سنوات (rate=0.4 ⇒ life=round(2.5)=3) — تُستبدل نقداً
            // في السنة 4، وكل جيل بديل يُهلَك من سنة شرائه على نفس أساس الأصل الأصلي (ع-2).
            equipment: [{ price: 200000, quantity: 1, depreciationRate: 0.4 }],
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
        // ── الاشتقاق التحليلي (2026-08-25) من الصيغة الجديدة وبيانات الفيكستشر أعلاه ──
        // launchStrategy الافتراضي Full_Launch ⇒ مضاعِف 1.0؛ contingencyRate الافتراضي 0.10
        // وriskPremium = 0 (لا سجل مخاطر) ⇒ computedContingencyRate = 0.10
        // ⇒ equipmentScale = 1.0 × (1 + 0.10) = 1.10
        //   كل الأجيال على نفس الأساس (ع-2): base = 200,000 × 1.10 = 220,000، life = 3،
        //   dep الاسمي = 220,000 × 0.4 = 88,000، والسنة الأخيرة من كل جيل تستوعب المتبقي (ع-1):
        //   220,000 − 2 × 88,000 = 44,000 ⇒ نمط الجيل = [88,000 ، 88,000 ، 44,000]
        //   المبنى (دائم، life = 20): 300,000 × 0.05 = 15,000 كل سنة
        // ⇒ الإهلاك = [103,000 ، 103,000 ، 59,000 ، 103,000 ، 103,000 ، 59,000]
        const dep = r.incomeStatement.map(s => s.depreciation);
        expect(dep[0]).toBeCloseTo(103000, 6);
        expect(dep[1]).toBeCloseTo(103000, 6);
        expect(dep[2]).toBeCloseTo(59000, 6);
        expect(dep[3]).toBeCloseTo(103000, 6);
        expect(dep[5]).toBeCloseTo(59000, 6);
        // حارس الانحدار الأهم: بعد استنفاد عمر الأصل الأصلي (السنة 3) لا يهبط الإهلاك إلى
        // إهلاك المبنى وحده (15,000) — الأصل البديل المُرسمَل في السنة 4 يُهلَك فعلاً.
        expect(dep[3]).toBeGreaterThan(15000 + 1);
        // ويبقى غير خطي (شرط صحة الاختبار الثاني): فارق 44,000 بين السنة 1 والسنة 3،
        // مصدره متبقي التقريب الذي تستوعبه السنة الأخيرة من الجيل (88,000 − 44,000).
        expect(dep[0] - dep[2]).toBeCloseTo(44000, 6);
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
        // وتحديث 2026-08-25: ومجموع replacementCost لنفس السنوات — الإحلال يُرسمَل في الأصول
        // الثابتة (fixedAssetsGross في lib/calc/balanceSheet.js:45)، فاستبعاده كان يُبخّس صافي
        // الأصول الثابتة أول السنة ويضخّم الوعاء الزكوي.
        let realCumulativeDep = 0;
        let realCumulativeReplacement = 0;
        let retainedEarningsStart = 0; // نفس ترحيل المحرك: مجموع netIncome للسنوات السابقة
        for (let j = 0; j < targetYearIdx; j++) {
            realCumulativeDep += r.incomeStatement[j].depreciation;
            realCumulativeReplacement += r.incomeStatement[j].replacementCost;
            retainedEarningsStart += r.incomeStatement[j].netIncome;
        }
        const linearCumulativeDep = linearAnnualDep * targetYearIdx; // annualDepreciation × yearIndex (الخاطئ القديم)

        // ── الاشتقاق التحليلي لهذا الفيكستشر (لا نسخاً من مخرجات المحرك) ──
        // capex.subtotal = مبنى 300,000 + معدات 200,000×1.10 = 220,000 ⇒ 520,000
        // realCumulativeDep (سنوات 1..4)         = 103,000 + 103,000 + 59,000 + 103,000 = 368,000
        // realCumulativeReplacement (سنوات 1..4) = 220,000 (شراء السنة 4 فقط؛ الشراء التالي في السنة 7 خارج الأفق)
        // linearAnnualDep = 15,000 (مبنى) + 88,000 (معدات، إهلاك السنة الأولى الفعلي بعد ع-4)
        //                 = 103,000 ⇒ ×4 = 412,000
        // ⇒ netFixedStartCorrect = 520,000 + 220,000 − 368,000 = 372,000
        // ⇒ netFixedStartBuggy   = 520,000 − 412,000           = 108,000   (فارق 264,000)
        expect(totalCapex).toBeCloseTo(520000, 6);
        expect(linearAnnualDep).toBeCloseTo(103000, 6);
        expect(realCumulativeDep).toBeCloseTo(368000, 6);
        expect(realCumulativeReplacement).toBeCloseTo(220000, 6);
        expect(linearCumulativeDep).toBeCloseTo(412000, 6);

        // إثبات عدم-عبثية الاختبار: التراكمان (الصحيح والخطي) يختلفان اختلافاً معنوياً لهذا
        // المُعطى — لولا ذلك لن يميّز الاختبار بين السلوك الصحيح والخاطئ. (44,000 هنا)
        expect(Math.abs(realCumulativeDep - linearCumulativeDep)).toBeGreaterThan(1000);

        // نفس تعريف fixedAssetsGross − accumulatedDepreciation في lib/calc/balanceSheet.js:45-46
        const netFixedStartCorrect = Math.max(0, totalCapex + realCumulativeReplacement - realCumulativeDep);
        const netFixedStartBuggy = Math.max(0, totalCapex - linearCumulativeDep);
        expect(netFixedStartCorrect).toBeCloseTo(372000, 6);
        expect(netFixedStartBuggy).toBeCloseTo(108000, 6);
        expect(Math.abs(netFixedStartCorrect - netFixedStartBuggy)).toBeGreaterThan(1000); // 264,000

        // وحدة التعريف مع الميزانية المعروضة: صافي الأصول الثابتة أول السنة 5 = صافيها
        // نهاية السنة 4 في lib/calc/balanceSheet.js (سبب توحيد الصيغتين).
        expect(r.balanceSheets[targetYearIdx - 1].assets.fixed.net).toBeCloseTo(netFixedStartCorrect, 0);

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
