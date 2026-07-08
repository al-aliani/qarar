/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DecisionDashboard } from '../DecisionDashboard.js';

describe('DecisionDashboard UI Tests', () => {
    let container;

    beforeEach(() => {
        // Setup a simple DOM structure
        document.body.innerHTML = `
            <div id="decisionDashboardContainer"></div>
        `;
        container = document.getElementById('decisionDashboardContainer');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('يجب أن يُهيئ واجهة القرار دون أخطاء', () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer');
        expect(dashboard).toBeDefined();
    });

    it('يجب أن يعرض توصية JDOM بناءً على مؤشرات قوية', () => {
        const dashboard = new DecisionDashboard('decisionDashboardContainer');
        const state = {
            projectInfo: { name: 'مشروع ممتاز' },
            assumptions: {
                thresholds: { minNPV: 0, minIRR: 0.15, maxPayback: 3.5, minROI: 0.20 }
            },
            financing: { totalInvestment: 1000000 },
            marketSizing: { som: { value: 100000 } },
            hr: { positions: [{ count: 1 }] },
            legal: { licenses: [{ name: 'رخصة' }] },
            riskAnalysis: { risks: [{ probability: 'low' }] },
            locationAnalysis: { selectionFactors: ['A'] }
        };
        const results = {
            decision: 'GO',
            indicators: { npv: 500000, irr: 0.25, paybackPeriod: 2, roi: 0.3 },
            capex: { total: 1000000 },
            financingCheck: { hasBlockers: false, fundingGap: 0, loanAmount: 0 }
        };
        
        // render calls calculateReadiness and scoring internally
        dashboard.render(state, results);
        
        const titleEl = document.querySelector('.dd-verdict__title');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toContain('ادخل المشروع بقوة');
    });
});
