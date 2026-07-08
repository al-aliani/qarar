/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة متوسطة #35): عند تحميل نتيجة مونت كارلو محفوظة من زيارة
 * سابقة (بلا ضغط زر «تشغيل»)، تُملأ بطاقات المؤشرات بأرقام حقيقية عبر
 * displaySavedSummary لكن renderHistogram لا تُستدعى أبداً (القيم الخام غير محفوظة
 * في الحالة)، فتبقى منطقة الرسم البياني فارغة تماماً بلا أي نص توضيحي.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonteCarloAnalysis } from '../MonteCarloAnalysis.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

describe('MonteCarloAnalysis — رسالة توضيحية بدل مدرّج فارغ صامت لنتيجة محفوظة (#35)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('نتيجة محفوظة (lastRun) بلا تشغيل حالي: يعرض رسالة تشرح غياب المدرّج', () => {
        const study = createEmptyStudy();
        study[SECTIONS.MONTE_CARLO] = {
            lastRun: { successProbability: 0.8, avgNPV: 1000000, p10: 0, p50: 0, p90: 0, iterations: 1000, volatility: 0.2, runAt: '2026-07-01T00:00:00.000Z' }
        };
        const view = new MonteCarloAnalysis('c', fakeStore(study));
        view.render();

        const placeholder = document.getElementById('histoPlaceholder');
        expect(placeholder).not.toBeNull();
        expect(placeholder.textContent).toContain('تشغيل المحاكاة');
    });

    it('لا نتيجة محفوظة إطلاقاً (أول زيارة): لا حاجة لرسالة الغياب (لا مدرّج متوقَّعاً أصلاً)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        view.render();
        expect(document.getElementById('histoPlaceholder')).toBeNull();
    });

    it('renderHistogram يحذف الرسالة فور توفر بيانات حقيقية جديدة (لا يبقيها بجانب مدرّج فعلي)', () => {
        const study = createEmptyStudy();
        study[SECTIONS.MONTE_CARLO] = {
            lastRun: { successProbability: 0.8, avgNPV: 1000000, p10: 0, p50: 0, p90: 0, iterations: 1000, volatility: 0.2, runAt: '2026-07-01T00:00:00.000Z' }
        };
        const view = new MonteCarloAnalysis('c', fakeStore(study));
        view.render();
        expect(document.getElementById('histoPlaceholder')).not.toBeNull();

        global.Chart = class { constructor() {} destroy() {} };
        view.renderHistogram([{ binStart: 0, binEnd: 100, count: 5 }]);
        expect(document.getElementById('histoPlaceholder')).toBeNull();
        delete global.Chart;
    });
});
