import { describe, expect, it } from 'vitest';
import { buildDecisionActionPlan } from '../decisionActionPlan.js';

describe('buildDecisionActionPlan', () => {
    it('يربط مشكلة التسعير بالأداة ويضيف مراجعة المختص عند قرار المراجعة', () => {
        const plan = buildDecisionActionPlan({}, {
            decision: 'REVISE',
            decisionExplanation: { issues: [{ metric: 'npv', path: 'revenue.streams', title: 'صافي القيمة الحالية', action: 'راجع السعر.' }] },
            partnerNeeds: []
        });

        expect(plan.some(item => item.id === 'fix-pricing' && item.stepIndex >= 0)).toBe(true);
        expect(plan.some(item => item.route === 'advisory')).toBe(true);
    });

    it('يربط احتياج المورد بدليل الشركاء ويمنع التكرار', () => {
        const supplier = { type: 'supplier', label: 'شريك مورّد', reason: 'لا يوجد مورد', priority: 'high' };
        const plan = buildDecisionActionPlan({}, { decision: 'REVISE', partnerNeeds: [supplier, supplier] });
        expect(plan.filter(item => item.id === 'partner-supplier')).toHaveLength(1);
        expect(plan.find(item => item.id === 'partner-supplier')?.route).toBe('partner');
    });

    it('يحوّل قرار GO إلى التنفيذ والملخص التنفيذي', () => {
        const plan = buildDecisionActionPlan({}, { decision: 'GO', decisionExplanation: { issues: [] }, partnerNeeds: [] });
        expect(plan.map(item => item.id)).toEqual(expect.arrayContaining(['start-execution', 'prepare-report']));
        expect(plan.every(item => item.stepIndex >= 0)).toBe(true);
    });
});
