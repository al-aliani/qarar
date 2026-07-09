/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (2026-07-09): يثبّت هذا الملف إصلاحين مستقلين طُلبا معاً لأنهما يشتركان
 * في السطح نفسه (تحليل الحساسية + محرك الحسابات):
 *
 * 1) SensitivityAnalysis.render() كان يستدعي calculateStudy الكامل ~22 مرة لكل
 *    رسم (بطاقتان × 3 + مصفوفة 4×3 + جدول مستويات تشغيل 3 + أساس 1) بلا أي
 *    ذاكرة تخزين مؤقت رغم أن كثيراً من هذه النداءات تتشارك نفس معاملات السيناريو
 *    عبر أقسام العرض المختلفة. أُضيفت ذاكرة Map تُنشأ من جديد في بداية كل
 *    render() — فتُختصر النداءات الفعلية إلى 14 (تركيبة مميّزة واحدة لكل
 *    سيناريو) بلا أي تغيير في الأرقام أو الألوان المعروضة.
 *
 * 2) calculateSensitivityScenarios المُصدَّرة من engine.js كانت كوداً ميتاً
 *    بتعليق يزعم "بعض الشاشات القديمة تستدعيه" رغم عدم وجود أي مستدعٍ حي فعلياً
 *    (تحقّق بحث شامل في web/ قبل الحذف). حُذفت الدالة وتصديرها بالكامل.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const calculateStudySpy = vi.fn();
vi.mock('../../core/engine.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        calculateStudy: (...args) => {
            calculateStudySpy(...args);
            return actual.calculateStudy(...args);
        }
    };
});

const { SensitivityAnalysis } = await import('../SensitivityAnalysis.js');
// الوحدة الحقيقية (غير المُقلَّدة) — vi.mock يُنشئ بروكسي صارماً يرمي خطأً عند
// الوصول لخاصية غير مُعرَّفة بدل إعادة undefined، لذا نتحقق من قائمة التصدير
// الفعلية عبر importActual لا عبر الوحدة المُقلَّدة في هذا الملف.
const realEngineModule = await vi.importActual('../../core/engine.js');
const { calculateStudy: realCalculateStudy } = realEngineModule;
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

function fakeStore(state) {
    return { getState: () => state };
}

// نفس دراسة الأساس المستخدمة في sensitivityAnalysis.test.js لضمان تطابق السياق.
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

describe('batch6 — SensitivityAnalysis.render(): ذاكرة تخزين مؤقت تختصر نداءات المحرك', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
    });

    it('يستدعي المحرك 14 مرة فقط (بدل ~22) لكل render، وكل تلك أقل بكثير من الأصل غير المُذاكَر', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        // 14 = تركيبة مميّزة: الأساس (1) + revenueChange {-0.3,-0.2,-0.1,0.1,0.2} (5)
        // + opexChange {-0.2,-0.1,0.1,0.2} (4) + capexChange {-0.2,-0.1,0.1,0.2} (4).
        expect(calculateStudySpy).toHaveBeenCalledTimes(14);
        expect(calculateStudySpy.mock.calls.length).toBeLessThan(22);
    });

    it('الأرقام المعروضة (بطاقة الإيرادات) تطابق تماماً ناتج المحرك الحقيقي المحسوب باستقلالية', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const base = realCalculateStudy(study);
        const revDown = realCalculateStudy(study, { revenueChange: -0.10 });
        const revUp = realCalculateStudy(study, { revenueChange: 0.10 });

        const revenueCard = document.querySelectorAll('.sensitivity-item-card')[0];
        const points = revenueCard.querySelectorAll('.range-point');
        const valueOf = (point) => point.querySelectorAll('span')[1].textContent;

        expect(valueOf(points[0])).toBe(view.formatCurrency(revDown.indicators.npv));
        expect(valueOf(points[1])).toBe(view.formatCurrency(base.indicators.npv));
        expect(valueOf(points[2])).toBe(view.formatCurrency(revUp.indicators.npv));
    });

    it('مصفوفة الإيرادات (±20%/±10%/0) تطابق أيضاً ناتج المحرك الحقيقي لكل نقطة', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const base = realCalculateStudy(study);
        const rows = [...document.querySelectorAll('.sensitivity-matrix-container tbody tr')];
        const revenueRow = rows.find(r => r.querySelector('td').textContent === 'الإيرادات');
        const cells = [...revenueRow.querySelectorAll('td')].slice(1);

        const variations = [-0.20, -0.10, 0, 0.10, 0.20];
        variations.forEach((v, i) => {
            const expectedNpv = v === 0 ? base.indicators.npv : realCalculateStudy(study, { revenueChange: v }).indicators.npv;
            expect(cells[i].textContent).toBe(view.formatCurrency(expectedNpv));
        });
    });

    it('جدول مستويات التشغيل (90%/80%/70%) يطابق أيضاً ناتج المحرك الحقيقي', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const title = [...document.querySelectorAll('.card-title')].find(h => h.textContent.includes('مستويات التشغيل'));
        const rows = [...title.closest('.card').querySelectorAll('tbody tr')];

        const expected = [
            realCalculateStudy(study).indicators.npv,
            realCalculateStudy(study, { revenueChange: -0.10 }).indicators.npv,
            realCalculateStudy(study, { revenueChange: -0.20 }).indicators.npv,
            realCalculateStudy(study, { revenueChange: -0.30 }).indicators.npv,
        ];

        rows.forEach((row, i) => {
            expect(row.querySelectorAll('td')[1].textContent).toBe(view.formatCurrency(expected[i]));
        });
    });

    it('الذاكرة المؤقتة لا تُسرّب نتائج قديمة: render() ثانٍ بعد تغيّر بيانات حقيقي يُنتج قيمة أساس مختلفة', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();
        const firstBase = document.querySelectorAll('.sensitivity-item-card')[0]
            .querySelectorAll('.range-point')[1].querySelectorAll('span')[1].textContent;

        study[SECTIONS.REVENUE].streams[0].avgPrice = 500; // تغيير حقيقي وكبير في مدخل الإيراد
        view.render();
        const secondBase = document.querySelectorAll('.sensitivity-item-card')[0]
            .querySelectorAll('.range-point')[1].querySelectorAll('span')[1].textContent;

        expect(secondBase).not.toBe(firstBase);
        expect(secondBase).toBe(view.formatCurrency(realCalculateStudy(study).indicators.npv));
    });
});

describe('batch6 — حذف الكود الميت calculateSensitivityScenarios من engine.js', () => {
    it('engine.js لم يعد يُصدِّر calculateSensitivityScenarios (كود ميت بلا أي مستدعٍ حي)', () => {
        expect(Object.prototype.hasOwnProperty.call(realEngineModule, 'calculateSensitivityScenarios')).toBe(false);
        expect(realEngineModule.calculateSensitivityScenarios).toBeUndefined();
    });

    it('حارس انحدار: يمنع عودة أي مستدعٍ حي لـcalculateSensitivityScenarios مستقبلاً في مصدر التطبيق', () => {
        const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
        const scanRoots = ['web/js', 'lib'].map(p => path.join(repoRoot, p));

        function walk(dir, hits) {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full, hits);
                } else if (entry.isFile() && /\.js$/.test(entry.name)) {
                    const content = fs.readFileSync(full, 'utf8');
                    if (content.includes('calculateSensitivityScenarios')) hits.push(full);
                }
            }
        }

        const hits = [];
        for (const root of scanRoots) walk(root, hits);

        expect(hits, `calculateSensitivityScenarios عاد للظهور في مصدر التطبيق (خارج الاختبارات): ${hits.join(', ')} — كان قد حُذف بصفته كوداً ميتاً بلا مستدعٍ حي`).toEqual([]);
    });
});
