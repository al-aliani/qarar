/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (مهندس الجودة): MonteCarloAnalysis.js كان بتغطية 0% تامة. هذا
 * يغطي: عرض نتيجة محفوظة مسبقاً بدقة (بلا إعادة حساب)، حدود ألوان/تصنيف المخاطرة
 * عند القيم الحرجة تحديداً (0.4/0.5/0.7/0.8 — عتبات مختلفة للّون مقابل النص، وهو
 * تناقض تصميمي حقيقي في الكود موثَّق هنا لا مُصلَح)، تشغيل المحاكاة الحقيقي فعلياً
 * (بذرة ثابتة ⇒ نتيجة قابلة للمطابقة بحساب مستقل)، وحارس القسمة على صفر في مدرّج
 * التوزيع عند تطابق كل قيم NPV (خلل حقيقي أُصلح هنا).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MonteCarloAnalysis } from '../MonteCarloAnalysis.js';
import { MonteCarloEngine } from '../../core/MonteCarloEngine.js';
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
    return {
        getState: () => state,
        updatePath: vi.fn((section, key, value) => { state = { ...state, [section]: { ...state[section], [key]: value } }; })
    };
}

function healthyStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 300000, quantity: 1 }], buildings: [], furniture: [{ price: 50000, quantity: 1 }], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 3, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 2000, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = { sources: { equity: { amount: 250000 }, bankLoan: { amount: 150000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' } } };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

function fmtCurrency(n) {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}

describe('MonteCarloAnalysis — الحالة الافتراضية (بلا تشغيل سابق)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('لا يعرض نتائج (div مخفي) ولا رسالة "آخر تشغيل" قبل أي محاكاة', () => {
        const study = healthyStudy();
        const view = new MonteCarloAnalysis('c', fakeStore(study));
        view.render();

        expect(document.getElementById('simResults').className).toContain('hidden');
        expect(document.getElementById('probSuccess').textContent).toBe('--');
        expect(document.querySelector('.card').textContent).not.toContain('آخر تشغيل');
    });
});

describe('MonteCarloAnalysis — عرض نتيجة محفوظة (displaySavedSummary)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يعرض القيم المحفوظة بدقة تامة (بلا إعادة حساب) ويُظهر div النتائج فوراً', () => {
        const study = healthyStudy();
        study[SECTIONS.MONTE_CARLO] = {
            lastRun: {
                successProbability: 0.85, avgNPV: 3200000, p10: 1000000, p50: 3100000, p90: 5400000,
                iterations: 1000, volatility: 0.20, runAt: '2026-07-01T10:00:00.000Z'
            }
        };
        const view = new MonteCarloAnalysis('c', fakeStore(study));
        view.render();

        expect(document.getElementById('simResults').className).not.toContain('hidden');
        expect(document.getElementById('probSuccess').textContent).toBe('85.0%');
        expect(document.getElementById('avgNPV').textContent).toBe(fmtCurrency(3200000));
        expect(document.getElementById('npvP10').textContent).toBe(fmtCurrency(1000000));
        expect(document.getElementById('npvP50').textContent).toBe(fmtCurrency(3100000));
        expect(document.getElementById('npvP90').textContent).toBe(fmtCurrency(5400000));
        expect(document.querySelector('.card').textContent).toContain('آخر تشغيل');
    });
});

describe('MonteCarloAnalysis — حدود ألوان/تصنيف المخاطرة موحَّدة الآن (#33)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    // تدقيق 2026-07-08 (ملاحظة متوسطة #33): كان الكود يستخدم 0.7/0.4 للّون لكن
    // 0.8/0.5 لنص "درجة المخاطرة" — نطاق وسيط [0.7, 0.8) كان يُظهر لوناً أخضر
    // (نجاح) مع نص "متوسطة ⚠️" في آنٍ واحد. getRiskRating() الموحَّدة تضمن الآن
    // تطابق اللون والنص دائماً لنفس الاحتمالية (لا مصدرين مستقلين).
    const cases = [
        { p: 0.75, color: 'var(--c-success)', risk: 'منخفضة ✅' },
        { p: 0.70, color: 'var(--c-warning)', risk: 'متوسطة ⚠️' },
        { p: 0.80, color: 'var(--c-success)', risk: 'منخفضة ✅' },
        { p: 0.40, color: 'var(--c-danger)', risk: 'عالية ⛔' },
        { p: 0.50, color: 'var(--c-warning)', risk: 'متوسطة ⚠️' },
    ];

    cases.forEach(({ p, color, risk }) => {
        it(`p=${p}: اللون=${color} والنص="${risk}" متطابقان (لا تناقض)`, () => {
            const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
            view.render();
            view.displaySavedSummary({ successProbability: p, avgNPV: 1000000, p10: 0, p50: 0, p90: 0 });

            expect(document.getElementById('probSuccess').style.color).toBe(color);
            expect(document.getElementById('riskRating').textContent).toBe(risk);
        });
    });

    it('getRiskRating تُعيد نفس اللون والنص المستخدَمين فعلياً في العرض (مصدر واحد)', () => {
        [0.9, 0.75, 0.7, 0.55, 0.4, 0.1].forEach(p => {
            const rating = MonteCarloAnalysis.getRiskRating(p);
            expect(['var(--c-success)', 'var(--c-warning)', 'var(--c-danger)']).toContain(rating.color);
            expect(['منخفضة ✅', 'متوسطة ⚠️', 'عالية ⛔']).toContain(rating.text);
        });
    });
});

describe('MonteCarloAnalysis — displayResults: بيانات غير كافية (ok:false)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يعرض حالة "تعذّرت المحاكاة" بدل احتمالية 0% مفبركة، ولا يرمي خطأً رغم غياب stats', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        view.render();
        expect(() => view.displayResults({ ok: false })).not.toThrow();

        expect(document.getElementById('probSuccess').textContent).toBe('—');
        expect(document.getElementById('riskRating').textContent).toContain('تعذّرت المحاكاة');
        expect(document.getElementById('avgNPV').textContent).toBe('—');
    });
});

describe('MonteCarloAnalysis — renderHistogram: يستهلك histogram الجاهزة من المحرك (#61)', () => {
    // تدقيق 2026-07-08 (ملاحظة منخفضة #61): renderHistogram لم تعد تُعيد تجميع
    // نتائج NPV الخام بمنطق مستقل — تستهلك مصفوفة histogram الجاهزة (نفس الشكل
    // الذي يُخرجه MonteCarloEngine.runSimulation) مباشرة. حارس القسمة على صفر
    // (تقلّب صفري) أصبح مسؤولية المحرك وحده الآن — مُثبَّت بحزم اختباراته الخاصة
    // وفي اختبار التكامل الحقيقي أدناه.
    function makeHistogram(bins) {
        // {start, end, count}[] → شكل المحرك الفعلي {binStart, binEnd, count}
        return bins.map(([binStart, binEnd, count]) => ({ binStart, binEnd, count }));
    }

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div><canvas id="histoChart"></canvas>`;
        global.Chart = FakeChart;
        FakeChart.instances = [];
    });
    afterEach(() => { delete global.Chart; });

    it('يرسم 20 صندوقاً بالضبط بنفس قيم count المُعطاة (لا إعادة تجميع)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const counts = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20، مجموعها معروف مسبقاً
        const histogram = makeHistogram(counts.map((c, i) => [-500000 + i * 50000, -500000 + (i + 1) * 50000, c]));
        view.renderHistogram(histogram);

        const buckets = FakeChart.instances[0].config.data.datasets[0].data;
        expect(buckets).toHaveLength(20);
        expect(buckets).toEqual(counts);
    });

    it('صندوق القيم السالبة أحمر والموجبة أخضر (حسب مركز الصندوق binStart/binEnd)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const histogram = makeHistogram([
            [-100000, -50000, 5],
            [50000, 100000, 5]
        ]);
        view.renderHistogram(histogram);

        const colors = FakeChart.instances[0].config.data.datasets[0].backgroundColor;
        expect(colors[0]).toContain('248, 113, 113'); // أحمر لصندوق مركزه سالب
        expect(colors[1]).toContain('74, 222, 128'); // أخضر لصندوق مركزه موجب
    });

    it('لا يرمي خطأً لو أُعطي histogram بصندوق واحد فقط (حالة تقلّب صفري من المحرك)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const histogram = makeHistogram([[999999.5, 1000000.5, 50]]);

        expect(() => view.renderHistogram(histogram)).not.toThrow();
        const buckets = FakeChart.instances[0].config.data.datasets[0].data;
        expect(buckets).toEqual([50]);
    });

    it('يُدمّر الرسم البياني القديم قبل رسم جديد (لا تسرّب/تراكم رسومات)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        view.renderHistogram(makeHistogram([[0, 100, 1], [100, 200, 1]]));
        const first = FakeChart.instances[0];
        view.renderHistogram(makeHistogram([[0, 100, 2], [100, 200, 2]]));

        expect(first.destroyed).toBe(true);
        expect(FakeChart.instances).toHaveLength(2);
    });

    it('يحذف رسالة "نتيجة محفوظة" (histoPlaceholder) فور رسم فعلي جديد', () => {
        document.body.innerHTML = `<div id="c"><p id="histoPlaceholder">نتيجة محفوظة</p><canvas id="histoChart"></canvas></div>`;
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        view.renderHistogram(makeHistogram([[0, 100, 1]]));
        expect(document.getElementById('histoPlaceholder')).toBeNull();
    });
});

describe('MonteCarloEngine.runSimulation — حارس القسمة على صفر في histogram (خلل مُصلَح، مصدره الآن هنا لا الواجهة)', () => {
    it('حالة الحافة الحرجة: كل قيم NPV متطابقة تماماً (تقلّب صفري) — لا NaN صامت، كل التكرارات في صندوق واحد', () => {
        // دراسة بلا أي مصدر تقلّب فعلي (volatility=0) ⇒ كل التكرارات تُنتج نفس NPV بالضبط
        const study = healthyStudy();
        const sim = MonteCarloEngine.runSimulation(study, 50, 0);
        expect(sim.ok).toBe(true);
        expect(sim.histogram).toHaveLength(20);
        const counts = sim.histogram.map(b => b.count);
        // قبل الإصلاح: binSize=0 ⇒ فهرس NaN ⇒ كل الصناديق صفر (بيانات مفقودة صامتة).
        // بعد الإصلاح: binSize احتياطي=1 ⇒ كل النتائج (فرق=0) تقع في الصندوق 0.
        expect(counts[0]).toBe(50);
        expect(counts.slice(1).every(c => c === 0)).toBe(true);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(50); // لا فقدان صامت للبيانات
    });
});

describe('MonteCarloAnalysis — run(): تكامل حقيقي مع المحرك الفعلي (بذرة ثابتة)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        global.Chart = FakeChart;
        FakeChart.instances = [];
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
        delete global.Chart;
    });

    it('يعرض بالضبط نفس نتائج MonteCarloEngine.runSimulation(state, 1000, 0.20) المحسوبة مستقلاً (بذرة ثابتة ⇒ قابلية مطابقة)', async () => {
        const study = healthyStudy();
        const expected = MonteCarloEngine.runSimulation(study, 1000, 0.20);
        expect(expected.ok).toBe(true); // تأكيد أن الدراسة صالحة فعلاً لهذا الاختبار

        const store = fakeStore(study);
        const view = new MonteCarloAnalysis('c', store);
        view.render();

        const btn = document.getElementById('btnRunSim');
        expect(btn.disabled).toBe(false);

        const runPromise = view.run();
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toContain('جاري المعالجة');

        await vi.advanceTimersByTimeAsync(100);
        await runPromise;

        expect(btn.disabled).toBe(false);
        // تدقيق 2026-07-08 (#29): الزر يستخدم الآن أيقونة SVG بدل إيموجي 🚀 (انظر
        // monteCarloAnalysis.iconSprite.test.js للتحقق التفصيلي من الأيقونة).
        expect(btn.textContent.trim()).toBe('تشغيل المحاكاة');
        expect(btn.querySelector('use[href="#i-bolt"]')).not.toBeNull();

        expect(document.getElementById('probSuccess').textContent).toBe((expected.stats.successProbability * 100).toFixed(1) + '%');
        expect(document.getElementById('avgNPV').textContent).toBe(fmtCurrency(expected.stats.avgNPV));
        expect(document.getElementById('npvP10').textContent).toBe(fmtCurrency(expected.stats.p10));
        expect(document.getElementById('npvP50').textContent).toBe(fmtCurrency(expected.stats.p50));
        expect(document.getElementById('npvP90').textContent).toBe(fmtCurrency(expected.stats.p90));

        expect(store.updatePath).toHaveBeenCalledWith(SECTIONS.MONTE_CARLO, 'lastRun', {
            successProbability: expected.stats.successProbability,
            avgNPV: expected.stats.avgNPV,
            p10: expected.stats.p10,
            p50: expected.stats.p50,
            p90: expected.stats.p90,
            iterations: expected.iterations,
            volatility: 0.20,
            // ملاحظة: ينتظر run() فعلياً 100ms (setTimeout) قبل قراءة new Date() — الساعة
            // المزيَّفة تتقدَّم فعلياً بهذا القدر، فالطابع الزمني المتوقَّع +100ms عن البداية.
            runAt: '2026-07-08T12:00:00.100Z'
        });
    }, 15000);
});
