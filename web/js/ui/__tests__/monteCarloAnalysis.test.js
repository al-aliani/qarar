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

describe('MonteCarloAnalysis — حدود ألوان/تصنيف المخاطرة (عتبات مختلفة عمداً للّون مقابل النص)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    // الكود يستخدم 0.7/0.4 للّون لكن 0.8/0.5 لنص "درجة المخاطرة" — نطاقاً وسيطاً
    // [0.7, 0.8) يُظهر لوناً أخضر (نجاح) مع نص "متوسطة ⚠️" في آنٍ واحد. هذا يُوثِّق
    // السلوك الفعلي الحالي (وليس إصلاحاً — قد يكون متعمَّداً كمنطقة عازلة).
    const cases = [
        { p: 0.75, color: 'var(--c-success)', risk: 'متوسطة ⚠️', note: 'أخضر لكن "متوسطة" — منطقة التناقض الموثّقة' },
        { p: 0.70, color: 'var(--c-warning)', risk: 'متوسطة ⚠️', note: '0.7 بالضبط: الشرط >0.7 صارم فيسقط للتحذير' },
        { p: 0.80, color: 'var(--c-success)', risk: 'منخفضة ✅', note: '0.8 بالضبط: الشرط <0.8 صارم فلا يُصنَّف متوسطاً' },
        { p: 0.40, color: 'var(--c-danger)', risk: 'عالية ⛔', note: '0.4 بالضبط: الشرط >0.4 صارم فيسقط للخطر' },
        { p: 0.50, color: 'var(--c-warning)', risk: 'متوسطة ⚠️', note: '0.5 بالضبط: الشرط <0.5 صارم فلا يُصنَّف عالياً' },
    ];

    cases.forEach(({ p, color, risk, note }) => {
        it(`p=${p}: اللون=${color}, النص="${risk}" — ${note}`, () => {
            const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
            view.render();
            view.displaySavedSummary({ successProbability: p, avgNPV: 1000000, p10: 0, p50: 0, p90: 0 });

            expect(document.getElementById('probSuccess').style.color).toBe(color);
            expect(document.getElementById('riskRating').textContent).toBe(risk);
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

describe('MonteCarloAnalysis — renderHistogram: حارس القسمة على صفر (خلل مُصلَح)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div><canvas id="histoChart"></canvas>`;
        global.Chart = FakeChart;
        FakeChart.instances = [];
    });
    afterEach(() => { delete global.Chart; });

    it('توزيع طبيعي: كل التكرارات تُوزَّع على 20 صندوقاً ومجموعها يساوي عدد النتائج بالضبط', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const results = Array.from({ length: 100 }, (_, i) => ({ npv: -500000 + i * 10000 }));
        view.renderHistogram(results);

        const buckets = FakeChart.instances[0].config.data.datasets[0].data;
        expect(buckets).toHaveLength(20);
        expect(buckets.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('صندوق القيم السالبة أحمر والموجبة أخضر (حسب مركز الصندوق)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const results = Array.from({ length: 100 }, (_, i) => ({ npv: -500000 + i * 10000 }));
        view.renderHistogram(results);

        const colors = FakeChart.instances[0].config.data.datasets[0].backgroundColor;
        expect(colors[0]).toContain('248, 113, 113'); // أحمر لأول صندوق (سالب)
        expect(colors[colors.length - 1]).toContain('74, 222, 128'); // أخضر لآخر صندوق (موجب)
    });

    it('حالة الحافة الحرجة: كل قيم NPV متطابقة تماماً (تقلّب صفري) — لا NaN صامت، كل التكرارات في صندوق واحد', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        const identicalResults = Array.from({ length: 50 }, () => ({ npv: 1000000 }));

        expect(() => view.renderHistogram(identicalResults)).not.toThrow();

        const buckets = FakeChart.instances[0].config.data.datasets[0].data;
        // قبل الإصلاح: width=0 ⇒ فهرس NaN ⇒ كل الصناديق الرقمية تبقى صفراً (بيانات مفقودة صامتة).
        // بعد الإصلاح: width احتياطي=1 ⇒ كل القيم (فرق=0) تقع في الصندوق 0 تحديداً.
        expect(buckets[0]).toBe(50);
        expect(buckets.slice(1).every(b => b === 0)).toBe(true);
        expect(buckets.reduce((a, b) => a + b, 0)).toBe(50); // لا فقدان صامت للبيانات
    });

    it('يُدمّر الرسم البياني القديم قبل رسم جديد (لا تسرّب/تراكم رسومات)', () => {
        const view = new MonteCarloAnalysis('c', fakeStore(healthyStudy()));
        view.renderHistogram([{ npv: 100 }, { npv: 200 }]);
        const first = FakeChart.instances[0];
        view.renderHistogram([{ npv: 300 }, { npv: 400 }]);

        expect(first.destroyed).toBe(true);
        expect(FakeChart.instances).toHaveLength(2);
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
        expect(btn.textContent).toBe('تشغيل المحاكاة 🚀');

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
