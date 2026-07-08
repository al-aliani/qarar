/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة متوسطة #32): نسبة تقلّب مونت كارلو كانت غير متسقة بين
 * ثلاثة مصادر — schema.js توثّق 0.15 (لا يُقرأ أبداً)، MonteCarloEngine.runSimulation
 * افتراضياً 0.15، بينما المُستدعي الفعلي الوحيد (MonteCarloAnalysis.run) يمرّر 0.20
 * مباشرة متجاوزاً كلا الافتراضيين بصمت، ولا تُفصح الواجهة عن النسبة المستخدمة فعلياً.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MonteCarloAnalysis } from '../MonteCarloAnalysis.js';
import { MonteCarloEngine } from '../../core/MonteCarloEngine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

describe('توحيد نسبة تقلّب مونت كارلو على 0.20 عبر كل المصادر (#32)', () => {
    it('MonteCarloEngine.runSimulation الافتراضي (بلا تمرير صريح) أصبح 0.20 لا 0.15', () => {
        const study = createEmptyStudy();
        study[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 500, avgPrice: 100, variableCostRate: 0.3, growthRate: 0 }] };
        study[SECTIONS.TECHNICAL] = { equipment: [{ price: 100000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
        const withDefault = MonteCarloEngine.runSimulation(study, 200, undefined, 42);
        const withExplicit20 = MonteCarloEngine.runSimulation(study, 200, 0.20, 42);
        // نفس البذرة + نفس التقلّب الفعلي ⇒ نفس النتيجة بالضبط إن كان الافتراضي فعلاً 0.20
        expect(withDefault.stats.avgNPV).toBeCloseTo(withExplicit20.stats.avgNPV, 6);
    });

    it('schema.js: SECTIONS.MONTE_CARLO الافتراضي موثَّق 0.20 (لا 0.15 القديمة المتناقضة)', () => {
        const study = createEmptyStudy();
        expect(study[SECTIONS.MONTE_CARLO].volatility).toBe(0.20);
    });
});

describe('MonteCarloAnalysis — إفصاح صريح عن نسبة التقلّب المستخدمة في الواجهة (#32)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يعرض نص إفصاح عن ±20% تقلّب في شاشة المحاكاة', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        view.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('20%');
        expect(html).toContain('افتراض التقلّب');
    });
});
