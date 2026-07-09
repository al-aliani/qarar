/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (theme-colors) — MonteCarloAnalysis.js كان يحتوي على متغيّر CSS مطبوع
 * خطأً `var(--c-muted, #888)` (غير معرَّف إطلاقاً في web/css — المتغيّر الصحيح
 * هو `--c-text-muted`)، وألوان أعمدة المدرّج التكراري كانت rgba(...) ثابتة لا
 * تتبع الثيم ولا تتطابق مع --c-success/--c-danger المستخدمين لنفس البيانات في
 * شارة "درجة المخاطرة" بجانبها مباشرة.
 *
 * هذا الاختبار يثبّت: (1) لا وجود لأي إشارة إلى '--c-muted' في الـHTML/الأنماط
 * المضمَّنة الناتجة عن المكوّن، (2) ألوان أعمدة المدرّج التكراري مُشتقة من
 * getComputedStyle(--c-success/--c-danger) عبر hexToRgba بدل rgba حرفية ثابتة.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonteCarloAnalysis } from '../MonteCarloAnalysis.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

class FakeChart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.destroyed = false;
        FakeChart.instances.push(this);
    }
    destroy() { this.destroyed = true; }
}
FakeChart.instances = [];

function fakeStore(state) {
    return { getState: () => state, updatePath: () => {} };
}

describe('MonteCarloAnalysis — batch6: لا "--c-muted" متيتّم، والمدرّج يستخدم متغيرات الهوية', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('displayResults عند ok:false: لون النص المعروض يستخدم --c-text-muted فقط، لا --c-muted إطلاقاً', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        view.render();
        view.displayResults({ ok: false });

        const probEl = document.getElementById('probSuccess');
        // لا يوجد أي أثر لاسم المتغيّر الخاطئ '--c-muted' في الأنماط المضمَّنة
        expect(probEl.style.color).not.toContain('--c-muted');
        expect(probEl.getAttribute('style') || '').not.toContain('--c-muted');
        // والمتغيّر الصحيح المعرَّف فعلياً في variables.css هو المستخدَم
        expect(probEl.style.color).toBe('var(--c-text-muted)');

        // تعميم الفحص على الـHTML الكامل للحاوية (لا مكان آخر يسرّب --c-muted)
        expect(view.container.innerHTML).not.toContain('--c-muted');
    });

    it('لا وجود مطلقاً للسلسلة الحرفية "--c-muted" في مصدر المكوّن (تأكيد إضافي على مستوى الملف)', async () => {
        // قراءة الوحدة كنص للتأكد من عدم بقاء أي استخدام آخر منسي لنفس الخطأ المطبعي
        const fs = await import('node:fs');
        const path = await import('node:path');
        const url = await import('node:url');
        const here = path.dirname(url.fileURLToPath(import.meta.url));
        const src = fs.readFileSync(path.join(here, '..', 'MonteCarloAnalysis.js'), 'utf8');
        expect(src).not.toContain('--c-muted');
        expect(src).toContain('--c-text-muted');
    });
});

describe('MonteCarloAnalysis — batch6: ألوان أعمدة المدرّج مُشتقة من --c-success/--c-danger', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div><canvas id="histoChart"></canvas>`;
        global.Chart = FakeChart;
        FakeChart.instances = [];
    });
    afterEach(() => { delete global.Chart; });

    function makeHistogram(bins) {
        return bins.map(([binStart, binEnd, count]) => ({ binStart, binEnd, count }));
    }

    it('لا تظهر قيم rgba القديمة الثابتة (74,222,128 / 248,113,113) في مخرجات backgroundColor', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        const histogram = makeHistogram([
            [-100000, -50000, 5],
            [50000, 100000, 5]
        ]);
        view.renderHistogram(histogram);

        const colors = FakeChart.instances[0].config.data.datasets[0].backgroundColor;
        colors.forEach(c => {
            expect(c).not.toContain('74, 222, 128');
            expect(c).not.toContain('248, 113, 113');
        });
    });

    it('الألوان الفعلية تطابق hexToRgba(--c-success/--c-danger, 0.6) — نفس مصدر شارة درجة المخاطرة', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        const histogram = makeHistogram([
            [-100000, -50000, 5], // مركز سالب ⇒ خطر/danger
            [50000, 100000, 5],   // مركز موجب ⇒ نجاح/success
        ]);
        view.renderHistogram(histogram);

        const colors = FakeChart.instances[0].config.data.datasets[0].backgroundColor;
        // jsdom لا يحمّل variables.css فعلياً ⇒ getComputedStyle تُعيد فارغة ⇒ القيم
        // الاحتياطية (fallback) داخل renderHistogram هي المرجع، وهي مطابقة حرفياً
        // لقيم --c-success/--c-danger المعرَّفة في :root ضمن variables.css.
        expect(colors[0]).toBe(MonteCarloAnalysis.hexToRgba('#c2382e', 0.6));
        expect(colors[1]).toBe(MonteCarloAnalysis.hexToRgba('#157f5f', 0.6));
    });

    it('hexToRgba() تحوّل صحيحاً hex→rgba بالشفافية المطلوبة (اختبار وحدة مباشر للمساعد الجديد)', () => {
        expect(MonteCarloAnalysis.hexToRgba('#157f5f', 0.6)).toBe('rgba(21, 127, 95, 0.6)');
        expect(MonteCarloAnalysis.hexToRgba('#c2382e', 0.6)).toBe('rgba(194, 56, 46, 0.6)');
        // صيغة hex مختصرة (3 خانات) أيضاً مدعومة
        expect(MonteCarloAnalysis.hexToRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    });

    it('عند وجود --c-success/--c-danger فعلياً على :root (محاكاة CSS محمّل)، تُستخدم القيمة المحسوبة لا الاحتياطية', () => {
        document.documentElement.style.setProperty('--c-success', '#00ff00');
        document.documentElement.style.setProperty('--c-danger', '#ff0000');

        const view = new MonteCarloAnalysis('c', fakeStore(createEmptyStudy()));
        view.renderHistogram(makeHistogram([[-100000, -50000, 1], [50000, 100000, 1]]));
        const colors = FakeChart.instances[0].config.data.datasets[0].backgroundColor;

        expect(colors[0]).toBe('rgba(255, 0, 0, 0.6)');
        expect(colors[1]).toBe('rgba(0, 255, 0, 0.6)');

        document.documentElement.style.removeProperty('--c-success');
        document.documentElement.style.removeProperty('--c-danger');
    });
});
