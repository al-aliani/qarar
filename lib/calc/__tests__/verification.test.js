
import { describe, it, expect } from 'vitest';
import Calc from '../index.js';

const { computeRestaurantBase, npv } = Calc;

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

  it('Calculates NPV correctly', () => {
    // Cashflows: [-100k, 1.08m, 1.08m, 1.08m, 1.08m, 1.08m]
    // Rate: 10%
    // Factor for annuity 5y @ 10%: 3.790786
    // PV Inflows = 1,080,000 * 3.790786 = 4,094,049.6
    // NPV = 4,094,049.6 - 100,000 = 3,994,049.6
    
    expect(res.kpis.npv).toBeCloseTo(3_994_050, -1); // tolerance of 10 SAR
  });

  it('Calculates Payback correctly', () => {
    // Recover 100k. Year 1 flow is 1.08m.
    // Fraction = 100,000 / 1,080,000 = 0.09259 years
    expect(res.kpis.payback).toBeCloseTo(0.09, 2);
  });
});
