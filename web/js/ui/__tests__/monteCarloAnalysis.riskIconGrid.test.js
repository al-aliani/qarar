/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (علة أ + علة ب):
 *
 * علة أ: getRiskRating() كانت تُعيد نص «درجة المخاطرة» ممزوجاً بإيموجي خام
 * (✅/⚠️/⛔) بينما 3 شاشات مشابهة (ReportBuilderView/Timeline/FinancialDashboard)
 * هُجِّرت بالكامل لأيقونات SVG-sprite. النص يُعرض عبر riskEl.textContent (لا
 * innerHTML) في مستهلكَيه (displaySavedSummary/displayResults)، فحقن وسم <svg>
 * داخل النص نفسه كان سيُعرض كنص مهروب حرفياً لا كأيقونة فعلية. الإصلاح: النص
 * أصبح نظيفاً بلا إيموجي، وحقل icon منفصل يحدّد أيقونة SVG-sprite تُعرض بجانب
 * النص عبر عنصر <svg><use> مستقل (#riskRatingIcon) يُحدَّث ببرنامج setRiskIcon().
 *
 * علة ب: خط شبكة المحور y في مدرّج مونت كارلو كان rgba(255,255,255,0.05) ثابتاً
 * (أبيض شفيف تقريباً غير مرئي على خلفية فاتحة). الإصلاح: يُشتق الآن من
 * --c-text-muted عبر hexToRgba (نفس أسلوب ألوان الأعمدة success/danger) بشفافية
 * منخفضة تتبع الثيم الفعلي.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MonteCarloAnalysis } from '../MonteCarloAnalysis.js';

class FakeChart {
    constructor(ctx, config) {
        this.config = config;
        this.destroyed = false;
        FakeChart.instances.push(this);
    }
    destroy() { this.destroyed = true; }
}
FakeChart.instances = [];

function fakeStore(state) {
    return { getState: () => state, updatePath: vi.fn() };
}

describe('MonteCarloAnalysis.getRiskRating — نص نظيف بلا إيموجي + حقل icon منفصل (علة أ)', () => {
    it('لا يحتوي نص أي من الحالات الثلاث على إيموجي خام (✅/⚠️/⛔)', () => {
        [0.9, 0.75, 0.71, 0.6, 0.41, 0.4, 0.2, 0].forEach(p => {
            const rating = MonteCarloAnalysis.getRiskRating(p);
            expect(rating.text).not.toMatch(/[✅⚠️⛔]/u);
        });
    });

    it('يُعيد أيقونة i-check + نص "منخفضة" عند احتمالية > 0.7', () => {
        expect(MonteCarloAnalysis.getRiskRating(0.71)).toEqual({ text: 'منخفضة', icon: 'i-check', color: 'var(--c-success)' });
        expect(MonteCarloAnalysis.getRiskRating(0.99)).toMatchObject({ icon: 'i-check', text: 'منخفضة' });
    });

    it('يُعيد أيقونة i-warning + نص "متوسطة" عند 0.4 < احتمالية <= 0.7', () => {
        expect(MonteCarloAnalysis.getRiskRating(0.7)).toEqual({ text: 'متوسطة', icon: 'i-warning', color: 'var(--c-warning)' });
        expect(MonteCarloAnalysis.getRiskRating(0.41)).toMatchObject({ icon: 'i-warning', text: 'متوسطة' });
    });

    it('يُعيد أيقونة i-x + نص "عالية" عند احتمالية <= 0.4', () => {
        expect(MonteCarloAnalysis.getRiskRating(0.4)).toEqual({ text: 'عالية', icon: 'i-x', color: 'var(--c-danger)' });
        expect(MonteCarloAnalysis.getRiskRating(0)).toMatchObject({ icon: 'i-x', text: 'عالية' });
    });
});

describe('MonteCarloAnalysis — الأيقونة الفعلية في القالب تعكس getRiskRating (علة أ)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('render() يُنشئ عنصر #riskRatingIcon مخفياً افتراضياً (لا نتيجة بعد)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();
        const icon = document.getElementById('riskRatingIcon');
        expect(icon).not.toBeNull();
        expect(icon.tagName.toLowerCase()).toBe('svg');
    });

    it('displaySavedSummary: يُحدّث href الأيقونة لتطابق getRiskRating(p).icon ويُظهرها', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();
        view.displaySavedSummary({ successProbability: 0.85, avgNPV: 1, p10: 0, p50: 0, p90: 0 });

        const icon = document.getElementById('riskRatingIcon');
        expect(icon.querySelector('use').getAttribute('href')).toBe('#i-check');
        expect(icon.style.display).not.toBe('none');
        expect(document.getElementById('riskRating').textContent).toBe('منخفضة');
    });

    it('displayResults (ok:false): يُخفي الأيقونة بدل تركها تعرض تصنيفاً مضلِّلاً', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();
        // أظهر أيقونة أولاً لإثبات أنها تُخفى فعلياً لا أنها كانت مخفية أصلاً
        view.displaySavedSummary({ successProbability: 0.85, avgNPV: 1, p10: 0, p50: 0, p90: 0 });
        expect(document.getElementById('riskRatingIcon').style.display).not.toBe('none');

        view.displayResults({ ok: false });
        expect(document.getElementById('riskRatingIcon').style.display).toBe('none');
        expect(document.getElementById('riskRating').textContent).toContain('تعذّرت المحاكاة');
    });

    it('displayResults (ok:true, احتمالية متوسطة): أيقونة i-warning + نص "متوسطة" بلا إيموجي', () => {
        global.Chart = FakeChart; // renderHistogram (تُستدعى من داخل displayResults) تحتاج Chart معرَّفاً
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.render();
        view.displayResults({
            ok: true,
            stats: { successProbability: 0.5, avgNPV: 100, p10: 0, p50: 0, p90: 0 },
            histogram: [{ binStart: -1, binEnd: 1, count: 1 }],
        });
        expect(document.getElementById('riskRating').textContent).toBe('متوسطة');
        expect(document.getElementById('riskRatingIcon').querySelector('use').getAttribute('href')).toBe('#i-warning');
        delete global.Chart;
    });
});

describe('MonteCarloAnalysis.renderHistogram — خط شبكة المحور y يتبع الثيم (علة ب)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div><canvas id="histoChart"></canvas>`;
        global.Chart = FakeChart;
        FakeChart.instances = [];
    });
    afterEach(() => { delete global.Chart; });

    function makeHistogram(bins) {
        return bins.map(([binStart, binEnd, count]) => ({ binStart, binEnd, count }));
    }

    it('لون شبكة المحور y مُشتق من hexToRgba(--c-text-muted, 0.15) — ليس القيمة الثابتة القديمة', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.renderHistogram(makeHistogram([[-100, 0, 1], [0, 100, 1]]));

        const gridColor = FakeChart.instances[0].config.options.scales.y.grid.color;
        // jsdom لا يحمّل variables.css فعلياً، فتُستخدم القيمة الاحتياطية '#5b665f'
        // (نفس fallback المستخدَم فعلياً في renderHistogram لـ --c-text-muted).
        expect(gridColor).toBe(MonteCarloAnalysis.hexToRgba('#5b665f', 0.15));
        expect(gridColor).not.toBe('rgba(255,255,255,0.05)');
    });

    it('لون الشبكة سلسلة rgba() صالحة (لا var(--x) خام لا يفهمها Chart.js/canvas)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.renderHistogram(makeHistogram([[0, 100, 1]]));

        const gridColor = FakeChart.instances[0].config.options.scales.y.grid.color;
        expect(gridColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\.15\)$/);
    });

    it('يقرأ --c-text-muted عبر getComputedStyle (يتبع الثيم الفعلي وقت الرسم، لا قيمة مجمَّدة)', () => {
        // نحاكي ثيماً مختلفاً بقيمة hex مغايرة عبر تجاوز getComputedStyle مباشرة
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = (el) => {
            const real = originalGetComputedStyle(el);
            return {
                getPropertyValue: (prop) => (prop === '--c-text-muted' ? '#93a39a' : real.getPropertyValue(prop)),
            };
        };

        const view = new MonteCarloAnalysis('c', fakeStore({}));
        view.renderHistogram([{ binStart: 0, binEnd: 100, count: 1 }]);
        const gridColor = FakeChart.instances[0].config.options.scales.y.grid.color;
        expect(gridColor).toBe(MonteCarloAnalysis.hexToRgba('#93a39a', 0.15));

        window.getComputedStyle = originalGetComputedStyle;
    });
});
