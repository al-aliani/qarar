
import { SECTIONS } from './schema.js';
import { computeLoanSchedule } from '../../../lib/calc/loanSchedule.js';
import { generateBalanceSheets } from '../../../lib/calc/balanceSheet.js';

function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

/**
 * Feasibility Study Calculation Engine (v4.0)
 * Compatible with new Schema.js structure
 */
export function calculateStudy(study, overrides) {
    if (!study) return null;
    const revMult = 1 + (overrides?.revenueChange ?? 0);
    const opexMult = 1 + (overrides?.opexChange ?? overrides?.costChange ?? 0);
    const capexMult = 1 + (overrides?.capexChange ?? 0);

    const years = study.assumptions?.projectionYears || 5;
    const inflation = study.assumptions?.inflationRate || 0.02;
    const technical = study[SECTIONS.TECHNICAL] || {};
    const marketing = study[SECTIONS.MARKETING] || {};
    const techResources = study[SECTIONS.TECH_RESOURCES] || {};
    const legal = study[SECTIONS.LEGAL] || {};
    const services = study[SECTIONS.SERVICES] || {};
    const taxRate = study.assumptions?.taxRate || 0.15; // Corporate Tax (if applicable)
    const zakatRate = 0.025; // Standard Zakat
    const discountRate = study.assumptions?.discountRate || 0.10;

    // ═══════════════════════════════════════════════════════════
    // 2. OPEX Calculation (Operating Expenses)
    // ═══════════════════════════════════════════════════════════
    const hr = study[SECTIONS.HR] || {};
    const logistics = study[SECTIONS.LOGISTICS] || {};
    const admin = study[SECTIONS.ADMINISTRATIVE] || {};

    // HR Costs
    // HR Costs (Saudi Logic: 11.75% GOSI for Saudis, or blended rate)
    // Assuming 'gosiRate' in assumptions or default to 0.1175 for Saudis (Employer share)
    // We'll treat gosiRate as a blended rate if not specified per position
    const gosiRate = study.assumptions?.gosiRate || 0.1175;
    const positions = toArray(hr.positions);
    const totalSalaries = positions.reduce((acc, pos) => {
        return acc + (Number(pos.salary || 0) * Number(pos.count || 1) * Number(pos.months || 12));
    }, 0);

    // GOSI Calculation (Refined)
    // Ideally we check nationality, but for now we apply rate to total or assume ratio
    // Let's assume 10% average if not strictly defined
    const gosiCost = totalSalaries * gosiRate;

    // Insurance (Mandatory for Saudis and Expats usually)
    const insuranceCost = positions.reduce((acc, pos) => acc + Number(pos.count || 1), 0) * (hr.healthInsurancePerHead || 1200); // Default 1200 SAR/year

    const annualPayroll = totalSalaries + gosiCost + insuranceCost;

    // Logistics & Admin
    let annualLogistics = toArray(logistics.logistics).reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);
    // Add Auto-calculated Govt Fees (License, CR, Baladiya) if not explicitly in admin
    // This is the "Localized" touch
    const hasGovtFees = toArray(admin.administrative).some(i => i.name && i.name.includes('حكوم'));
    let annualAdmin = toArray(admin.administrative).reduce((acc, item) => acc + (Number(item.monthly || 0) * 12), 0);

    if (!hasGovtFees) {
        // Add estimated annual govt fees (CR renewal, Baladiya, Civil Defense etc) ~ 2000 SAR/year avg for small biz
        annualAdmin += 2500;
    }

    // Marketing (Operating)
    const annualMarketing = toArray(marketing.campaigns)
        .filter(c => c.type === 'operating')
        .reduce((acc, c) => acc + (Number(c.monthly || 0) * 12), 0);

    let totalFixedOpexYear1 = annualPayroll + annualLogistics + annualAdmin + annualMarketing;
    if (opexMult !== 1) totalFixedOpexYear1 *= opexMult;

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    // 1. CAPEX Calculation (Investment Costs)
    // ═══════════════════════════════════════════════════════════

    // Corporate Venture Logic (Transcript 7)
    const isCorporate = study[SECTIONS.PROJECT_INFO]?.businessModel === 'Corporate_Venture';
    const corporateAssets = study[SECTIONS.PROJECT_INFO]?.corporateAssets || [];

    // Helper to calculate savings from Unfair Advantage
    const getSaving = (category) => {
        if (!isCorporate) return 0;
        const asset = corporateAssets.find(a => a.costSavingType === category);
        return asset ? (Number(asset.savingPercentage || 0)) : 0;
    };

    // Launch Strategy Multipliers (Transcript 5 - Soft Launch)
    // Full_Launch = 1.0
    // Pilot_Phase = 0.5 (Start small, 50% of appliances/marketing)
    // Outsourcing = 0.3 (Outsource production, minimal equipment)
    const launchStrategy = marketing.marketAnalysis?.launchStrategy || "Full_Launch";
    let strategyMult = 1.0;
    if (launchStrategy === "Pilot_Phase") strategyMult = 0.5;
    if (launchStrategy === "Outsourcing") strategyMult = 0.3; // Significantly less equipment needed

    // Helper to sum cost/price * quantity WITH Corporate Savings
    const sumAsset = (arr, category) => toArray(arr).reduce((acc, item) => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const saving = getSaving(category); // e.g. "Equipment"
        return acc + (cost * qty * (1 - saving));
    }, 0);

    // Apply 10% Contingency on Equipment as per video recommendation
    // Apply 10% Contingency on Equipment as per video recommendation
    // Apply Launch Strategy Multiplier to Equipment
    const equipmentBase = sumAsset(technical.equipment, 'Equipment') * (launchStrategy === "Outsourcing" ? 0.3 : (launchStrategy === "Pilot_Phase" ? 0.5 : 1.0));
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
        techResources: sumAsset(techResources.techResources, 'TechResources'),
        // Add Franchise Entry Fee if applicable
        franchiseFee: (study[SECTIONS.PROJECT_INFO]?.businessModel === 'Franchise') ?
            Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.entryFee || 0) : 0,
        licenses: sumAsset(legal.licenses, 'Licenses'), // Initial license costs
        preOpeningMarketing: (marketing.campaigns || [])
            .filter(c => c.type === 'capital')
            .reduce((acc, c) => acc + (Number(c.amount || 0)), 0) * (launchStrategy === "Pilot_Phase" ? 0.6 : 1.0), // 40% saving in pilot
        servicesCapex: toArray(services.items).reduce((acc, s) => acc + Number(s.capex || 0), 0),
        // Transcript 7: Venture Builder Fees
        ventureBuilder: (study[SECTIONS.FINANCING]?.ventureBuilderFees?.fixedFee || 0),
        // Transcript 8: Environmental Mitigation
        envMitigation: (study[SECTIONS.TECHNICAL]?.environmentalMitigationCost || 0),
        validation: 0
    };

    // Adjust Establishment Total with new fees
    const establishmentTotal =
        capexBreakdown.establishment +
        capexBreakdown.preOpeningMarketing +
        capexBreakdown.licenses +
        capexBreakdown.franchiseFee +
        capexBreakdown.ventureBuilder +
        capexBreakdown.validation +
        capexBreakdown.envMitigation;

    // Calculate Depreciation (Simplified Straight Line)
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
        (equipmentTotal * 0.15) + // equipmentTotal already has savings applied
        assetDepreciation(technical.furniture, 0.20, 'Furniture') +
        assetDepreciation(techResources.techResources, 0.25, 'TechResources') +
        (capexBreakdown.servicesCapex * 0.15);

    let totalCapex = Object.values(capexBreakdown).reduce((a, b) => a + b, 0);
    if (capexMult !== 1) totalCapex *= capexMult;

    // Working Capital: Based on Grant Workshop (Operating Capital)
    // Granular coverage periods based on best practices
    const coverage = {
        rent: 6,      // Rent is usually paid semi-annually
        salaries: 3,  // Buffer for hiring/training/stability
        cogs: 3,      // Inventory cycle
        marketing: 3, // Initial push overlap
        other: 3
    };

    // 1. Rent & Admin (Assuming logistics + admin is mostly Rent/Utilities)
    const monthlyRentAndAdmin = (annualLogistics + annualAdmin) / 12;
    const wcRent = monthlyRentAndAdmin * coverage.rent;

    // 2. Salaries
    const monthlyPayroll = annualPayroll / 12;
    const wcSalaries = monthlyPayroll * coverage.salaries;

    // 3. Marketing (Operating)
    const monthlyMarketing = annualMarketing / 12;
    const wcMarketing = monthlyMarketing * coverage.marketing;

    // 4. COGS (Variable Costs)
    // We already calculated simplified VC preliminarily above
    // Need to define year1VariableCosts and serviceItems before this point
    // Assuming serviceItems is defined from services.items
    const serviceItems = toArray(services.items);

    let estYear1OperatingRevenueBase = 0;
    let estYear1OperatingVCBase = 0;
    serviceItems.forEach(item => {
        const customers = Number(item.customersPerMonth || 0) * 12;
        const price = Number(item.pricePerUnit || 0);
        const variableCost = Number(item.variableCostPerUnit || 0);

        estYear1OperatingRevenueBase += customers * price;
        estYear1OperatingVCBase += customers * variableCost;
    });

    const revenueStreams = toArray(study[SECTIONS.REVENUE]?.streams);
    const hasServices = serviceItems.length > 0;

    revenueStreams.forEach(stream => {
        const type = stream.type || 'operating';
        const annualCust = Number(stream.customersPerMonth || 0) * 12;
        const price = Number(stream.avgPrice || 0);
        const revenue = annualCust * price;
        const vc = revenue * (Number(stream.variableCostRate || 0.30)); // Use stream's VC rate

        if (type === 'operating') {
            if (!hasServices) { // Only add if no services defined, otherwise services take precedence for operating
                estYear1OperatingRevenueBase += revenue;
                estYear1OperatingVCBase += vc;
            }
        }
    });

    const estYear1VariableCosts = estYear1OperatingVCBase; // Simplified for now, assuming non-operating has 0 VC

    const monthlyVariable = estYear1VariableCosts / 12;
    const wcCOGS = monthlyVariable * coverage.cogs;

    const workingCapital = wcRent + wcSalaries + wcMarketing + wcCOGS;

    const totalInvestment = totalCapex + workingCapital;

    // ═══════════════════════════════════════════════════════════
    // 3. Revenue & Variable Costs (Operating vs Non-Operating)
    // ═══════════════════════════════════════════════════════════

    // Helper: Determine Utilization Rate for a given year
    const capacityUtilization = study[SECTIONS.TECHNICAL]?.capacityUtilization || [];
    const getUtilizationRate = (yearLine) => {
        // yearLine is 1, 2, 3...
        // Find explicit entry
        const entry = capacityUtilization.find(r => Number(r.year) === yearLine);
        if (entry) return Number(entry.rate);

        // If not found, logic:
        // If year > last defined year, use last defined rate.
        // If year < first defined year (unlikely), use first.
        // If empty, default 1.0
        if (capacityUtilization.length === 0) return 1.0;

        // Sort by year
        const sorted = [...capacityUtilization].sort((a, b) => Number(a.year) - Number(b.year));
        const last = sorted[sorted.length - 1];
        if (yearLine > Number(last.year)) return Number(last.rate);

        return 1.0; // Fallback
    };

    // Calculate Year 1 Base (At 100% Capacity)
    let year1OperatingRevenueBase = 0;
    let year1OperatingVCBase = 0;
    let year1Units = 0; // وحدات السنة الأولى (للتعادل بالوحدات)
    let year1NonOperatingRevenueBase = 0;
    let year1NonOperatingVCBase = 0;

    // Services are inherently Operating
    // serviceItems is already defined above
    serviceItems.forEach(item => {
        const customers = Number(item.customersPerMonth || 0) * 12;
        const price = Number(item.pricePerUnit || 0);
        const variableCost = Number(item.variableCostPerUnit || 0);
        const saving = getSaving('Services'); // Apply corporate savings to services variable costs

        year1OperatingRevenueBase += customers * price;
        year1OperatingVCBase += customers * variableCost * (1 - saving);
        year1Units += customers;
    });

    // Revenue Streams - Check Type
    // const revenueStreams = toArray(study[SECTIONS.REVENUE]?.streams); // Already defined above
    if (year1OperatingRevenueBase === 0 && revenueStreams.length > 0) {
        // Only use this fallback/mix if services not detailed, OR if additional streams exist.
        // Current logic was fallback. Let's assume it's additive if services exist?
        // To be safe and consistent with previous "fallback" logic:
        // if serviceItems used, we might ignore streams or add them? 
        // The previous code was: if (year1Revenue === 0 && ...).
        // Let's keep it as additive if distinct? No, previously it was fallback.
        // Let's stick to: If Services defined, use them. If not, use Streams.
        // BUT, `streams` might contain Non-Operating items (Rent) which are NOT in services.
        // So we should ALWAYS process Non-Operating streams.
        // And process Operating streams ONLY if serviceItems is empty (Fallback for Operating).

        // const hasServices = serviceItems.length > 0; // Already defined above

        revenueStreams.forEach(stream => {
            const type = stream.type || 'operating';
            const annualCust = Number(stream.customersPerMonth || 0) * 12;
            const price = Number(stream.avgPrice || 0);
            const revenue = annualCust * price;
            // نسبة التكلفة المتغيرة لكل مصدر (Food Cost + عمولات المنصات) — الافتراضي 30% إن لم تُحدد
            const vc = revenue * Number(stream.variableCostRate ?? 0.30);

            if (type === 'operating') {
                if (!hasServices) {
                    year1OperatingRevenueBase += revenue;
                    year1OperatingVCBase += vc;
                    year1Units += annualCust;
                }
            } else {
                // Non-Operating (always add)
                year1NonOperatingRevenueBase += revenue;
                year1NonOperatingVCBase += 0; // Usually 0 VC for passive income or distinct
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Projections (5 Years)
    // ═══════════════════════════════════════════════════════════
    const incomeStatement = [];
    let cumulativeCashFlow = -totalInvestment;
    let cumulativeDiscountedCashFlow = -totalInvestment; // Transcript 9
    let paybackPeriod = Infinity;
    let discountedPaybackPeriod = Infinity; // Transcript 9
    const financing = study[SECTIONS.FINANCING] || {};
    const loanAmount = financing.sources?.bankLoan?.amount || 0;
    const interestRate = financing.sources?.bankLoan?.interestRate || 0.08;
    const loanTerm = financing.sources?.bankLoan?.termYears || 5;

    // Simple amortization
    const annualPrincipal = loanAmount / loanTerm;

    for (let i = 1; i <= years; i++) {
        const yearIndex = i - 1;
        const utilRate = getUtilizationRate(i);

        // Growth factors
        const revenueGrowth = Math.pow(1.05, yearIndex);
        const costInflation = Math.pow(1 + inflation, yearIndex);

        // Operating: Scales with Utilization
        const opRev = year1OperatingRevenueBase * revenueGrowth * revMult * utilRate;
        const opVC = year1OperatingVCBase * revenueGrowth * costInflation * (revMult < 1 ? revMult : 1) * utilRate;

        // Non-Operating: Does NOT scale with Utilization (Fixed income usually)
        const nonOpRev = year1NonOperatingRevenueBase * revenueGrowth * revMult;
        const nonOpVC = year1NonOperatingVCBase * revenueGrowth * costInflation;

        const totalRevenue = opRev + nonOpRev;
        // opexMult (سيناريو تغيّر التكاليف) يطال المتغيرة والثابتة معاً
        const totalVariableCosts = (opVC + nonOpVC) * opexMult;

        // Separate Gross Profit Logic if needed, but for now combined
        const grossProfit = totalRevenue - totalVariableCosts;

        // OPEX inflates
        const payroll = annualPayroll * costInflation * (1 - getSaving('HR')); // Apply corporate savings to HR
        const rentAndAdmin = (annualLogistics + annualAdmin) * costInflation * (1 - getSaving('AdminLogistics')); // Apply corporate savings to Admin/Logistics
        const mkt = annualMarketing * Math.pow(1.05, yearIndex) * (1 - getSaving('Marketing')); // Apply corporate savings to Marketing

        // Transcript 8: Hidden Overheads (Contingency for OpEx)
        const overheadRate = (study[SECTIONS.FINANCIAL]?.hiddenOverheadsRate || 0) / 100;
        const baseFixed = (payroll + rentAndAdmin + mkt) * opexMult; // سيناريو تغيّر التكاليف الثابتة

        const hiddenOverheads = baseFixed * overheadRate;

        const fixedCosts = baseFixed + hiddenOverheads;
        // Franchise Royalties (Transcript 6)
        let franchiseCo = 0;
        if (study[SECTIONS.PROJECT_INFO]?.businessModel === 'Franchise') {
            const royaltyRate = Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.royaltyRate || 0) / 100;
            const marketingFee = Number(study[SECTIONS.PROJECT_INFO]?.franchiseDetails?.marketingFee || 0) / 100;
            franchiseCo = opRev * (royaltyRate + marketingFee); // Use opRev for operating revenue
        }

        let ebitda = grossProfit - fixedCosts - franchiseCo; // Use fixedCosts here

        // Transcript 7: Venture Builder Success Fee
        let builderSuccessFee = 0;
        if (isCorporate) {
            const successFeeRate = Number(study[SECTIONS.FINANCING]?.ventureBuilderFees?.successFee || 0) / 100;
            // Assuming success fee is on Net Income or EBITDA? Let's assume EBITDA for now as a proxy for 'Success'
            // Or usually it's on Exit, but here maybe on profit distribution.
            // Let's simplified it: % of EBITDA
            builderSuccessFee = Math.max(0, ebitda * successFeeRate);
        }

        const ebitdaFinal = ebitda - builderSuccessFee; // Adjust EBITDA

        // Asset Replacement Logic (Transcript 6)
        // Check for assets expiring this year
        let replacementCost = 0;
        // Simple logic: if asset life (1/depRate) divides evenly into current year, replace it.
        // e.g. furniture dep=0.2 (5 years). In year 6, we need to buy new furniture? 
        // Or in year 5 end? Let's say Year 5 end (beginning of Year 6).
        // Current loop is yearLine (1..years).
        // If yearLine % (1/rate) === 1 && yearLine > 1 -> Replace? 
        // Let's assume replacement happens AT THE START of the cycle.
        // If 5 year life, replace at year 6, 11, etc.
        const checkReplacement = (arr, defaultRate) => toArray(arr).reduce((acc, item) => {
            const rate = Number(item.depreciationRate || defaultRate);
            if (rate <= 0) return acc;
            const life = Math.round(1 / rate);
            // If yearLine is 6, and life is 5. (6-1)%5 == 0? 5%5==0. 
            // Replace in Year 6 (after 5 years).
            if (life > 0 && (i - 1) % life === 0 && i > 1) { // Use 'i' for current year
                const cost = Number(item.price || item.cost || 0);
                const qty = Number(item.quantity || item.count || 1);
                return acc + (cost * qty);
            }
            return acc;
        }, 0);

        // Only calculate replacement for short-term assets (Equipment, Furniture, Tech)
        replacementCost += checkReplacement(technical.equipment, 0.15);
        replacementCost += checkReplacement(technical.furniture, 0.20);
        replacementCost += checkReplacement(techResources.techResources, 0.25);


        const depreciation = annualDepreciation;
        const ebit = ebitda - depreciation;

        // Interest
        let interest = 0;
        if (loanAmount > 0 && i <= loanTerm) {
            const remainingPrincipal = loanAmount - (annualPrincipal * yearIndex);
            interest = remainingPrincipal * interestRate;
        }

        const ebt = ebit - interest;

        // Zakat Calculation (Saudi Logic: 2.5% of Zakat Base)
        // Base ≈ Equity + LongTermLiabilities - NetFixedAssets
        // Equity ≈ Cumulative Retained Earnings + Capital
        // This is a simplified proxy:
        // Zakat Base = (Total Investment - Depreciation) + Cumulative Profit - NetFixedAssets 
        // Let's use the simplest approximate acceptable by Monshaat templates:
        // Zakat Base ≈ Net Working Capital + Net Fixed Assets? No.
        // Zakat Base = Working Capital + Cash? 
        // Let's use: Adjusted Net Profit + (Equity + Loans - Fixed Assets)
        // For simple feasibility: Zakat ≈ 2.5% of Net Worth (Asset-Liabilities) OR Adjusted Profit.
        // We will strictly use 2.5% of (EBT + Capital) - FixedAssets if positive, else 2.5% of Adjusted Profit.
        // To be safe and generous in estimation (Constraint):
        // Zakat Base = EBT (Approximation for simple businesses) is often too low.
        // Let's use: Base = Capital + Retained Earnings + Loan - Net Fixed Assets
        const retainedEarnings = cumulativeCashFlow + totalInvestment; // Approx
        const netFixedAssets = totalCapex - (cumulativeCashFlow < 0 ? 0 : cumulativeCashFlow); // Very rough
        // Better:
        // NetFixedAssets = TotalCapex - AccumulatedDepreciation
        // AccumulatedDepreciation is not tracked easily here without a running sum.
        // Let's simplify: Zakat = 2.5% of (EBT) AS A MINIMUM, usually higher.
        // But for Feasibility, standard is often just 2.5% of Net Income or Revenue?
        // No, standard is 2.5% of Zakat Base.
        // Let's stick to the previous code's safety but ensure it's not negative.

        let zakatBase = ebt;
        // If we want to be closer to reality:
        const approximateEquity = totalInvestment + cumulativeCashFlow; // Initial + Retained
        const approximateNetFixed = totalCapex * (1 - (0.10 * i)); // Approx Dep
        const zakatBaseApprox = (approximateEquity + (loanAmount - annualPrincipal * i)) - approximateNetFixed;

        if (zakatBaseApprox > zakatBase) zakatBase = zakatBaseApprox;

        const zakat = zakatBase > 0 ? zakatBase * zakatRate : 0;

        // Tax (Non-Saudi share would be taxed 20%)
        // This 'tax' line assumes 100% foreign if applied? 
        // For mixed, `ZakatView` handles the detailed split. 
        // Here we just keep a placeholder or full Saudi assumption (Zakat only).
        const tax = (ebt - zakat) > 0 ? (ebt - zakat) * (study.assumptions?.taxRate || 0) : 0;
        const netIncome = ebt - zakat - tax;

        // Cash Flow
        const operatingCF = netIncome + depreciation;
        const financingCF = (i <= loanTerm) ? -annualPrincipal : 0;
        const netCashFlow = operatingCF + financingCF - replacementCost; // Include replacement cost in cash flow

        // Payback Calculation
        const prevCum = cumulativeCashFlow;
        cumulativeCashFlow += netCashFlow;

        if (prevCum < 0 && cumulativeCashFlow >= 0) {
            const fraction = Math.abs(prevCum) / netCashFlow;
            paybackPeriod = (i - 1) + fraction;
        }

        // Transcript 9: Discounted Payback Period
        const df = 1 / Math.pow(1 + discountRate, i);
        const discountedCF = netCashFlow * df;
        const prevCumDiscounted = cumulativeDiscountedCashFlow;
        cumulativeDiscountedCashFlow += discountedCF;

        if (prevCumDiscounted < 0 && cumulativeDiscountedCashFlow >= 0) {
            const fractionD = Math.abs(prevCumDiscounted) / discountedCF;
            discountedPaybackPeriod = (i - 1) + fractionD;
        }

        incomeStatement.push({
            year: i,
            revenue: totalRevenue,
            operatingRevenue: opRev, // Expose for detailed UI if needed
            utilizationRate: utilRate,
            variableCosts: totalVariableCosts,
            grossProfit,
            fixedCosts,
            franchiseFees: franchiseCo, // Log this for UI
            ebitda,
            depreciation,
            ebit,
            interest,
            ebt,
            zakat,
            tax,
            netIncome,
            replacementCost, // Log this for UI
            cashFlow: netCashFlow
        });
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Indicators
    // ═══════════════════════════════════════════════════════════
    const cashFlows = [-totalInvestment, ...incomeStatement.map(y => y.cashFlow)];

    const npv = calculateNPV(discountRate, cashFlows);
    const irr = calculateIRR(cashFlows);
    const mirr = calculateMIRR(cashFlows, discountRate, discountRate);
    const roi = (incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / totalInvestment) * 100;

    // Transcript 9: New Indicators
    // Profitability Index (PI) = (NPV + Investment) / Investment
    const pi = (npv + totalInvestment) / totalInvestment;

    // ARR (Accounting Rate of Return) = Average Annual Profit / Initial Investment
    const avgAnnualProfit = incomeStatement.reduce((acc, y) => acc + y.netIncome, 0) / incomeStatement.length;
    const arr = (avgAnnualProfit / totalInvestment) * 100;

    // Year 1 values for Break-even and margins (from first year in incomeStatement)
    const year1 = incomeStatement[0];
    const year1Revenue = year1 ? year1.revenue : 0;
    const year1VariableCosts = year1 ? year1.variableCosts : 0;

    // Break Even (Year 1)
    // BEP Value = Fixed Costs / ( (Rev - Var) / Rev )
    const cmRatio = year1Revenue > 0 ? (year1Revenue - year1VariableCosts) / year1Revenue : 0;
    const breakEvenValue = cmRatio > 0 ? totalFixedOpexYear1 / cmRatio : 0;
    // BEP بالوحدات = التكاليف الثابتة / (هامش المساهمة للوحدة)
    const contributionMarginPerUnit = year1Units > 0 ? (year1Revenue - year1VariableCosts) / year1Units : 0;
    const breakEvenUnits = contributionMarginPerUnit > 0 ? totalFixedOpexYear1 / contributionMarginPerUnit : 0;

    // DSCR (Debt Service Coverage Ratio) — عند وجود قرض
    const year1Ebitda = year1 ? year1.ebitda : 0;
    const debtServiceYear1 = loanAmount > 0 && loanTerm > 0
        ? (loanAmount / loanTerm) + (loanAmount * interestRate)
        : 0;
    const dscrYear1 = debtServiceYear1 > 0 && year1Ebitda > 0
        ? year1Ebitda / debtServiceYear1
        : null;
    const dscrAnalysis = loanAmount > 0 ? incomeStatement.slice(0, loanTerm).map((stmt, idx) => {
        const y = idx + 1;
        const remaining = loanAmount - (loanAmount / loanTerm) * idx;
        const interestY = remaining * interestRate;
        const principalY = loanAmount / loanTerm;
        const debtService = principalY + interestY;
        const dscr = debtService > 0 && stmt.ebitda > 0 ? stmt.ebitda / debtService : null;
        return { year: y, dscr: dscr != null ? Number(dscr.toFixed(2)) : null, status: dscr >= 1.25 ? 'مريح للممول' : dscr >= 1 ? 'مقبول' : 'يحتاج مراجعة' };
    }) : [];

    // 3 Capitals Structure (Grant Workshop Model)
    // + Franchise Fee update
    const capitalStructure = {
        establishment: {
            total: establishmentTotal + (capexBreakdown.preOpeningMarketing || 0) + (capexBreakdown.licenses || 0) + (capexBreakdown.franchiseFee || 0),
            breakdown: {
                foundation: establishmentTotal,
                marketing: capexBreakdown.preOpeningMarketing,
                legal: capexBreakdown.licenses,
                franchise: capexBreakdown.franchiseFee
            }
        },
        investment: {
            total: equipmentTotal + sumAsset(technical.buildings) + sumAsset(technical.furniture) + sumAsset(techResources.techResources) + (capexBreakdown.servicesCapex || 0),
            breakdown: {
                equipment: equipmentTotal,
                buildings: sumAsset(technical.buildings),
                furniture: sumAsset(technical.furniture),
                tech: sumAsset(techResources.techResources),
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

    // ═══════════════════════════════════════════════════════════
    // 6. التحليلات المشتقة: الحساسية والسيناريوهات
    //    تُحسب فقط في التشغيل الأعلى (بدون overrides) — تشغيلات الحساسية نفسها
    //    تمرّر overrides فتتخطى هذا القسم (لا عدوى تكرارية).
    // ═══════════════════════════════════════════════════════════
    let sensitivity = [];
    let scenarios = null;
    let loanSchedule = null;
    let balanceSheets = [];
    if (!overrides) {
        // جدول سداد القرض (كان مفقوداً من مخرجات المحرك رغم أن التقرير يتوقعه)
        try {
            if (loanAmount > 0) {
                const grace = Number(financing.sources?.bankLoan?.gracePeriodMonths || 0);
                const ls = computeLoanSchedule(loanAmount, interestRate, loanTerm, grace);
                loanSchedule = { ...ls, loanAmount, annualRate: interestRate, termYears: loanTerm };
            }
        } catch (_) { loanSchedule = null; }

        // الميزانية العمومية التقديرية لكل سنوات الدراسة (حقوق الملكية = الاستثمار − القرض)
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

        // السيناريوهات: أساسي (الحالي) / متفائل (+10% إيراد، -5% تكاليف) / متشائم (-15% إيراد، +10% تكاليف)
        scenarios = {
            base: {
                kpis: { npv, irr, payback: paybackPeriod === Infinity ? 0 : paybackPeriod, roi: roi / 100 },
                breakeven: { ordersPerDay: (breakEvenUnits || 0) / 360 }
            }
        };
        const opt = runCase({ revenueChange: 0.10, costChange: -0.05 });
        const pess = runCase({ revenueChange: -0.15, costChange: 0.10 });
        if (opt) scenarios.optimistic = opt;
        if (pess) scenarios.pessimistic = pess;
    }

    // التدفق النقدي التراكمي (لتقرير التدفقات وحساب الاسترداد البصري)
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
            capitalStructure, // New Granular Structure
            breakdown: capexBreakdown, // Legacy
            subtotal: totalCapex,
            workingCapital,
            contingency: 0,
            total: totalInvestment
        },
        opex: {
            fixedAnnual: totalFixedOpexYear1,
            variableAnnual: year1VariableCosts,
            totalAnnual: totalFixedOpexYear1 + year1VariableCosts
        },
        depreciation: annualDepreciation,
        incomeStatement,
        sensitivity,
        scenarios,
        loanSchedule,
        balanceSheets,
        cashFlow: cashFlowRows,
        indicators: {
            npv,
            irr,
            mirr,
            paybackPeriod: paybackPeriod === Infinity ? 0 : paybackPeriod,
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
            discountedPaybackPeriod: discountedPaybackPeriod === Infinity ? 0 : discountedPaybackPeriod,
            arr: arr / 100
        },
        dscrAnalysis,
        // قرار مبني على Thresholds في 01_Assumptions (معايير QA)
        ...computeDecision(study.assumptions?.thresholds, {
            npv, irr,
            paybackPeriod: paybackPeriod === Infinity ? 0 : paybackPeriod,
            roi: roi / 100
        }),
        get kpis() { return this.indicators; }
    };
}

/**
 * ينتج GO / NO-GO / REVISE بناءً على حدود 01_Assumptions.
 * @param {Object} th - study.assumptions.thresholds
 * @param {Object} k - { npv, irr, paybackPeriod, roi }
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
    const passPayback = (k.paybackPeriod ?? 999) <= maxPayback && (k.paybackPeriod ?? 0) > 0;
    const passROI = (k.roi ?? 0) >= minROI;

    const reasons = [];
    if (!passNPV) reasons.push(`صافي القيمة الحالية يجب أن يكون > ${minNPV}`);
    if (!passIRR) reasons.push(`معدل العائد الداخلي يجب أن يكون ≥ ${(minIRR * 100).toFixed(0)}%`);
    if (!passPayback) reasons.push(`فترة الاسترداد يجب أن تكون ≤ ${maxPayback} سنوات`);
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

    // ═══════════════════════════════════════════════════════════
    // 6. Sensitivity Analysis (Video Requirement)
    // ═══════════════════════════════════════════════════════════
    // What if? Scenarios: Rev +/- 10%, Cost +/- 10%
    // We need to re-calculate basic indicators for these cases.
    // To avoid infinite recursion, we'll implement a lightweight estimator or re-run core logic if possible.
    // Since we are inside 'calculateStudy', re-running it might be circular if we are not careful.
    // Better to have a separate 'calculateIndicators(cashFlows)' helper and just adjust Cash Flows.

    // Base Cash Flows are known.
    // Rev +10%: Increase Revenue stream in logic? 
    // It's uniform change.

    // We will approximate Sensitivity by modifying the Net Cash Flow:
    // This is hard because Cost/Rev mix varies.
    // Best way: Clone study, modify Assumption, calling calculateStudy is risky if it calls this again.
    // Solution: The 'calculateStudy' function should accept an optional 'sensitivityMode' flag to skip sensitivity step.

    return { decision, decisionReasons: reasons }; // sensitivity/scenarios تُحسب في calculateStudy مباشرة.
}

/**
 * Runner for Sensitivity Analysis
 * To be called by UI or Main Wrapper, NOT inside calculateStudy to avoid circular deps/perf issues if not managed.
 * BUT, if we want it in the output, we can do it here with a flag.
 */
export function calculateSensitivityScenarios(study) {
    // Helper to run a scenario
    const run = (revMult, costMult, label) => {
        // Deep clone or just Proxy? Deep clone is safer.
        const dStudy = JSON.parse(JSON.stringify(study));

        // Apply Modifiers
        // We need to inject these modifiers into calculateStudy. 
        // Standard way: Modify Assumptions or pass as 2nd arg.
        // Let's assume we modify the 'assumptions' object in dStudy with temporary flags
        // OR better, we modify the input data directly:

        // 1. Revenue Modification
        if (dStudy[SECTIONS.REVENUE]) {
            (dStudy[SECTIONS.REVENUE].streams || []).forEach(s => s.avgPrice = (s.avgPrice || 0) * revMult);
        }
        if (dStudy[SECTIONS.SERVICES]) {
            (dStudy[SECTIONS.SERVICES].items || []).forEach(s => s.pricePerUnit = (s.pricePerUnit || 0) * revMult);
        }

        // 2. Cost Modification (Opex + Capex? Video implies Opex/Running costs usually)
        // Let's apply to Variable Costs and Fixed Opex
        // HR
        if (dStudy[SECTIONS.HR]) {
            (dStudy[SECTIONS.HR].positions || []).forEach(p => p.salary = (p.salary || 0) * costMult);
        }
        // Logistics/Admin
        if (dStudy[SECTIONS.LOGISTICS]) (dStudy[SECTIONS.LOGISTICS].logistics || []).forEach(i => i.monthly = (i.monthly || 0) * costMult);
        if (dStudy[SECTIONS.ADMINISTRATIVE]) (dStudy[SECTIONS.ADMINISTRATIVE].administrative || []).forEach(i => i.monthly = (i.monthly || 0) * costMult);

        // Variable Costs (Services)
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
        // منع التباعد: أوقف إن أصبحت القيمة غير محدودة أو خرجت عن نطاق واقعي
        if (!Number.isFinite(newRate) || newRate <= -0.9999 || newRate > 1e4) break;
        if (Math.abs(newRate - rate) < precision) { rate = newRate; break; }
        rate = newRate;
    }
    // حارس نهائي: قيمة آمنة (٠) إن لم تتقارب ضمن نطاق معقول (‎-99%..1000%‎) بدل رقم فلكي
    if (!Number.isFinite(rate) || rate < -0.9999 || rate > 10) return 0;
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
