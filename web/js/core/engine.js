
import { SECTIONS } from './schema.js';
import { computeLoanSchedule } from '../../../lib/calc/loanSchedule.js';
import { generateBalanceSheets } from '../../../lib/calc/balanceSheet.js';

function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
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
    const discountRate = study.assumptions?.discountRate || 0.10;

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

    const gosiRate = study.assumptions?.gosiRate || hr.gosiRate || 0.1175;
    const positions = toArray(hr.positions);
    const totalSalaries = positions.reduce((acc, pos) => {
        return acc + (Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12));
    }, 0);

    // GOSI حسب الجنسية — مطابق لصيغة جدول الرواتب في الواجهة (schema positions.annualCost)
    const gosiCost = positions.reduce((acc, pos) => {
        const basic = Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12);
        const rate = pos.nationality === 'saudi' ? 0.1175 : (pos.nationality === 'expat' ? 0.02 : gosiRate);
        return acc + basic * rate;
    }, 0);

    const totalHeadcount = positions.reduce((acc, pos) => acc + Number(pos.count || 1), 0);
    const insuranceCost = totalHeadcount * (hr.healthInsurancePerHead || 1200);

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

    const annualLogistics = toArray(logistics.logistics).reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);
    const hasGovtFees = toArray(admin.administrative).some(i => i.name && i.name.includes('حكوم'));
    let annualAdmin = toArray(admin.administrative).reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);
    if (!hasGovtFees) {
        // رسوم حكومية سنوية تقديرية (سجل، بلدية، دفاع مدني) لمنشأة صغيرة
        annualAdmin += 2500;
    }
    // المواد المستهلكة الشهرية (technical.consumables)
    annualAdmin += toArray(technical.consumables).reduce((acc, item) => acc + (Number(item.monthlyCost ?? item.monthly ?? 0) * 12), 0);

    const annualMarketing = toArray(marketing.campaigns)
        .filter(c => c.type === 'operating')
        .reduce((acc, c) => acc + (Number(c.monthly || 0) * 12), 0);

    // التكاليف الثابتة الشهرية المعرفة على مستوى كل خدمة
    const annualServiceFixed = serviceItems.reduce((acc, s) => acc + (Number(s.fixedCosts || 0) * 12), 0);

    let totalFixedOpexYear1 = annualPayroll + annualLogistics + annualAdmin + annualMarketing + annualServiceFixed;
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

    // طوارئ 10% على المعدات + مضاعف استراتيجية الإطلاق
    const equipmentBase = sumAsset(technical.equipment, 'Equipment') * (launchStrategy === 'Outsourcing' ? 0.3 : (launchStrategy === 'Pilot_Phase' ? 0.5 : 1.0));
    const equipmentContingency = equipmentBase * 0.10;
    const equipmentTotal = equipmentBase + equipmentContingency;

    const initialEstablishmentTotal = toArray(technical.establishmentCosts).reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const establishmentAmortization = toArray(technical.establishmentCosts).reduce((acc, item) => {
        return acc + (Number(item.amount || 0) * Number(item.amortizationRate || 0.20));
    }, 0);

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

    const assetDepreciation = (arr, defaultRate, category) => toArray(arr).reduce((acc, item) => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const rate = Number(item.depreciationRate || defaultRate);
        const saving = getSaving(category);
        return acc + (cost * qty * rate * (1 - saving));
    }, 0);

    const annualDepreciation =
        establishmentAmortization +
        assetDepreciation(technical.buildings, 0.05, 'Buildings') +
        (equipmentTotal * 0.15) +
        assetDepreciation(technical.furniture, 0.20, 'Furniture') +
        assetDepreciation(technical.vehicles, 0.20, 'Vehicles') +
        assetDepreciation(techResources.techResources, 0.25, 'TechResources') +
        (capexBreakdown.servicesCapex * 0.15);

    let totalCapex = Object.values(capexBreakdown).reduce((a, b) => a + b, 0);
    if (capexMult !== 1) totalCapex *= capexMult;

    // ═══════════════════════════════════════════════════════════
    // 3. مصادر الإيراد الموحدة (تشغيلية/غير تشغيلية) مع نمو لكل مصدر
    // ═══════════════════════════════════════════════════════════
    const revenueStreams = toArray(study[SECTIONS.REVENUE]?.streams);
    const hasServices = serviceItems.length > 0;
    const defaultGrowth = 0.05;

    /** @type {{rev1:number, vc1:number, units1:number, growth:number, operating:boolean}[]} */
    const revenueSources = [];

    // الخدمات المفصلة: تشغيلية دائماً
    serviceItems.forEach(item => {
        const customers = Number(item.customersPerMonth || 0) * 12;
        const saving = getSaving('Services');
        revenueSources.push({
            rev1: customers * Number(item.pricePerUnit || 0),
            vc1: customers * Number(item.variableCostPerUnit || 0) * (1 - saving),
            units1: customers,
            growth: Number(item.growthRate ?? defaultGrowth),
            operating: true
        });
    });

    // مصادر الإيرادات: التشغيلية تُستبدل بالخدمات إن وُجدت؛
    // غير التشغيلية (إيجار جزء من المقر…) تُحسب دائماً (كانت تُهمل مع وجود خدمات).
    revenueStreams.forEach(stream => {
        const type = stream.type || 'operating';
        if (type === 'operating' && hasServices) return;
        const annualCust = Number(stream.customersPerMonth || 0) * 12;
        const revenue = annualCust * Number(stream.avgPrice || 0);
        revenueSources.push({
            rev1: revenue,
            vc1: type === 'operating' ? revenue * Number(stream.variableCostRate ?? 0.30) : 0,
            units1: annualCust,
            growth: Number(stream.growthRate ?? defaultGrowth),
            operating: type === 'operating'
        });
    });

    const sumSources = (operating, field) =>
        revenueSources.filter(s => s.operating === operating).reduce((a, s) => a + s[field], 0);
    const year1OperatingRevenueBase = sumSources(true, 'rev1');
    const year1OperatingVCBase = sumSources(true, 'vc1');
    const year1Units = sumSources(true, 'units1');
    const year1NonOperatingRevenueBase = sumSources(false, 'rev1');

    // قيمة الفئة في سنة معينة وفق نمو كل مصدر (yearIndex = 0 للسنة الأولى)
    const sourcesAtYear = (operating, field, yearIndex) =>
        revenueSources.filter(s => s.operating === operating)
            .reduce((a, s) => a + s[field] * Math.pow(1 + (Number.isFinite(s.growth) ? s.growth : defaultGrowth), yearIndex), 0);

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

    const monthlyRentAndAdmin = (annualLogistics + annualAdmin) / 12;
    const wcRent = monthlyRentAndAdmin * coverage.rent;
    const monthlyPayroll = annualPayroll / 12;
    const wcSalaries = monthlyPayroll * coverage.salaries;
    const monthlyMarketing = annualMarketing / 12;
    const wcMarketing = monthlyMarketing * coverage.marketing;
    const monthlyVariable = year1OperatingVCBase / 12;
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
    const totalInvestment = totalCapex + workingCapital;

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
    const interestRate = financing.sources?.bankLoan?.interestRate || 0.08;
    const loanTerm = financing.sources?.bankLoan?.termYears || 5;
    const gracePeriodMonths = Number(financing.sources?.bankLoan?.gracePeriodMonths || 0);

    let loanScheduleData = null;
    if (loanAmount > 0) {
        try {
            loanScheduleData = computeLoanSchedule(loanAmount, interestRate, loanTerm, gracePeriodMonths);
        } catch (_) { loanScheduleData = null; }
    }
    const loanYear = (y) => loanScheduleData?.annualSummary?.find(s => s.year === y) || null;

    // ═══════════════════════════════════════════════════════════
    // 7. الإسقاطات (قائمة الدخل والتدفقات لسنوات الدراسة)
    // ═══════════════════════════════════════════════════════════
    const incomeStatement = [];
    let cumulativeCashFlow = -totalInvestment;
    let cumulativeDiscountedCashFlow = -totalInvestment;
    let paybackPeriod = Infinity;
    let discountedPaybackPeriod = Infinity;

    // وعاء الزكاة الحقيقي يتطلب تتبع حقوق الملكية والأصول سنة بسنة
    const paidCapital = Math.max(0, totalInvestment - loanAmount);
    let retainedEarningsStart = 0; // الأرباح المحتجزة في بداية كل سنة

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

        const totalRevenue = opRev + nonOpRev;
        const totalVariableCosts = (opVC + nonOpVC) * opexMult;
        const grossProfit = totalRevenue - totalVariableCosts;

        // المصاريف الثابتة تتضخم مع الزمن
        const payroll = annualPayroll * costInflation * (1 - getSaving('HR'));
        const rentAndAdmin = (annualLogistics + annualAdmin) * costInflation * (1 - getSaving('AdminLogistics'));
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
            const rate = Number(item.depreciationRate || defaultRate);
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

        const depreciation = annualDepreciation;
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
        const netFixedStart = Math.max(0, totalCapex - annualDepreciation * yearIndex);
        const fundingSourcesBase = paidCapital + retainedEarningsStart + loanBalanceStart - netFixedStart;
        const taxDepY = taxDepByYear[yearIndex] || 0;
        const adjustedProfit = ebt + depreciation - taxDepY; // الربح المعدل (إهلاك نظامي بدل الدفتري)
        const zakatBase = Math.max(0, Math.max(adjustedProfit, fundingSourcesBase));
        const zakat = zakatBase * zakatRate * (1 - foreignShare);
        // ضريبة دخل حصة الأجانب تُحسب على الربح المعدل (الإهلاك النظامي هو المعتمد ضريبياً)
        const tax = foreignShare > 0 ? Math.max(0, adjustedProfit) * taxRate * foreignShare : 0;
        const netIncome = ebt - zakat - tax;
        retainedEarningsStart += netIncome; // ترحيل لبداية السنة التالية

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
            ebt,
            zakat,
            zakatBase,
            adjustedProfit,
            taxDepreciation: taxDepY,
            tax,
            netIncome,
            replacementCost,
            loanPrincipalPaid: principalPaid,
            cashFlow: netCashFlow
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 8. المؤشرات
    // ═══════════════════════════════════════════════════════════
    const cashFlows = [-totalInvestment, ...incomeStatement.map(y => y.cashFlow)];

    const npv = calculateNPV(discountRate, cashFlows);
    const irr = calculateIRR(cashFlows);
    const mirr = calculateMIRR(cashFlows, discountRate, discountRate);

    // ═══ القيمة النهائية (Terminal Value — نمو Gordon) ═══
    // استرشادية دائماً: القرار يبقى على NPV المتحفظ بدونها (البنوك لا تعتد بها)،
    // لكن غيابها كلياً يعني افتراض تصفية المشروع بلا قيمة بعد سنوات الدراسة.
    const tvCfg = study.assumptions?.terminalValue || {};
    let terminalValueDiscounted = 0;
    if ((tvCfg.method || 'gordon') !== 'none') {
        const lastCF = incomeStatement[incomeStatement.length - 1]?.cashFlow || 0;
        // نمو مستدام مقصوص تحت معدل الخصم (شرط صحة معادلة Gordon)
        const g = Math.min(Number(tvCfg.growthRate ?? 0.02), Math.max(0, discountRate - 0.02));
        if (lastCF > 0 && discountRate > g) {
            const tv = (lastCF * (1 + g)) / (discountRate - g);
            terminalValueDiscounted = tv / Math.pow(1 + discountRate, years);
        }
    }

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
    const roi = (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / totalInvestment) * 100;
    const pi = (npv + totalInvestment) / totalInvestment;
    const avgAnnualProfit = incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length;
    const arr = (avgAnnualProfit / totalInvestment) * 100;

    const year1 = incomeStatement[0];
    const year1Revenue = year1 ? year1.revenue : 0;
    const year1VariableCosts = year1 ? year1.variableCosts : 0;

    // نقطة التعادل (السنة الأولى)
    const cmRatio = year1Revenue > 0 ? (year1Revenue - year1VariableCosts) / year1Revenue : 0;
    const breakEvenValue = cmRatio > 0 ? totalFixedOpexYear1 / cmRatio : 0;
    // هامش المساهمة للوحدة يُحسب على أساس 100% طاقة للطرفين (سعر − تكلفة متغيرة للوحدة)
    // — كان يقسم إيراداً مخفّضاً بالاستغلال على وحدات كاملة فيضاعف نقطة التعادل زوراً
    const contributionMarginPerUnit = year1Units > 0
        ? (year1OperatingRevenueBase - year1OperatingVCBase) / year1Units
        : 0;
    const breakEvenUnits = contributionMarginPerUnit > 0 ? totalFixedOpexYear1 / contributionMarginPerUnit : 0;

    // DSCR من جدول السداد الفعلي
    const year1Ebitda = year1 ? year1.ebitda : 0;
    const debtServiceYear1 = loanYear(1)?.totalPayment || 0;
    const dscrYear1 = debtServiceYear1 > 0 && year1Ebitda > 0
        ? year1Ebitda / debtServiceYear1
        : null;
    const dscrAnalysis = loanScheduleData ? incomeStatement.slice(0, loanTerm).map((stmt, idx) => {
        const y = idx + 1;
        const debtService = loanYear(y)?.totalPayment || 0;
        const dscr = debtService > 0 && stmt.ebitda > 0 ? stmt.ebitda / debtService : null;
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
            total: workingCapital,
            breakdown: {
                rent: wcRent,
                salaries: wcSalaries,
                marketing: wcMarketing,
                cogs: wcCOGS
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
                equityAmount: Math.max(0, totalInvestment - loanAmount)
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
        const opt = runCase({ revenueChange: 0.10, costChange: -0.05 });
        const pess = runCase({ revenueChange: -0.15, costChange: 0.10 });
        if (opt) scenarios.optimistic = opt;
        if (pess) scenarios.pessimistic = pess;
    }

    // التدفق النقدي التراكمي
    let _cum = -totalInvestment;
    const cashFlowRows = [
        { year: 0, cashFlow: -totalInvestment, netIncome: 0, depreciation: 0, cumulative: -totalInvestment },
        ...incomeStatement.map(y => {
            _cum += y.cashFlow;
            return { year: y.year, cashFlow: y.cashFlow, netIncome: y.netIncome, depreciation: y.depreciation, cumulative: _cum };
        })
    ];

    return {
        capex: {
            capitalStructure,
            breakdown: capexBreakdown,
            subtotal: totalCapex,
            workingCapital,
            contingency: 0,
            total: totalInvestment
        },
        opex: {
            fixedAnnual: totalFixedOpexYear1,
            variableAnnual: year1VariableCosts,
            totalAnnual: totalFixedOpexYear1 + year1VariableCosts,
            // مكونات السنة الأولى — تستهلكها فحوصات معايير «السائقين» القطاعية
            payrollAnnual: annualPayroll,
            rentAdminAnnual: annualLogistics + annualAdmin,
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
            inflationRate: inflation
        },
        indicators: {
            npv,
            irr,
            mirr,
            paybackPeriod: paybackOut,
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
            roe: totalInvestment > 0 ? (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length) / totalInvestment : 0,
            roa: totalInvestment > 0 ? (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length) / totalInvestment : 0,
            profitabilityIndex: pi,
            discountedPaybackPeriod: discountedPaybackOut,
            arr: arr / 100,
            // القيمة النهائية (مخصومة) — استرشادية؛ القرار على NPV المتحفظ أعلاه
            terminalValue: terminalValueDiscounted,
            npvWithTerminal: npv + terminalValueDiscounted
        },
        dscrAnalysis,
        ...(() => {
            const d = computeDecision(study.assumptions?.thresholds, {
                npv, irr,
                paybackPeriod: paybackOut,
                roi: roi / 100
            });
            // مبيعات تتجاوز الطاقة القصوى المادية لا يمكن أن تكون GO مهما كانت
            // المؤشرات — الأرقام مبنية على حجم مستحيل التحقيق
            if (capacityCheck?.exceeded && d.decision === 'GO') {
                d.decision = 'REVISE';
                d.decisionReasons.unshift(
                    `المبيعات المخططة (${capacityCheck.plannedUnitsPerMonth.toLocaleString('ar-SA')} عميل/شهر) تتجاوز الطاقة القصوى (${capacityCheck.maxUnitsPerMonth.toLocaleString('ar-SA')}) — خفّض التوقعات أو وسّع الطاقة`
                );
            }
            return d;
        })(),
        get kpis() { return this.indicators; }
    };
}

/**
 * ينتج GO / NO-GO / REVISE بناءً على حدود 01_Assumptions.
 * @param {Object} th - study.assumptions.thresholds
 * @param {Object} k - { npv, irr, paybackPeriod, roi } — paybackPeriod قد يكون null (غير قابل للاسترداد)
 * @returns {{ decision: 'GO'|'NO-GO'|'REVISE', decisionReasons: string[] }}
 */
function computeDecision(th, k) {
    const t = th || {};
    const minNPV = t.minNPV != null ? Number(t.minNPV) : 0;
    const minIRR = t.minIRR != null ? Number(t.minIRR) : 0.15;
    const maxPayback = t.maxPayback != null ? Number(t.maxPayback) : 7;
    const minROI = t.minROI != null ? Number(t.minROI) : 0.20;

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

    return { decision, decisionReasons: reasons };
}

/**
 * Runner for Sensitivity Analysis (legacy — بعض الشاشات القديمة تستدعيه)
 */
export function calculateSensitivityScenarios(study) {
    const run = (revMult, costMult, label) => {
        const dStudy = JSON.parse(JSON.stringify(study));

        if (dStudy[SECTIONS.REVENUE]) {
            (dStudy[SECTIONS.REVENUE].streams || []).forEach(s => s.avgPrice = (s.avgPrice || 0) * revMult);
        }
        if (dStudy[SECTIONS.SERVICES]) {
            (dStudy[SECTIONS.SERVICES].items || []).forEach(s => s.pricePerUnit = (s.pricePerUnit || 0) * revMult);
        }
        if (dStudy[SECTIONS.HR]) {
            (dStudy[SECTIONS.HR].positions || []).forEach(p => p.salary = (p.salary || 0) * costMult);
        }
        if (dStudy[SECTIONS.LOGISTICS]) (dStudy[SECTIONS.LOGISTICS].logistics || []).forEach(i => i.monthly = (i.monthly || 0) * costMult);
        if (dStudy[SECTIONS.ADMINISTRATIVE]) (dStudy[SECTIONS.ADMINISTRATIVE].administrative || []).forEach(i => i.monthly = (i.monthly || 0) * costMult);
        if (dStudy[SECTIONS.SERVICES]) {
            (dStudy[SECTIONS.SERVICES].items || []).forEach(s => s.variableCostPerUnit = (s.variableCostPerUnit || 0) * costMult);
        }

        const res = calculateStudy(dStudy);
        return {
            scenario: label,
            npv: res.indicators.npv,
            irr: res.indicators.irr,
            payback: res.indicators.paybackPeriod,
            roi: res.indicators.roi
        };
    };

    return [
        run(1.10, 1.0, 'زيادة الإيرادات 10%'),
        run(0.90, 1.0, 'انخفاض الإيرادات 10%'),
        run(1.0, 1.10, 'زيادة التكاليف 10%'),
        run(1.0, 0.90, 'انخفاض التكاليف 10%'),
    ];
}

// Helpers
function calculateNPV(rate, cashflows) {
    return cashflows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i), 0);
}

function calculateIRR(cashflows, guess = 0.1) {
    // حراسات صحة: IRR حقيقي يتطلب تدفقين على الأقل وتغيّر إشارة واحداً
    if (!Array.isArray(cashflows) || cashflows.length < 2) return 0;
    if (!cashflows.some(v => v > 0) || !cashflows.some(v => v < 0)) return 0;

    const maxIter = 1000;
    const precision = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        const npv = calculateNPV(rate, cashflows);
        if (Math.abs(npv) < precision) break;

        const derivative = cashflows.reduce((acc, val, t) => {
            if (t === 0) return acc;
            return acc - t * val * Math.pow(1 + rate, -t - 1);
        }, 0);

        if (derivative === 0) break;
        const newRate = rate - npv / derivative;
        if (!Number.isFinite(newRate) || newRate <= -0.9999 || newRate > 1e4) break;
        if (Math.abs(newRate - rate) < precision) { rate = newRate; break; }
        rate = newRate;
    }
    if (!Number.isFinite(rate)) return 0;
    // مشروع فائق الربحية: قصّ عند 1000% بدل إرجاع 0 (كان 0 يقلب القرار إلى NO-GO زوراً)
    if (rate > 10) return 10;
    if (rate < -0.9999) return -0.9999;
    return rate;
}

/**
 * MIRR (Modified Internal Rate of Return)
 * @param {number[]} cashflows - [CF0, CF1, ...]
 * @param {number} financeRate - cost of borrowing
 * @param {number} reinvestRate - rate for reinvesting positive flows
 */
function calculateMIRR(cashflows, financeRate, reinvestRate) {
    if (!cashflows?.length) return 0;
    const n = cashflows.length;
    let pvNeg = 0;
    let fvPos = 0;
    for (let i = 0; i < n; i++) {
        const cf = cashflows[i];
        if (cf < 0) pvNeg += cf / Math.pow(1 + financeRate, i);
        else if (cf > 0) fvPos += cf * Math.pow(1 + reinvestRate, n - 1 - i);
    }
    if (pvNeg >= 0 || fvPos <= 0) return 0;
    return Math.pow(-fvPos / pvNeg, 1 / (n - 1)) - 1;
}
