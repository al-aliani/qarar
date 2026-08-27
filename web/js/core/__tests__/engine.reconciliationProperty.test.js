/**
 * اختبار مصالحة محاسبية بخصائص (property-based reconciliation) — 2026-08-26.
 *
 * الفرق عن بقية اختبارات المحرك: تلك كلها أمثلة يدوية محدودة (دراسة مقهى، دراسة B2B واحدة...).
 * هذا الاختبار يولّد مئات الدراسات الصالحة عشوائياً (بذرة قابلة للتكرار — mulberry32، لا
 * Math.random() عارياً) ويتحقق من ثلاث خصائص محاسبية يجب أن تصحّ على **أي** دراسة صالحة:
 *
 *   1) قائمة الدخل ⟵ التدفق النقدي: لكل سنة،
 *      netIncome + depreciation − loanPrincipalPaid − replacementCost − deltaNWC + nwcRecapture
 *      يساوي stmt.cashFlow بالضبط (الصيغة الفعلية في engine.js:964، مُعاد بناؤها من الحقول
 *      العلنية وحدها في incomeStatement — لا حقول داخلية مخمَّنة).
 *   2) الميزانية تتوازن كل سنة: assets.total = totalLiabilitiesAndEquity (isBalanced=true،
 *      |imbalance| <= 5 ريال — نفس تسامح تقريب جدول القرض الشهري المُعتمَد في بقية اختبارات
 *      lib/calc/__tests__/balanceSheet.*.test.js).
 *   3) مجموع مصادر التمويل + فجوة التمويل = إجمالي الاستثمار (financingCheck الموجود أصلاً
 *      في نتيجة المحرك — engine.js:1468، لا إعادة اختراع).
 *
 * هذا الملف **لا يعدّل** web/js/core/engine.js ولا أي ملف web/js/core/financial/*.js ولا
 * lib/calc/*.js — يستهلك calculateStudy كما هو فقط. أي عيار (assumption) في المولّد العشوائي
 * مقصود لإبقاء المدخلات "صالحة" (لا أفق صفري، لا معدل خصم سالب...)، لا لإخفاء فشل حقيقي.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

// ─────────────────────────────────────────────────────────────────────────
// مولّد أرقام عشوائية بذريّ (mulberry32) — نفس البذرة تُنتج نفس التسلسل دائماً،
// فأي فشل قابل لإعادة الإنتاج بذكر رقم seed وحده (لا حاجة لتخزين المدخلات الخام).
// ─────────────────────────────────────────────────────────────────────────
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const randFloat = (rng, min, max) => min + rng() * (max - min);
const randInt = (rng, min, max) => Math.floor(randFloat(rng, min, max + 1));
const chance = (rng, p) => rng() < p;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/**
 * دراسة صالحة عشوائياً — تُغطي المدى المطلوب: رأس مال 50,000–5,000,000، أفق 3–15 سنة،
 * مع/بلا قرض بنكي، مع/بلا سياسة دورة نقدية (DSO/DPO/DIO)، مع/بلا موارد بديلة (إحلال).
 * يعيد {study, meta} — meta تسجّل القرارات العشوائية المهمة لتشخيص أي فشل بلا الحاجة
 * لقراءة الكائن الكامل.
 */
function generateRandomStudy(seed) {
    const rng = mulberry32(seed);

    const capitalScale = randFloat(rng, 50000, 5000000);
    const years = randInt(rng, 3, 15);
    const hasLoan = chance(rng, 0.6);
    const hasCashCyclePolicy = chance(rng, 0.5);
    const hasReplaceableTechResources = chance(rng, 0.5);
    const foreignOwnershipRate = chance(rng, 0.3) ? randFloat(rng, 0, 1) : 0;

    // ── CAPEX: نسب عشوائية من capitalScale لكل فئة (بعضها صفر/غائب عمداً) ──
    const equipmentAmount = capitalScale * randFloat(rng, 0.35, 0.6);
    const buildingsAmount = chance(rng, 0.5) ? capitalScale * randFloat(rng, 0.05, 0.3) : 0;
    const furnitureAmount = capitalScale * randFloat(rng, 0.03, 0.15);
    const establishmentAmount = capitalScale * randFloat(rng, 0.01, 0.05);
    const techResourcesAmount = hasReplaceableTechResources ? capitalScale * randFloat(rng, 0.02, 0.12) : 0;
    const openingInventory = capitalScale * randFloat(rng, 0, 0.06);

    // ── الموارد البشرية ──
    const numPositions = randInt(rng, 1, 5);
    const positions = Array.from({ length: numPositions }, (_, idx) => ({
        position: `موظف ${idx + 1}`,
        count: randInt(rng, 1, 8),
        salary: randFloat(rng, 3000, 25000),
        months: 12,
        nationality: chance(rng, 0.4) ? 'expat' : 'saudi'
    }));

    // ── اللوجستيات (اختيارية) ──
    const numLogistics = randInt(rng, 0, 2);
    const logistics = Array.from({ length: numLogistics }, (_, idx) => ({
        name: `لوجستيات ${idx + 1}`,
        monthly: randFloat(rng, 500, 15000),
        variablePercent: randFloat(rng, 0, 0.6)
    }));

    // ── الإدارية (إيجار دائماً + بند إضافي أحياناً) ──
    const administrative = [
        { name: 'إيجار', monthly: randFloat(rng, 3000, 40000) },
        ...(chance(rng, 0.5) ? [{ name: 'مصاريف إدارية', monthly: randFloat(rng, 500, 5000) }] : [])
    ];

    // ── التسويق (اختياري) ──
    const numCampaigns = randInt(rng, 0, 2);
    const campaigns = Array.from({ length: numCampaigns }, (_, idx) => ({
        name: `حملة ${idx + 1}`,
        type: 'operating',
        monthly: randFloat(rng, 0, 8000)
    }));

    // ── الإيرادات: مصدر تشغيلي واحد على الأقل، وأحياناً مصدر غير تشغيلي إضافي ──
    const streams = [
        {
            service: 'المنتج الرئيسي',
            type: 'operating',
            customersPerMonth: randInt(rng, 50, 5000),
            avgPrice: randFloat(rng, 10, 600),
            variableCostRate: randFloat(rng, 0.15, 0.65),
            growthRate: randFloat(rng, -0.02, 0.10)
        },
        ...(chance(rng, 0.2) ? [{
            service: 'إيراد إضافي',
            type: 'non-operating',
            customersPerMonth: randInt(rng, 10, 500),
            avgPrice: randFloat(rng, 10, 300),
            growthRate: randFloat(rng, 0, 0.05)
        }] : [])
    ];

    // ── التمويل ──
    let financingSources;
    let loanAmount = 0;
    if (hasLoan) {
        const loanFraction = randFloat(rng, 0.3, 0.8);
        loanAmount = capitalScale * loanFraction;
        const equityAmount = Math.max(0, capitalScale - loanAmount);
        financingSources = {
            equity: { amount: equityAmount },
            bankLoan: {
                amount: loanAmount,
                interestRate: randFloat(rng, 0, 0.12),
                termYears: randInt(rng, 2, 10),
                gracePeriodMonths: pick(rng, [0, 0, 0, 6, 12]),
                repaymentType: 'equal'
            }
        };
    } else {
        financingSources = chance(rng, 0.5)
            ? {}
            : { equity: { amount: capitalScale } };
    }

    const meta = {
        seed, capitalScale, years, hasLoan, hasCashCyclePolicy,
        hasReplaceableTechResources, foreignOwnershipRate, loanAmount
    };

    const study = {
        [SECTIONS.PROJECT_INFO]: { name: `دراسة عشوائية ${seed}`, sector: 'عام', businessModel: 'Independent' },
        assumptions: {
            projectionYears: years,
            discountRate: randFloat(rng, 0.08, 0.18),
            inflationRate: randFloat(rng, 0.0, 0.05),
            taxRate: 0.20,
            hiddenOverheadsRate: 0,
            foreignOwnershipRate,
            ...(hasCashCyclePolicy ? {
                workingCapitalPolicy: {
                    dsoDays: randInt(rng, 0, 90),
                    dpoDays: randInt(rng, 0, 60),
                    dioDays: randInt(rng, 0, 60)
                }
            } : {})
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات', price: equipmentAmount, quantity: 1 }],
            buildings: buildingsAmount > 0 ? [{ name: 'مبنى', price: buildingsAmount, quantity: 1 }] : [],
            furniture: [{ name: 'أثاث', price: furnitureAmount, quantity: 1 }],
            establishmentCosts: [{ name: 'تأسيس', amount: establishmentAmount }],
            capacityUtilization: [],
            openingInventory
        },
        [SECTIONS.HR]: { positions },
        [SECTIONS.LOGISTICS]: { logistics },
        [SECTIONS.ADMINISTRATIVE]: { administrative },
        [SECTIONS.MARKETING]: { campaigns },
        [SECTIONS.REVENUE]: { streams },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: financingSources },
        [SECTIONS.TECH_RESOURCES]: {
            techResources: techResourcesAmount > 0 ? [{ name: 'نظام تقني', price: techResourcesAmount, quantity: 1 }] : []
        },
        [SECTIONS.LEGAL]: { licenses: [] }
    };

    return { study, meta };
}

const NUM_STUDIES = 500;
const CASHFLOW_DECIMALS = 6;     // مطابق لتسامح toBeCloseTo المُعتمَد أصلاً في nwcRecapture.test.js
const BALANCE_TOLERANCE = 5;     // نفس تسامح lib/calc/__tests__/balanceSheet.*.test.js (ريال واحد لكل جدول قرض شهري مقرَّب)
const FINANCING_TOLERANCE = 1e-6;

function closeEnough(a, b, decimals) {
    return Math.abs(a - b) < 0.5 * Math.pow(10, -decimals);
}

/**
 * يفحص الخصائص الثلاث على نتيجة calculateStudy واحدة، ويعيد مصفوفة انتهاكات (فارغة = نجاح).
 * مُستقلّة عن expect() عمداً كي تُستخدم في حلقة التوليد (تجميع كل الفشل قبل إفشال الاختبار
 * دفعة واحدة) وفي اختبار حقن العيب (fault injection) أدناه على نتيجة واحدة معدَّلة يدوياً.
 */
function checkReconciliationProperties(result) {
    const violations = [];

    (result.incomeStatement || []).forEach(stmt => {
        const expectedCashFlow = stmt.netIncome + stmt.depreciation - stmt.loanPrincipalPaid
            - stmt.replacementCost - stmt.deltaNWC + stmt.nwcRecapture;
        if (!closeEnough(stmt.cashFlow, expectedCashFlow, CASHFLOW_DECIMALS)) {
            violations.push({
                property: 'incomeStatement->cashFlow',
                year: stmt.year,
                expected: expectedCashFlow,
                actual: stmt.cashFlow,
                diff: stmt.cashFlow - expectedCashFlow
            });
        }
    });

    (result.balanceSheets || []).forEach(bs => {
        const diff = bs.assets.total - bs.totalLiabilitiesAndEquity;
        if (!bs.isBalanced || Math.abs(bs.imbalance) > BALANCE_TOLERANCE || Math.abs(diff) > BALANCE_TOLERANCE) {
            violations.push({
                property: 'balanceSheet.isBalanced',
                year: bs.year,
                isBalanced: bs.isBalanced,
                imbalance: bs.imbalance,
                assetsTotal: bs.assets.total,
                totalLiabilitiesAndEquity: bs.totalLiabilitiesAndEquity,
                diff
            });
        }
    });

    if (result.financingCheck) {
        const fc = result.financingCheck;
        const diff = fc.totalInvestment - (fc.totalFundingSources + fc.fundingGap);
        if (Math.abs(diff) > FINANCING_TOLERANCE) {
            violations.push({
                property: 'financingCheck.totalInvestment',
                totalInvestment: fc.totalInvestment,
                totalFundingSources: fc.totalFundingSources,
                fundingGap: fc.fundingGap,
                diff
            });
        }
    }

    return violations;
}

describe('مصالحة محاسبية بخصائص — عبر مئات الدراسات المولَّدة عشوائياً', () => {
    it(`${NUM_STUDIES} دراسة عشوائية (بذور 1..${NUM_STUDIES}): قائمة الدخل⟵تدفق نقدي، توازن الميزانية، ومصادر التمويل=الاستثمار — كل سنة، كل دراسة`, () => {
        const failures = [];

        for (let seed = 1; seed <= NUM_STUDIES; seed++) {
            const { study, meta } = generateRandomStudy(seed);
            let result;
            try {
                result = calculateStudy(study);
            } catch (err) {
                failures.push({ seed, meta, error: `calculateStudy رمى استثناءً: ${err?.message || err}`, study });
                continue;
            }
            if (!result || !Array.isArray(result.incomeStatement) || result.incomeStatement.length === 0) {
                failures.push({ seed, meta, error: 'calculateStudy أعادت نتيجة بلا incomeStatement', study });
                continue;
            }
            const violations = checkReconciliationProperties(result);
            if (violations.length > 0) {
                failures.push({ seed, meta, violations, study });
            }
        }

        if (failures.length > 0) {
            // تقرير مفصَّل: البذرة الدقيقة + المُدخَلات الكاملة لأول 5 حالات فاشلة (قابلة
            // لإعادة الإنتاج بحرفية عبر generateRandomStudy(seed) بنفس هذا الملف).
            const sample = failures.slice(0, 5).map(f => ({
                seed: f.seed,
                meta: f.meta,
                error: f.error,
                violations: f.violations,
                study: f.study
            }));
            const report = `فشلت ${failures.length}/${NUM_STUDIES} دراسة مولَّدة عشوائياً في خاصية المصالحة المحاسبية.\n` +
                `البذور الفاشلة: ${failures.map(f => f.seed).join(', ')}\n` +
                `تفصيل أول ${sample.length} حالة (قابلة لإعادة الإنتاج بـ generateRandomStudy(seed)):\n` +
                JSON.stringify(sample, null, 2);
            throw new Error(report);
        }

        expect(failures.length).toBe(0);
    });
});

describe('دليل الأنياب (fault injection) — إثبات أن الاختبار يكتشف انحرافاً محاسبياً حقيقياً', () => {
    it('حقن انحراف ثابت في صافي الربح بعد calculateStudy يُفشل فحص مصالحة التدفق النقدي فوراً، وإزالته يعيد النجاح', () => {
        const { study } = generateRandomStudy(42);
        const result = calculateStudy(study);
        expect(result.incomeStatement.length).toBeGreaterThan(0);

        // 1) قبل أي حقن: الخاصية تصحّ فعلاً على هذه الدراسة (خط الأساس)
        const baselineViolations = checkReconciliationProperties(result);
        expect(baselineViolations).toEqual([]);

        // 2) الحقن: نضيف انحرافاً ثابتاً صغيراً (1234.56 ريال) لصافي الربح في نسخة معدَّلة من
        // النتيجة فقط — لا تعديل على engine.js ولا أي ملف مصدر، فقط على الكائن هنا في الاختبار.
        const INJECTED_BIAS = 1234.56;
        const mutatedResult = {
            ...result,
            incomeStatement: result.incomeStatement.map((stmt, idx) =>
                idx === 0 ? { ...stmt, netIncome: stmt.netIncome + INJECTED_BIAS } : stmt)
        };
        const violationsAfterInjection = checkReconciliationProperties(mutatedResult);
        const cashFlowViolation = violationsAfterInjection.find(
            v => v.property === 'incomeStatement->cashFlow' && v.year === mutatedResult.incomeStatement[0].year);
        expect(cashFlowViolation).toBeDefined();
        expect(Math.abs(cashFlowViolation.diff)).toBeCloseTo(INJECTED_BIAS, 6);
        expect(Math.abs(cashFlowViolation.diff)).toBeGreaterThan(1); // فارق واضح، لا ضجيج تقريب

        // 3) إزالة المحاكاة: النتيجة الأصلية غير المعدَّلة تعود (لم تُغيَّر أصلاً) — الفحص ينجح من جديد
        const violationsAfterRemoval = checkReconciliationProperties(result);
        expect(violationsAfterRemoval).toEqual([]);
    });

    it('حقن اختلال في إجمالي الأصول يُفشل فحص توازن الميزانية فوراً، وإزالته يعيد النجاح', () => {
        const { study } = generateRandomStudy(7);
        const result = calculateStudy(study);
        expect(result.balanceSheets.length).toBeGreaterThan(0);

        expect(checkReconciliationProperties(result)).toEqual([]);

        const mutatedResult = {
            ...result,
            balanceSheets: result.balanceSheets.map((bs, idx) =>
                idx === 0 ? { ...bs, assets: { ...bs.assets, total: bs.assets.total + 500 } } : bs)
        };
        const violations = checkReconciliationProperties(mutatedResult);
        const balanceViolation = violations.find(v => v.property === 'balanceSheet.isBalanced');
        expect(balanceViolation).toBeDefined();
        expect(Math.abs(balanceViolation.diff)).toBeGreaterThanOrEqual(500);

        expect(checkReconciliationProperties(result)).toEqual([]);
    });

    it('حقن انحراف في فجوة التمويل يُفشل فحص financingCheck فوراً، وإزالته يعيد النجاح', () => {
        const { study } = generateRandomStudy(13);
        const result = calculateStudy(study);
        expect(result.financingCheck).toBeTruthy();

        expect(checkReconciliationProperties(result)).toEqual([]);

        const mutatedResult = { ...result, financingCheck: { ...result.financingCheck, fundingGap: result.financingCheck.fundingGap + 10 } };
        const violations = checkReconciliationProperties(mutatedResult);
        const financingViolation = violations.find(v => v.property === 'financingCheck.totalInvestment');
        expect(financingViolation).toBeDefined();
        expect(Math.abs(financingViolation.diff)).toBeCloseTo(10, 6);

        expect(checkReconciliationProperties(result)).toEqual([]);
    });
});
