import { validateInputs } from './validateInputs.js';
import { qaGate } from './qaGate.js';

/**
 * Restaurant Feasibility Calc Engine (Saudi Restaurants layer)
 * ----------------------------------------------------------
 * Outputs:
 * - P&L (annual) + monthly Y1 (optional)
 * - Cash Flow (annual)
 * - KPIs: NPV / IRR / Payback
 * - Break-even (orders/day and revenue/month approximation)
 * - Scenarios + Sensitivity helpers
 */

// ---------- utils ----------

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function n0(x) {
  return isFiniteNumber(x) ? x : 0;
}

function normalizePercent01(x) {
  const n = n0(x);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return n / 100;
  return n;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function round2(n) {
  return isFiniteNumber(n) ? Math.round(n * 100) / 100 : n;
}

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function sum(arr) {
  return (arr || []).reduce((acc, v) => acc + n0(v), 0);
}

// ---------- finance ----------

function npv(rate, cashflows) {
  const r = n0(rate);
  let out = 0;
  for (let t = 0; t < cashflows.length; t++) {
    out += n0(cashflows[t]) / Math.pow(1 + r, t);
  }
  return out;
}

function irr(cashflows) {
  let r = 0.2;
  for (let i = 0; i < 50; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const ct = n0(cashflows[t]);
      const den = Math.pow(1 + r, t);
      f += ct / den;
      if (t > 0) df += (-t * ct) / (den * (1 + r));
    }
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;
    const rNext = r - f / df;
    if (Math.abs(rNext - r) < 1e-7) return rNext;
    r = clamp(rNext, -0.95, 10);
  }
  return NaN;
}

function paybackYears(cashflows) {
  let cum = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum;
    cum += n0(cashflows[t]);
    if (t === 0) continue;
    if (prev < 0 && cum >= 0) {
      const frac = (0 - prev) / (cum - prev);
      return (t - 1) + frac;
    }
  }
  return Infinity;
}

function depreciationStraightLine(capexItems, years) {
  const dep = Array.from({ length: years }, () => 0);
  for (const it of capexItems || []) {
    const cost = n0(it.cost);
    const startYearIndex = Math.max(0, Math.floor(n0(it.year || 0)));
    const life = Math.max(1, Math.floor(n0(it.lifeYears || years)));
    const annual = cost / life;
    for (let y = 0; y < years; y++) {
      if (y < startYearIndex) continue;
      if (y >= startYearIndex + life) continue;
      dep[y] += annual;
    }
  }
  return dep;
}

// ---------- restaurant model ----------

function computeRestaurantBase(model) {
  // 1. Validation
  const validation = validateInputs(model);
  
  // 2. Setup
  const years = Math.max(1, n0(model.years) || 5);
  const daysPerMonth = n0(model.daysPerMonth) || 30;
  const daysPerYear = daysPerMonth * 12;
  const taxRate = normalizePercent01(model.taxRate || model.settings?.taxRate);
  const discountRate = normalizePercent01(model.discountRate || model.settings?.discountRate || 0.10);
  
  // Growth & Inflation
  const inflationRate = normalizePercent01(model.inflationRate || 0.02);
  const annualGrowth = normalizePercent01(model.growthAnnual || 0.05);

  // Capex & Depreciation
  const capex = model.capex || [];
  const depreciation = depreciationStraightLine(capex, years);
  
  // Working Capital (simplified)
  const workingCapitalMonths = n0(model.workingCapitalMonths || 3);
  
  // Outputs
  const pnl = [];
  const cashflow = [];
  const monthlyY1 = [];
  
  // Loop Years
  for (let y = 0; y < years; y++) {
    const yearNum = y + 1;
    const isYear1 = (y === 0);
    
    // Growth factors
    const growthFactor = Math.pow(1 + annualGrowth, y);
    const inflationFactor = Math.pow(1 + inflationRate, y);

    // -- Revenue --
    let revenueTotal = 0;
    let totalOrders = 0;
    let commissionTotal = 0;
    
    // Channels
    const channels = model.channels || {};
    const channelNames = ['dineIn', 'takeaway', 'delivery'];
    
    const channelStats = {};
    
    channelNames.forEach(ch => {
        const data = channels[ch] || {};
        const orders = n0(data.ordersPerDay) * daysPerYear * growthFactor;
        const ticket = n0(data.avgTicket) * inflationFactor; // Ticket price increases with inflation
        const rev = orders * ticket;
        
        channelStats[ch] = { orders, rev };
        revenueTotal += rev;
        totalOrders += orders;
        
        if (ch === 'delivery') {
            const commRate = normalizePercent01(data.commissionRate);
            commissionTotal += rev * commRate;
        }
    });

    // -- COGS --
    const costs = model.costs || {};
    const foodCostPct = normalizePercent01(costs.foodCostPct);
    const wastePct = normalizePercent01(costs.wastePct);
    const packagingCost = n0(costs.packagingPerOrder) * totalOrders;
    
    const foodCost = revenueTotal * foodCostPct;
    const wasteCost = foodCost * wastePct;
    const totalCOGS = foodCost + wasteCost + packagingCost + commissionTotal;
    
    const grossProfit = revenueTotal - totalCOGS;

    // -- Labor --
    const labor = model.labor || {};
    const laborFixed = n0(labor.fixedMonthly) * 12 * inflationFactor; // Salaries increase with inflation?
    const laborVarPerOrder = n0(labor.variablePerOrder) * totalOrders;
    const laborVarPct = revenueTotal * normalizePercent01(labor.variablePctOfRevenue);
    const totalLabor = laborFixed + laborVarPerOrder + laborVarPct;

    // -- OPEX --
    let totalOpex = 0;
    const opexList = model.opexFixedMonthly || [];
    opexList.forEach(item => {
        const monthly = n0(item.monthly);
        const annualGrowth = normalizePercent01(item.annualGrowth || 0);
        const itemGrowth = Math.pow(1 + annualGrowth, y); // Item specific growth
        totalOpex += monthly * 12 * itemGrowth;
    });

    // Marketing (often % of revenue)
    const marketingParams = model.marketing || {};
    let marketingCost = 0;
    if (marketingParams.pctOfRevenue) {
        marketingCost = revenueTotal * normalizePercent01(marketingParams.pctOfRevenue);
    } else {
        marketingCost = n0(marketingParams.monthlyBudget) * 12 * inflationFactor;
    }
    totalOpex += marketingCost;

    // -- EBITDA --
    const ebitda = grossProfit - totalLabor - totalOpex;
    
    // -- EBIT --
    const dep = depreciation[y] || 0;
    const ebit = ebitda - dep;
    
    // -- Tax --
    const tax = ebit > 0 ? ebit * taxRate : 0;
    
    // -- Net Income --
    const netIncome = ebit - tax;

    // Store P&L
    pnl.push({
        year: yearNum,
        revenueTotal,
        totalOrders,
        grossProfit,
        totalCOGS,
        totalLabor,
        totalOpex,
        ebitda,
        depreciation: dep,
        ebit,
        tax,
        netIncome,
        variable: {
            laborVariable: laborVarPerOrder + laborVarPct,
            total: totalCOGS + laborVarPerOrder + laborVarPct // Approx variable costs
        },
        fixed: {
            laborFixed,
            total: totalLabor - (laborVarPerOrder + laborVarPct) + totalOpex
        },
        contribution: revenueTotal - (totalCOGS + laborVarPerOrder + laborVarPct)
    });

    // -- Monthly Y1 (Approximation) --
    if (isYear1) {
        const revMonthly = revenueTotal / 12;
        const fixedMonthly = (totalLabor - (laborVarPerOrder + laborVarPct) + totalOpex) / 12;
        const variableMonthly = (totalCOGS + laborVarPerOrder + laborVarPct) / 12;
        monthlyY1.push({
            revenueTotal: revMonthly,
            fixed: { total: fixedMonthly },
            variable: { total: variableMonthly },
            grossProfit: grossProfit / 12,
            contribution: (revenueTotal - (totalCOGS + laborVarPerOrder + laborVarPct)) / 12,
            ebitda: ebitda / 12
        });
    }

    // -- Cash Flow Prep --
    // CFO = Net Income + Depreciation (simplest form)
    // Adjustments for WC?
    
    // WC Requirement
    const monthlyOpex = (totalCOGS + totalLabor + totalOpex) / 12; // Approx
    const wcReq = monthlyOpex * workingCapitalMonths;
    
    // WC Delta handled in loop below or here?
    // Let's store WC Req to calc delta later if needed, or just use simplified flow
    
    const cfo = netIncome + dep;
    const cfi = 0; // Capex handled at t=0 usually
    const cff = 0; // Loans handled later
    
    cashflow.push({
        year: yearNum,
        cfo,
        cfi,
        cff,
        workingCapitalDelta: 0, // Placeholder
        netCashFlow: cfo,
        wcReq
    });
  }

  // Handle WC Delta
  let prevWC = 0;
  // Initial WC
  const y1Costs = pnl[0] ? (pnl[0].totalCOGS + pnl[0].totalLabor + pnl[0].totalOpex) : 0;
  const workingCapitalInitial = (y1Costs / 12) * workingCapitalMonths;
  prevWC = workingCapitalInitial;
  
  cashflow.forEach((cf, i) => {
      const nextWC = cf.wcReq;
      const delta = nextWC - prevWC;
      cf.workingCapitalDelta = delta;
      cf.netCashFlow -= delta;
      prevWC = nextWC;
  });
  
  // Release WC at end?
  const releaseAtEnd = true;
  
  // Build cashflows array (t=0..years)
  const initialCapex = sum((capex || []).map((it) => n0(it.cost)));
  const t0 = -(initialCapex + workingCapitalInitial);
  
  const yearly = cashflow.map((c) => n0(c.netCashFlow));
  if (releaseAtEnd && yearly.length) yearly[yearly.length - 1] += prevWC; // Release last held WC
  const cashflowsArr = [t0, ...yearly];

  // Financing (simple loan DSCR)
  const loan = model.financing?.loan || model.loan || null;
  const loanAmount = n0(loan?.amount);
  const loanRate = normalizePercent01(loan?.annualRate);
  const loanTermYears = Math.max(0, Math.floor(n0(loan?.termYears)));
  const dscr = [];
  
  if (loanAmount > 0 && loanTermYears > 0) {
    const r = loanRate;
    const n = loanTermYears;
    const annuity = r === 0 ? loanAmount / n : (loanAmount * r) / (1 - Math.pow(1 + r, -n));

    for (let y = 0; y < years; y++) {
      const debtService = y < n ? annuity : 0;
      // Update cashflow to include financing outflow (simple)
      if (debtService > 0) {
        cashflow[y].cff = n0(cashflow[y].cff) - debtService;
        cashflow[y].netCashFlow = n0(cashflow[y].cfo) + n0(cashflow[y].cfi) + n0(cashflow[y].cff) - n0(cashflow[y].workingCapitalDelta);
      }
      const cfo = n0(cashflow[y].cfo);
      const d = debtService > 0 ? cfo / debtService : NaN;
      dscr.push(d);
    }
    
    // Recompute t=0 (add loan inflow)
    // Actually, usually Loan Inflow is CFF at t=0.
    // If we assume Loan covers Capex, then t0 becomes less negative.
    // Let's assume Loan is Inflow at t=0.
    // t0 = -(InitialCapex + WC) + LoanAmount
    
    const t0_financed = t0 + loanAmount;
    
    // Update yearly flows
    const yearly2 = cashflow.map((c) => n0(c.netCashFlow));
    if (releaseAtEnd && yearly2.length) yearly2[yearly2.length - 1] += prevWC;
    
    cashflowsArr.length = 0;
    cashflowsArr.push(t0_financed, ...yearly2);
  }

  const kpis = {
    npv: npv(discountRate, cashflowsArr),
    irr: irr(cashflowsArr),
    payback: paybackYears(cashflowsArr),
  };
  const dscrMin = dscr.length ? Math.min(...dscr.filter((x) => Number.isFinite(x) && x > 0)) : NaN;

  // Break-even (month-based approximation using Y1 structure)
  const y1 = monthlyY1[0] || null;
  const fixedMonthly = y1 ? n0(y1.fixed.total) : 0;
  const revMonthly = y1 ? n0(y1.revenueTotal) : 0;
  const variableMonthly = y1 ? n0(y1.variable.total) : 0;
  const contribMarginRatio = revMonthly > 0 ? (revMonthly - variableMonthly) / revMonthly : NaN;

  // Estimate avg contribution per order
  const baseOrdersPerMonth = pnl[0] ? pnl[0].totalOrders / 12 : 0;
  const avgContributionPerOrder = baseOrdersPerMonth > 0 ? (revMonthly - variableMonthly) / baseOrdersPerMonth : NaN;

  const breakeven = {
    contributionMarginRatio: contribMarginRatio,
    revenuePerMonth: Number.isFinite(contribMarginRatio) && contribMarginRatio > 0 ? fixedMonthly / contribMarginRatio : Infinity,
    ordersPerMonth:
      Number.isFinite(avgContributionPerOrder) && avgContributionPerOrder > 0 ? fixedMonthly / avgContributionPerOrder : Infinity,
    ordersPerDay:
      Number.isFinite(avgContributionPerOrder) && avgContributionPerOrder > 0
        ? (fixedMonthly / avgContributionPerOrder) / daysPerMonth
        : Infinity,
  };

  const out = {
    ok: true,
    blocked: false,
    validation,
    dscr,
    meta: {
      years,
      currency: "SAR",
      country: "SA",
      domain: "restaurants",
    },
    inputsEcho: deepClone(model),
    monthlyY1: monthlyY1.map((m) => ({
      ...m,
      revenueTotal: round2(m.revenueTotal),
      grossProfit: round2(m.grossProfit),
      contribution: round2(m.contribution),
      ebitda: round2(m.ebitda),
    })),
    pnl: pnl.map((r) => ({
      ...r,
      revenueTotal: round2(r.revenueTotal),
      grossProfit: round2(r.grossProfit),
      contribution: round2(r.contribution),
      ebitda: round2(r.ebitda),
      ebit: round2(r.ebit),
      tax: round2(r.tax),
      netIncome: round2(r.netIncome),
    })),
    cashflow: cashflow.map((c) => ({
      ...c,
      netCashFlow: round2(c.netCashFlow),
    })),
    cashflows: cashflowsArr,
    laborCost: pnl.map((r) => r.totalLabor),
    kpis: {
      npv: round2(kpis.npv),
      irr: kpis.irr,
      payback: kpis.payback,
      dscrMin: Number.isFinite(dscrMin) ? round2(dscrMin) : null,
    },
    breakeven: {
      contributionMarginRatio: breakeven.contributionMarginRatio,
      revenuePerMonth: round2(breakeven.revenuePerMonth),
      ordersPerMonth: round2(breakeven.ordersPerMonth),
      ordersPerDay: round2(breakeven.ordersPerDay),
    },
  };

  // Attach 2-stage QA report
  const strictMode = Boolean(model?.strictMode);
  out.qa = qaGate(model, out, null, { strictMode });
  return out;
}

// ---------- scenarios & sensitivity ----------

function applyScenario(model, multipliers) {
  const m = deepClone(model);
  const revMult = isFiniteNumber(multipliers?.revenue) ? multipliers.revenue : 1;
  const ticketMult = isFiniteNumber(multipliers?.avgTicket) ? multipliers.avgTicket : 1;
  const foodPctDelta = isFiniteNumber(multipliers?.foodCostPctDelta) ? multipliers.foodCostPctDelta : 0;
  const laborFixedMult = isFiniteNumber(multipliers?.laborFixed) ? multipliers.laborFixed : 1;
  const laborVarMult = isFiniteNumber(multipliers?.laborVariable) ? multipliers.laborVariable : 1;
  const rentMult = isFiniteNumber(multipliers?.fixedOpex) ? multipliers.fixedOpex : 1;
  const capexMult = isFiniteNumber(multipliers?.capex) ? multipliers.capex : 1;
  const commissionDelta = isFiniteNumber(multipliers?.deliveryCommissionDelta) ? multipliers.deliveryCommissionDelta : 0;

  // Revenue drivers
  for (const k of ["dineIn", "takeaway", "delivery"]) {
    if (!m.channels?.[k]) continue;
    m.channels[k].ordersPerDay = n0(m.channels[k].ordersPerDay) * revMult;
    m.channels[k].avgTicket = n0(m.channels[k].avgTicket) * ticketMult;
  }

  // Costs
  if (m.costs) m.costs.foodCostPct = clamp(n0(m.costs.foodCostPct) + foodPctDelta, 0, 1);

  if (m.labor) {
    m.labor.fixedMonthly = n0(m.labor.fixedMonthly) * laborFixedMult;
    m.labor.variablePerOrder = n0(m.labor.variablePerOrder) * laborVarMult;
    m.labor.variablePctOfRevenue = clamp(n0(m.labor.variablePctOfRevenue) * laborVarMult, 0, 1);
  }

  m.opexFixedMonthly = (m.opexFixedMonthly || []).map((it) => ({
    ...it,
    monthly: n0(it.monthly) * rentMult,
  }));

  m.capex = (m.capex || []).map((it) => ({ ...it, cost: n0(it.cost) * capexMult }));

  // Delivery commission only
  if (m.channels?.delivery) {
    m.channels.delivery.commissionRate = clamp(n0(m.channels.delivery.commissionRate) + commissionDelta, 0, 1);
  }

  return m;
}

function computeScenarios(model, scenarioMap) {
  const out = {};
  const scenarios = scenarioMap || {
    base: {},
    best: { revenue: 1.15, avgTicket: 1.05, fixedOpex: 0.97, capex: 0.97 },
    worst: { revenue: 0.85, avgTicket: 0.95, fixedOpex: 1.08, capex: 1.08, foodCostPctDelta: 0.03 },
  };

  for (const [name, mult] of Object.entries(scenarios)) {
    const m2 = applyScenario(model, mult);
    out[name] = computeRestaurantBase(m2);
  }
  return out;
}

function computeSensitivity(model, dims) {
  const dimensions =
    dims ||
    [
      { dim: "revenue", cases: [0.9, 1.0, 1.1] },
      { dim: "avgTicket", cases: [0.9, 1.0, 1.1] },
      { dim: "foodCostPctDelta", cases: [-0.02, 0, 0.02] },
      { dim: "deliveryCommissionDelta", cases: [-0.02, 0, 0.02] },
      { dim: "fixedOpex", cases: [0.9, 1.0, 1.1] },
      { dim: "laborFixed", cases: [0.9, 1.0, 1.1] },
      { dim: "capex", cases: [0.9, 1.0, 1.1] },
    ];

  return dimensions.map((d) => {
    const cases = d.cases.map((v) => {
      const mult = {};
      mult[d.dim] = v;
      const eng = computeRestaurantBase(applyScenario(model, mult));
      return { label: `${d.dim}=${v}`, value: v, kpis: eng.kpis, breakeven: eng.breakeven };
    });
    return { dim: d.dim, cases };
  });
}

// ---------- public API ----------

const Calc = {
  validateInputs,
  qaGate,
  computeRestaurantBase,
  computeScenarios,
  computeSensitivity,
  npv,
  irr,
  paybackYears,
};

// ESM Exports
export { 
  validateInputs, 
  qaGate, 
  computeRestaurantBase, 
  computeScenarios, 
  computeSensitivity, 
  npv, 
  irr, 
  paybackYears 
};
export default Calc;

// Browser global
if (typeof window !== "undefined") {
  window.CalcEngine = Calc;
}

// CommonJS (Node)
if (typeof module !== "undefined" && module.exports) {
  module.exports = Calc;
}
