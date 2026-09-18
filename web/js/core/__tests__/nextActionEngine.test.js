import { describe, expect, it } from 'vitest';
import { actionTarget, buildNextActions } from '../nextActionEngine.js';

describe('buildNextActions', () => {
    it('prioritizes overdue work and customer-blocked requests', () => {
        const actions = buildNextActions({
            completeness: { percentage: 90, details: {} },
            workspace: {
                tasks: [{ id: 't1', title: 'اتصال المورد', status: 'todo', due_date: '2020-01-01' }],
                requests: [{ id: 'r1', title: 'مراجعة الخبير', status: 'waiting_customer' }],
                quotes: [], suggestions: []
            }
        });
        expect(actions).toHaveLength(2);
        expect(actions.every(item => item.priority === 'critical')).toBe(true);
        expect(actionTarget(actions[0])).toBe('#/workspace');
    });

    it('shows one completion action and caps the surface at four actions', () => {
        const actions = buildNextActions({
            completeness: { percentage: 20, details: { revenue: { percentage: 0, missing: ['مصادر الإيرادات'] } } },
            qualityGate: { locked: true, hardCount: 2 },
            workspace: { tasks: [], requests: [], quotes: [], suggestions: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, status: 'pending', field_path: 'revenue.streams', rationale: 'راجع الرقم' })) }
        });
        expect(actions).toHaveLength(4);
        expect(actions[0].id).toBe('quality-blocked');
    });
});
