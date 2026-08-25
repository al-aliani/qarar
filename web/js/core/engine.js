
import { SECTIONS, SAUDI_GOSI_RATE_2026 } from './schema.js';
export { SAUDI_GOSI_RATE_2026 }; // إعادة تصدير — بعض المستهلكين (nitaqatHrCard.js واختباره) يستوردانه من هنا
import { computeLoanSchedule } from '../../../lib/calc/loanSchedule.js';
import { generateBalanceSheets } from '../../../lib/calc/balanceSheet.js';
import { analyzeSaaSMetrics } from './SaaSEngine.js';
import { analyzeSaudiMarket } from './SaudiMarketEngine.js';
import { explainDecisionBreakers } from './DecisionExplainer.js';
import { analyzePartnerNeeds } from './partnerNeeds.js';
import { calculateZakatAndTax } from './financial/tax.js';
import { calculateNPV, calculateIRR, calculateMIRR, calculateTerminalValue, countSignChanges, outstandingDebtAtHorizon } from './financial/cashflow.js';
import { buildDepreciationModel, itemDepAtYear, replaceableItemDepAtYear } from './financial/depreciation.js';
import { buildFinancialRatios } from './financial/ratios.js';
import { buildRevenueModel } from './financial/revenue.js';
import { computeStressSurvival } from './financial/stressTestMath.js';
import { getRiskScore, classifyRiskScore } from './riskScoring.js';
function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

// يطابق بند «إيجار» ضمن الموارد الإدارية (عربي/إنجليزي) — نفس مفردات الكشف التي
// كانت مستخدمة سابقاً في BenchmarkingView.js/SmartAdvisor.js قبل أن يُستبدل المصدر
// سهواً بقسم اللوجستيات (تدقيق 2026-07-10).
const RENT_KEYWORDS_RE = /إيجار|ايجار|rent|lease/i;
function isRentLineItem(item) {
    return RENT_KEYWORDS_RE.test((item?.name || '').toString());
}

// معدل إهلاك/إطفاء/فائدة يحترم الصفر الصريح: «0» قرارُ مستخدمٍ واعٍ (أصل لا يُستهلك،
// أو قرض بنك تنمية 0% فائدة) وليس غياباً للقيمة. النمط القديم `rate || default` كان
// يعامل الصفر كفراغ فيفرض الافتراضي. مُصدَّرة (لا محلية داخل calculateStudy) كي
// تستهلكها شاشات العرض (FinancingStructure.js) بنفس المنطق بدل نسخة محلية مكرَّرة.
export function rateOrDefault(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt;
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
}

// معدل GOSI الوافد (مخاطر مهنية فقط) — نفس الرقم الحرفي 0.02 المستخدم في gosiCost
// أدناه وفي schema.js (positions.annualCost)؛ لا ثابت مُصدَّر مشترك بينهما بعد (تعديل
// ذلك الكود القائم خارج نطاق هذه المهمة) — يُصدَّر هنا فقط ليستهلكه computeAnnualEmployeeCost
// دون طباعة رقم ثالث منفصل قد ينحرف عن القيمتين الحاليتين.
export const EXPAT_GOSI_RATE = 0.02;

/**
 * تكلفة سنوية تقديرية لموظف واحد (سعودي أو وافد) — نفس صيغة positions.reduce داخل
 * calculateStudy أدناه (راتب أساسي + GOSI حسب الجنسية + تأمين صحي للفرد + رسوم حكومية
 * للوافد فقط) لكن لموظف واحد افتراضي (count=1) بدل مجموع جدول الرواتب كاملاً — تستهلكها
 * بطاقة مقارنة «سعودي مقابل وافد» في واجهة الموارد البشرية (nitaqatHrCard.js) دون طباعة
 * صيغة GOSI/رسوم موازية. إضافية بحتة: لا تُستدعى من calculateStudy ولا تُغيّر مخرجاً قائماً.
 * @param {{salary?:number, months?:number, nationality?:'saudi'|'expat', gosiRate?:number, healthInsurancePerHead?:number, govtFees?:{workCard?:number, ticket?:number, iqama?:number}}} [params]
 * @returns {number}
 */
export function computeAnnualEmployeeCost({
    salary = 0,
    months = 12,
    nationality = 'expat',
    gosiRate = SAUDI_GOSI_RATE_2026,
    healthInsurancePerHead = 1500,
    govtFees = {}
} = {}) {
    const basic = Number(salary || 0) * Number(months || 12);
    const rate = nationality === 'expat' ? EXPAT_GOSI_RATE : Number(gosiRate ?? SAUDI_GOSI_RATE_2026);
    const gosi = basic * rate;
    const insurance = Number(healthInsurancePerHead || 1500);
    const expatFees = nationality === 'expat'
        ? (Number(govtFees.workCard || 0) + Number(govtFees.ticket || 0) + Number(govtFees.iqama || 0))
        : 0;
    return basic + gosi + insurance + expatFees;
}

export function calculateFinancingWACC(study) {
    const financing = study?.[SECTIONS.FINANCING] || {};
    const sources = financing.sources || {};
    const equity = Number(sources.equity?.amount || 0);
    const debt = Number(sources.bankLoan?.amount || 0);
    const total = equity + debt;
    if (total <= 0) return null;

    const costOfEquity = Number.isFinite(Number(financing.costOfEquity))
        ? Number(financing.costOfEquity)
        : 0.15;
    const costOfDebt = rateOrDefault(sources.bankLoan?.interestRate, 0.08);
    const assumptions = study?.assumptions || {};
    const foreignShare = Math.min(1, Math.max(0, Number(assumptions.foreignOwnershipRate ?? 0)));
    const effectiveLevyRate = (0.025 * (1 - foreignShare)) + (Number(assumptions.taxRate ?? 0.20) * foreignShare);

    const we = equity / total;
    const wd = debt / total;
    return (we * costOfEquity) + (wd * costOfDebt * (1 - effectiveLevyRate));
}

/**
 * معامل تصاعد الإيراد للسنة الأولى (Ramp-Up): متوسط منحنى خطي يبلغ 100% عند شهر
 * rampUpMonths. مُصدَّرة (لا محلية داخل calculateStudy) كي تستهلكها شاشات إدخال
 * الإيرادات (OfferingView.js) لعرض مطابقة سريعة بين إجمالي جدول الإيرادات (بلا
 * تصاعد) ورقم السنة الأولى في القوائم المالية (بعد تصاعد) — دون تشغيل المحرك
 * الكامل (calculateStudy) على كل تعديل خلية فقط لعرض ملاحظة تفسيرية.
 * تدقيق اختبار عميل 2026-07-12: فجوة الرقمين هذه بلا شرح كانت تُقرأ خطأً كخلل حسابي.
 */
export function calculateRampFactorY1(rampUpMonths) {
    const months = Math.max(0, Math.min(24, Number(rampUpMonths || 0)));
    if (months <= 1) return 1;
    let s = 0;
    for (let m = 1; m <= 12; m++) s += Math.min(1, m / months);
    return s / 12;
}

/**
 * مشتقات موحّدة من جدول مصادر الإيرادات (revenue.streams) بنفس صيغة عمود year1 حرفياً
 * (customersPerMonth × 12 × avgPrice) — بلا معامل تصاعد (rampFactorY1) وبلا تشغيل المحرك
 * الكامل (calculateStudy). مصدر واحد يستهلكه أي عرض خفيف يحتاج «الإيراد المخطَّط لسنة
 * كاملة» أو «عدد العملاء السنوي» فوراً أثناء الكتابة (الهدف المالي الذكي SmartGoals.js،
 * حقل SOM في MarketAnalysis.js) دون تكرار الصيغة بنسخ قد تتباعد لاحقاً.
 * خطة الاستفادة 2026-07-12 (بند 1.2).
 * @param {Array} streams state.revenue.streams
 * @returns {{ year1Revenue: number, annualCustomers: number }}
 */
export function deriveRevenueFromStreams(streams) {
    const list = Array.isArray(streams) ? streams : [];
    const year1Revenue = list.reduce((sum, r) => sum + (Number(r?.customersPerMonth) || 0) * 12 * (Number(r?.avgPrice) || 0), 0);
    const annualCustomers = list.reduce((sum, r) => sum + (Number(r?.customersPerMonth) || 0) * 12, 0);
    return { year1Revenue, annualCustomers };
}

/**
 * نص المطابقة بين إجمالي جدول مصادر الإيرادات (بلا تصاعد) وإيراد السنة الأولى في
 * القوائم المالية (بعد تصاعد) — مصدر واحد يستهلكه كل موضع يعرض جدول الإيرادات
 * (Wizard.js للمسار العام، OfferingView.js لمسار «ماذا تبيع وبكم») كي لا يتكرر
 * الحساب بصيغتين قد تتباعدان. يعيد '' إن لم تكن هناك فجوة تستحق الشرح.
 */
export function describeRevenueRampGap(streams, rampUpMonths) {
    const { year1Revenue: tableTotal } = deriveRevenueFromStreams(streams);
    const rampFactor = calculateRampFactorY1(rampUpMonths);
    if (!tableTotal || rampFactor >= 1) return '';
    const ramped = Math.round(tableTotal * rampFactor);
    const fmt = (n) => n.toLocaleString('ar-SA');
    return `إجمالي خطة سنة كاملة: ${fmt(tableTotal)} ريال — بعد فترة التصاعد (${Number(rampUpMonths) || 0} شهر) يظهر إيراد السنة الأولى في القوائم المالية كـ ${fmt(ramped)} ريال تقريباً. هذا فرق تصميم متوقّع، لا خطأ حسابي.`;
}

/**
 * Feasibility Study Calculation Engine (v5.0)
 * مصدر الحقيقة الوحيد لكل الأرقام في المنصة — كل الشاشات والمصدّرات تقرأ منه.
 *
 * إصلاحات v5.0 (تدقيق 2026-07-04):
 * - الزكاة 2.5% على حصة الملكية السعودية فقط + ضريبة الدخل على حصة الأجانب فقط
 *   (كان يطبّق زكاة ثم ضريبة 15% على الجميع = اقتطاع ~17% من مشروع سعودي 100%).
 * - فوائد وأقساط القرض من جدول PMT الفعلي (مع فترة السماح) بدل إهلاك خطي يناقض
 *   جدول السداد المطبوع في نفس التقرير.
 * - نمو الإيرادات لكل مصدر من growthRate الذي يُدخله المستخدم (كان 5% مصمتاً).
 * - الإيرادات غير التشغيلية تُحسب دائماً (كانت تُهمل متى امتلأ قسم الخدمات).
 * - رسوم العمالة الوافدة + GOSI حسب الجنسية + المركبات + المستهلكات + التكاليف
 *   الثابتة للخدمات: كانت مدخلات ميتة تُجمع ولا تدخل أي حساب.
 * - رسوم Venture Builder كانت تُحسب ثم تُهمل؛ ازدواج عدّ رأس مال التأسيس؛
 *   تعادل الوحدات كان يخلط أساس 100% طاقة مع إيراد مخفّض بالاستغلال.
 * - فترة استرداد غير محققة = null (كانت 0 فتظهر «أفضل مؤشر» في تقرير البنك).
 */
export function calculateStudy(study, overrides) {
    if (!study) return null;
    const revMult = 1 + (overrides?.revenueChange ?? 0);
    const opexMult = 1 + (overrides?.opexChange ?? overrides?.costChange ?? 0);
    const capexMult = 1 + (overrides?.capexChange ?? 0);
    // محاور حساسية منفصلة (لرسم Tornado): سعر / حجم / تكلفة متغيرة / ثابتة
    // — revenueChange القديم يحرك السعر والحجم معاً؛ هذه تعزلها لمعرفة المتغير المهيمن
    const priceMult = 1 + (overrides?.priceChange ?? 0);
    const volumeMult = 1 + (overrides?.volumeChange ?? 0);
    const vcRateMult = 1 + (overrides?.vcRateChange ?? 0);
    const fixedMult = 1 + (overrides?.fixedChange ?? 0);

    // أفق الدراسة: حارس `>= 1` منفصل عمداً — أفق صفر أو سالب غير منطقي، فيبقى الافتراضي.
    // (بخلاف معدلات التضخم/الخصم أدناه حيث الصفر قرار مستخدم واعٍ لا فراغ.)
    //
    // تصحيح 2026-08-25: الحارس كان `> 0` فيقبل الكسور دون سنة (0.5 أو "0.03") — وحلقة
    // بناء القوائم `for (y = 1; y <= years; y++)` لا تدور ولا مرة، فينتج incomeStatement
    // فارغ وكل المؤشرات صفر/null: نفس «أفق الصفر» الذي أُنشئ الحارس لمنعه، من مدخل آخر.
    // الآن: أقل من سنة كاملة ⟶ الافتراضي (5)، والكسور فوق ذلك تُقطع لأسفل عمداً
    // (2.5 ⟶ سنتان) — القوائم المالية سنوية بحكم البناء فلا معنى لنصف سنة، والقطع لأسفل
    // متحفّظ (سنة إضافية جزئية لا تُحتسب أرباحها).
    const yearsInput = Number(study.assumptions?.projectionYears);
    const years = Number.isFinite(yearsInput) && yearsInput >= 1 ? Math.floor(yearsInput) : 5;
    // تضخم صفر = «سيناريو أسعار ثابتة» يختاره المستخدم صراحةً، لا غياب قيمة. النمط القديم
    // `|| 0.02` كان يستبدله صمتاً بـ2% فتُنتج الدراسة نتائج مطابقة حرفياً لما لم يطلبه —
    // نفس الفخ الذي أُنشئت rateOrDefault أعلاه لتفاديه (كانت تُستخدم للفائدة/الإهلاك فقط).
    //
    // حارس ‎≤ −1‎ (2026-08-25): التضخم يدخل الحسابات كـ`Math.pow(1 + inflation, i)` فقط
    // (لا مقاماً)، فلا ينفجر إلى Infinity كمعدل الخصم — لكنه ينهار بصمت: عند −1 بالضبط
    // يصبح المعامل صفراً فتختفي كل التكاليف من السنة الثانية فصاعداً (تشغيل مجاني ⟶ أرباح
    // وهمية)، وتحت −1 يتناوب المعامل بين موجب وسالب (تكاليف سالبة في سنوات فردية).
    // الانكماش المعتدل (−2% مثلاً) سيناريو اقتصادي مشروع فيبقى مقبولاً؛ الرفض عند ‎≤ −1‎ فقط.
    const inflationInput = rateOrDefault(study.assumptions?.inflationRate, 0.02);
    const inflation = inflationInput > -1 ? inflationInput : 0.02;
    const technical = study[SECTIONS.TECHNICAL] || {};
    const marketing = study[SECTIONS.MARKETING] || {};
    const techResources = study[SECTIONS.TECH_RESOURCES] || {};
    const legal = study[SECTIONS.LEGAL] || {};
    const services = study[SECTIONS.SERVICES] || {};

    // ═══════════════════════════════════════════════════════════
    // Risk-to-Quant Engine: حساب علاوة المخاطر بناءً على المخاطر والـ SWOT
    // ═══════════════════════════════════════════════════════════
    let riskPremium = 0;
    const risks = toArray(study[SECTIONS.RISK_ANALYSIS]?.risks);
    const swot = study[SECTIONS.STRATEGIC]?.swot || {};

    risks.forEach(r => {
        const impact = (r.impact || '').toLowerCase();
        const prob = (r.probability || '').toLowerCase();
        if (impact === 'high' && prob === 'high') riskPremium += 0.015;
        else if (impact === 'high' || prob === 'high') riskPremium += 0.005;
    });

    const weaknessesCount = toArray(swot.weaknesses).length;
    const threatsCount = toArray(swot.threats).length;
    riskPremium += (weaknessesCount + threatsCount) * 0.002;

    riskPremium = Math.min(0.08, riskPremium); // سقف علاوة المخاطر 8%

    // تصحيح 2026-08-24: التدفق النقدي المحسوب في هذا المحرك هو FCFE (تدفق حقوق ملكية،
    // بعد خدمة الدين — انظر تعليق 2026-07-06 أعلاه). خصمه بـWACC (مصمَّم لتدفق غير مرفوع
    // FCFF) كان يزدوج أثر عبء الدين. البديل الصحيح لخصم FCFE هو تكلفة حقوق الملكية (Re)
    // وحدها. calculateFinancingWACC تبقى قائمة للعرض الإرشادي فقط (renderWACC في
    // FinancingStructure.js) ولم تعد تُستهلك هنا.
    const useCostOfEquityDiscountRate = Boolean(study.assumptions?.useWaccAsDiscountRate);
    const costOfEquityDiscountRate = useCostOfEquityDiscountRate
        ? (Number.isFinite(Number(study.financing?.costOfEquity)) ? Number(study.financing?.costOfEquity) : 0.15)
        : null;
    const hasCostOfEquityDiscountRate = costOfEquityDiscountRate != null && Number.isFinite(Number(costOfEquityDiscountRate));
    const rawBaseDiscountRate = hasCostOfEquityDiscountRate
        ? Number(costOfEquityDiscountRate)
        // معدل خصم صفر = مقارنة اسمية يطلبها المستخدم صراحةً (لا فراغ) — rateOrDefault
        // تحترمه، بينما `Number(...) || 0.10` كانت تفرض 10% صمتاً على نفس المدخل.
        : rateOrDefault(study.assumptions?.discountRate, 0.10);
    // حارس المعدل السالب (2026-08-25): معامل الخصم = ‎1 / (1 + r)^i‎، فمعدل ‎−1‎ يجعل المقام
    // صفراً ⟹ المعامل ‎Infinity‎ ⟹ ‎NPV = Infinity‎ وقرار «امضِ» مؤكَّد لأي مشروع مهما كانت
    // خسائره؛ وأي معدل سالب آخر يجعل الريال المستقبلي أثمن من الحاضر — عكس معنى الخصم —
    // فينفخ NPV بلا أساس. CentralAssumptionsView تقصّ بـ`Math.max(0, …)` لكن Wizard.updateStore
    // لا تقصّ (ولا أي مسار استيراد/مزامنة)، فالحدّ يُفرض هنا في المحرك لا في الواجهة وحدها.
    // الصفر يبقى **مقبولاً** عمداً (مقارنة اسمية يطلبها المستخدم — تصحيح 052c6ef).
    // السقوط إلى افتراضي المسار نفسه: 15% لتكلفة حقوق الملكية، 10% لمعدل الافتراضات.
    const baseDiscountRate = rawBaseDiscountRate >= 0
        ? rawBaseDiscountRate
        : (hasCostOfEquityDiscountRate ? 0.15 : 0.10);
    const discountRateSource = hasCostOfEquityDiscountRate ? 'costOfEquity' : 'assumptions';
    const discountRate = baseDiscountRate + riskPremium;
    const computedContingencyRate = Number(study.assumptions?.contingencyRate ?? 0.10) + (riskPremium * 0.5);

    // ═══════════════════════════════════════════════════════════
    // الزكاة والضريبة (النظام السعودي):
    // الزكاة 2.5% على حصة الملكية السعودية/الخليجية، وضريبة الدخل (20%)
    // على حصة الملكية الأجنبية فقط. مشروع سعودي 100% (الافتراضي) = زكاة فقط.
    // ═══════════════════════════════════════════════════════════
    const foreignShare = Math.min(1, Math.max(0, Number(study.assumptions?.foreignOwnershipRate ?? 0)));
    const taxRate = Number(study.assumptions?.taxRate ?? 0.20); // تُطبق على حصة الأجانب فقط
    const zakatRate = 0.025;

    // ═══════════════════════════════════════════════════════════
    // 1. OPEX (المصاريف التشغيلية الثابتة)
    // ═══════════════════════════════════════════════════════════
    const hr = study[SECTIONS.HR] || {};
    const logistics = study[SECTIONS.LOGISTICS] || {};
    const admin = study[SECTIONS.ADMINISTRATIVE] || {};
    const serviceItems = toArray(services.items);

    // حصة صاحب العمل في التأمينات (GOSI) للسعودي — ثابت مُصدَّر من schema.js (مصدر وحيد،
    // كان مكرراً محلياً بقيمة مختلفة 0.1175 هناك رغم تعليق يدّعي التطابق — تدقيق 2026-07-08).
    // قابل للتجاوز عبر assumptions.gosiRate أو hr.gosiRate — ?? تحترم تجاوزاً صريحاً بـ0
    // (بخلاف || القديمة التي كانت تتجاهل الصفر الصريح كما لو كان فراغاً).
    const gosiRate = study.assumptions?.gosiRate ?? hr.gosiRate ?? SAUDI_GOSI_RATE_2026;
    const positions = toArray(hr.positions);
    const totalSalaries = positions.reduce((acc, pos) => {
        return acc + (Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12));
    }, 0);

    // GOSI حسب الجنسية — مطابق فعلياً الآن لصيغة جدول الرواتب في الواجهة (schema
    // positions.annualCost)، وتجاوز المستخدم (gosiRate أعلاه) يسري على صفوف السعوديين
    // أيضاً لا فقط الصفوف بلا جنسية محددة (كان bug: صفوف "saudi" تتجاهل التجاوز تماماً).
    // الوافد يبقى ثابتاً 2% (مخاطر مهنية فقط، لا تتأثر بتجاوز نسبة GOSI السعودية).
    const gosiCost = positions.reduce((acc, pos) => {
        const basic = Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12);
        const rate = pos.nationality === 'expat' ? 0.02 : gosiRate;
        return acc + basic * rate;
    }, 0);

    const totalHeadcount = positions.reduce((acc, pos) => acc + Number(pos.count || 1), 0);
    const insuranceCost = totalHeadcount * (hr.healthInsurancePerHead || 1500);

    // رسوم العمالة الوافدة الحكومية السنوية (مقابل مالي + تذاكر + إقامة)
    const govtFees = hr.govtFees || {};
    const expatHeadcount = positions.reduce((acc, pos) => acc + (pos.nationality === 'expat' ? Number(pos.count || 1) : 0), 0);
    const annualExpatFees = expatHeadcount * (
        Number(govtFees.workCard || 0) + Number(govtFees.ticket || 0) + Number(govtFees.iqama || 0)
    );

    const annualPayroll = totalSalaries + gosiCost + insuranceCost + annualExpatFees;

    // نسبة التوطين (السعودة) — تطلبها جهات التمويل (منشآت/نطاقات) وتظهر في التقارير
    const saudiHeadcount = positions.reduce((acc, pos) => acc + (pos.nationality === 'saudi' ? Number(pos.count || 1) : 0), 0);
    const saudization = {
        saudiHeads: saudiHeadcount,
        totalHeads: totalHeadcount,
        rate: totalHeadcount > 0 ? saudiHeadcount / totalHeadcount : null
    };

    // تدقيق 2026-07-08 (ملاحظة عالية #38): عمود «% متغير» باللوجستيات كان معروضاً في
    // الواجهة (schema.js) لكن المحرك يحسب annualLogistics كاملاً كتكلفة ثابتة دائماً،
    // متجاهلاً variablePercent تماماً — الآن يُقسَّم كل بند إلى حصة ثابتة (تدخل fixedCosts)
    // وحصة متغيرة تتبع الحجم فعلياً (تدخل totalVariableCosts) بحسب نسبته المُدخلة.
    const logisticsItemsList = toArray(logistics.logistics);
    const annualLogisticsFixed = logisticsItemsList.reduce((acc, item) => {
        const vPct = Math.max(0, Math.min(1, Number(item.variablePercent) || 0));
        return acc + (Number(item.monthly || 0) * 12 * (1 - vPct));
    }, 0);
    const annualLogisticsVariable = logisticsItemsList.reduce((acc, item) => {
        const vPct = Math.max(0, Math.min(1, Number(item.variablePercent) || 0));
        return acc + (Number(item.monthly || 0) * 12 * vPct);
    }, 0);
    const administrativeItemsList = toArray(admin.administrative);
    let annualAdmin = administrativeItemsList.reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);
    // ملاحظة: أُزيلت إضافة 2,500 ريال «رسوم حكومية» الصامتة — كانت تُحقَن في OPEX دون علم
    // المستخدم أو إفصاح، فيجد فرقاً لا يفسَّر عند مطابقة تكاليفه بقائمة الدخل (نقض لشفافية المعادلات).
    // بديلها الصحيح: بند ظاهر في «الموارد الإدارية» يضيفه المستخدم أو تحذير QA يطلب إدخاله.
    // المواد المستهلكة الشهرية (technical.consumables)
    annualAdmin += toArray(technical.consumables).reduce((acc, item) => acc + (Number(item.monthlyCost ?? item.monthly ?? 0) * 12), 0);

    // تدقيق 2026-07-10: opex.rentAnnual (المستهلَك في costRatios.js/sectorBenchmarks.js/
    // BenchmarkingView.js لحساب «نسبة الإيجار») كان يُحسب خطأً من annualLogisticsFixed —
    // قسم اللوجستيات (SECTIONS.LOGISTICS) صفه الافتراضي «التوصيل والنقل» وليس إيجاراً.
    // بند الإيجار الفعلي («إيجار المحل (الصالة/المطبخ)») يعيش في الموارد الإدارية
    // (SECTIONS.ADMINISTRATIVE). الآن يُستخرج بمطابقة اسم البند (نفس منطق كان موجوداً
    // في BenchmarkingView.js/SmartAdvisor.js قبل أن يُحذف بإعادة هيكلة سابقة)، ويُخصم من
    // annualAdmin كي لا يُحتسب مرتين بين rentAnnual و adminAnnual.
    const annualAdminRent = administrativeItemsList
        .filter(isRentLineItem)
        .reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);

    const annualMarketing = toArray(marketing.campaigns)
        .filter(c => c.type === 'operating')
        .reduce((acc, c) => acc + (Number(c.monthly || 0) * 12), 0);

    // نمو الرواتب وميزانية التسويق متعدد السنوات (اختياري لكل بند): إن لم يُدخل المستخدم
    // pos.salaryGrowthRate/campaign.annualGrowthRate يتصرف كل بند تماماً كما اليوم (تضخم عام
    // موحّد costInflation) — الدالتان أدناه تُستدعيان داخل حلقة السنوات بدل الضرب المجمَّع
    // annualPayroll*costInflation/annualMarketing*costInflation، بلا أي تغيير في النتيجة عندما
    // لا تُستخدم الحقول الجديدة (تحقّق بذلك اختبار توافق رجعي صريح).
    const operatingPositions = positions; // نفس المصفوفة المُصدَّرة أعلاه لـ totalSalaries/gosiCost
    const operatingCampaigns = toArray(marketing.campaigns).filter(c => c.type === 'operating');

    function payrollAtYear(yearNum, costInflationForYear) {
        let basicSum = 0, gosiSum = 0, headcountSum = 0, expatHeadcountSum = 0;
        for (const pos of operatingPositions) {
            const months = Number(pos.months || 12);
            const count = Number(pos.count || 1);
            const growthRate = Number(pos.salaryGrowthRate);
            const growth = Number.isFinite(growthRate) ? Math.pow(1 + growthRate, yearNum - 1) : costInflationForYear;
            const basic = Number(pos.salary || 0) * count * months * growth;
            const rate = pos.nationality === 'expat' ? 0.02 : gosiRate;
            basicSum += basic;
            gosiSum += basic * rate;
            headcountSum += count;
            if (pos.nationality === 'expat') expatHeadcountSum += count;
        }
        const insurance = headcountSum * (hr.healthInsurancePerHead || 1500) * costInflationForYear;
        const expatFees = expatHeadcountSum * (
            Number(govtFees.workCard || 0) + Number(govtFees.ticket || 0) + Number(govtFees.iqama || 0)
        ) * costInflationForYear;
        return basicSum + gosiSum + insurance + expatFees;
    }

    function marketingAtYear(yearNum, costInflationForYear) {
        let sum = 0;
        for (const c of operatingCampaigns) {
            const base = Number(c.monthly || 0) * 12;
            const growthRate = Number(c.annualGrowthRate);
            const growth = Number.isFinite(growthRate) ? Math.pow(1 + growthRate, yearNum - 1) : costInflationForYear;
            sum += base * growth;
        }
        return sum;
    }

    // جدول رواتب/تسويق مُسمّى لكل وظيفة/حملة على حدة — لعرضه في التصديرات (لا يُستهلك في
    // حساب القرار، فقط عرض تفصيلي مماثل لـ assetSchedule أعلاه).
    const payrollByPosition = operatingPositions.map(pos => {
        const growthRate = Number(pos.salaryGrowthRate);
        const hasCustomGrowth = Number.isFinite(growthRate);
        const rate = pos.nationality === 'expat' ? 0.02 : gosiRate;
        return {
            position: pos.position || 'وظيفة',
            nationality: pos.nationality || null,
            count: Number(pos.count || 1),
            growthRateUsed: hasCustomGrowth ? growthRate : inflation,
            byYear: Array.from({ length: years }, (_, idx) => {
                const yearNum = idx + 1;
                const growth = hasCustomGrowth ? Math.pow(1 + growthRate, yearNum - 1) : Math.pow(1 + inflation, yearNum - 1);
                const basic = Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12) * growth;
                return basic * (1 + rate);
            })
        };
    });

    const marketingByChannel = operatingCampaigns.map(c => {
        const growthRate = Number(c.annualGrowthRate);
        const hasCustomGrowth = Number.isFinite(growthRate);
        return {
            name: c.name || 'حملة',
            channel: c.channel || null,
            growthRateUsed: hasCustomGrowth ? growthRate : inflation,
            byYear: Array.from({ length: years }, (_, idx) => {
                const yearNum = idx + 1;
                const growth = hasCustomGrowth ? Math.pow(1 + growthRate, yearNum - 1) : Math.pow(1 + inflation, yearNum - 1);
                return Number(c.monthly || 0) * 12 * growth;
            })
        };
    });

    // التكاليف الثابتة الشهرية المعرفة على مستوى كل خدمة
    const annualServiceFixed = serviceItems.reduce((acc, s) => acc + (Number(s.fixedCosts || 0) * 12), 0);

    let totalFixedOpexYear1 = annualPayroll + annualLogisticsFixed + annualAdmin + annualMarketing + annualServiceFixed;
    if (opexMult !== 1) totalFixedOpexYear1 *= opexMult;

    // ═══════════════════════════════════════════════════════════
    // 2. CAPEX (التكاليف الاستثمارية)
    // ═══════════════════════════════════════════════════════════

    const isCorporate = study[SECTIONS.PROJECT_INFO]?.businessModel === 'Corporate_Venture';
    const corporateAssets = study[SECTIONS.PROJECT_INFO]?.corporateAssets || [];

    // نسبة التوفير المؤسسي = كسر عشري في [0, 1] (التسمية في labels.js: «نسبة التوفير (0.1 - 1.0)»).
    // إصلاح 2026-08-25: كانت تُقرأ بلا أي حدّ، فمُدخَل «40» (بنيّة 40%) يُنتج (1 − 40) = −39
    // ⇒ أساس أصل سالب ⇒ capex سالب، ونقد إحلال سالب يدخل سطر التدفق النقدي كأنه إيراد
    // (NPV قفز من 721,352 إلى 12,897,050 على نفس المُعطى، وIRR = null). والنطاق السالب
    // يضخّم التكاليف بالمثل (−0.2 ⇒ ×1.2). التقييد هنا حاجز أمان عددي فقط — التصحيح الفعلي
    // مسؤولية المستخدم، وqaChecks.js (فحص 14) يُنبّهه صراحة قبل التقييد. لا نقسم على 100
    // نيابةً عنه: تخمين النية صامتاً أخطر من التقييد المُعلَن.
    const getSaving = (category) => {
        if (!isCorporate) return 0;
        const asset = corporateAssets.find(a => a.costSavingType === category);
        if (!asset) return 0;
        const raw = Number(asset.savingPercentage);
        if (!Number.isFinite(raw)) return 0;
        return Math.min(1, Math.max(0, raw));
    };

    // استراتيجية الإطلاق: Full_Launch = 1.0 / Pilot_Phase = 0.5 / Outsourcing = 0.3
    const launchStrategy = marketing.marketAnalysis?.launchStrategy || 'Full_Launch';

    const sumAsset = (arr, category) => toArray(arr).reduce((acc, item) => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const saving = getSaving(category);
        return acc + (cost * qty * (1 - saving));
    }, 0);

    // طوارئ على المعدات + مضاعف استراتيجية الإطلاق
    const equipmentBase = sumAsset(technical.equipment, 'Equipment') * (launchStrategy === 'Outsourcing' ? 0.3 : (launchStrategy === 'Pilot_Phase' ? 0.5 : 1.0));
    const equipmentContingency = equipmentBase * computedContingencyRate;
    const equipmentTotal = equipmentBase + equipmentContingency;

    const initialEstablishmentTotal = toArray(technical.establishmentCosts).reduce((acc, item) => acc + Number(item.amount || 0), 0);
    // إطفاء التأسيس بند-ببند مع عمره (life = round(1/rate)، الافتراضي 20% ⇒ 5 سنوات).
    // كان يُحمَّل ثابتاً كل سنوات الإسقاط فيتجاوز 100% من كلفته عند أفق>5 سنوات
    // (أفق 10 ⇒ 200%). يُقصّ الآن عند استنفاد عمره مثل البنود القابلة للإحلال. (تدقيق ٢٠٢٦-٠٧-٠٨)
    //
    // إصلاح 2026-08-25: الشرط اليدوي `yr <= life ? dep : 0` كان بلا حقل base وبلا سقف
    // على المجموع، فيُطفئ life × rate من الأصل — وهي ≠ 1 عموماً لأن life تقريب لأقرب سنة:
    //   • rate = 0.15 (منتصف نطاق DynamicTable [0.10, 0.20]، وهو ما يقترحه الساحر نفسه)
    //     ⇒ life = 7 ⇒ 7 × 15,000 = 105,000 على أصل 100,000 (105%) ⇒ isBalanced = false
    //     واختلال 5,000 في السنة السابعة (زر أفق «7 سنوات» جاهز في الواجهة).
    //   • rate = 0.40 ⇒ life = round(2.5) = 3 ⇒ 120,000 (120%) ⇒ اختلال 20,000 من السنة 3
    //     ضمن الأفق الافتراضي.
    // الحل: نفس itemDepAtYear المستخدمة للأصول الدائمة والقابلة للإحلال — سقف على المتبقي،
    // والسنة الأخيرة تستوعبه كاملاً ⇒ Σ الإطفاء = amount بالضبط. توحيد المسارات الثلاثة
    // على منطق واحد بدل ثلاث نسخ قابلة للانحراف.
    const establishmentAmortItems = toArray(technical.establishmentCosts).map(item => {
        const rate = rateOrDefault(item.amortizationRate, 0.20);
        const base = Number(item.amount || 0);
        return { base, dep: base * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
    });
    const establishmentAmortAtYear = (yr) => establishmentAmortItems.reduce(
        (d, it) => d + itemDepAtYear(it, yr), 0);

    const capexBreakdown = {
        establishment: initialEstablishmentTotal,
        buildings: sumAsset(technical.buildings, 'Buildings'),
        equipment: equipmentTotal,
        furniture: sumAsset(technical.furniture, 'Furniture'),
        vehicles: sumAsset(technical.vehicles, 'Vehicles'), // كانت مدخلاً ميتاً
        techResources: sumAsset(techResources.techResources, 'TechResources'),
        franchiseFee: (study[SECTIONS.PROJECT_INFO]?.businessModel === 'Franchise') ?
            Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.entryFee || 0) : 0,
        licenses: sumAsset(legal.licenses, 'Licenses'),
        preOpeningMarketing: (marketing.campaigns || [])
            .filter(c => c.type === 'capital')
            .reduce((acc, c) => acc + (Number(c.amount || 0)), 0) * (launchStrategy === 'Pilot_Phase' ? 0.6 : 1.0),
        servicesCapex: serviceItems.reduce((acc, s) => acc + Number(s.capex || 0), 0),
        ventureBuilder: (study[SECTIONS.FINANCING]?.ventureBuilderFees?.fixedFee || 0),
        envMitigation: (study[SECTIONS.TECHNICAL]?.environmentalMitigationCost || 0),
        validation: 0
    };

    // إجمالي «رأس مال التأسيس» (يُجمع مرة واحدة — كان يُزدوج في capitalStructure)
    const establishmentTotal =
        capexBreakdown.establishment +
        capexBreakdown.preOpeningMarketing +
        capexBreakdown.licenses +
        capexBreakdown.franchiseFee +
        capexBreakdown.ventureBuilder +
        capexBreakdown.validation +
        capexBreakdown.envMitigation;
    const {
        annualDepreciation,
        permanentDepAtYear,
        replaceableDepAtYear,
        getReplacementCostAtYear,
        getReplacementByCategoryAtYear,
        replaceableItems
    } = buildDepreciationModel({
        technical,
        techResources,
        // equipmentTotal لم يعد يُمرَّر (2026-08-25): كان مدخل النسبة المصمتة 0.15 في
        // annualDepreciation، وصار المكوّن مشتقاً من replaceableItems داخل الوحدة نفسها.
        capexBreakdown,
        launchStrategy,
        getSaving,
        // 2026-08-25: صارت الدالة (لا المجموع الثابت establishmentAmortization) هي المُمرَّرة —
        // annualDepreciation داخل الوحدة يحتاج شحن السنة الأولى الفعلي، وقد يختلف عن
        // Σ amount×rate بعد تقييد itemDepAtYear (life = 1 مثلاً تستوعب كامل الأصل).
        establishmentAmortAtYear,
        // 2026-08-25: نسبة الطوارئ الفعلية المستخدمة في رسملة المعدات أعلاه (السطر 415) —
        // كانت depreciation.js تفترضها مصمتة 1.10 فينفصل أساس الإهلاك عن المبلغ المُرسمَل
        // كلما اختلفت النسبة الفعلية عن 10% (contingencyRate مُدخَل و/أو riskPremium > 0).
        computedContingencyRate
    });

    // جدول إهلاك مسمّى لكل أصل قابل للإحلال (معدات/أثاث/موارد تقنية) — replaceableItems
    // كانت داخلية فقط (تُستخدم لحساب replaceableDepAtYear المجمَّع)، الآن تُعرض كجدول
    // بقيمة إهلاك سنوية لكل أصل حتى انتهاء عمره الافتراضي، بدل رقم فئة واحد مجمَّع.
    // إصلاح 2026-08-25: byYear كان يُبنى بـ itemDepAtYear (بلا وعي بالإحلال) فيطبع أصفاراً
    // لكل سنة بعد الجيل الأول بينما قائمة الدخل تشحن إهلاك الجيل البديل — جدول معروض
    // ومُصدَّر (Excel/Word/ReportGenerator) يناقض القوائم المالية في نفس الملف
    // (330,000 مقابل 1,100,000 على أفق 10 لمعدة بعمر 3). الآن نفس دالة قائمة الدخل.
    const assetSchedule = toArray(replaceableItems).map(it => ({
        name: it.name,
        category: it.category,
        // المبلغ الاسمي بالقسط الثابت (base × rate) — يُعرض كعمود «الإهلاك السنوي» في
        // المصدّرات. يبقى كما هو عمداً: byYear هو المرجع للسنة-بالسنة، وقد تختلف عنه
        // السنة الأخيرة من كل جيل (تستوعب متبقي التقريب) دون أن يكون ذلك «الإهلاك السنوي».
        annualDepreciation: it.dep,
        usefulLifeYears: it.life || null,
        byYear: Array.from({ length: years }, (_, idx) => replaceableItemDepAtYear(it, idx + 1))
    }));

    let totalCapex = Object.values(capexBreakdown).reduce((a, b) => a + b, 0);
    if (capexMult !== 1) totalCapex *= capexMult;

    // ═══════════════════════════════════════════════════════════
    // 3. مصادر الإيراد الموحدة (تشغيلية/غير تشغيلية) مع نمو لكل مصدر
    // ═══════════════════════════════════════════════════════════
    const { revenueSources, sourcesAtYear } = buildRevenueModel({
        study,
        SECTIONS,
        serviceItems,
        getSaving
    });

    const sumSources = (operating, field) =>
        revenueSources.filter(s => s.operating === operating).reduce((a, s) => a + s[field], 0);
    const year1OperatingRevenueBase = sumSources(true, 'rev1');
    const year1OperatingVCBase = sumSources(true, 'vc1');
    const year1Units = sumSources(true, 'units1');
    const year1NonOperatingRevenueBase = sumSources(false, 'rev1');

    // ═══════════════════════════════════════════════════════════
    // 3.5 مصالحة الطاقة (Capacity Reconciliation) — سقف مادي للمبيعات
    // «تبيع 20 ألف عميل/شهر؟ كم مقعداً؟ كم دورة؟» — أول سؤال يطرحه مدقق محترف
    // ═══════════════════════════════════════════════════════════
    let capacityCheck = null;
    {
        const capRow = toArray(technical.capacityModel)[0];
        const modelMaxMonthly = capRow
            ? (Number(capRow.maxUnitsPerMonth) ||
                (Number(capRow.seats || 0) * Number(capRow.turnsPerDay || 0) * Number(capRow.daysPerMonth || 26)))
            : 0;
        // خطة الاستفادة 2026-07-12 (بند 1.2): كان الفحص يقرأ capacityModel (مقاعد/دورات) فقط
        // ويتجاهل بصمت حقل «السعة السنوية» العام productionCapacity.annualCapacity الذي يملؤه
        // العميل من خطوة «الأصول والتجهيزات» — فيمر تخطيط مبيعات مستحيل مادياً بلا تحذير إن لم
        // يملأ العميل نموذج المقاعد تحديداً. عند توفر الاثنين معاً يُستخدم الأدنى (الأكثر تقييداً)
        // كسقف فعلي؛ عند توفر أحدهما فقط يُستخدم وحده.
        const annualCapacityMonthly = Number(technical.productionCapacity?.annualCapacity || 0) / 12;
        const capacityCandidates = [modelMaxMonthly, annualCapacityMonthly].filter(v => v > 0);
        const maxMonthly = capacityCandidates.length > 0 ? Math.min(...capacityCandidates) : 0;
        if (maxMonthly > 0) {
            const plannedMonthly = year1Units / 12;
            capacityCheck = {
                maxUnitsPerMonth: Math.round(maxMonthly),
                plannedUnitsPerMonth: Math.round(plannedMonthly),
                utilizationOfMax: maxMonthly > 0 ? plannedMonthly / maxMonthly : null,
                exceeded: plannedMonthly > maxMonthly,
                source: capacityCandidates.length === 2 ? 'both' : (modelMaxMonthly > 0 ? 'capacityModel' : 'annualCapacity')
            };
        }
    }

    // منحنى التصاعد (Ramp-Up): الإيراد لا يقفز لكامل الخطة من الشهر الأول —
    // معامل السنة الأولى = متوسط منحنى خطي يبلغ 100% عند شهر rampUpMonths
    const rampUpMonths = Math.max(0, Math.min(24, Number(study.assumptions?.rampUpMonths || 0)));
    const rampFactorY1 = calculateRampFactorY1(rampUpMonths);

    // ═══════════════════════════════════════════════════════════
    // 4. رأس المال العامل: دورة نقدية فعلية (DSO/DIO/DPO) إن حُددت،
    //    وإلا فترات تغطية بالأشهر (الطريقة المبسطة)
    // ═══════════════════════════════════════════════════════════
    const wcMonths = Number(study.assumptions?.workingCapitalMonths);
    const baseMonths = Number.isFinite(wcMonths) && wcMonths > 0 ? wcMonths : 3;
    const coverage = {
        rent: Math.max(6, baseMonths), // الإيجار يُدفع عادة نصف سنوي
        salaries: baseMonths,
        cogs: baseMonths,
        marketing: baseMonths,
        other: baseMonths
    };

    const monthlyRentAndAdmin = (annualLogisticsFixed + annualAdmin) / 12;
    const wcRent = monthlyRentAndAdmin * coverage.rent;
    const monthlyPayroll = annualPayroll / 12;
    const wcSalaries = monthlyPayroll * coverage.salaries;
    const monthlyMarketing = annualMarketing / 12;
    const wcMarketing = monthlyMarketing * coverage.marketing;
    // تدقيق 2026-07-08 (ملاحظة عالية #38): annualLogisticsVariable لم تكن تُغطَّى بأي
    // مخزون رأس مال عامل بعد فصلها عن monthlyRentAndAdmin — كانت تختفي من حساب
    // الاستثمار الكلي بدل أن تنتقل لتغطية COGS (نفس منطق: تكلفة تتبع الحجم تحتاج غطاء نقدياً).
    const monthlyVariable = (year1OperatingVCBase + annualLogisticsVariable) / 12;
    let wcCOGS = monthlyVariable * coverage.cogs;

    // سياسة الدورة النقدية: AR + مخزون − ذمم موردين تحل محل مخزون «الأشهر» —
    // حاسمة لنشاط B2B (تحصيل آجل) أو مخزون بطيء الدوران
    const wcp = study.assumptions?.workingCapitalPolicy || {};
    const dso = Number(wcp.dsoDays);
    const dpo = Number(wcp.dpoDays);
    const dio = Number(wcp.dioDays);
    const hasCashCycle = [dso, dpo, dio].some(v => Number.isFinite(v) && v > 0);
    // دالة موحّدة لحساب الدورة النقدية لأي سنة (إيراد وتكلفة متغيرة تشغيلية لتلك السنة) —
    // تُستخدم لسنة الأساس (rev1Total/year1OperatingVCBase) هنا، ولاحقاً لكل سنة إسقاط داخل
    // حلقة قائمة الدخل (ΔNWC السنوي) بنفس المنطق حرفياً.
    const computeCashCycle = (revBase, vcBase) => {
        const ar = revBase * (Number.isFinite(dso) && dso > 0 ? dso : 0) / 365;
        const inv = vcBase * (Number.isFinite(dio) && dio > 0 ? dio : 0) / 365;
        const ap = vcBase * (Number.isFinite(dpo) && dpo > 0 ? dpo : 0) / 365;
        return { receivables: ar, inventory: inv, payables: ap, net: Math.max(0, ar + inv - ap) };
    };
    let cashCycle = null;
    if (hasCashCycle) {
        const rev1Total = year1OperatingRevenueBase + year1NonOperatingRevenueBase;
        cashCycle = computeCashCycle(rev1Total, year1OperatingVCBase);
        wcCOGS = cashCycle.net; // يحل محل تغطية COGS بالأشهر
    }

    const workingCapital = wcRent + wcSalaries + wcMarketing + wcCOGS;
    // المخزون الافتتاحي: بند رأسمالي يُموَّل عند التأسيس لكنه أصل متداول — خارج capexBreakdown
    // عمداً كي لا يدخل الإهلاك الدفتري ولا مجمعات الإهلاك الزكوي (كان حشره في نفقات التأسيس
    // يُطفئه 20% سنوياً ويخفيه من الأصول المتداولة — تدقيق ٢٠٢٦-٠٧-٠٦).
    const openingInventory = Math.max(0, Number(technical.openingInventory || 0));
    const totalInvestment = totalCapex + openingInventory + workingCapital;

    // ═══════════════════════════════════════════════════════════
    // 4.5 إهلاك نظامي (زكوي/ضريبي) بالقسط المتناقص — مجموعات ZATCA مبسطة:
    //     مبانٍ ثابتة 5%، آلات/معدات/حاسبات/مركبات 25%، أخرى (أثاث…) 10%.
    //     يُستخدم لحساب الربح المعدل زكوياً؛ الإهلاك الدفتري (الخطي) يبقى للقوائم.
    //
    // أُغلقت الفجوة المؤجَّلة (2026-08-25، الجبهة الرابعة): كانت المجموعات تُرصَّد مرة
    // واحدة من capexBreakdown عند التأسيس فلا تُضاف إليها أصول الإحلال المشتراة لاحقاً —
    // بينما الإهلاك الدفتري صار يشملها بعد إصلاح P0. فكان الإهلاك النظامي يُبخَّس في
    // السنوات المتأخرة فيرتفع «الربح المعدل» وقد يرتفع معه وعاء الزكاة بلا سند.
    // الآن كل دفعة إحلال تُضاف إلى **مجموعتها الصحيحة** (معدات/موارد تقنية 25%، أثاث 10%)
    // في سنة شرائها، قبل احتساب إهلاك تلك السنة — مطابقةً للإهلاك الدفتري الذي يبدأ في
    // سنة الشراء أيضاً. التفصيل بالفئة ضروري: افتراض مجموعة واحدة لكل الإحلال كان
    // سيُهلك الأثاث بـ25% بدل 10%.
    // ═══════════════════════════════════════════════════════════
    const taxDepByYear = (() => {
        const pools = [
            { balance: capexBreakdown.buildings, rate: 0.05 },
            {
                balance: capexBreakdown.equipment + capexBreakdown.vehicles +
                    capexBreakdown.techResources + capexBreakdown.servicesCapex,
                rate: 0.25
            },
            { balance: capexBreakdown.furniture + capexBreakdown.establishment, rate: 0.10 }
        ];
        // خريطة الفئة ⟶ المجموعة النظامية. الفئات هي نفسها المستعملة في
        // buildReplaceable، والمجموعات بترتيب pools أعلاه (0 مبانٍ، 1 معدات، 2 أثاث).
        const POOL_OF_CATEGORY = { Equipment: 1, TechResources: 1, Furniture: 2 };
        const out = [];
        for (let y = 0; y < years; y++) {
            // إضافات الإحلال أولاً: الأصل المشترى في سنة y يُهلَك نظامياً ابتداءً منها،
            // كما يفعل الإهلاك الدفتري بالضبط (replaceableItemDepAtYear عند a = 1).
            const additions = getReplacementByCategoryAtYear(y + 1);
            Object.entries(additions).forEach(([category, amount]) => {
                const idx = POOL_OF_CATEGORY[category];
                if (idx !== undefined) pools[idx].balance += amount;
            });
            let dep = 0;
            pools.forEach(p => {
                const d = p.balance * p.rate;
                dep += d;
                p.balance -= d;
            });
            out.push(dep);
        }
        return out;
    })();

    // ═══════════════════════════════════════════════════════════
    // 5. معدل استغلال الطاقة (مع استيفاء خطي بين السنوات المعرفة)
    // ═══════════════════════════════════════════════════════════
    const capacityUtilization = study[SECTIONS.TECHNICAL]?.capacityUtilization || [];
    const getUtilizationRate = (yearLine) => {
        if (capacityUtilization.length === 0) return 1.0;
        const entry = capacityUtilization.find(r => Number(r.year) === yearLine);
        if (entry) return Number(entry.rate);
        const sorted = [...capacityUtilization].sort((a, b) => Number(a.year) - Number(b.year));
        if (yearLine < Number(sorted[0].year)) return Number(sorted[0].rate);
        const last = sorted[sorted.length - 1];
        if (yearLine > Number(last.year)) return Number(last.rate);
        // بين سنتين معرفتين: استيفاء خطي (كانت الفجوة تقفز إلى 100%)
        let before = sorted[0];
        let after = last;
        for (const r of sorted) {
            if (Number(r.year) < yearLine) before = r;
            else if (Number(r.year) > yearLine) { after = r; break; }
        }
        const span = Number(after.year) - Number(before.year);
        if (span <= 0) return Number(before.rate);
        const t = (yearLine - Number(before.year)) / span;
        return Number(before.rate) + t * (Number(after.rate) - Number(before.rate));
    };

    // ═══════════════════════════════════════════════════════════
    // 6. التمويل: جدول سداد PMT فعلي (مصدر واحد للفوائد والأقساط)
    // ═══════════════════════════════════════════════════════════
    const financing = study[SECTIONS.FINANCING] || {};
    const loanAmount = financing.sources?.bankLoan?.amount || 0;
    // rateOrDefault يحترم الصفر الصريح: قرض 0% (بنك التنمية الاجتماعية/الزراعية) يجب أن يبقى 0% لا 8%.
    const interestRate = rateOrDefault(financing.sources?.bankLoan?.interestRate, 0.08);
    const loanTerm = financing.sources?.bankLoan?.termYears || 5;
    const gracePeriodMonths = Number(financing.sources?.bankLoan?.gracePeriodMonths || 0);
    const repaymentType = financing.sources?.bankLoan?.repaymentType || 'equal';

    let loanScheduleData = null;
    if (loanAmount > 0) {
        try {
            loanScheduleData = computeLoanSchedule(loanAmount, interestRate, loanTerm, gracePeriodMonths, repaymentType);
        } catch (_) { loanScheduleData = null; }
    }
    const loanYear = (y) => loanScheduleData?.annualSummary?.find(s => s.year === y) || null;

    // ═══════════════════════════════════════════════════════════
    // 7. الإسقاطات (قائمة الدخل والتدفقات لسنوات الدراسة)
    // ═══════════════════════════════════════════════════════════
    const incomeStatement = [];

    // ═══ إزالة ازدواج عبء القرض (تدقيق ٢٠٢٦-٠٧-٠٦) ═══
    // التدفقات السنوية «بعد التمويل» أصلاً (الفائدة تُخصم عبر EBT وأصل القرض عبر financingCF)،
    // بينما كانت سنة الصفر تتحمل كامل الاستثمار دون إثبات دخول القرض — فيُدفع القرض مرتين
    // (مرة ضمن الاستثمار ومرة كأقساط) ويظهر الرصيد التراكمي سالباً بمقدار القرض زوراً.
    // التصحيح: سنة الصفر تتحمل حصة المالك النقدية فقط (الاستثمار − القرض)، فتصبح
    // NPV/IRR/الاسترداد كلها على أساس حقوق الملكية (levered/equity basis) — متسقة مع تدفقاتها.
    const equityOutlay = Math.max(0, totalInvestment - loanAmount);
    let cumulativeCashFlow = -equityOutlay;
    let cumulativeDiscountedCashFlow = -equityOutlay;
    let paybackPeriod = Infinity;
    let discountedPaybackPeriod = Infinity;
    // انتكاس بعد العبور: عبر التراكمي الصفر ثم عاد سالباً ولم يتعافَ حتى نهاية الأفق —
    // يميّزه عن «لم يعبر قط» في paybackReason أدناه (نفس اصطلاح breakEvenReason/dscrReason).
    let paybackReverted = false;

    // حقوق الملكية للوعاء الزكوي والميزانية: مساهمة المالك المُدخلة في خطوة التمويل هي
    // مصدر الحقيقة؛ الاشتقاق (الاستثمار − القرض) يبقى احتياطاً فقط عند غياب الإدخال —
    // كان يُشتق دائماً فيظهر «رأس مال مدفوع» لا يطابق ما أدخله المستخدم (رقم plug).
    const enteredEquityLike =
        Number(financing.sources?.equity?.amount || 0) +
        Number(financing.sources?.investors?.amount || 0) +
        Number(financing.sources?.governmentSupport?.amount || 0);
    const paidCapital = enteredEquityLike > 0 ? enteredEquityLike : equityOutlay;
    // فجوة التمويل الصريحة: موجبة = مصادر أقل من الاستثمار (يجب سدها)، سالبة = فائض
    const fundingGap = totalInvestment - (paidCapital + loanAmount);
    // حد مادية الفجوة (تدقيق ٢٠٢٦-٠٧-٠٩): مصادر التمويل تُدخَل في خطوة سابقة من المعالج
    // على أساس إجمالي استثمار محسوب في تلك اللحظة، بينما totalInvestment أعلاه يُعاد حسابه
    // حياً من كل بند CAPEX/رأس مال عامل — أي تعديل لاحق في خطوات تالية (تسويق، تشغيل...)
    // يُحرّك totalInvestment قليلاً فتظهر «فجوة» زائفة رغم أن المستخدم موّل المشروع بالكامل
    // فعلياً وقت إدخاله. كانت > 1 ريال تُصعّد أي انحراف تقريب عادي (لوحظ فعلياً ٩٤٥ ريالاً
    // من ٣٩٠٬٩٥٧ = ٠٫٢٤٪) إلى REVISE حرجة رغم مؤشرات مالية مثالية. الحد: 1% من الاستثمار
    // الإجمالي (بحد أدنى 1000 ريال) يُفرّق فجوة حقيقية تستحق REVISE عن انحراف تسلسل الخطوات.
    const fundingGapMaterialityThreshold = Math.max(1000, totalInvestment * 0.01);
    let retainedEarningsStart = 0; // الأرباح المحتجزة في بداية كل سنة
    // تراكم الإهلاك الدفتري الفعلي (غير خطي: يتوقف الجزء القابل للإحلال/التأسيس عند
    // استنفاد عمره) لبداية كل سنة — يُستخدم في صافي الأصول الثابتة للوعاء الزكوي
    // بدل التقريب الخطي annualDepreciation×yearIndex الذي كان يفترض إهلاكاً ثابتاً للأبد.
    let cumulativeDepreciationPriorYears = 0;
    // 2026-08-25: الإحلال المُرسمَل في السنوات السابقة — لازم كي يطابق الوعاء الزكوي تعريف
    // fixedAssetsGross في lib/calc/balanceSheet.js:45 (capex.subtotal + cumulativeReplacement).
    let cumulativeReplacementPriorYears = 0;

    // ΔNWC السنوي: رأس المال العامل التأسيسي (cashCycle أعلاه) يبقى كما هو لحساب
    // totalInvestment — هذا فقط يتتبّع التغيّر السنوي في صافي رأس المال العامل (AR+مخزون−ذمم
    // موردين) مع نمو الإيراد/التكلفة الفعليين، لخصمه من التدفق النقدي واسترداده في آخر سنة.
    let prevNWC = hasCashCycle ? cashCycle.net : 0;
    const cashCycleByYear = [];

    for (let i = 1; i <= years; i++) {
        const yearIndex = i - 1;
        const utilRate = getUtilizationRate(i);
        const costInflation = Math.pow(1 + inflation, yearIndex);
        // منحنى التصاعد يطال السنة الأولى فقط (الحجم لا يبدأ كاملاً من الشهر الأول)
        const rampFactor = i === 1 ? rampFactorY1 : 1;

        // التشغيلي يتدرج مع الاستغلال؛ غير التشغيلي دخل شبه ثابت
        // السعر يحرك الإيراد فقط؛ الحجم يحرك الإيراد والتكاليف المتغيرة معاً
        const opRev = sourcesAtYear(true, 'rev1', yearIndex) * revMult * priceMult * volumeMult * utilRate * rampFactor;
        // الوحدات التشغيلية الفعلية لهذه السنة — نفس مضاعِفات الحجم المطبَّقة على opRev/opVC
        // بالضبط (بلا priceMult/vcRateMult: السعر ومعدل التكلفة لا يغيّران عدد الوحدات).
        // مصدر واحد لمقام «هامش المساهمة للوحدة» أدناه، كي لا يُقسَم إيراد بمقياس على وحدات
        // بمقياس آخر (فخّ موثَّق: إيراد مخفّض بالاستغلال ÷ وحدات كاملة يضاعف التعادل زوراً).
        const opUnits = sourcesAtYear(true, 'units1', yearIndex) * volumeMult * utilRate * rampFactor;
        // التكاليف المتغيرة تتبع حجم المبيعات في الاتجاهين (كانت غير متماثلة:
        // زيادة الإيراد لم تكن ترفعها فينتفخ السيناريو المتفائل)
        const opVC = sourcesAtYear(true, 'vc1', yearIndex) * costInflation * revMult * volumeMult * vcRateMult * utilRate * rampFactor;
        const nonOpRev = sourcesAtYear(false, 'rev1', yearIndex) * revMult * priceMult;
        const nonOpVC = 0;
        // تدقيق 2026-07-08 (ملاحظة عالية #38): الحصة المتغيرة من اللوجستيات (variablePercent)
        // تتبع الحجم الفعلي فعلياً (لا سعر البيع) — نفس منطق مضاعِف opVC بلا vcRateMult/priceMult
        // لأنها تكلفة تشغيلية مباشرة لا تكلفة بضاعة مرتبطة بمعدل تكلفة الإيراد.
        const logisticsVC = annualLogisticsVariable * costInflation * volumeMult * utilRate * rampFactor;

        const totalRevenue = opRev + nonOpRev;
        const totalVariableCosts = (opVC + nonOpVC + logisticsVC) * opexMult;

        // الدورة النقدية الفعلية لهذه السنة — القاعدة عمداً opVC فقط (التكلفة المتغيرة
        // التشغيلية) لا totalVariableCosts (التي تضم logisticsVC): قرار مالك المنتج
        // 2026-08-24 أن يبقى مخزون/ذمم الموردين مبنياً على نفس قاعدة سنة الأساس تماماً
        // (year1OperatingVCBase أعلاه)، بلا توسعة لتشمل تكاليف اللوجستيات.
        const yearCashCycle = hasCashCycle ? computeCashCycle(totalRevenue, opVC) : null;
        const nwc = yearCashCycle ? yearCashCycle.net : 0;
        const deltaNWC = hasCashCycle ? (nwc - prevNWC) : 0;
        prevNWC = nwc;
        cashCycleByYear.push(yearCashCycle);

        const grossProfit = totalRevenue - totalVariableCosts;

        // المصاريف الثابتة تتضخم مع الزمن — الرواتب والتسويق تدعمان الآن معدل نمو مخصص لكل
        // بند (salaryGrowthRate/annualGrowthRate)؛ عند غيابه تتصرف كل بند بالضبط كما كان
        // (costInflation الموحّد)، فتُنتج payrollAtYear/marketingAtYear نفس annualPayroll*
        // costInflation و annualMarketing*costInflation السابقتين حرفياً (توافق رجعي مضمون).
        const payroll = payrollAtYear(i, costInflation) * (1 - getSaving('HR'));
        const rentAndAdmin = (annualLogisticsFixed + annualAdmin) * costInflation * (1 - getSaving('AdminLogistics'));
        const mkt = marketingAtYear(i, costInflation) * (1 - getSaving('Marketing'));
        const svcFixed = annualServiceFixed * costInflation;

        // الطوارئ التشغيلية المخفية (كان يقرأ SECTIONS.FINANCIAL غير الموجود → صفر دائماً)
        const overheadRate = (study.assumptions?.hiddenOverheadsRate || 0) / 100;
        const baseFixed = (payroll + rentAndAdmin + mkt + svcFixed) * opexMult * fixedMult;
        const hiddenOverheads = baseFixed * overheadRate;
        const fixedCosts = baseFixed + hiddenOverheads;

        // إتاوات الفرنشايز على الإيراد التشغيلي فقط
        let franchiseCo = 0;
        if (study[SECTIONS.PROJECT_INFO]?.businessModel === 'Franchise') {
            const royaltyRate = Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.royaltyRate || 0) / 100;
            const marketingFee = Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.marketingFee || 0) / 100;
            franchiseCo = opRev * (royaltyRate + marketingFee);
        }

        const ebitda = grossProfit - fixedCosts - franchiseCo;

        // رسوم نجاح Venture Builder (كانت تُحسب ثم تُهمل)
        let builderSuccessFee = 0;
        if (isCorporate) {
            const successFeeRate = Number(study[SECTIONS.FINANCING]?.ventureBuilderFees?.successFee || 0) / 100;
            builderSuccessFee = Math.max(0, ebitda * successFeeRate);
        }
        const ebitdaFinal = ebitda - builderSuccessFee;

        // إحلال الأصول قصيرة العمر (يبدأ من السنة التالية لانتهاء العمر) — 2026-08-25:
        // مصدر واحد مشترك مع أساس الإهلاك في depreciation.js (كلاهما replacementBase لنفس
        // العنصر)، بعد أن كان منطقاً مكرراً هنا يمكن أن ينحرف عنه (getReplacementCostAtYear
        // كانت مفكَّكة أعلاه بلا أي استخدام — كود ميت). القيمة تغيّرت عمداً في نفس اليوم
        // (ع-2): صارت replacementBase = base المُقيَّس (cost×qty×(1−saving)×scale) لا cost×qty
        // الخام — الأصل البديل هو نفس الأصل بنفس نمذجته، فيتطابق نقد الإحلال مع المُرسمَل.
        const replacementCost = getReplacementCostAtYear(i);

        // Bug B: الإهلاك الدفتري لا يبقى ثابتاً للأبد — الأصناف القابلة للإحلال
        // تتوقف عن الإهلاك الدفتري بعد استنفاد عمرها الأصلي (صُرِفت نقداً كإحلال).
        // تصحيح إضافي (تدقيق حي 2026-07-22): الجزء «الدائم» (مبانٍ/مركبات/خدمات) كان
        // يُفترَض خطأً أنه يستمر للأبد بلا سقف، فيتجاوز تراكمه تكلفة الأصل ويكسر توازن
        // الميزانية بعد انتهاء عمره الافتراضي — الآن يتوقف عند life كل عنصر أيضاً.
        const depreciation = permanentDepAtYear(i) + replaceableDepAtYear(i) + establishmentAmortAtYear(i);
        const ebit = ebitdaFinal - depreciation;

        // فائدة وأصل القرض من جدول السداد الفعلي (PMT + فترة سماح)
        const yearLoan = loanYear(i);
        const interest = yearLoan ? yearLoan.totalInterest : 0;
        const principalPaid = yearLoan ? yearLoan.totalPrincipal : 0;

        const ebt = ebit - interest;

        // ═══ الزكاة على الوعاء النظامي الحقيقي (منهجية ZATCA — طريقة مصادر الأموال) ═══
        // الوعاء = حقوق الملكية أول السنة (رأس مال مدفوع + أرباح محتجزة)
        //        + القروض طويلة الأجل (رصيد أول السنة) − صافي الأصول الثابتة أول السنة،
        // ولا يقل نظاماً عن «الربح المعدل» = الربح الدفتري + إهلاك دفتري − إهلاك نظامي متناقص.
        const loanBalanceStart = loanScheduleData
            ? (i === 1 ? loanAmount : (loanScheduleData.annualSummary.find(s => s.year === i - 1)?.endingBalance ?? 0))
            : 0;
        // تصحيح (دفعة ٦): تراكم الإهلاك الفعلي غير الخطي (permanentAnnualDep + replaceableDepAtYear
        // + establishmentAmortAtYear لكل سنة سابقة) بدل annualDepreciation الخطي — كان يفترض
        // استمرار إهلاك الأصول القابلة للإحلال/التأسيس للأبد فيُحرّف صافي الأصول الثابتة (وبالتالي
        // الوعاء الزكوي بطريقة مصادر الأموال) في السنوات التي يُستنفد فيها عمر أي بند منها.
        // تصحيح 2026-08-25: الأصول الثابتة الإجمالية تشمل الإحلال المُرسمَل في السنوات
        // السابقة — نفس تعريف fixedAssetsGross في lib/calc/balanceSheet.js:45 بالضبط. كان
        // الوعاء الزكوي يستبعده فيُبخّس صافي الأصول الثابتة أول السنة ويضخّم الوعاء بطريقة
        // مصادر الأموال، فيختلف نفس البند بين قائمة الزكاة والميزانية المعروضة.
        const netFixedStart = Math.max(0, totalCapex + cumulativeReplacementPriorYears - cumulativeDepreciationPriorYears);
        const taxDepY = taxDepByYear[yearIndex] || 0;
        
        const { zakatBase, zakat, tax, adjustedProfit } = calculateZakatAndTax({
            paidCapital,
            retainedEarningsStart,
            loanBalanceStart,
            netFixedStart,
            taxDepY,
            ebt,
            depreciation,
            zakatRate,
            foreignShare,
            taxRate
        });
        const netIncome = ebt - zakat - tax;
        retainedEarningsStart += netIncome; // ترحيل لبداية السنة التالية
        cumulativeDepreciationPriorYears += depreciation; // نفس الترحيل: تراكم الإهلاك الفعلي لبداية السنة التالية
        // 2026-08-25: بعد netFixedStart أعلاه عمداً — إحلال السنة الجارية يدخل «أول السنة
        // التالية» لا هذه، تماماً كما يفعل slice(0, year) في lib/calc/balanceSheet.js:32.
        cumulativeReplacementPriorYears += replacementCost;

        // التدفق النقدي
        const operatingCF = netIncome + depreciation;
        const financingCF = -principalPaid;
        // استرداد رأس المال العامل في آخر سنة من الأفق (قرار مالك المنتج 2026-08-24، رقم 1):
        // يرفع NPV/IRR لأنه تدفق نقدي حقيقي داخل عند تصفية/نهاية أفق الدراسة، لكنه خارج CFADS
        // كلياً (قرار رقم 3) — cfads() أدناه يقرأ deltaNWC فقط ولا يقرأ nwcRecapture إطلاقاً.
        const isLastYear = i === years;
        const nwcRecapture = (isLastYear && hasCashCycle) ? nwc : 0;
        const netCashFlow = operatingCF + financingCF - replacementCost - deltaNWC + nwcRecapture;

        // الاسترداد لا يُعتمد إلا إن بقي التراكمي ≥ 0 من لحظة العبور حتى نهاية الأفق:
        // أي انتكاس لاحق إلى السالب يُلغي العبور المسجَّل (وعبورٌ جديد بعده يُسجَّل من
        // جديد). قبل هذا التصحيح كان **أول** عبور يُثبَّت للأبد، فمشروعٌ يعبر في السنة
        // الأولى ثم ينهار إلى −4.5 مليون بنهاية الأفق (NPV سالب) كان يعرض «0.8 سنة» —
        // أقوى مؤشر في الملخص التنفيذي وتقرير الممول — ويمرّر passPayback في بوابة القرار.
        const prevCum = cumulativeCashFlow;
        cumulativeCashFlow += netCashFlow;
        if (prevCum < 0 && cumulativeCashFlow >= 0 && netCashFlow > 0) {
            const fraction = Math.abs(prevCum) / netCashFlow;
            paybackPeriod = (i - 1) + fraction;
        } else if (cumulativeCashFlow < 0 && Number.isFinite(paybackPeriod)) {
            paybackPeriod = Infinity;
            paybackReverted = true;
        }

        const df = 1 / Math.pow(1 + discountRate, i);
        const discountedCF = netCashFlow * df;
        const prevCumDiscounted = cumulativeDiscountedCashFlow;
        cumulativeDiscountedCashFlow += discountedCF;
        if (prevCumDiscounted < 0 && cumulativeDiscountedCashFlow >= 0 && discountedCF > 0) {
            const fractionD = Math.abs(prevCumDiscounted) / discountedCF;
            discountedPaybackPeriod = (i - 1) + fractionD;
        } else if (cumulativeDiscountedCashFlow < 0 && Number.isFinite(discountedPaybackPeriod)) {
            discountedPaybackPeriod = Infinity;
        }

        incomeStatement.push({
            year: i,
            revenue: totalRevenue,
            operatingRevenue: opRev,
            operatingUnits: opUnits,
            utilizationRate: utilRate,
            variableCosts: totalVariableCosts,
            grossProfit,
            fixedCosts,
            // تفصيل الثابتة — تستهلكه قوائم الدخل في المصدّرات كي لا تُطبع بنود صفرية
            // بجانب إجمالي غير صفري (تناقض يلتقطه أي محلل ائتمان)
            fixedCostsBreakdown: {
                payroll,
                rentAndAdmin,
                marketing: mkt,
                servicesFixed: svcFixed,
                hiddenOverheads
            },
            franchiseFees: franchiseCo,
            ebitda,
            builderSuccessFee,
            depreciation,
            ebit,
            interest,
            interestExpense: interest,
            ebt,
            profitBeforeZakat: ebt,
            zakat,
            zakatBase,
            adjustedProfit,
            taxDepreciation: taxDepY,
            tax,
            levy: zakat + tax,
            netIncome,
            replacementCost,
            deltaNWC,
            nwcRecapture,
            loanPrincipalPaid: principalPaid,
            cashFlow: netCashFlow
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 8. المؤشرات
    // ═══════════════════════════════════════════════════════════
    // سلسلة التقييم على أساس حقوق الملكية: سنة الصفر = حصة المالك النقدية (الاستثمار − القرض)
    // لأن التدفقات السنوية بعد خدمة الدين أصلاً — انظر تعليق equityOutlay أعلاه.
    const cashFlows = [-equityOutlay, ...incomeStatement.map(y => y.cashFlow)];

    // تصحيح (تدقيق حي 2026-07-22، مُطبَّق 2026-08-21): إن كانت مدة القرض أطول من أفق
    // الدراسة، يبقى رصيد قرض غير مسدَّد عند نهاية السنة الأخيرة — التزام حقيقي على
    // المالك حتى لو توقفت التدفقات المُحتسَبة عند تلك السنة (لا استمرارية مُفترَضة في
    // npv/irr الأساسيين، خلافاً لـnpvWithTerminal أدناه). قبل هذا التصحيح كان تمديد مدة
    // القرض وحده — بلا أي تغيير تشغيلي فعلي — يُخفي هذا الالتزام فيرفع NPV/IRR وهماً،
    // ويمرّ نفس الرقم غير المصحَّح لبوابة القرار GO/REVISE/NO-GO ولكل التقارير المصدَّرة.
    // مصدر واحد (cashflow.js) بدل نسختين متوازيتين — النسخة السابقة هنا كانت تطابق السنة
    // حرفياً، فتُعيد صفراً حين تكون مدة القرض أقصر من الأفق ويبقى رصيد قائم. التفاصيل
    // والقياس في تعليق outstandingDebtAtHorizon.
    const remainingDebtAtHorizon = outstandingDebtAtHorizon(loanScheduleData, years);
    const cashFlowsForDecision = remainingDebtAtHorizon > 0
        ? [...cashFlows.slice(0, -1), cashFlows[cashFlows.length - 1] - remainingDebtAtHorizon]
        : cashFlows;

    // ═══ القيمة النهائية (Terminal Value — نمو Gordon) ═══
    const tvCfg = study.assumptions?.terminalValue || {};
    const lastYearIncomeStatement = incomeStatement[incomeStatement.length - 1] || {};

    const { terminalValueDiscounted } = calculateTerminalValue({
        tvCfg,
        lastYearIncomeStatement,
        discountRate,
        years,
        loanScheduleData
    });

    // القيمة النهائية استرشادية، لا تُخلط مع سلسلة التدفقات النقدية الأساسية.
    // npvOperating (بلا خصم الدين المتبقي) هو أساس npvWithTerminal — لأن terminalValueDiscounted
    // نفسها تخصم remainingDebtAtHorizon من قيمة المنشأة بالفعل (calculateTerminalValue)؛
    // لو استُخدم npv المُصحَّح هنا لتكرر خصم الدين مرتين. npv (المستخدم في بوابة القرار
    // وكل المخرَجات) هو المصحَّح — من cashFlowsForDecision.
    const npvOperating = calculateNPV(discountRate, cashFlows);
    const npv = remainingDebtAtHorizon > 0 ? calculateNPV(discountRate, cashFlowsForDecision) : npvOperating;
    const npvWithTerminal = npvOperating + terminalValueDiscounted;

    const irrSignChanges = countSignChanges(cashFlowsForDecision);
    let irr = calculateIRR(cashFlowsForDecision);
    if (irr != null) {
        const tol = 1e-6;
        if (npv < -tol && irr > discountRate) irr = null;
        else if (npv > tol && irr < discountRate) irr = null;
    }
    const mirr = calculateMIRR(cashFlowsForDecision, discountRate, discountRate);

    // ═══ ضريبة القيمة المضافة (15%) — توقيت نقدي، لا ربحية ═══
    // الأسعار تُفترض غير شاملة للضريبة؛ تُحصَّل على المبيعات وتُخصم على المشتريات
    // وتُورَّد لهيئة الزكاة — أثرها الحقيقي على السيولة (عوّامة/التزام) لا على الربح.
    const VAT_RATE = 0.15;
    const vat = {
        rate: VAT_RATE,
        note: 'الأسعار غير شاملة للضريبة؛ صافي المستحق يُورَّد ربع سنوياً — أثر سيولة لا ربح',
        years: incomeStatement.map(y => {
            const bd = y.fixedCostsBreakdown || {};
            const outputVat = (y.revenue || 0) * VAT_RATE;
            // مدخلات خاضعة: التكاليف المتغيرة + الإيجار/الإدارية + التسويق (الرواتب غير خاضعة)
            const inputVat = ((y.variableCosts || 0) + (bd.rentAndAdmin || 0) + (bd.marketing || 0)) * VAT_RATE;
            const netPayable = Math.max(0, outputVat - inputVat);
            return { year: y.year, outputVat, inputVat, netPayable, avgFloat: netPayable * (45 / 365) };
        })
    };
    const vatByYear = new Map(vat.years.map(v => [v.year, v]));
    // تدقيق 2026-07-08 (ملاحظة متوسطة #6): roi/arr كانا يقسمان على totalInvestment
    // بلا حارس صفر (خلافاً لـ pi/roa/roe المجاورة أدناه) — دراسة جديدة بلا بيانات
    // فنية بعد (totalInvestment=0) كانت تُنتج NaN/Infinity تُعرض حرفياً في الملخص
    // التنفيذي وتحليل المستثمر (فحوصات `?? 0`/`!= null` الموجودة لا تلتقط NaN).
    const roi = totalInvestment > 0 ? (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / totalInvestment) * 100 : 0;
    // مؤشر الربحية على نفس أساس سلسلة NPV (حصة المالك) — كان يقسم على إجمالي الاستثمار
    // بينما NPV محسوبة على المساهمة فيختل المؤشر عند وجود قرض.
    const pi = equityOutlay > 0 ? (npv + equityOutlay) / equityOutlay : 0;
    const avgAnnualProfit = incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length;
    const arr = totalInvestment > 0 ? (avgAnnualProfit / totalInvestment) * 100 : 0;

    const year1 = incomeStatement[0];
    const year1Revenue = year1 ? year1.revenue : 0;
    const year1VariableCosts = year1 ? year1.variableCosts : 0;
    // الإيراد التشغيلي وغير التشغيلي للسنة الأولى بعد كل المضاعِفات (الحلقة أعلاه):
    // كل التكاليف المتغيرة تشغيلية بحكم البناء (nonOpVC = 0 دائماً)، فمقام هامش المساهمة
    // هو الإيراد التشغيلي وحده، والإيراد غير التشغيلي يُعالَج على حدة كخصم من الثوابت.
    const year1OperatingRevenue = year1 ? year1.operatingRevenue : 0;
    const year1NonOperatingRevenue = Math.max(0, year1Revenue - year1OperatingRevenue);
    const year1OperatingCM = year1OperatingRevenue - year1VariableCosts;

    // نقطة التعادل (السنة الأولى) — تعريف واحد قانوني لكل الشاشات والتقارير:
    // الثوابت المحتسبة = ثوابت السنة الأولى الفعلية (شاملة الأوفرهيد الخفي) + الإهلاك الدفتري.
    // كانت الشاشات تتضارب: المحرك بلا إهلاك/أوفرهيد، وشاشة التعادل تضيفهما، والنص المولد ثالثة —
    // ثلاث قيم مختلفة لنفس «نقطة التعادل» في دراسة واحدة (تدقيق ٢٠٢٦-٠٧-٠٦).
    //
    // تصحيح 2026-08-25 (تناقض المسارين): cmRatio كان يُحسب على الإيراد **الكلي**
    // (تشغيلي + غير تشغيلي) بينما هامش المساهمة للوحدة يُحسب على التشغيلي وحده — فيتناقض
    // «التعادل بالريال» مع «التعادل بالوحدات × السعر» بمقدار وزن الإيراد غير التشغيلي
    // (قياس فعلي: تشغيلي 360,000 بهامش 65% + غير تشغيلي 1,000,000 ⟶ 18,185 ريال مقابل
    // 254 وحدة × 100 = 25,400 ريال)، ودائماً في الاتجاه المُطَمئِن زوراً (تعادل يبدو أقرب
    // مما هو فعلاً)، وكان يرفع grossMargin المعروض إلى 91% لمشروع هامشه التشغيلي 65%.
    // الإصلاح: (أ) النسبة وهامش الوحدة من نفس البسط التشغيلي بالضبط (year1OperatingCM)
    // فيتطابق المساران بحكم البناء لا بالمصادفة؛ (ب) الإيراد غير التشغيلي بالمعالجة
    // القياسية — خصماً من التكاليف الثابتة في البسط (دخل لا يتبع حجم النشاط) — ويُطبَّق
    // على المسارين معاً كي يبقيا متسقين.
    const year1FixedForBE = year1 ? (year1.fixedCosts + year1.depreciation) : totalFixedOpexYear1;
    const fixedForBENetOfNonOp = year1FixedForBE - year1NonOperatingRevenue;
    const cmRatio = year1OperatingRevenue > 0 ? year1OperatingCM / year1OperatingRevenue : 0;
    // هامش المساهمة للوحدة على وحدات السنة الأولى الفعلية (operatingUnits) — نفس مقياس
    // year1OperatingRevenue تماماً (حجم/استغلال/تصاعد)، فالسعر الضمني = الإيراد ÷ الوحدات
    // وبالتالي breakEvenValue = breakEvenUnits × السعر الضمني حسابياً. القاعدة المحفوظة من
    // التصحيح السابق: لا يُقسم إيراد بمقياس على وحدات بمقياس آخر.
    const year1OperatingUnits = year1 ? year1.operatingUnits : 0;
    const contributionMarginPerUnit = year1OperatingUnits > 0 ? year1OperatingCM / year1OperatingUnits : 0;
    // بسط سالب = الإيراد غير التشغيلي وحده يغطي كل الثوابت ⟶ التعادل محقق بلا أي مبيعات
    // تشغيلية. القيمة صفر مع سبب صريح (breakEvenReason) كي لا تختلط بصفر «تعادل مستحيل»
    // (هامش مساهمة ≤ 0) الذي يميّزه breakEvenAchievable أصلاً.
    const breakEvenValue = (cmRatio > 0 && fixedForBENetOfNonOp > 0) ? fixedForBENetOfNonOp / cmRatio : 0;
    const breakEvenUnits = (contributionMarginPerUnit > 0 && fixedForBENetOfNonOp > 0)
        ? fixedForBENetOfNonOp / contributionMarginPerUnit
        : 0;
    // ترتيب الفحص مقصود (تصحيح 2026-08-25): التغطية بالإيراد غير التشغيلي تُفحص **أولاً**.
    // كان `cmRatio <= 0` أولاً، فمشروع كل إيراده غير تشغيلي (تأجير عقار مثلاً) يغطي كل
    // ثوابته يُصنَّف 'no_contribution_margin' وbreakEvenAchievable=false — أي «يخسر على كل
    // وحدة» وهو وصف معكوس تماماً لمشروع رابح بلا مبيعات تشغيلية أصلاً. قياس الانقطاع:
    // إضافة 12 ريالاً من إيراد تشغيلي كانت تقلب التصنيف كلياً. المنطق: متى غطّت الثوابتُ
    // بالكامل، فالتعادل محقق عند صفر وحدات مهما كان هامش الوحدة — فالسؤال عن الهامش لا
    // يُطرح أصلاً.
    const fixedFullyCoveredByNonOp = fixedForBENetOfNonOp <= 0;
    const breakEvenReason = fixedFullyCoveredByNonOp
        ? 'covered_by_non_operating'
        : (cmRatio <= 0 ? 'no_contribution_margin' : null);
    const breakEvenAchievable = fixedFullyCoveredByNonOp || cmRatio > 0;

    // DSCR من جدول السداد الفعلي — بسطه CFADS (النقد المتاح لخدمة الدين) لا EBITDA خام.
    // CFADS = EBITDA − الضرائب النقدية (الزكاة+الضريبة = levy) − الإنفاق الرأسمالي للإحلال
    // (replacementCost). المعيار البنكي: خدمة الدين تُسدَّد من نقد فعلي بعد اقتطاع الزكاة/الضريبة
    // والإحلال، لا من ربح تشغيلي خام يتجاهلهما (فيُبالِغ في تغطية الدين). (تدقيق ٢٠٢٦-٠٧-٠٨)
    // تحديث 2026-08-24 (ΔNWC): CFADS يخصم أيضاً الزيادة السنوية في رأس المال العامل الصافي
    // (deltaNWC) — نقد حقيقي يُحتجز في AR/مخزون فلا يتوفر لخدمة الدين. عمداً لا يقرأ
    // nwcRecapture (استرداد آخر سنة) إطلاقاً — قرار مالك المنتج رقم 3: الاسترداد خارج
    // CFADS/DSCR كلياً مهما كانت السنة.
    const cfads = (stmt) => Math.max(0,
        (Number(stmt.ebitda) || 0) - (Number(stmt.levy) || 0) - (Number(stmt.replacementCost) || 0) - (Number(stmt.deltaNWC) || 0));
    const year1Cfads = year1 ? cfads(year1) : 0;
    const debtServiceYear1 = loanYear(1)?.totalPayment || 0;
    const dscrYear1 = debtServiceYear1 > 0 && year1Cfads > 0
        ? year1Cfads / debtServiceYear1
        : null;
    // يميّز سببَي null المتعاكسين (بند #3 من تدقيق الجولة 2026-07-20): لا خدمة دين
    // (لا قرض أو سماح كامل — DSCR «لا ينطبق») مقابل CFADS ≤ 0 (النقد المتاح لخدمة الدين
    // = EBITDA − الزكاة/الضريبة − الإحلال، وقد يكون EBITDA موجباً بينما CFADS سالب).
    // كانت كل التفسيرات تنسب null لـ«EBITDA سالبة/صفرية» خطأً، فيتناقض مع بطاقة EBITDA الخضراء.
    const dscrReason = dscrYear1 != null ? null : (debtServiceYear1 <= 0 ? 'no_debt_service' : 'no_cfads');
    const dscrAnalysis = loanScheduleData ? incomeStatement.slice(0, loanTerm).map((stmt, idx) => {
        const y = idx + 1;
        const debtService = loanYear(y)?.totalPayment || 0;
        const stmtCfads = cfads(stmt);
        const dscr = debtService > 0 && stmtCfads > 0 ? stmtCfads / debtService : null;
        return { year: y, dscr: dscr != null ? Number(dscr.toFixed(2)) : null, status: dscr >= 1.25 ? 'مريح للممول' : dscr >= 1 ? 'مقبول' : 'يحتاج مراجعة' };
    }) : [];

    // هيكل رؤوس الأموال الثلاثة — كل بند يُجمع مرة واحدة فقط
    const capitalStructure = {
        establishment: {
            total: establishmentTotal,
            breakdown: {
                foundation: capexBreakdown.establishment,
                marketing: capexBreakdown.preOpeningMarketing,
                legal: capexBreakdown.licenses,
                franchise: capexBreakdown.franchiseFee,
                ventureBuilder: capexBreakdown.ventureBuilder,
                envMitigation: capexBreakdown.envMitigation
            }
        },
        investment: {
            total: capexBreakdown.equipment + capexBreakdown.buildings + capexBreakdown.furniture +
                capexBreakdown.vehicles + capexBreakdown.techResources + capexBreakdown.servicesCapex,
            breakdown: {
                equipment: capexBreakdown.equipment,
                buildings: capexBreakdown.buildings,
                furniture: capexBreakdown.furniture,
                vehicles: capexBreakdown.vehicles,
                tech: capexBreakdown.techResources,
                services: capexBreakdown.servicesCapex
            }
        },
        operating: {
            total: workingCapital + openingInventory,
            breakdown: {
                rent: wcRent,
                salaries: wcSalaries,
                marketing: wcMarketing,
                cogs: wcCOGS,
                openingInventory
            },
            months: coverage
        }
    };

    // فترة استرداد غير محققة تبقى null — لا تتحول إلى 0 («أفضل مؤشر» زوراً)
    const paybackOut = Number.isFinite(paybackPeriod) ? paybackPeriod : null;
    const discountedPaybackOut = Number.isFinite(discountedPaybackPeriod) ? discountedPaybackPeriod : null;
    // يميّز سببَي null: لم يعبر التراكمي الصفر قط، مقابل عبَره ثم انتكس ولم يتعافَ حتى
    // نهاية الأفق (الحالة الثانية أخطر: أرباح مبكرة تبتلعها خسائر لاحقة).
    const paybackReason = paybackOut != null ? null : (paybackReverted ? 'reverted_to_negative' : 'never_recovered');

    // ═══════════════════════════════════════════════════════════
    // 9. التحليلات المشتقة (فقط في التشغيل الأعلى بدون overrides)
    // ═══════════════════════════════════════════════════════════
    let sensitivity = [];
    let scenarios = null;
    let loanSchedule = null;
    let balanceSheets = [];
    let ratios = [];
    let tornado = [];
    if (!overrides) {
        if (loanScheduleData) {
            loanSchedule = { ...loanScheduleData, loanAmount, annualRate: interestRate, termYears: loanTerm };
        }

        try {
            balanceSheets = generateBalanceSheets({
                capex: { subtotal: totalCapex, total: totalInvestment },
                depreciation: annualDepreciation,
                loanSchedule,
                incomeStatements: incomeStatement,
                workingCapital,
                openingInventory,
                // الدورة النقدية الفعلية (DSO/DIO/DPO) — تُمرَّر كي تُظهر الميزانية ذمم عملاء
                // حقيقية بدل صفر ثابت («Simplified») حتى مع سياسة تحصيل آجل صريحة (تدقيق دفعة 6).
                cashCycle,
                // الدورة النقدية لكل سنة إسقاط (2026-08-24) — تتيح للميزانية استخدام AR/مخزون/ذمم
                // موردين الفعليين لكل سنة (يتبعون نمو الإيراد الحقيقي) بدل تجميد رقم سنة 1 عبر
                // كل الأفق؛ cashCycle أعلاه يبقى كما هو للتوافق الخلفي (يُستخدم إن غابت هذه المصفوفة).
                cashCycleByYear,
                // مساهمة المالك المُدخلة (وليس رقماً مشتقاً) + الفجوة صراحةً كي تُعرض
                // «فجوة تمويل غير مغطاة» بدل رأس مال مدفوع مختلَق يوازن الميزانية صمتاً
                equityAmount: paidCapital,
                fundingGap
            }, years);
        } catch (_) { balanceSheets = []; }

        try {
            // مكتبة النسب المالية (سيولة/مديونية/نشاط/ربحية لكل سنة) — إضافية بالكامل،
            // تُبنى من قائمة الدخل والميزانية المحسوبتين أعلاه، بلا أي إعادة حساب.
            ratios = buildFinancialRatios(incomeStatement, balanceSheets);
        } catch (_) { ratios = []; }

        const runCase = (ov) => {
            try {
                const r = calculateStudy(study, ov);
                if (!r) return null;
                return {
                    kpis: {
                        npv: r.indicators.npv,
                        irr: r.indicators.irr,
                        payback: r.indicators.paybackPeriod,
                        roi: r.indicators.roi
                    },
                    breakeven: { ordersPerDay: (r.indicators.breakEvenUnits || 0) / 360 }
                };
            } catch (_) { return null; }
        };
        const mkCase = (label, ov) => { const k = runCase(ov); return k ? { value: label, kpis: k.kpis } : null; };

        const revCases = [mkCase('زيادة 10%', { revenueChange: 0.10 }), mkCase('انخفاض 10%', { revenueChange: -0.10 })].filter(Boolean);
        const costCases = [mkCase('زيادة 10%', { costChange: 0.10 }), mkCase('انخفاض 10%', { costChange: -0.10 })].filter(Boolean);
        if (revCases.length) sensitivity.push({ dim: 'الإيرادات', cases: revCases });
        if (costCases.length) sensitivity.push({ dim: 'التكاليف التشغيلية', cases: costCases });

        // رسم Tornado: حساسية NPV لكل متغير على حدة (±10%) مرتبة بحجم الأثر —
        // تُري المستثمر أي متغير يهيمن على النتيجة فيركّز دقته فيه
        const TORNADO_AXES = [
            { key: 'priceChange', label: 'سعر البيع' },
            { key: 'volumeChange', label: 'حجم المبيعات' },
            { key: 'vcRateChange', label: 'التكاليف المتغيرة' },
            { key: 'fixedChange', label: 'التكاليف الثابتة' },
            { key: 'capexChange', label: 'الاستثمار الرأسمالي' }
        ];
        tornado = TORNADO_AXES.map(ax => {
            const lo = runCase({ [ax.key]: -0.10 });
            const hi = runCase({ [ax.key]: 0.10 });
            if (!lo || !hi) return null;
            const npvLow = lo.kpis.npv;
            const npvHigh = hi.kpis.npv;
            return {
                variable: ax.label,
                key: ax.key,
                npvLow,
                npvHigh,
                swing: Math.abs(npvHigh - npvLow)
            };
        }).filter(Boolean).sort((a, b) => b.swing - a.swing);

        scenarios = {
            base: {
                kpis: { npv, irr, payback: paybackOut, roi: roi / 100 },
                breakeven: { ordersPerDay: (breakEvenUnits || 0) / 360 }
            }
        };
        // B2: السيناريوهات تُقرأ من مدخلات المستخدم (خطوة 30) لا من أرقام مثبتة — كي يتطابق
        // التقرير ولوحة القرار مع ما يعدّله المستخدم فعلاً. القيم الافتراضية احتياط فقط.
        const userScenarios = study[SECTIONS.SCENARIOS] || {};
        const optIn = userScenarios.optimistic || {};
        const pessIn = userScenarios.pessimistic || {};
        const opt = runCase({
            revenueChange: rateOrDefault(optIn.revenueChange, 0.25),
            costChange: rateOrDefault(optIn.costChange, -0.10)
        });
        const pess = runCase({
            revenueChange: rateOrDefault(pessIn.revenueChange, -0.20),
            costChange: rateOrDefault(pessIn.costChange, 0.15)
        });
        if (opt) scenarios.optimistic = opt;
        if (pess) scenarios.pessimistic = pess;
    }

    // التدفق النقدي التراكمي — سنة الصفر تفصح عن التمويل بدل دفنه:
    // الاستثمار كاملاً خارج، ودخول القرض داخل، والصافي = حصة المالك النقدية.
    let _cum = -equityOutlay;
    const cashFlowRows = [
        {
            year: 0,
            investment: -totalInvestment,
            loanInflow: loanAmount,
            cashFlow: -equityOutlay,
            netIncome: 0,
            depreciation: 0,
            loanPrincipalPaid: 0,
            replacementCost: 0,
            cumulative: -equityOutlay
        },
        ...incomeStatement.map(y => {
            const vatYear = vatByYear.get(y.year) || {};
            const vatNetPayable = Number(vatYear.netPayable || 0);
            _cum += y.cashFlow;
            return {
                year: y.year,
                cashFlow: y.cashFlow,
                vatNetPayable,
                cashFlowAfterVat: y.cashFlow - vatNetPayable,
                netIncome: y.netIncome,
                depreciation: y.depreciation,
                loanPrincipalPaid: y.loanPrincipalPaid || 0,
                replacementCost: y.replacementCost || 0,
                cumulative: _cum
            };
        })
    ];

    // معاينة مبكرة لتحليل السوق (تحتاج incomeStatement فقط، متاح هنا) — تُستخدم في بوابة
    // القرار أدناه («واقعية السوق»)؛ result.saudiMarket أسفل الدالة يعيد حسابها للتوافق
    // الخلفي مع بقية الشاشات (حساب رخيص نقي، لا ضرر من التكرار).
    const marketPreview = analyzeSaudiMarket(study, { incomeStatement });

    const result = {
        capex: {
            capitalStructure,
            breakdown: capexBreakdown,
            subtotal: totalCapex,
            workingCapital,
            openingInventory,
            contingency: 0,
            total: totalInvestment
        },
        opex: {
            fixedAnnual: totalFixedOpexYear1,
            variableAnnual: year1VariableCosts,
            totalAnnual: totalFixedOpexYear1 + year1VariableCosts,
            // مكونات السنة الأولى — تستهلكها فحوصات معايير «السائقين» القطاعية
            payrollAnnual: annualPayroll,
            laborAnnual: annualPayroll,
            rentAnnual: annualAdminRent,
            adminAnnual: annualAdmin - annualAdminRent,
            rentAdminAnnual: annualLogisticsFixed + annualAdmin,
            marketingAnnual: annualMarketing
        },
        depreciation: annualDepreciation,
        depreciationSchedules: {
            // تدقيق 2026-08-25: كان `map(() => annualDepreciation)` — خطاً مسطّحاً يكرّر شحن
            // السنة الأولى لكل السنوات، فيناقض قائمة الدخل من أول دورة إحلال أو استنفاد عمر.
            // الشحن الدفتري الفعلي محسوب أصلاً لكل سنة (permanent + replaceable + إطفاء
            // التأسيس) ومخزَّن في صف قائمة الدخل — يُقرأ منه مباشرة ليبقى مصدراً واحداً.
            book: incomeStatement.map(s => Number(s.depreciation) || 0),
            tax: taxDepByYear.slice(0, incomeStatement.length)   // متناقص (زكوي/ضريبي — ZATCA)
        },
        incomeStatement,
        sensitivity,
        scenarios,
        tornado,
        loanSchedule,
        balanceSheets,
        ratios,
        assetSchedule,
        payrollByPosition,
        marketingByChannel,
        saudization,
        capacityCheck,
        cashCycle,
        rampUpMonths,
        vat,
        cashFlow: cashFlowRows,
        assumptionDisclosures: [
            'حسابات الزكاة وضريبة الدخل تقديرية وتحتاج مراجعة مختص قبل الاعتماد النظامي أو التقديم التمويلي.',
            'حساب VAT تقديري لأثر السيولة، ويفترض أن الأسعار غير شاملة للضريبة وأن المدخلات التشغيلية المحددة قابلة للخصم.',
            'قيمة الإنقاذ/القيمة المتبقية للأصول تفترض صفراً ما لم تظهر ضمن القيمة النهائية الاسترشادية.',
            'محاكاة مونت كارلو، عند استخدامها، تفترض استقلالية المتغيرات ولا تطبق ارتباطات بين المبيعات والتكاليف.'
        ],
        assumptionsApplied: {
            zakatRate,
            taxRate,
            foreignOwnershipRate: foreignShare,
            discountRate,
            baseDiscountRate,
            discountRateSource,
            costOfEquityDiscountRate,
            inflationRate: inflation,
            // مصدر وحيد لعتبات القرار المُطبَّقة فعلياً (بعد دمج تجاوزات المستخدم مع
            // الافتراضات) — الشاشات تقرأ من هنا بدل بناء احتياطياتها الخاصة (تدقيق 2026-07-08).
            thresholds: resolveDecisionThresholds(study.assumptions?.thresholds, financing)
        },
        // فحص التمويل الموحد — كل الشاشات تقرأ منه (خطوة التمويل، بوابة التصدير، الميزانية)
        financingCheck: {
            totalInvestment,
            loanAmount,
            paidCapital,
            equityOutlay,
            totalFundingSources: paidCapital + loanAmount,
            fundingGap,
            fundingGapMaterialityThreshold
        },
        indicators: {
            npv,
            irr,
            irrSignChanges,
            irrMultipleRootsRisk: irrSignChanges > 1,
            mirr,
            paybackPeriod: paybackOut,
            payback: paybackOut,
            paybackReason,
            roi: roi / 100,
            breakEvenPointValue: breakEvenValue,
            // breakEvenValue=0 غامض: قد يعني تعادلاً مستحيلاً (هامش مساهمة ≤ 0، يخسر على كل وحدة)
            // أو غياب تكاليف ثابتة (يتعادل فوراً). هذا العلَم يميّزهما كي لا تعرض اللوحة
            // «هامش أمان لنقطة التعادل = 100%» لمشروع لا يمكنه التعادل أصلاً.
            breakEvenAchievable,
            // يميّز صفرَي breakEvenPointValue المتعاكسين: no_contribution_margin (يخسر على
            // كل وحدة ⟶ تعادل مستحيل) مقابل covered_by_non_operating (الإيراد غير التشغيلي
            // يغطي كل الثوابت ⟶ التعادل محقق أصلاً). null = نقطة تعادل موجبة عادية.
            breakEvenReason,
            // ‎Math.ceil‎ لا ‎Math.round‎ (تصحيح 2026-08-25): لا يتعادل مشروع ببيع جزء وحدة،
            // فالعدد الصحيح الصحيح محاسبياً هو أول عدد وحدات **يبلغ** التعادل أو يتجاوزه.
            // التقريب لأقرب كان يُنقص العدد متى كان الكسر < 0.5 (1.2 وحدة ⟶ 1) فيظهر
            // «تعادل» عند مبيعات لا تغطي الثوابت فعلاً — أخطر اتجاه للخطأ.
            //
            // فارق تقريب مقصود، ليس تناقضاً بين الشاشتين: breakEvenPointValue يبقى دقيقاً
            // بلا تقريب، فحاصل ‎breakEvenUnits × السعر الضمني‎ يساويه أو **يتجاوزه** بأقل من
            // سعر وحدة واحدة (0 ≤ الفارق < السعر الضمني) — ويتجاوزه دائماً في الاتجاه
            // المتحفّظ. المشاريع عالية سعر الوحدة تُظهر الفارق بأوضح صورة: سعر 100,000 وثوابت
            // 112,500 بهامش 65% ⟹ 173,076.92 ريال مقابل 2 × 100,000 = 200,000 (فارق 26,923
            // = جزء الوحدة غير القابل للبيع 0.269 × 100,000)، ولا سبيل لإزالته دون كسر إحدى
            // الخاصيتين: دقة قيمة الريال، أو صحة عدد الوحدات كعدد صحيح.
            breakEvenUnits: Math.ceil(breakEvenUnits),
            dscr: dscrYear1 != null ? Number(dscrYear1.toFixed(2)) : null,
            dscrReason,
            profitMargin: year1Revenue > 0 ? (incomeStatement[0].netIncome / year1Revenue) : 0,
            // هامش إجمالي تشغيلي: كل التكاليف المتغيرة تشغيلية، فقسمتها على الإيراد الكلي
            // (شاملاً غير التشغيلي) كانت تُظهر 91% لمشروع هامشه الحقيقي 65% (القياس الفعلي:
            // ‎(1,360,000 − 126,000) ÷ 1,360,000 = 0.9074‎ — انظر نفس الرقم عند تعريف cmRatio
            // أعلاه). نفس تعريف cmRatio حرفياً — مصدر واحد كي لا ينحرف الرقمان.
            //
            // بلا إيراد تشغيلي إطلاقاً: ‎null‎ لا صفر (تصحيح 2026-08-25). الكسر ‎0 ÷ 0‎ غير
            // معرَّف، و«هامش إجمالي = 0%» ادّعاء موضوعي كاذب («يبيع بالتكلفة») عن مشروع لا
            // يبيع شيئاً — نفس مبدأ payback/dscr/irr في هذا الملف: غير المنطبق يبقى null.
            // (cmRatio يبقى صفراً داخلياً لأن حرّاس التعادل أعلاه تقارن `> 0`.)
            // عقد المستهلكات: null هنا = «غير منطبق» (تُعرض —)، وليس «حقل مفقود من نتيجة
            // قديمة» — فلا يصحّ السقوط عنده إلى حساب محلي على الإيراد الكلي (يعطي 100%
            // لمشروع بلا مبيعات، وهو بالضبط الكسر الذي أُصلح هنا).
            grossMargin: year1OperatingRevenue > 0 ? cmRatio : null,
            netMargin: year1Revenue > 0 ? (incomeStatement[0].netIncome / year1Revenue) : 0,
            ebitdaYear1: year1 ? year1.ebitda : 0,
            freeCashFlowYear1: year1 ? year1.cashFlow : 0,
            workingCapital,
            // ROE يُقسَم على حقوق الملكية (رأس المال المدفوع) لا على إجمالي الاستثمار،
            // وإلا تطابق مع ROA حرفياً. paidCapital = totalInvestment − loanAmount.
            roe: paidCapital > 0 ? (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length) / Math.max(1, paidCapital) : 0,
            roa: totalInvestment > 0 ? (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length) / totalInvestment : 0,
            profitabilityIndex: pi,
            discountedPaybackPeriod: discountedPaybackOut,
            arr: arr / 100,
            annualROI: arr / 100,
            // القيمة النهائية (مخصومة) — استرشادية؛ القرار على NPV المتحفظ أعلاه
            terminalValue: terminalValueDiscounted,
            npvWithTerminal
        },
        dscrAnalysis,
        ...(() => {
            const d = computeDecision(study.assumptions?.thresholds, {
                npv, irr,
                paybackPeriod: paybackOut,
                roi: roi / 100,
                netMargin: year1Revenue > 0 ? (incomeStatement[0].netIncome / year1Revenue) : 0
            });
            // مبيعات تتجاوز الطاقة القصوى المادية لا يمكن أن تكون GO مهما كانت
            // المؤشرات — الأرقام مبنية على حجم مستحيل التحقيق. نُضيف السبب دائماً عند
            // تجاوز الطاقة (حتى لو كان القرار REVISE أصلاً بسبب مؤشرات غير واقعية)،
            // وإلا اختفى سبب «الطاقة القصوى» خلف رسالة المؤشرات المرتفعة.
            if (capacityCheck?.exceeded) {
                if (d.decision === 'GO') d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `المبيعات المخططة (${capacityCheck.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميل/شهر) تتجاوز الطاقة القصوى (${capacityCheck.maxUnitsPerMonth.toLocaleString('ar-SA')}) — خفّض التوقعات أو وسّع الطاقة`
                );
            }
            // إيراد يتجاوز حصة السوق القابلة للالتقاط (SOM) بمقدار واضح لا يمكن أن يكون GO
            // مهما كانت المؤشرات — نفس منطق تجاوز الطاقة أعلاه لكن من زاوية حجم السوق لا
            // الطاقة التشغيلية (كان تحذيراً تجميلياً فقط لا يغيّر القرار — تدقيق 2026-07-08).
            if (marketPreview?.warnings?.some(w => w.code === 'REVENUE_EXCEEDS_SOM')) {
                if (d.decision === 'GO') d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `إيراد السنة الأولى (${Math.round(marketPreview.y1Revenue).toLocaleString('ar-SA')} ريال) يتجاوز حصة السوق القابلة للالتقاط SOM (${marketPreview.som.toLocaleString('ar-SA')} ريال) — راجع توقع العملاء/السعر أو وثّق مصدر SOM أعلى`
                );
            }
            if (Number(fundingGap) > fundingGapMaterialityThreshold) {
                if (d.decision === 'GO') d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `مصادر التمويل أقل من الاستثمار المطلوب بفجوة ${Math.round(fundingGap).toLocaleString('ar-SA')} ريال — لا تعتمد القرار قبل رفع رأس المال أو خفض التكاليف الرأسمالية/رأس المال العامل`
                );
            }
            const minDscr = resolveDecisionThresholds(study.assumptions?.thresholds, financing).targetDSCR;
            if (loanAmount > 0 && (dscrYear1 == null || dscrYear1 < minDscr)) {
                if (d.decision === 'GO') d.decision = 'REVISE';
                const dscrText = dscrYear1 != null ? dscrYear1.toFixed(2)
                    : (debtServiceYear1 <= 0 ? 'غير قابل للحساب — لا خدمة دين في السنة الأولى'
                        : 'غير قابل للحساب لأن CFADS (النقد المتاح لخدمة الدين) صفر أو سالب — لا يعني EBITDA سالبة');
                d.decisionReasons.unshift(
                    `تغطية خدمة الدين في السنة الأولى (${dscrText}) أقل من الحد المستهدف ${minDscr.toFixed(2)} — راجع مبلغ القرض أو فترة السماح أو أضف رأس مال عامل`
                );
            }
            // مرونة السيناريو المتشائم: GO مبني فقط على الحالة الأساسية بينما ينهار المشروع
            // (NPV سلبي) تحت سيناريو متشائم معقول (نفس مدخلات خطوة السيناريوهات) هو «GO هش»
            // يخالف روح بوابة الجودة — لا نُظهر ثقة لا تصمد أمام أول صدمة سوق معتادة.
            const pessNpv = scenarios?.pessimistic?.kpis?.npv;
            if (d.decision === 'GO' && pessNpv != null && pessNpv < 0) {
                d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `المشروع مجدٍ في الحالة الأساسية لكنه يخسر (NPV سلبي) تحت السيناريو المتشائم — راجع هامش الأمان قبل الاعتماد على القرار`
                );
            }

            // اختبار التحمل: صدمة معيارية موحّدة (نفس سيناريو «أزمة حادة» الجاهز في
            // StressTest.js: -50% مبيعات و+20% تكاليف) — لا نقرأ آخر إعداد سلايدر محفوظ
            // (تعسفي وقد يختلف بين تشغيلتين لنفس المشروع)، بل سيناريو ثابت قابل لإعادة
            // الإنتاج (تدقيق 2026-07-08: القرار كان لا يدمج نتيجة اختبار التحمل إطلاقاً).
            const stressBase = {
                monthlyRevenue: year1Revenue / 12,
                monthlyFixed: totalFixedOpexYear1 / 12,
                monthlyVariable: year1VariableCosts / 12,
                monthlyDebt: (loanSchedule?.annualSummary?.find(s => s.year === 1)?.totalPayment || 0) / 12,
                cashReserve: Math.max(Number(workingCapital) || 0, Number(balanceSheets?.[0]?.assets?.current?.cash) || 0)
            };
            const stress = computeStressSurvival(stressBase, 50, 20);
            if (d.decision === 'GO' && Number.isFinite(stress.months) && stress.months < 3) {
                d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `أشهر البقاء تحت أزمة حادة (اختبار التحمل: -50% مبيعات و+20% تكاليف) = ${stress.months.toFixed(1)} شهراً فقط (أقل من 3) — خطر سيولة حرج قبل أي صدمة سوق معتادة`
                );
            }

            // مونت كارلو: تُقرأ من آخر تشغيل محفوظ فعلياً (لا نعيد تشغيل 1000 تكرار هنا —
            // مكلف حسابياً وقد يجمّد كل شاشة تستدعي calculateStudy). استشارية فقط: غياب
            // تشغيل سابق لا يخفّض القرار (المستخدم لم يفتح الشاشة بعد، لا خلل في المشروع).
            // تدقيق 2026-07-12: كان شرط إضافة السبب نفسه معلَّقاً على d.decision === 'GO'
            // (مطابقاً لشرط تخفيض القرار) — فمشروع REVISE أصلاً بسبب آخر (فجوة تمويل، DSCR...)
            // لا يُظهر سبب الاحتمالية المنخفضة إطلاقاً رغم صحته، فيبدو التقرير ناقصاً. نفس
            // نمط بقية البوابات أعلاه: تخفيض القرار يبقى مشروطاً بـGO (لا داعي لتخفيض REVISE/NO-GO
            // أصلاً)، لكن إضافة السبب للشفافية غير مشروطة بحالة القرار الحالية.
            const mcLastRun = study[SECTIONS.MONTE_CARLO]?.lastRun;
            if (mcLastRun && Number.isFinite(mcLastRun.successProbability) && mcLastRun.successProbability < 0.5) {
                if (d.decision === 'GO') d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `احتمالية النجاح في محاكاة مونت كارلو (آخر تشغيل: ${Math.round(mcLastRun.successProbability * 100)}%) أقل من 50% — نصف السيناريوهات العشوائية المعقولة تخسر`
                );
            }

            // سجل المخاطر: خطر حرج (احتمالية×أثر ≥9، نفس تصنيف RiskMatrix.js) بلا خطة
            // مواجهة موثَّقة لا يمكن تجاهله في القرار — خطر موثَّق ومُخفَّف لا يوقف GO.
            const risks = toArray(study[SECTIONS.RISK_ANALYSIS]?.risks);
            const unmitigatedCritical = risks.find(r =>
                classifyRiskScore(getRiskScore(r.probability, r.impact)) === 'critical' && !String(r.mitigation || '').trim()
            );
            if (d.decision === 'GO' && unmitigatedCritical) {
                d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `خطر حرج بلا خطة مواجهة موثَّقة في سجل المخاطر: «${unmitigatedCritical.name || 'بلا اسم'}» — أضف خطة مواجهة أو أعد تقييم احتماليته/أثره قبل الاعتماد`
                );
            }

            return d;
        })(),
        get kpis() { return this.indicators; }
    };
    result.saasMetrics = analyzeSaaSMetrics(study, result);
    result.saudiMarket = analyzeSaudiMarket(study, result);
    result.decisionExplanation = explainDecisionBreakers(study, result);
    result.partnerNeeds = analyzePartnerNeeds(study, result);
    return result;
}

/**
 * أثر تأخير الافتتاح N شهر على NPV — نفس مبدأ CentralAssumptionsView._commitRampUpMonths
 * (استنساخ الدراسة + تعديل rampUpMonths + إعادة حساب كامل)، مُصدَّر هنا ليُستهلك من أي
 * شاشة (خطة التنفيذ) بلا تكرار منطق الاستنساخ. يُضيف delayMonths فوق rampUpMonths
 * الحالي (لا يستبدله) لأن تأخير الافتتاح يمدّد فترة التصاعد الفعلية للسنة الأولى.
 * @param {Object} study
 * @param {number} delayMonths
 * @returns {{delayMonths:number, baselineNpv:number, delayedNpv:number, npvImpact:number}}
 */
export function calculateDelayedLaunchImpact(study, delayMonths) {
    const delay = Math.max(0, Number(delayMonths) || 0);
    const baseline = calculateStudy(study);
    if (delay === 0) {
        return { delayMonths: 0, baselineNpv: baseline.indicators.npv, delayedNpv: baseline.indicators.npv, npvImpact: 0 };
    }
    const currentRamp = Number(study?.assumptions?.rampUpMonths) || 0;
    const delayedStudy = {
        ...study,
        assumptions: { ...(study.assumptions || {}), rampUpMonths: currentRamp + delay }
    };
    const delayed = calculateStudy(delayedStudy);
    return {
        delayMonths: delay,
        baselineNpv: baseline.indicators.npv,
        delayedNpv: delayed.indicators.npv,
        npvImpact: delayed.indicators.npv - baseline.indicators.npv
    };
}

/**
 * أفضل مزيج دين/ملكية (ضمن استثمار إجمالي ثابت) يعظّم NPV دون خفض أدنى DSCR عن
 * الهدف — بحث على مجموعة نسب دين مرشَّحة ثابتة (لا بحث مستمر) لأن العلاقة بين
 * نسبة الدين وNPV غير أحادية الاتجاه بالضرورة (فائدة أعلى تخفض NPV، لكن الدين
 * أرخص من حقوق الملكية في WACC غالباً) — تشغيل calculateStudy الفعلي لكل مرشّح
 * أدق من صيغة مغلقة تفترض علاقة خطية. يُستهلك من CentralAssumptionsView.
 * @param {Object} study
 * @param {number} [targetDSCR] - افتراضي: عتبة الدراسة نفسها (thresholds.targetDSCR)
 * @returns {{candidates:Array, best:Object}|null}
 */
export function findOptimalFinancingMix(study, targetDSCR) {
    const base = calculateStudy(study);
    if (!base) return null;
    const totalInvestment = Number(base.capex?.total) || 0;
    if (totalInvestment <= 0) return null;
    const target = Number.isFinite(targetDSCR)
        ? targetDSCR
        : Number(base.assumptionsApplied?.thresholds?.targetDSCR) || 1.25;

    const debtFractions = [0, 0.25, 0.5, 0.65, 0.75, 0.9];
    const candidates = debtFractions.map(debtFraction => {
        const loanAmount = Math.round(totalInvestment * debtFraction);
        const equityAmount = totalInvestment - loanAmount;
        const variant = {
            ...study,
            financing: {
                ...(study.financing || {}),
                sources: {
                    ...(study.financing?.sources || {}),
                    equity: { ...(study.financing?.sources?.equity || {}), amount: equityAmount },
                    bankLoan: { ...(study.financing?.sources?.bankLoan || {}), amount: loanAmount }
                }
            }
        };
        const r = calculateStudy(variant);
        if (!r) return null;
        const dscrValues = (r.dscrAnalysis || []).map(d => d.dscr).filter(Number.isFinite);
        const minDscr = dscrValues.length ? Math.min(...dscrValues) : null;
        return {
            debtFraction,
            loanAmount,
            equityAmount,
            npv: r.indicators?.npv,
            minDscr,
            meetsTarget: minDscr == null || minDscr >= target
        };
    }).filter(Boolean);

    if (!candidates.length) return null;
    const feasible = candidates.filter(c => c.meetsTarget);
    const pool = feasible.length ? feasible : candidates;
    const best = pool.reduce((a, b) => (Number(b.npv) > Number(a.npv) ? b : a), pool[0]);
    return { candidates, best, targetDSCR: target };
}

/**
 * مصدر وحيد لعتبات قرار GO/NO-GO/REVISE المُطبَّقة فعلياً — تدقيق 2026-07-08:
 * كانت كل شاشة (لوحة القرار، تحليل الجدوى الاستثمارية، لوحة التحكم المالي) تبني
 * احتياطياتها الخاصة عند غياب إدخال المستخدم (مثال: DSCR 1.5 هناك مقابل 1.25 هنا،
 * واسترداد 7 سنوات هناك مقابل 3.5 هنا فعلياً) فتُظهر ✓ لمشروع يرفضه هذا القرار
 * نفسه. أي شاشة تعرض عتبة قرار يجب أن تستورد هذه الدالة (عبر results.assumptionsApplied.thresholds)
 * بدل كتابة رقم احتياطي محلي خاص بها.
 * @param {Object} th - study.assumptions.thresholds
 * @param {Object} [financing] - study.financing (للتوافق مع مسار قديم financing.targetDSCR)
 */
export function resolveDecisionThresholds(th, financing) {
    const t = th || {};
    const f = financing || {};
    return {
        minNPV: t.minNPV != null ? Number(t.minNPV) : 0,
        minIRR: t.minIRR != null ? Number(t.minIRR) : 0.15,
        maxPayback: t.maxPayback != null ? Number(t.maxPayback) : 3.5,
        minROI: t.minROI != null ? Number(t.minROI) : 0.20,
        targetDSCR: t.targetDSCR != null ? Number(t.targetDSCR) : (f.targetDSCR != null ? Number(f.targetDSCR) : 1.25),
    };
}

/**
 * ينتج GO / NO-GO / REVISE بناءً على حدود 01_Assumptions.
 * @param {Object} th - study.assumptions.thresholds
 * @param {Object} k - { npv, irr, paybackPeriod, roi } — paybackPeriod قد يكون null (غير قابل للاسترداد)
 * @returns {{ decision: 'GO'|'NO-GO'|'REVISE', decisionReasons: string[] }}
 */
function computeDecision(th, k) {
    const { minNPV, minIRR, maxPayback, minROI } = resolveDecisionThresholds(th);

    const passNPV = (k.npv ?? 0) > minNPV;
    const passIRR = (k.irr ?? 0) >= minIRR;
    const passPayback = k.paybackPeriod != null && k.paybackPeriod > 0 && k.paybackPeriod <= maxPayback;
    const passROI = (k.roi ?? 0) >= minROI;

    const reasons = [];
    if (!passNPV) reasons.push(`صافي القيمة الحالية يجب أن يكون > ${minNPV}`);
    if (!passIRR) reasons.push(k.irr == null
        ? 'معدل العائد الداخلي غير قابل للحساب — أكمل بيانات الاستثمار (الأصول والتجهيزات) أولاً'
        : `معدل العائد الداخلي يجب أن يكون ≥ ${(minIRR * 100).toFixed(0)}%`);
    if (!passPayback) reasons.push(k.paybackPeriod == null
        ? 'رأس المال لا يُسترد خلال سنوات الدراسة'
        : `فترة الاسترداد يجب أن تكون ≤ ${maxPayback} سنوات`);
    if (!passROI) reasons.push(`العائد على الاستثمار يجب أن يكون ≥ ${(minROI * 100).toFixed(0)}%`);

    const passed = [passNPV, passIRR, passPayback, passROI].filter(Boolean).length;

    let decision = 'REVISE';
    if ((k.npv ?? 0) <= minNPV && minNPV >= 0) {
        decision = 'NO-GO';
        if (!reasons.includes('صافي القيمة الحالية سلبي أو أقل من الحد الأدنى')) reasons.push('صافي القيمة الحالية غير محقق');
    } else if (passed === 4) {
        decision = 'GO';
    } else if (passed <= 1) {
        decision = 'NO-GO';
    }

    // سقف معقولية: «أفضل من أن يكون حقيقياً» لا يكون GO قاطعاً. مؤشرات مرتفعة بغرابة
    // (IRR ≥ 100%، استرداد < 1.2 سنة، أو هامش صافٍ > 35%) غالباً تعني تكاليف ناقصة — نخفّضها لمراجعة.
    if (decision === 'GO') {
        const implausible = (k.irr ?? 0) >= 1
            || (k.paybackPeriod != null && k.paybackPeriod > 0 && k.paybackPeriod < 1.2)
            || (k.netMargin ?? 0) > 0.35;
        if (implausible) {
            decision = 'REVISE';
            reasons.unshift('المؤشرات مرتفعة بشكل غير معتاد (عائد/استرداد/هامش) — تحقّق من اكتمال التكاليف وواقعية المبيعات قبل عرضها على ممول.');
        }
    }

    return { decision, decisionReasons: reasons };
}

// Helpers

