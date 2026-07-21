import { describe, expect, it } from 'vitest';
import { buildStudyConfidence, renderStudyConfidence } from '../studyConfidence.js';

describe('study confidence disclosure', () => {
    it('calculates a bounded score and shows assumptions, sources, and its date', () => {
        const confidence = buildStudyConfidence({
            projectInfo: { name: 'Project' },
            revenue: { streams: [{ service: 'Sales' }] },
            financing: { sources: { equity: { amount: 12000 } } },
            assumptions: { discountRate: 0.12, projectionYears: 5 },
            marketSizing: { source: 'Market report <unsafe>' }
        }, { capex: { total: 12000 } });
        const html = renderStudyConfidence(confidence);

        expect(confidence.score).toBeGreaterThanOrEqual(0);
        expect(confidence.score).toBeLessThanOrEqual(100);
        expect(confidence.generatedAt).toBeTruthy();
        expect(html).toContain('درجة موثوقية النتائج');
        expect(html).toContain('Market report &lt;unsafe&gt;');
        expect(html).not.toContain('Market report <unsafe>');
    });
});
