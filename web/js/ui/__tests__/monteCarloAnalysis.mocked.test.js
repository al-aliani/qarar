/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (تحقّق عدائي): يثبّت أن run() لا يحفظ نتيجة "ناجحة" وهمية في
 * المخزن حين يُعيد المحرك ok:false (بيانات غير كافية)، وأن فشل المحاكاة الكامل
 * (استثناء) يُظهر تنبيهاً ويُعيد الزر لحالته الطبيعية دون تجميد الواجهة. يصعب
 * إجبار المحرك الحقيقي على هذين المسارين بمعاملات واقعية، لذا يُحاكى عبر vi.mock.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const runSimulationMock = vi.fn();
vi.mock('../../core/MonteCarloEngine.js', () => ({
    MonteCarloEngine: { runSimulation: (...args) => runSimulationMock(...args) }
}));

const { MonteCarloAnalysis } = await import('../MonteCarloAnalysis.js');
const { SECTIONS } = await import('../../core/schema.js');

function fakeStore(state) {
    return { getState: () => state, updatePath: vi.fn() };
}

describe('MonteCarloAnalysis — run(): بيانات غير كافية لا تُحفَظ كنتيجة ناجحة', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        runSimulationMock.mockReset();
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('ok:false: يعرض "تعذّرت المحاكاة" ولا يستدعي store.updatePath إطلاقاً (لا تلويث سجل تشغيل ناجح)', async () => {
        runSimulationMock.mockReturnValue({
            ok: false, error: 'insufficient_data', iterations: 1000, completedRuns: 0,
            results: [], stats: { minNPV: 0, maxNPV: 0, avgNPV: 0, p10: 0, p50: 0, p90: 0, successProbability: 0 }
        });

        const store = fakeStore({});
        const view = new MonteCarloAnalysis('c', store);
        view.render();

        const runPromise = view.run();
        await vi.advanceTimersByTimeAsync(100);
        await runPromise;

        expect(document.getElementById('riskRating').textContent).toContain('تعذّرت المحاكاة');
        expect(store.updatePath).not.toHaveBeenCalled();
        expect(document.getElementById('btnRunSim').disabled).toBe(false);
    });

    it('استثناء أثناء المحاكاة: يُنبِّه المستخدم، لا يرمي للأعلى، ويُعيد الزر لحالته الطبيعية (finally)', async () => {
        runSimulationMock.mockImplementation(() => { throw new Error('محاكاة فشلت'); });
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});

        const store = fakeStore({});
        const view = new MonteCarloAnalysis('c', store);
        view.render();

        const runPromise = view.run();
        await vi.advanceTimersByTimeAsync(100);
        await expect(runPromise).resolves.toBeUndefined();

        expect(alertSpy).toHaveBeenCalledWith('حدث خطأ أثناء المحاكاة');
        expect(store.updatePath).not.toHaveBeenCalled();
        expect(document.getElementById('btnRunSim').disabled).toBe(false);
        expect(document.getElementById('btnRunSim').textContent).toBe('تشغيل المحاكاة 🚀');

        alertSpy.mockRestore();
    });
});
