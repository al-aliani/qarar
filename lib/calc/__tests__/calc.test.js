import { describe, it, expect } from 'vitest';
import Calc from '../index.js';

const { npv, irr, paybackYears, computeRestaurantBase } = Calc;

describe('Financial Math', () => {
  it('calculates NPV correctly', () => {
    // Rate 10%, Initial -100, then 110. NPV should be 0.
    const rate = 0.1;
    const flows = [-100, 110];
    const val = npv(rate, flows);
    expect(val).toBeCloseTo(0, 4);
    
    // Rate 0%, sum of flows
    expect(npv(0, [-100, 50, 60])).toBeCloseTo(10, 4);
  });

  it('calculates IRR correctly', () => {
    // -100, 110 -> 10% return
    const flows = [-100, 110];
    const val = irr(flows);
    expect(val).toBeCloseTo(0.1, 4);

    // -100, 50, 60 -> slightly more than 0 (total 110)
    // -100 + 50/(1+r) + 60/(1+r)^2 = 0
    // roughly 6-7%? Let's check logic: irr([-100, 105]) is 0.05
    expect(irr([-100, 105])).toBeCloseTo(0.05, 4);
  });

  it('calculates Payback correctly', () => {
    // -100, 50, 50 -> 2 years
    expect(paybackYears([-100, 50, 50])).toBe(2);
    
    // -100, 50, 25, 25 -> 3 years
    expect(paybackYears([-100, 50, 25, 25])).toBe(3);

    // -100, 60, 60 -> 1 + (40/60) = 1.666...
    expect(paybackYears([-100, 60, 60])).toBeCloseTo(1.67, 2);
  });
});

describe('Restaurant Logic', () => {
  const baseModel = {
    years: 5,
    daysPerMonth: 30,
    openingMonth: 1,
    capex: [{ name: "Fitout", cost: 100000 }],
    channels: {
      dineIn: { ordersPerDay: 50, avgTicket: 40 },
      takeaway: { ordersPerDay: 0, avgTicket: 0 },
      delivery: { ordersPerDay: 0, avgTicket: 0, platformCommission: 0.2 }
    },
    costs: {
      foodCostPct: 30,
      wastePct: 2,
      packagingPerOrder: 1 // SAR per order
    },
    employees: [],
    opex: [],
    financing: { loan: { amount: 0 } },
    assumptions: {
      tax: 0,
      discount: 0.1,
      projectType: "restaurant"
    }
  };

  it('calculates Break-even (Orders/Day)', () => {
    // Fixed costs = 0 (for simplicity in this test case, or add some)
    // Let's add fixed cost to test break-even
    const model = JSON.parse(JSON.stringify(baseModel));
    model.opexFixedMonthly = [{ name: "Rent", monthly: 3000 }];
    
    // Use Takeaway to ensure packaging cost is included (engine ignores packaging for dine-in)
    model.channels.dineIn = { ordersPerDay: 0, avgTicket: 0 };
    model.channels.takeaway = { ordersPerDay: 50, avgTicket: 40 };

    // Revenue per unit = 40
    // Variable costs:
    // - Food: 30% of 40 = 12
    // - Waste: 2% of Food Cost (12) = 0.24
    // - Packaging: 1
    // Total Variable = 12 + 0.24 + 1 = 13.24
    // Contribution Margin = 40 - 13.24 = 26.76
    
    // Fixed Cost Monthly = 3000
    // Break-even monthly orders = 3000 / 26.76 ≈ 112.107
    // Break-even daily orders = 112.107 / 30 ≈ 3.737
    
    const res = computeRestaurantBase(model);
    expect(res.breakeven.ordersPerDay).toBeCloseTo(3.737, 2);
  });

  it('applies delivery commission ONLY to delivery channel', () => {
    const model = JSON.parse(JSON.stringify(baseModel));
    model.channels.dineIn = { ordersPerDay: 10, avgTicket: 100 }; // 1000/day
    model.channels.delivery = { ordersPerDay: 10, avgTicket: 100, growthAnnual: 0, commissionRate: 0.2 }; // 1000/day
    
    // Total Rev = 2000/day
    // Commission = 20% of 1000 (delivery only) = 200/day
    
    const res = computeRestaurantBase(model);
    // Access pnl[0] for Year 1
    
    // Year 1 Revenue = 2000 * 30 * 12 = 720,000
    // Commission Year 1 = 200 * 30 * 12 = 72,000
    
    // Food Cost (30%) = 30% of 720k = 216k
    // Waste (2% of Food) = 2% of 216k = 4,320
    // Packaging (1 per order) = 1 * 10 (del) * 30 * 12 = 3,600 (Takeaway is 0, DineIn is 0 packaging)
    
    // Total Variable (excluding comm) = 216k + 4.32k + 3.6k = 223,920
    // Gross Profit (Engine def: Rev - Food - Waste - Packaging)
    // GP = 720,000 - 223,920 = 496,080
    
    const y1Gross = res.pnl[0].grossProfit;
    expect(y1Gross).toBeCloseTo(496080, -2);
    
    const y1Comm = res.pnl[0].variable.deliveryCommission;
    expect(y1Comm).toBeCloseTo(72000, -2);
  });

  it('aggregates food cost, waste, and packaging correctly', () => {
    const model = JSON.parse(JSON.stringify(baseModel));
    // Use takeaway so packaging is applied
    model.channels.dineIn = { ordersPerDay: 0, avgTicket: 0 };
    model.channels.takeaway = { ordersPerDay: 100, avgTicket: 50 }; // 5000/day
    // costs: FC 30%, Waste 2%, Pack 1
    
    // Daily:
    // Revenue: 5000
    // Food: 1500
    // Waste (2% of Food): 30
    // Pack: 100 * 1 = 100
    // Total COGS daily = 1630
    
    // Annual (360 days): 1630 * 360 = 586,800
    
    const res = computeRestaurantBase(model);
    // cogs.total = food + waste + packaging
    const y1COGS = res.pnl[0].cogs.total;
    expect(y1COGS).toBeCloseTo(586800, -2);
  });
});
