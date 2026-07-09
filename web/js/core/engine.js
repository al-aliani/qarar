
import { SECTIONS, SAUDI_GOSI_RATE_2026 } from './schema.js';
import { computeLoanSchedule } from '../../../lib/calc/loanSchedule.js';
import { generateBalanceSheets } from '../../../lib/calc/balanceSheet.js';
import { analyzeSaaSMetrics } from './SaaSEngine.js';
import { analyzeSaudiMarket } from './SaudiMarketEngine.js';
import { explainDecisionBreakers } from './DecisionExplainer.js';
import { calculateZakatAndTax } from './financial/tax.js';
import { calculateNPV, calculateIRR, calculateMIRR, calculateTerminalValue } from './financial/cashflow.js';
import { buildDepreciationModel } from './financial/depreciation.js';
import { buildRevenueModel } from './financial/revenue.js';
import { computeStressSurvival } from './financial/stressTestMath.js';
import { getRiskScore, classifyRiskScore } from './riskScoring.js';
function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
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

    const years = study.assumptions?.projectionYears || 5;
    const inflation = study.assumptions?.inflationRate || 0.02;
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

    const baseDiscountRate = Number(study.assumptions?.discountRate) || 0.10;
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
    let annualAdmin = toArray(admin.administrative).reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);
    // ملاحظة: أُزيلت إضافة 2,500 ريال «رسوم حكومية» الصامتة — كانت تُحقَن في OPEX دون علم
    // المستخدم أو إفصاح، فيجد فرقاً لا يفسَّر عند مطابقة تكاليفه بقائمة الدخل (نقض لشفافية المعادلات).
    // بديلها الصحيح: بند ظاهر في «الموارد الإدارية» يضيفه المستخدم أو تحذير QA يطلب إدخاله.
    // المواد المستهلكة الشهرية (technical.consumables)
    annualAdmin += toArray(technical.consumables).reduce((acc, item) => acc + (Number(item.monthlyCost ?? item.monthly ?? 0) * 12), 0);

    const annualMarketing = toArray(marketing.campaigns)
        .filter(c => c.type === 'operating')
        .reduce((acc, c) => acc + (Number(c.monthly || 0) * 12), 0);

    // التكاليف الثابتة الشهرية المعرفة على مستوى كل خدمة
    const annualServiceFixed = serviceItems.reduce((acc, s) => acc + (Number(s.fixedCosts || 0) * 12), 0);

    let totalFixedOpexYear1 = annualPayroll + annualLogisticsFixed + annualAdmin + annualMarketing + annualServiceFixed;
    if (opexMult !== 1) totalFixedOpexYear1 *= opexMult;

    // ═══════════════════════════════════════════════════════════
    // 2. CAPEX (التكاليف الاستثمارية)
    // ═══════════════════════════════════════════════════════════

    const isCorporate = study[SECTIONS.PROJECT_INFO]?.businessModel === 'Corporate_Venture';
    const corporateAssets = study[SECTIONS.PROJECT_INFO]?.corporateAssets || [];

    const getSaving = (category) => {
        if (!isCorporate) return 0;
        const asset = corporateAssets.find(a => a.costSavingType === category);
        return asset ? (Number(asset.savingPercentage || 0)) : 0;
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
    const establishmentAmortization = toArray(technical.establishmentCosts).reduce((acc, item) => {
        return acc + (Number(item.amount || 0) * rateOrDefault(item.amortizationRate, 0.20));
    }, 0);
    // إطفاء التأسيس بند-ببند مع عمره (life = round(1/rate)، الافتراضي 20% ⇒ 5 سنوات).
    // كان يُحمَّل ثابتاً كل سنوات الإسقاط فيتجاوز 100% من كلفته عند أفق>5 سنوات
    // (أفق 10 ⇒ 200%). يُقصّ الآن عند استنفاد عمره مثل البنود القابلة للإحلال. (تدقيق ٢٠٢٦-٠٧-٠٨)
    const establishmentAmortItems = toArray(technical.establishmentCosts).map(item => {
        const rate = rateOrDefault(item.amortizationRate, 0.20);
        return { dep: Number(item.amount || 0) * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
    });
    const establishmentAmortAtYear = (yr) => establishmentAmortItems.reduce(
        (d, it) => d + (it.life > 0 && yr <= it.life ? it.dep : 0), 0);

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
        permanentAnnualDep,
        replaceableDepAtYear,
        getReplacementCostAtYear
    } = buildDepreciationModel({
        technical,
        techResources,
        equipmentTotal,
        capexBreakdown,
        launchStrategy,
        getSaving,
        establishmentAmortization,
        establishmentAmortAtYear
    });

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
        if (capRow) {
            const maxMonthly = Number(capRow.maxUnitsPerMonth) ||
                (Number(capRow.seats || 0) * Number(capRow.turnsPerDay || 0) * Number(capRow.daysPerMonth || 26));
            if (maxMonthly > 0) {
                const plannedMonthly = year1Units / 12;
                capacityCheck = {
                    maxUnitsPerMonth: Math.round(maxMonthly),
                    plannedUnitsPerMonth: Math.round(plannedMonthly),
                    utilizationOfMax: maxMonthly > 0 ? plannedMonthly / maxMonthly : null,
                    exceeded: plannedMonthly > maxMonthly
                };
            }
        }
    }

    // منحنى التصاعد (Ramp-Up): الإيراد لا يقفز لكامل الخطة من الشهر الأول —
    // معامل السنة الأولى = متوسط منحنى خطي يبلغ 100% عند شهر rampUpMonths
    const rampUpMonths = Math.max(0, Math.min(24, Number(study.assumptions?.rampUpMonths || 0)));
    let rampFactorY1 = 1;
    if (rampUpMonths > 1) {
        let s = 0;
        for (let m = 1; m <= 12; m++) s += Math.min(1, m / rampUpMonths);
        rampFactorY1 = s / 12;
    }

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
    let cashCycle = null;
    if (hasCashCycle) {
        const rev1Total = year1OperatingRevenueBase + year1NonOperatingRevenueBase;
        const ar = rev1Total * (Number.isFinite(dso) && dso > 0 ? dso : 0) / 365;
        const inventory = year1OperatingVCBase * (Number.isFinite(dio) && dio > 0 ? dio : 0) / 365;
        const ap = year1OperatingVCBase * (Number.isFinite(dpo) && dpo > 0 ? dpo : 0) / 365;
        cashCycle = { receivables: ar, inventory, payables: ap, net: Math.max(0, ar + inventory - ap) };
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
        const out = [];
        for (let y = 0; y < years; y++) {
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

    for (let i = 1; i <= years; i++) {
        const yearIndex = i - 1;
        const utilRate = getUtilizationRate(i);
        const costInflation = Math.pow(1 + inflation, yearIndex);
        // منحنى التصاعد يطال السنة الأولى فقط (الحجم لا يبدأ كاملاً من الشهر الأول)
        const rampFactor = i === 1 ? rampFactorY1 : 1;

        // التشغيلي يتدرج مع الاستغلال؛ غير التشغيلي دخل شبه ثابت
        // السعر يحرك الإيراد فقط؛ الحجم يحرك الإيراد والتكاليف المتغيرة معاً
        const opRev = sourcesAtYear(true, 'rev1', yearIndex) * revMult * priceMult * volumeMult * utilRate * rampFactor;
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
        const grossProfit = totalRevenue - totalVariableCosts;

        // المصاريف الثابتة تتضخم مع الزمن
        const payroll = annualPayroll * costInflation * (1 - getSaving('HR'));
        const rentAndAdmin = (annualLogisticsFixed + annualAdmin) * costInflation * (1 - getSaving('AdminLogistics'));
        const mkt = annualMarketing * costInflation * (1 - getSaving('Marketing'));
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

        // إحلال الأصول قصيرة العمر (يبدأ من السنة التالية لانتهاء العمر)
        const checkReplacement = (arr, defaultRate) => toArray(arr).reduce((acc, item) => {
            const rate = rateOrDefault(item.depreciationRate, defaultRate);
            if (rate <= 0) return acc;
            const life = Math.round(1 / rate);
            if (life > 0 && (i - 1) % life === 0 && i > 1) {
                const cost = Number(item.price || item.cost || 0);
                const qty = Number(item.quantity || item.count || 1);
                return acc + (cost * qty);
            }
            return acc;
        }, 0);
        let replacementCost = 0;
        replacementCost += checkReplacement(technical.equipment, 0.15);
        replacementCost += checkReplacement(technical.furniture, 0.20);
        replacementCost += checkReplacement(techResources.techResources, 0.25);

        // Bug B: الإهلاك الدفتري لا يبقى ثابتاً للأبد — الأصناف القابلة للإحلال
        // تتوقف عن الإهلاك الدفتري بعد استنفاد عمرها الأصلي (صُرِفت نقداً كإحلال)،
        // بينما يستمر الجزء الدائم (مبانٍ/تأسيس/خدمات). هذا يزيل ازدواج الصرف.
        const depreciation = permanentAnnualDep + replaceableDepAtYear(i) + establishmentAmortAtYear(i);
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
        const netFixedStart = Math.max(0, totalCapex - cumulativeDepreciationPriorYears);
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

        // التدفق النقدي
        const operatingCF = netIncome + depreciation;
        const financingCF = -principalPaid;
        const netCashFlow = operatingCF + financingCF - replacementCost;

        const prevCum = cumulativeCashFlow;
        cumulativeCashFlow += netCashFlow;
        if (prevCum < 0 && cumulativeCashFlow >= 0 && netCashFlow > 0) {
            const fraction = Math.abs(prevCum) / netCashFlow;
            paybackPeriod = (i - 1) + fraction;
        }

        const df = 1 / Math.pow(1 + discountRate, i);
        const discountedCF = netCashFlow * df;
        const prevCumDiscounted = cumulativeDiscountedCashFlow;
        cumulativeDiscountedCashFlow += discountedCF;
        if (prevCumDiscounted < 0 && cumulativeDiscountedCashFlow >= 0 && discountedCF > 0) {
            const fractionD = Math.abs(prevCumDiscounted) / discountedCF;
            discountedPaybackPeriod = (i - 1) + fractionD;
        }

        incomeStatement.push({
            year: i,
            revenue: totalRevenue,
            operatingRevenue: opRev,
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

    // ═══ القيمة النهائية (Terminal Value — نمو Gordon) ═══
    const tvCfg = study.assumptions?.terminalValue || {};
    const lastYearIncomeStatement = incomeStatement[incomeStatement.length - 1] || {};
    
    const { tvEquity, terminalValueDiscounted } = calculateTerminalValue({
        tvCfg,
        lastYearIncomeStatement,
        discountRate,
        years,
        loanScheduleData
    });

    // القيمة النهائية استرشادية، لا تُخلط مع سلسلة التدفقات النقدية الأساسية
    const npv = calculateNPV(discountRate, cashFlows);
    const npvWithTerminal = npv + terminalValueDiscounted;
    
    let irr = calculateIRR(cashFlows);
    if (irr != null) {
        const tol = 1e-6;
        if (npv < -tol && irr > discountRate) irr = null;
        else if (npv > tol && irr < discountRate) irr = null;
    }
    const mirr = calculateMIRR(cashFlows, discountRate, discountRate);

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

    // نقطة التعادل (السنة الأولى) — تعريف واحد قانوني لكل الشاشات والتقارير:
    // الثوابت المحتسبة = ثوابت السنة الأولى الفعلية (شاملة الأوفرهيد الخفي) + الإهلاك الدفتري.
    // كانت الشاشات تتضارب: المحرك بلا إهلاك/أوفرهيد، وشاشة التعادل تضيفهما، والنص المولد ثالثة —
    // ثلاث قيم مختلفة لنفس «نقطة التعادل» في دراسة واحدة (تدقيق ٢٠٢٦-٠٧-٠٦).
    const year1FixedForBE = year1 ? (year1.fixedCosts + year1.depreciation) : totalFixedOpexYear1;
    const cmRatio = year1Revenue > 0 ? (year1Revenue - year1VariableCosts) / year1Revenue : 0;
    const breakEvenValue = cmRatio > 0 ? year1FixedForBE / cmRatio : 0;
    // هامش المساهمة للوحدة يُحسب على أساس 100% طاقة للطرفين (سعر − تكلفة متغيرة للوحدة)
    // — كان يقسم إيراداً مخفّضاً بالاستغلال على وحدات كاملة فيضاعف نقطة التعادل زوراً
    const contributionMarginPerUnit = year1Units > 0
        ? (year1OperatingRevenueBase - year1OperatingVCBase) / year1Units
        : 0;
    const breakEvenUnits = contributionMarginPerUnit > 0 ? year1FixedForBE / contributionMarginPerUnit : 0;

    // DSCR من جدول السداد الفعلي — بسطه CFADS (النقد المتاح لخدمة الدين) لا EBITDA خام.
    // CFADS = EBITDA − الضرائب النقدية (الزكاة+الضريبة = levy) − الإنفاق الرأسمالي للإحلال
    // (replacementCost). المعيار البنكي: خدمة الدين تُسدَّد من نقد فعلي بعد اقتطاع الزكاة/الضريبة
    // والإحلال، لا من ربح تشغيلي خام يتجاهلهما (فيُبالِغ في تغطية الدين). (تدقيق ٢٠٢٦-٠٧-٠٨)
    const cfads = (stmt) => Math.max(0,
        (Number(stmt.ebitda) || 0) - (Number(stmt.levy) || 0) - (Number(stmt.replacementCost) || 0));
    const year1Cfads = year1 ? cfads(year1) : 0;
    const debtServiceYear1 = loanYear(1)?.totalPayment || 0;
    const dscrYear1 = debtServiceYear1 > 0 && year1Cfads > 0
        ? year1Cfads / debtServiceYear1
        : null;
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

    // ═══════════════════════════════════════════════════════════
    // 9. التحليلات المشتقة (فقط في التشغيل الأعلى بدون overrides)
    // ═══════════════════════════════════════════════════════════
    let sensitivity = [];
    let scenarios = null;
    let loanSchedule = null;
    let balanceSheets = [];
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
                // مساهمة المالك المُدخلة (وليس رقماً مشتقاً) + الفجوة صراحةً كي تُعرض
                // «فجوة تمويل غير مغطاة» بدل رأس مال مدفوع مختلَق يوازن الميزانية صمتاً
                equityAmount: paidCapital,
                fundingGap
            }, years);
        } catch (_) { balanceSheets = []; }

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
            _cum += y.cashFlow;
            return {
                year: y.year,
                cashFlow: y.cashFlow,
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
            rentAdminAnnual: annualLogisticsFixed + annualAdmin,
            marketingAnnual: annualMarketing
        },
        depreciation: annualDepreciation,
        depreciationSchedules: {
            book: incomeStatement.map(() => annualDepreciation), // خطي (للقوائم)
            tax: taxDepByYear.slice(0, incomeStatement.length)   // متناقص (زكوي/ضريبي — ZATCA)
        },
        incomeStatement,
        sensitivity,
        scenarios,
        tornado,
        loanSchedule,
        balanceSheets,
        saudization,
        capacityCheck,
        cashCycle,
        rampUpMonths,
        vat,
        cashFlow: cashFlowRows,
        assumptionsApplied: {
            zakatRate,
            taxRate,
            foreignOwnershipRate: foreignShare,
            discountRate,
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
            npvWithTerminal,
            terminalValue: tvEquity,
            irr,
            mirr,
            paybackPeriod: paybackOut,
            payback: paybackOut,
            roi: roi / 100,
            breakEvenPointValue: breakEvenValue,
            breakEvenUnits: Math.round(breakEvenUnits),
            dscr: dscrYear1 != null ? Number(dscrYear1.toFixed(2)) : null,
            profitMargin: year1Revenue > 0 ? (incomeStatement[0].netIncome / year1Revenue) : 0,
            grossMargin: year1Revenue > 0 ? ((year1Revenue - year1VariableCosts) / year1Revenue) : 0,
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
            npvWithTerminal: npv + terminalValueDiscounted
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
                const dscrText = dscrYear1 == null ? 'غير قابل للحساب بسبب EBITDA سالبة/صفرية' : dscrYear1.toFixed(2);
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
            const mcLastRun = study[SECTIONS.MONTE_CARLO]?.lastRun;
            if (d.decision === 'GO' && mcLastRun && Number.isFinite(mcLastRun.successProbability) && mcLastRun.successProbability < 0.5) {
                d.decision = 'REVISE';
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
    return result;
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
    if (!passIRR) reasons.push(`معدل العائد الداخلي يجب أن يكون ≥ ${(minIRR * 100).toFixed(0)}%`);
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

