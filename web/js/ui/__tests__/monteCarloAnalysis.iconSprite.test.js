/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة #29): عنوان قسم مونت كارلو وزر «تشغيل المحاكاة» كانا
 * يستخدمان إيموجي خام (🎲🚀) بينما لوحة القرار (DecisionDashboard.js) اعتمدت
 * أيقونات SVG من مكتبة index.html الموحّدة — تناقض بصري بين شاشتين لنفس المفهوم.
 * الآن تستخدم نفس نمط <svg class="ic"><use href="#i-..."/></svg>، بما في ذلك
 * حالتي التحميل (i-reset) والزر الطبيعي (i-bolt) داخل run() — وكلتاهما انتقلتا
 * من .textContent إلى .innerHTML عمداً (سلسلة SVG عبر textContent تُعرض كنص
 * مهروب حرفياً، لا كعنصر أيقونة حقيقي).
 *
 * تدقيق 2026-07-09 (علة أ): رموز حالة المخاطرة الديناميكية التالية عولجت الآن
 * أيضاً — النص أصبح نظيفاً بلا إيموجي (getRiskRating يُعيد text/icon منفصلين)،
 * والأيقونة المكافئة تُعرض عبر عنصر SVG-sprite مستقل (#riskRatingIcon) بجانب
 * النص، لأن riskEl.textContent (لا innerHTML) هو ما يُحدَّث فعلياً. الرموز
 * القديمة (✅/⚠️/⛔ داخل displaySavedSummary/displayResults) اختفت من النص —
 * انظر الاختبار الأخير أدناه للتحقق.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const runSimulationMock = vi.fn();
vi.mock('../../core/MonteCarloEngine.js', () => ({
    MonteCarloEngine: { runSimulation: (...args) => runSimulationMock(...args) }
}));

const { MonteCarloAnalysis } = await import('../MonteCarloAnalysis.js');

function fakeStore(state) {
    return { getState: () => state, updatePath: vi.fn() };
}

describe('MonteCarloAnalysis — عنوان القسم وزر التشغيل توحّدا على أيقونات SVG بدل الإيموجي (#29)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        runSimulationMock.mockReset();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('عنوان القسم يستخدم أيقونة i-chart ولا يحتوي على إيموجي 🎲', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();

        const title = document.querySelector('.section-title');
        expect(title.innerHTML).toContain('href="#i-chart"');
        expect(title.textContent).not.toMatch(/[🎲]/u);
    });

    it('زر التشغيل (قبل أي نقر) يستخدم أيقونة i-bolt ولا يحتوي على إيموجي 🚀', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();

        const btn = document.getElementById('btnRunSim');
        expect(btn.innerHTML).toContain('href="#i-bolt"');
        expect(btn.textContent).not.toMatch(/[🚀]/u);
    });

    it('أثناء التحميل: يُظهر أيقونة i-reset فعلية (عنصر <svg><use>) لا نص SVG مهروب، ولا تظهر 🎲', async () => {
        runSimulationMock.mockReturnValue({
            ok: true, iterations: 1000,
            results: [{ npv: 100000 }, { npv: 200000 }],
            histogram: [{ binStart: 100000, binEnd: 200000, count: 2 }],
            stats: { minNPV: 100000, maxNPV: 200000, avgNPV: 150000, p10: 110000, p50: 150000, p90: 190000, successProbability: 0.9 }
        });
        global.Chart = class { constructor() {} destroy() {} };

        const store = fakeStore({});
        const view = new MonteCarloAnalysis('c', store);
        view.render();

        const btn = document.getElementById('btnRunSim');
        const runPromise = view.run();

        // في أثناء التحميل مباشرة (قبل أول تقدّم للمؤقّت المزيّف)
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).not.toMatch(/[🎲]/u);
        const loadingIcon = btn.querySelector('svg.ic use[href="#i-reset"]');
        expect(loadingIcon).not.toBeNull(); // عنصر SVG حقيقي عبر innerHTML، لا نص مهروب عبر textContent
        expect(btn.innerHTML).not.toContain('&lt;svg'); // يثبت أن السلسلة لم تُدرَج كنص مهروب

        await vi.advanceTimersByTimeAsync(100);
        await runPromise;

        delete global.Chart;
    });

    it('بعد انتهاء التشغيل: يعود الزر لأيقونة i-bolt فعلية ولا تظهر 🚀', async () => {
        runSimulationMock.mockReturnValue({
            ok: true, iterations: 1000,
            results: [{ npv: 100000 }, { npv: 200000 }],
            histogram: [{ binStart: 100000, binEnd: 200000, count: 2 }],
            stats: { minNPV: 100000, maxNPV: 200000, avgNPV: 150000, p10: 110000, p50: 150000, p90: 190000, successProbability: 0.9 }
        });
        global.Chart = class { constructor() {} destroy() {} };

        const store = fakeStore({});
        const view = new MonteCarloAnalysis('c', store);
        view.render();

        const btn = document.getElementById('btnRunSim');
        const runPromise = view.run();
        await vi.advanceTimersByTimeAsync(100);
        await runPromise;

        expect(btn.disabled).toBe(false);
        expect(btn.textContent).not.toMatch(/[🚀]/u);
        const finalIcon = btn.querySelector('svg.ic use[href="#i-bolt"]');
        expect(finalIcon).not.toBeNull();
        expect(btn.innerHTML).not.toContain('&lt;svg');

        delete global.Chart;
    });

    it('تصنيف المخاطرة الديناميكي (نص نظيف + أيقونة SVG-sprite مستقلة بجانبه، لا إيموجي خام)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();

        view.displaySavedSummary({ successProbability: 0.9, avgNPV: 1000000, p10: 0, p50: 0, p90: 0 });
        expect(document.getElementById('riskRating').textContent).toBe('منخفضة');
        expect(document.getElementById('riskRatingIcon').querySelector('use').getAttribute('href')).toBe('#i-check');

        view.displaySavedSummary({ successProbability: 0.6, avgNPV: 1000000, p10: 0, p50: 0, p90: 0 });
        expect(document.getElementById('riskRating').textContent).toBe('متوسطة');
        expect(document.getElementById('riskRatingIcon').querySelector('use').getAttribute('href')).toBe('#i-warning');

        view.displaySavedSummary({ successProbability: 0.3, avgNPV: 1000000, p10: 0, p50: 0, p90: 0 });
        expect(document.getElementById('riskRating').textContent).toBe('عالية');
        expect(document.getElementById('riskRatingIcon').querySelector('use').getAttribute('href')).toBe('#i-x');

        expect(document.getElementById('riskRating').textContent).not.toMatch(/[✅⚠️⛔]/u);
    });
});
