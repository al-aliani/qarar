/**
 * ⛔ DEPRECATED (تدقيق 2026-07-04) — لا تستورد runFullModel من هذا الملف.
 * كان محركاً موازياً (بلا زكاة، خصم 5%) يعطي أرقاماً تناقض engine.js لنفس الدراسة.
 * مصدر الحقيقة الوحيد: web/js/core/engine.js (calculateStudy).
 * أُبقي الملف مؤقتاً لأن وحداته الفرعية (loanSchedule/balanceSheet/wacc/dscr)
 * تُستورد من ملفاتها مباشرة — أي استيراد جديد لهذا الملف يُعد خطأ مراجعة.
 *
 * Financial Model Engine (legacy)
 * Data flows: Inputs → CAPEX/OPEX → Revenue → P&L → Cash Flow → Indicators
 */

// Import new calculation modules
import { computeLoanSchedule, getYearlyInterest } from './loanSchedule.js';
import { computeWACC, getDiscountRate } from './wacc.js';
import { computeBalanceSheet, generateBalanceSheets } from './balanceSheet.js';
import { computeDSCR, computeMultiYearDSCR } from './dscr.js';
import { bridgeServicesToRevenueStreams } from './servicesToRevenueBridge.js';
import { calculateTotalGOSI } from './gosi.js'; // توطين مالي — GOSI تلقائياً

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULTS = {
    inflationRate: 0.02,
    taxRate: 0.15,
    discountRate: 0.05,
    workingCapitalMonths: 3,
    contingencyRate: 0.10,
    projectionYears: 5
};

export const DEPRECIATION_RATES = {
    buildings: 0.05,      // 20 years
    equipment: 0.15,      // ~7 years
    furniture: 0.20,      // 5 years
    software: 0.33,       // 3 years
    vehicles: 0.25,       // 4 years
    default: 0.10
};

// ═══════════════════════════════════════════════════════════════════════════
// CAPEX AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate all capital expenditures from input tables
 * @param {Object} inputs - All study sections
 * @returns {Object} { items[], total, depreciation[], workingCapital, contingency, grandTotal }
 */
export function aggregateCapex(inputs) {
    const items = [];

    // 1. Technical Study - Buildings & Construction
    const technical = inputs.technical || {};
    (technical.buildings || []).forEach(item => {
        items.push({
            source: 'الدراسة الفنية - المباني',
            name: item.name || 'مباني',
            amount: (item.quantity || 1) * (item.price || 0),
            depreciationRate: item.depreciationRate || DEPRECIATION_RATES.buildings,
            category: 'buildings'
        });
    });

    // 2. Technical Study - Equipment
    (technical.equipment || []).forEach(item => {
        items.push({
            source: 'الدراسة الفنية - المعدات',
            name: item.name || 'معدات',
            amount: (item.quantity || 1) * (item.price || 0),
            depreciationRate: item.depreciationRate || DEPRECIATION_RATES.equipment,
            category: 'equipment'
        });
    });

    // 3. IT/Tech Resources
    // techResources can be either an array directly or an object with techResources array
    const techResourcesData = inputs.techResources;
    const techResourcesArray = Array.isArray(techResourcesData) 
        ? techResourcesData 
        : (techResourcesData?.techResources || []);
    
    if (Array.isArray(techResourcesArray)) {
        techResourcesArray.forEach(item => {
            items.push({
                source: 'الموارد التقنية',
                name: item.name || 'تقنية',
                amount: (item.quantity || 1) * (item.price || item.total || 0),
                depreciationRate: item.depreciationRate || DEPRECIATION_RATES.software,
                category: 'software'
            });
        });
    }

    // 4. Legal - Licenses & Formation
    const legal = inputs.legal || {};
    (legal.licenses || []).forEach(item => {
        if (item.isCapex !== false) {
            items.push({
                source: 'الدراسة القانونية',
                name: item.name || 'تراخيص',
                amount: (item.quantity || 1) * (item.price || 0),
                depreciationRate: 0, // Non-depreciable
                category: 'legal'
            });
        }
    });

    // 5. Marketing - Launch Campaign (Capital portion)
    const marketing = inputs.marketing || {};
    (marketing.campaigns || []).forEach(item => {
        if (item.type === 'capital' || item.isCapex === true) {
            items.push({
                source: 'الدراسة التسويقية - إطلاق',
                name: item.name || 'حملة تسويقية',
                amount: item.amount || 0,
                depreciationRate: 0,
                category: 'marketing'
            });
        }
    });

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const contingency = subtotal * DEFAULTS.contingencyRate;

    // Working capital will be calculated after OPEX
    const workingCapital = 0; // Placeholder - calculated separately

    return {
        items,
        subtotal,
        contingency,
        workingCapital,
        total: subtotal + contingency
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// OPEX AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aggregate all operating expenses from input tables
 * @param {Object} inputs - All study sections
 * @returns {Object} { fixed[], variable[], totalMonthly, totalAnnual }
 */
export function aggregateOpex(inputs) {
    const fixed = [];
    const variable = [];

    // 1. HR - Salaries + توطين مالي (GOSI، رسوم إقامة، تأمين صحي)
    const hr = inputs.hr || {};
    const positions = hr.positions || [];
    const saudizationRate = Math.max(0, Math.min(1, Number(hr.saudizationRate ?? inputs.assumptions?.saudizationRate ?? 0.3)));

    positions.forEach(pos => {
        const monthly = (pos.count || 1) * (pos.salary || 0);
        const annual = monthly * (pos.months || 12);

        // Management = Fixed, Operations = Variable
        const isVariable = (pos.isVariable === true) ||
            (pos.position || '').includes('مشرف') ||
            (pos.position || '').includes('عامل');

        const item = {
            source: 'الموارد البشرية',
            name: pos.position || 'موظف',
            monthly,
            annual,
            variablePercent: isVariable ? 1 : 0
        };

        if (isVariable) variable.push(item);
        else fixed.push(item);
    });

    // توطين مالي — GOSI (التأمينات الاجتماعية) تلقائياً حسب الجنسية
    if (positions.length > 0) {
        const gosiResult = calculateTotalGOSI(positions, saudizationRate);
        fixed.push({
            source: 'التأمينات الاجتماعية (GOSI)',
            name: 'اشتراكات التأمينات الاجتماعية',
            monthly: gosiResult.monthlyTotal,
            annual: gosiResult.annualTotal,
            variablePercent: 0,
            autoCalculated: true,
            _meta: { saudi: gosiResult.saudiContribution, nonSaudi: gosiResult.nonSaudiContribution }
        });

        // رسوم إقامة (للعاملين غير السعوديين) — من hr.govtFees أو 1000 ريال/سنة/فرد افتراضي
        const RESIDENCY_FEE_PER_EXPAT = Number(hr.govtFees?.iqama ?? 1000);
        let expatHeads = 0;
        positions.forEach(pos => {
            const c = pos.count || 1;
            if (pos.nationality === 'saudi') return;
            if (pos.nationality === 'expat' || (pos.nationality && pos.nationality !== 'saudi')) expatHeads += c;
            else expatHeads += Math.max(0, Math.floor(c * (1 - saudizationRate)));
        });
        if (expatHeads > 0) {
            const residencyAnnual = expatHeads * RESIDENCY_FEE_PER_EXPAT;
            fixed.push({
                source: 'رسوم التوظيف',
                name: 'رسوم إقامة وتأشيرات (غير سعوديين)',
                monthly: residencyAnnual / 12,
                annual: residencyAnnual,
                variablePercent: 0,
                autoCalculated: true,
                _meta: { expatHeads }
            });
        }

        // التأمين الصحي — سنوياً لكل فرد
        const healthPerHead = Number(hr.healthInsurancePerHead ?? 1200);
        const totalHeads = positions.reduce((s, p) => s + (p.count || 1), 0);
        if (totalHeads > 0 && healthPerHead > 0) {
            const healthAnnual = totalHeads * healthPerHead;
            fixed.push({
                source: 'التأمين الصحي',
                name: 'التأمين الصحي (إلزامي)',
                monthly: healthAnnual / 12,
                annual: healthAnnual,
                variablePercent: 0,
                autoCalculated: true,
                _meta: { heads: totalHeads }
            });
        }
    }

    // 2. Logistics
    // logistics can be either an array directly or an object with logistics array
    const logisticsData = inputs.logistics;
    const logisticsArray = Array.isArray(logisticsData) 
        ? logisticsData 
        : (logisticsData?.logistics || []);
    
    if (Array.isArray(logisticsArray)) {
        logisticsArray.forEach(item => {
            const monthly = item.monthly || 0;
            const annual = monthly * 12;
            const varPct = item.variablePercent || 0;

            fixed.push({
                source: 'الموارد اللوجستية',
                name: item.name || 'لوجستيات',
                monthly: monthly * (1 - varPct),
                annual: annual * (1 - varPct),
                variablePercent: 0
            });

            if (varPct > 0) {
                variable.push({
                    source: 'الموارد اللوجستية',
                    name: item.name || 'لوجستيات',
                    monthly: monthly * varPct,
                    annual: annual * varPct,
                    variablePercent: varPct
                });
            }
        });
    }

    // 3. Administrative
    // administrative can be either an array directly or an object with administrative array
    const administrativeData = inputs.administrative;
    const administrativeArray = Array.isArray(administrativeData) 
        ? administrativeData 
        : (administrativeData?.administrative || []);
    
    if (Array.isArray(administrativeArray)) {
        administrativeArray.forEach(item => {
            const monthly = item.monthly || 0;
            const annual = monthly * 12;

            fixed.push({
                source: 'الموارد الإدارية',
                name: item.name || 'إدارية',
                monthly,
                annual,
                variablePercent: 0
            });
        });
    }

    // 4. Marketing - Ongoing (Operating portion)
    const marketing = inputs.marketing || {};
    (marketing.campaigns || []).forEach(item => {
        if (item.type === 'operating' || item.isCapex === false) {
            const monthly = item.monthly || (item.amount / 12) || 0;
            variable.push({
                source: 'الدراسة التسويقية - تشغيل',
                name: item.name || 'تسويق',
                monthly,
                annual: monthly * 12,
                variablePercent: 0.5
            });
        }
    });

    // Totals
    const fixedMonthly = fixed.reduce((s, i) => s + i.monthly, 0);
    const fixedAnnual = fixed.reduce((s, i) => s + i.annual, 0);
    const variableMonthly = variable.reduce((s, i) => s + i.monthly, 0);
    const variableAnnual = variable.reduce((s, i) => s + i.annual, 0);

    return {
        fixed,
        variable,
        fixedMonthly,
        fixedAnnual,
        variableMonthly,
        variableAnnual,
        totalMonthly: fixedMonthly + variableMonthly,
        totalAnnual: fixedAnnual + variableAnnual
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPRECIATION CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate annual depreciation from CAPEX items
 * @param {Array} capexItems - Array of CAPEX items with depreciationRate
 * @returns {number} Total annual depreciation
 */
export function computeDepreciation(capexItems) {
    return capexItems.reduce((sum, item) => {
        return sum + (item.amount * (item.depreciationRate || 0));
    }, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// REVENUE PROJECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Project revenue over multiple years
 * @param {Array} streams - Revenue streams with customersPerMonth, avgPrice, growthRate
 * @param {number} years - Number of years to project
 * @returns {Array} [{ year, streams[], total }]
 */
export function computeRevenueProjection(streams, years = 5) {
    const projection = [];

    for (let y = 1; y <= years; y++) {
        const yearData = { year: y, streams: [], total: 0 };

        streams.forEach(stream => {
            const baseRevenue = (stream.customersPerMonth || 0) * 12 * (stream.avgPrice || 0);
            const growth = stream.growthRate || 0;
            const yearRevenue = baseRevenue * Math.pow(1 + growth, y - 1);

            yearData.streams.push({
                name: stream.service || stream.name || 'خدمة',
                revenue: yearRevenue
            });
            yearData.total += yearRevenue;
        });

        projection.push(yearData);
    }

    return projection;
}

// ═══════════════════════════════════════════════════════════════════════════
// INCOME STATEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute projected income statement (Enhanced with Interest Expense)
 * @param {Object} params
 * @returns {Array} [{ year, revenue, variableCosts, grossProfit, fixedCosts, depreciation, ebit, interestExpense, ebt, tax, netIncome }]
 */
export function computeIncomeStatement({ revenueProjection, opex, depreciation, loanSchedule = null, assumptions = {} }) {
    const { inflationRate = DEFAULTS.inflationRate, taxRate = DEFAULTS.taxRate } = assumptions;
    const years = revenueProjection.length;
    const statements = [];

    for (let y = 0; y < years; y++) {
        const yearNum = y + 1;
        const inflationFactor = Math.pow(1 + inflationRate, y);

        const revenue = revenueProjection[y].total;
        const variableCosts = opex.variableAnnual * inflationFactor;
        const grossProfit = revenue - variableCosts;
        const grossMargin = revenue > 0 ? (grossProfit / revenue) : 0;
        const fixedCosts = opex.fixedAnnual * inflationFactor;
        const ebitda = grossProfit - fixedCosts;
        const ebit = ebitda - depreciation;

        // NEW: Interest Expense from Loan Schedule
        const interestExpense = getYearlyInterest(loanSchedule, yearNum);
        const ebt = ebit - interestExpense; // Earnings Before Tax

        const tax = ebt > 0 ? ebt * taxRate : 0;
        const netIncome = ebt - tax;
        const netMargin = revenue > 0 ? (netIncome / revenue) : 0;

        statements.push({
            year: yearNum,
            revenue,
            variableCosts,
            grossProfit,
            grossMargin,
            fixedCosts,
            depreciation,
            ebitda,
            ebit,
            interestExpense, // NEW
            ebt,             // NEW
            tax,
            netIncome,
            netMargin        // NEW
        });
    }

    return statements;
}

// ═══════════════════════════════════════════════════════════════════════════
// CASH FLOW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute cash flow from income statement
 * @param {Array} incomeStatements
 * @param {number} initialInvestment - Total CAPEX
 * @returns {Array} [{ year, netIncome, depreciation, cashFlow, cumulative }]
 */
export function computeCashFlow(incomeStatements, initialInvestment) {
    const cashFlows = [];
    let cumulative = -initialInvestment;

    // Year 0 - Initial Investment
    cashFlows.push({
        year: 0,
        netIncome: 0,
        depreciation: 0,
        cashFlow: -initialInvestment,
        cumulative
    });

    incomeStatements.forEach(stmt => {
        const cashFlow = stmt.netIncome + stmt.depreciation;
        cumulative += cashFlow;

        cashFlows.push({
            year: stmt.year,
            netIncome: stmt.netIncome,
            depreciation: stmt.depreciation,
            cashFlow,
            cumulative
        });
    });

    return cashFlows;
}

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute NPV (Net Present Value)
 */
export function computeNPV(cashFlows, discountRate = DEFAULTS.discountRate) {
    return cashFlows.reduce((npv, cf) => {
        const pv = cf.cashFlow / Math.pow(1 + discountRate, cf.year);
        return npv + pv;
    }, 0);
}

/**
 * Compute IRR (Internal Rate of Return) using Newton-Raphson method
 */
export function computeIRR(cashFlows, maxIterations = 100, tolerance = 0.0001) {
    let rate = 0.1; // Initial guess

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let derivative = 0;

        cashFlows.forEach(cf => {
            const t = cf.year;
            npv += cf.cashFlow / Math.pow(1 + rate, t);
            derivative -= t * cf.cashFlow / Math.pow(1 + rate, t + 1);
        });

        if (Math.abs(npv) < tolerance) return rate;
        if (derivative === 0) break;

        rate = rate - npv / derivative;

        // Bounds check
        if (rate < -0.99) rate = -0.99;
        if (rate > 10) rate = 10;
    }

    return rate;
}

/**
 * Compute Payback Period
 */
export function computePaybackPeriod(cashFlows) {
    for (let i = 1; i < cashFlows.length; i++) {
        if (cashFlows[i].cumulative >= 0) {
            // Interpolate
            const prev = cashFlows[i - 1];
            const curr = cashFlows[i];
            const fraction = -prev.cumulative / curr.cashFlow;
            return (i - 1) + fraction;
        }
    }
    return Infinity; // Never pays back within projection period
}

/**
 * Compute Break-even Point (in units per month)
 */
export function computeBreakeven(fixedCostsAnnual, avgPrice, variableCostPerUnit) {
    const contribution = avgPrice - variableCostPerUnit;
    if (contribution <= 0) return Infinity;

    const annualUnits = fixedCostsAnnual / contribution;
    return annualUnits / 12; // Monthly
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run full financial model from inputs to indicators
 * @param {Object} studyData - Full study data from store
 * @returns {Object} Complete financial analysis
 */
// Main Orchestrator with Scenario Support (Enhanced)
export function runFullModel(studyData, scenarioParams = {}) {
    // Default Scenario Modifiers
    const modifiers = {
        revenue: 1 + (scenarioParams.revenueChange || 0),
        cogs: 1 + (scenarioParams.costChange || 0),
        opex: 1 + (scenarioParams.opexChange || 0),
        capex: 1 + (scenarioParams.capexChange || 0)
    };

    if (scenarioParams.costChange) {
        modifiers.cogs = 1 + scenarioParams.costChange;
        modifiers.opex = 1 + scenarioParams.costChange;
    }

    let assumptions = studyData.assumptions || DEFAULTS;
    // تحصين: منع سنوات التخطيط الشاذة (NaN أو خارج 1–30) التي قد تسبب أخطاء
    const rawY = Number(assumptions.projectionYears ?? assumptions.years ?? DEFAULTS.projectionYears);
    assumptions = { ...assumptions, projectionYears: (Number.isFinite(rawY) && rawY >= 1 && rawY <= 30) ? rawY : DEFAULTS.projectionYears };

    const financing = studyData.financing || {};

    // Phase 1: Aggregate inputs
    const capex = aggregateCapex(studyData);
    capex.subtotal *= modifiers.capex;
    capex.total = capex.subtotal + capex.contingency + (capex.workingCapital || 0);

    const opex = aggregateOpex(studyData);
    opex.fixedAnnual *= modifiers.opex;
    opex.fixedMonthly *= modifiers.opex;
    opex.variableAnnual *= modifiers.cogs;
    opex.variableMonthly *= modifiers.cogs;
    opex.totalAnnual = opex.fixedAnnual + opex.variableAnnual;
    opex.totalMonthly = opex.fixedMonthly + opex.variableMonthly;

    // Add working capital to CAPEX
    capex.workingCapital = opex.totalMonthly * (assumptions.workingCapitalMonths || 3);
    capex.total = capex.subtotal + capex.contingency + capex.workingCapital;

    // Phase 2: Compute depreciation
    const depreciation = computeDepreciation(capex.items);

    // Phase 2.5: NEW - Compute Loan Schedule
    let loanSchedule = null;
    if (financing.sources?.bankLoan?.amount > 0) {
        const loan = financing.sources.bankLoan;
        loanSchedule = computeLoanSchedule(
            loan.amount,
            loan.interestRate || 0.08,
            loan.termYears || 5,
            loan.gracePeriodMonths || 0
        );
    }

    // Phase 2.6: NEW - Compute WACC
    const waccResult = computeWACC(financing, assumptions.taxRate);
    const discountRate = waccResult.waccDecimal || assumptions.discountRate || 0.10;

    // Phase 3: Revenue projection
    let revenueStreams = studyData.financial?.revenue?.streams ||
        studyData.revenue?.streams || [];
    let revenueFromBridge = false;

    // DATA BRIDGE (Single Source of Truth)
    if ((!revenueStreams || revenueStreams.length === 0) && studyData.services?.items?.length > 0) {
        const bridged = bridgeServicesToRevenueStreams(
            studyData.services.items,
            studyData.revenue?.streams || studyData.financial?.revenue?.streams || []
        );
        if (bridged) {
            revenueStreams = bridged;
            revenueFromBridge = true;
        }
    }
    if (revenueStreams.length === 0 && studyData.services?.breakdown?.length > 0) {
        revenueFromBridge = true;
        revenueStreams = (studyData.services.breakdown || []).map(svc => ({
            name: svc.name || 'خدمة',
            service: svc.name || 'خدمة',
            customersPerMonth: (svc.dailyRequests || 0) * 30,
            avgPrice: parseFloat(svc.price) || 0,
            growthRate: 0.05
        }));
    }

    const revenueProjection = computeRevenueProjection(revenueStreams, assumptions.projectionYears || 5);

    revenueProjection.forEach(year => {
        year.total *= modifiers.revenue;
        year.streams.forEach(s => s.revenue *= modifiers.revenue);
    });

    // Phase 4: Income statement (now includes interest expense)
    const incomeStatement = computeIncomeStatement({
        revenueProjection,
        opex,
        depreciation,
        loanSchedule, // NEW
        assumptions
    });

    // Phase 5: Cash flow (now accounts for loan repayment)
    const cashFlow = computeCashFlow(incomeStatement, capex.total);

    // Phase 5.5: NEW - Balance Sheets
    const balanceSheets = generateBalanceSheets({
        capex,
        depreciation,
        loanSchedule,
        incomeStatements: incomeStatement,
        workingCapital: capex.workingCapital,
        equityAmount: financing.sources?.equity?.amount || capex.total
    }, assumptions.projectionYears || 5);

    // Phase 5.6: NEW - DSCR (Debt Service Coverage Ratio)
    const dscrAnalysis = computeMultiYearDSCR(incomeStatement, loanSchedule);

    // Phase 6: Indicators (now using WACC as discount rate)
    const npv = computeNPV(cashFlow, discountRate);
    const irr = computeIRR(cashFlow);
    const paybackPeriod = computePaybackPeriod(cashFlow);

    // Break-even calculation
    const totalRevenue = revenueStreams.reduce((s, r) => s + (r.customersPerMonth || 0) * 12 * (r.avgPrice || 0), 0);
    const avgPrice = totalRevenue / (revenueStreams.reduce((s, r) => s + (r.customersPerMonth || 0) * 12, 0) || 1);
    const variableCostPerUnit = opex.variableAnnual / (revenueStreams.reduce((s, r) => s + (r.customersPerMonth || 0) * 12, 0) || 1);
    const breakevenUnits = computeBreakeven(opex.fixedAnnual + depreciation, avgPrice, variableCostPerUnit);

    return {
        assumptions,
        capex,
        opex,
        depreciation,
        revenueProjection,
        incomeStatement,
        cashFlow,
        // NEW outputs
        loanSchedule,
        wacc: waccResult,
        balanceSheets,
        dscrAnalysis,
        // KPIs
        indicators: {
            npv,
            irr,
            paybackPeriod,
            breakevenUnitsPerMonth: breakevenUnits,
            roi: capex.total > 0 ? (incomeStatement[0]?.netIncome || 0) / capex.total : 0,
            profitMargin: revenueProjection[0]?.total > 0 ?
                (incomeStatement[0]?.netIncome || 0) / revenueProjection[0].total : 0,
            discountRateUsed: discountRate, // NEW
            dscr: dscrAnalysis[0]?.dscr || 'N/A' // NEW: Year 1 DSCR
        },
        decision: npv > 0 && irr > discountRate ? 'GO' : 'NO-GO',
        _meta: { revenueFromBridge }
    };
}
