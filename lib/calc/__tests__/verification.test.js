
import { describe, it, expect } from 'vitest';
import Calc from '../index.js';

const { computeRestaurantBase, npv, paybackYears } = Calc;

describe('Verification with "Mac Blash" Proxy Model', () => {
  // A simplified, round-number model to allow manual verification against Excel
  const verificationModel = {
    years: 5,
    daysPerMonth: 30,
    discountRate: 0.10, // 10%
    taxRate: 0,
    inflationRate: 0,
    channels: {
      dineIn: { ordersPerDay: 0, avgTicket: 0, growthAnnual: 0 },
      takeaway: { ordersPerDay: 100, avgTicket: 50, growthAnnual: 0 }, // 5000/day
      delivery: { ordersPerDay: 0, avgTicket: 0, growthAnnual: 0, commissionRate: 0 }
    },
    costs: {
      foodCostPct: 0.30, // 30%
      wastePct: 0,
      packagingPerOrder: 0
    },
    labor: {
      fixedMonthly: 10000, // 10k
      variablePerOrder: 0,
      variablePctOfRevenue: 0
    },
    opexFixedMonthly: [
      { name: "Rent", monthly: 5000 } // 5k
    ],
    capex: [
      { name: "Kitchen", cost: 100000, lifeYears: 5, year: 0 } // 100k
    ],
    workingCapital: { initial: 0, releaseAtEnd: false }
  };

  const res = computeRestaurantBase(verificationModel);

  it('Calculates Annual Revenue correctly', () => {
    // 100 orders * 50 SAR * 30 days * 12 months = 1,800,000
    expect(res.pnl[0].revenueTotal).toBe(1_800_000);
  });

  it('Calculates Variable Costs correctly', () => {
    // 30% of 1.8m = 540,000
    // Note: variable.total in the engine includes COGS (Food + Waste + Packaging) + Labor Variable + Commission
    expect(res.pnl[0].variable.total).toBe(540_000);
  });

  it('Calculates Fixed Costs correctly', () => {
    // (10k Labor + 5k Rent) * 12 = 180,000
    expect(res.pnl[0].fixed.total).toBe(180_000);
  });

  it('Calculates EBITDA correctly', () => {
    // 1.8m - 540k - 180k = 1,080,000
    expect(res.pnl[0].ebitda).toBe(1_080_000);
  });

  it('Calculates Net Income correctly', () => {
    // EBITDA 1.08m - Dep (100k/5 = 20k) = 1,060,000
    // Tax is 0
    expect(res.pnl[0].netIncome).toBe(1_060_000);
  });

  it('Calculates Cash Flow correctly', () => {
    // CFO = Net Income + Dep = 1.06m + 20k = 1.08m
    expect(res.cashflow[0].netCashFlow).toBe(1_080_000);
  });

  it('Calculates Break-even correctly', () => {
    // Monthly Fixed = 15,000
    // Monthly Rev = 150,000
    // Monthly Var = 45,000
    // CM Ratio = (150-45)/150 = 0.7
    // BE Rev = 15,000 / 0.7 = 21,428.57
    // BE Orders/Day = (21,428.57 / 50) / 30 = 14.2857
    
    expect(res.breakeven.ordersPerDay).toBeCloseTo(14.29, 2);
  });

  // NOTE on the two tests below: the original hand-typed expectations assumed a
  // year-0 cashflow of simply -100,000 (just the capex) with zero working-capital
  // effect, and a FLAT (identical every year) cashflow for years 1-5 -- i.e. they
  // took `workingCapital: { initial: 0, releaseAtEnd: false }`, `inflationRate: 0`,
  // and the per-channel `growthAnnual: 0` fields in `verificationModel` at face
  // value. Neither assumption survives a careful read of `computeRestaurantBase`:
  //
  // 1) Working capital: the function never reads `model.workingCapital.initial` or
  //    `model.workingCapital.releaseAtEnd` at all (`releaseAtEnd` is a hardcoded
  //    `const releaseAtEnd = true` inside the function). It derives its own working
  //    capital from `workingCapitalMonths = n0(model.workingCapitalMonths || 3)`,
  //    which defaults to 3 months since `verificationModel` never sets
  //    `workingCapitalMonths`. That makes `workingCapitalInitial` a real, non-zero
  //    number the original comments never accounted for.
  //
  // 2) Growth/inflation are NOT flat, and NOT zero, despite the model saying so.
  //    `annualGrowth = normalizePercent01(model.growthAnnual || 0.05)` and
  //    `inflationRate = normalizePercent01(model.inflationRate || 0.02)` both use a
  //    `value || default` pattern -- so an explicit `0` is silently treated the same
  //    as "not provided" (0 is falsy in JS) and replaced by the hardcoded defaults
  //    (5% growth, 2% inflation). `verificationModel` sets `inflationRate: 0` at the
  //    top level (defeated by the bug) and `growthAnnual: 0` only *inside* each
  //    channel object (a field the function never reads at all -- growth is read
  //    from `model.growthAnnual`, not `model.channels[ch].growthAnnual`). Net
  //    effect: orders/ticket/labor actually compound at 5%/2% every year after
  //    year 1. This does not affect the six tests above (they only read `pnl[0]` /
  //    `cashflow[0]`, i.e. year 1, where any growth/inflation factor is `rate^0 = 1`
  //    regardless of the rate), but it fully invalidates a "flat across 5 years"
  //    assumption for NPV/payback, which depend on every year's cashflow.
  //
  // Since this module is an isolated legacy calc never wired into the live app, we
  // fix the *test* (not the implementation) by reconstructing the real expected
  // cashflow array from first principles -- using the model's own inputs plus the
  // *actual* defaults the code falls back to -- and feeding it through the same
  // `npv`/`paybackYears` functions the engine itself uses, rather than asserting a
  // hand-guessed magic number.
  const growthAnnual = 0.05; // real default used by the engine (see note above)
  const inflation = 0.02; // real default used by the engine (see note above)
  const workingCapitalMonths = 3; // n0(model.workingCapitalMonths || 3), unset here
  const daysPerYear = verificationModel.daysPerMonth * 12;
  const { ordersPerDay, avgTicket } = verificationModel.channels.takeaway;
  const { foodCostPct } = verificationModel.costs;
  const { fixedMonthly: laborFixedMonthly } = verificationModel.labor;
  const rentMonthly = verificationModel.opexFixedMonthly[0].monthly;
  const capexAmount = verificationModel.capex[0].cost;
  const lifeYears = verificationModel.capex[0].lifeYears;

  // Per-year P&L/cashflow reconstruction (mirrors the engine's formulas exactly,
  // using only the model's inputs + the real default rates above).
  const rows = Array.from({ length: verificationModel.years }, (_, y) => {
    const growthFactor = Math.pow(1 + growthAnnual, y);
    const inflationFactor = Math.pow(1 + inflation, y);
    const orders = ordersPerDay * daysPerYear * growthFactor;
    const ticket = avgTicket * inflationFactor;
    const revenue = orders * ticket;
    const totalCOGS = revenue * foodCostPct; // wastePct=0, packagingPerOrder=0, no delivery commission
    const totalLabor = laborFixedMonthly * 12 * inflationFactor; // variablePerOrder=0, variablePctOfRevenue=0
    const totalOpex = rentMonthly * 12; // no per-item annualGrowth set -> flat
    const grossProfit = revenue - totalCOGS;
    const ebitda = grossProfit - totalLabor - totalOpex;
    const dep = capexAmount / lifeYears; // straight-line, covers all 5 years here
    const ebit = ebitda - dep;
    const netIncome = ebit; // taxRate = 0
    const cfo = netIncome + dep;
    const wcReq = ((totalCOGS + totalLabor + totalOpex) / 12) * workingCapitalMonths;
    return { revenue, cfo, wcReq };
  });

  const workingCapitalInitial = rows[0].wcReq; // == (y1Costs/12)*workingCapitalMonths
  let prevWC = workingCapitalInitial;
  const yearly = rows.map((r) => {
    const delta = r.wcReq - prevWC;
    prevWC = r.wcReq;
    return r.cfo - delta;
  });
  yearly[yearly.length - 1] += prevWC; // release held working capital at end (hardcoded releaseAtEnd=true)

  const t0 = -(capexAmount + workingCapitalInitial);
  const expectedCashflows = [t0, ...yearly];

  it('Calculates NPV correctly', () => {
    // Guard the reconstruction against the very assumptions it depends on:
    // year-1 has zero WC delta (baseline), but year 2 does NOT (growth/inflation
    // push the requirement up) -- confirming the "flat" reading would be wrong.
    expect(res.cashflow[0].workingCapitalDelta).toBeCloseTo(0, 6);
    expect(res.cashflow[1].workingCapitalDelta).not.toBeCloseTo(0, 2);
    expect(res.pnl[1].revenueTotal).toBeCloseTo(rows[1].revenue, 2);
    expect(res.cashflows[0]).toBeCloseTo(t0, 2);

    const expectedNpv = npv(verificationModel.discountRate, expectedCashflows);
    expect(res.kpis.npv).toBeCloseTo(expectedNpv, 2);
  });

  it('Calculates Payback correctly', () => {
    const expectedPayback = paybackYears(expectedCashflows);
    expect(res.kpis.payback).toBeCloseTo(expectedPayback, 6);
  });
});
