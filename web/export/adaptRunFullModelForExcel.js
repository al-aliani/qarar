/**
 * يُحوّل ناتج runFullModel (النموذج العام) إلى صيغة modelR/base التي يتوقعها exportExcel (قالب معياري).
 * يستخدم عندما لا يكون نموذج المطاعم (CalcEngine) متاحاً.
 *
 * @param {object} state - حالة الدراسة (state)
 * @param {object} runResult - ناتج runFullModel (incomeStatement, cashFlow, indicators, assumptions, capex, opex, …)
 * @returns {{ modelR: object, base: object, scenarios: object, sensitivity: array, decision: string }}
 */
export function adaptRunFullModelForExcel(state, runResult) {
  if (!runResult || !runResult.incomeStatement) {
    throw new Error('لا توجد نتائج كافية من النموذج المالي للتصدير.');
  }

  const as = runResult.assumptions || {};
  const cap = runResult.capex || {};
  const op = runResult.opex || {};
  const is = Array.isArray(runResult.incomeStatement) ? runResult.incomeStatement : [];
  const cf = Array.isArray(runResult.cashFlow) ? runResult.cashFlow : [];
  const ind = runResult.indicators || {};

  const years = as.projectionYears || Math.max(1, is.length);
  const totalCapex = cap.total || 0;

  // modelR: الحد الأدنى المطلوب من قالب excel.js (مع افتراضات عامة عند الغياب)
  const modelR = {
    inflationRate: as.inflationRate ?? 0.02,
    taxRate: as.taxRate ?? 0.15,
    discountRate: as.discountRate ?? 0.10,
    years,
    channels: {
      dineIn: { ordersPerDay: 0, avgTicket: 0, growthAnnual: 0 },
      takeaway: { ordersPerDay: 0, avgTicket: 0, growthAnnual: 0 },
      delivery: { ordersPerDay: 0, avgTicket: 0, growthAnnual: 0, commissionRate: 0 },
    },
    costs: { foodCostPct: 0, wastePct: 0, packagingPerOrder: 0 },
    labor: {
      fixedMonthly: op.fixedMonthly ?? 0,
      variablePerOrder: 0,
      variablePctOfRevenue: 0,
    },
    opexFixedMonthly: (op.fixed || []).map((i) => ({
      name: i.name || '—',
      monthly: i.monthly ?? 0,
      inflationRate: '',
      source: i.source || '',
    })),
    capex: (cap.items || []).map((i) => ({
      name: i.name || '—',
      cost: i.amount ?? 0,
      year: 0,
      lifeYears: (i.depreciationRate && i.depreciationRate > 0) ? 1 / i.depreciationRate : 5,
      source: i.source || '',
    })),
    workingCapital: { initial: cap.workingCapital ?? 0 },
  };

  // base.pnl من incomeStatement
  const pnl = is.map((r) => ({
    year: r.year,
    revenueTotal: r.revenue ?? 0,
    cogs: { total: r.variableCosts ?? 0 },
    grossProfit: r.grossProfit ?? 0,
    variable: { total: r.variableCosts ?? 0 },
    contribution: r.grossProfit ?? 0,
    fixed: { total: r.fixedCosts ?? 0 },
    ebitda: r.ebitda ?? 0,
    depreciation: r.depreciation ?? 0,
    ebit: r.ebit ?? 0,
    tax: r.tax ?? 0,
    netIncome: r.netIncome ?? 0,
  }));

  // base.cashflow: فقط السنوات 1..n (مطابقة أعمدة pnl). year 0 يُستبعد لأن القالب يعتمد على سنوات pnl
  const cfYears = cf.filter((c) => c.year >= 1);
  const baseCashflow = cfYears.map((c) => ({
    year: c.year,
    cfo: c.cashFlow ?? 0,
    cfi: 0,
    cff: 0,
    netCashFlow: c.cashFlow ?? 0,
  }));

  // إن لم تكن السنوات مطابقة، نملأ من incomeStatement
  if (baseCashflow.length < pnl.length) {
    for (let i = baseCashflow.length; i < pnl.length; i++) {
      const r = pnl[i] || {};
      const cfo = (r.netIncome ?? 0) + (r.depreciation ?? 0);
      baseCashflow.push({
        year: r.year ?? i + 1,
        cfo,
        cfi: 0,
        cff: 0,
        netCashFlow: cfo,
      });
    }
  }

  const base = {
    pnl,
    cashflow: baseCashflow,
    kpis: {
      npv: ind.npv ?? 0,
      irr: ind.irr ?? 0,
      payback: ind.paybackPeriod ?? ind.payback ?? 0,
    },
    breakeven: {
      ordersPerDay: (ind.breakevenUnitsPerMonth ?? 0) / 30 || 0,
    },
  };

  return {
    modelR,
    base,
    scenarios: runResult.scenarios || {},
    sensitivity: Array.isArray(runResult.sensitivity) ? runResult.sensitivity : [],
    decision: runResult.decision || '',
    loanSchedule: runResult.loanSchedule || {},
  };
}
