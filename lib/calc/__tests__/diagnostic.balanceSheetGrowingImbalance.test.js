/**
 * DIAGNOSTIC ONLY (not a permanent regression test) — reproduces the reported
 * growing year-over-year balance-sheet imbalance for a small-cafe study:
 *   total investment ~733,320 SAR, 300,000 equity + 433,320 bank loan
 *   (8% interest, 5-year term, 6-month grace period), 5-year projection,
 *   discountRate 0.10, taxRate 0.20.
 *
 * Dumps every intermediate figure per year so the root cause of the
 * compounding imbalance can be identified from real numbers instead of
 * static reasoning alone.
 */
import { describe, it } from 'vitest';
import { calculateStudy } from '../../../web/js/core/engine.js';
import { SECTIONS } from '../../../web/js/core/schema.js';

function makeStudy(bankLoanAmount = 433320) {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'كافيه صغير', sector: 'مقهى', businessModel: 'Independent' },
        assumptions: {
            projectionYears: 5,
            discountRate: 0.10,
            inflationRate: 0.02,
            taxRate: 0.20,
            hiddenOverheadsRate: 0
        },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ name: 'معدات مقهى', price: 300000, quantity: 1 }],
            buildings: [{ name: 'تجهيزات محل', price: 200000, quantity: 1 }],
            furniture: [{ name: 'أثاث', price: 80000, quantity: 1 }],
            establishmentCosts: [{ name: 'تأسيس', amount: 40000 }],
            capacityUtilization: [],
            openingInventory: 20000
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 8000, months: 12, nationality: 'saudi' },
                { position: 'باريستا', count: 3, salary: 4000, months: 12, nationality: 'non-saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'توصيل', monthly: 3000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ service: 'مشروبات ومأكولات', type: 'operating', customersPerMonth: 6000, avgPrice: 25, variableCostRate: 0.32, growthRate: 0.05 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: {
            sources: {
                equity: { amount: 300000, percentage: 40.9 },
                bankLoan: {
                    amount: bankLoanAmount,
                    percentage: 59.1,
                    interestRate: 0.08,
                    termYears: 5,
                    gracePeriodMonths: 6,
                    repaymentType: 'equal'
                }
            }
        },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('DIAGNOSTIC — نمو اختلال الميزانية عبر السنوات', () => {
    it('يطبع كل سنة كامل المتغيرات الوسيطة (fundingGap ≈ 0: القرض = الاستثمار المحسوب - 300,000)', () => {
        // Pass 1: run once with a placeholder loan amount just to learn the engine's own
        // computed total investment (capex.total), then re-run with bankLoan.amount set so
        // that entered sources (equity + loan) EXACTLY match totalInvestment => fundingGap = 0,
        // matching the primary reported scenario (733,320 = 300,000 equity + 433,320 loan, no gap).
        const probe = calculateStudy(makeStudy(433320));
        const targetTotalInvestment = probe.capex?.total || 733320;
        const tunedBankLoan = Math.max(0, Math.round(targetTotalInvestment - 300000));
        console.log('\n[probe] engine totalInvestment =', targetTotalInvestment, ' => tuned bankLoan =', tunedBankLoan);

        const r = calculateStudy(makeStudy(tunedBankLoan));

        console.log('\n=== totalInvestment (engine, capex.total) ===', r.capex?.total);
        console.log('=== totalCapex (capex.subtotal) ===', r.capex?.subtotal);
        console.log('=== loanAmount ===', r.loanSchedule?.loanAmount);
        console.log('=== fundingGap ===', r.fundingGap);
        console.log('=== paidCapital/equityAmount used ===', r.balanceSheets?.[0] ? undefined : undefined);
        console.log('=== loanSchedule.annualSummary ===', JSON.stringify(r.loanSchedule?.annualSummary, null, 2));
        console.log('=== incomeStatement (depreciation, netIncome, replacementCost per year) ===');
        (r.incomeStatement || []).forEach((st, idx) => {
            console.log(`  year ${idx + 1}: netIncome=${st.netIncome} depreciation=${st.depreciation} replacementCost=${st.replacementCost}`);
        });

        console.log('\n=== BALANCE SHEETS PER YEAR ===');
        (r.balanceSheets || []).forEach(bs => {
            console.log(`\n--- Year ${bs.year} ---`);
            console.log('  assets.fixed.gross            =', bs.assets.fixed.gross);
            console.log('  assets.fixed.accumulatedDep    =', bs.assets.fixed.accumulatedDepreciation);
            console.log('  assets.fixed.net               =', bs.assets.fixed.net);
            console.log('  assets.current.cash            =', bs.assets.current.cash);
            console.log('  assets.current.AR              =', bs.assets.current.accountsReceivable);
            console.log('  assets.current.inventory       =', bs.assets.current.inventory);
            console.log('  assets.current.total           =', bs.assets.current.total);
            console.log('  assets.total                   =', bs.assets.total);
            console.log('  liab.current.currentPortion    =', bs.liabilities.current.currentPortionOfDebt);
            console.log('  liab.longTerm.bankLoan         =', bs.liabilities.longTerm.bankLoan);
            console.log('  liab.total                     =', bs.liabilities.total);
            console.log('  equity.paidInCapital           =', bs.equity.paidInCapital);
            console.log('  equity.retainedEarnings        =', bs.equity.retainedEarnings);
            console.log('  equity.total                   =', bs.equity.total);
            console.log('  fundingGap                     =', bs.fundingGap);
            console.log('  totalLiabilitiesAndEquity      =', bs.totalLiabilitiesAndEquity);
            console.log('  IMBALANCE                      =', bs.imbalance, ' isBalanced=', bs.isBalanced);
        });
    });
});
