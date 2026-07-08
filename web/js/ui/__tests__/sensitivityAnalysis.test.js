/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (مهندس الجودة): SensitivityAnalysis.js كان بتغطية 0% تامة.
 * هذا يغطي: أن كل بطاقة/خلية تعرض بالضبط ما يُنتجه calculateStudy الحقيقي (لا صيغة
 * تقريبية)، أن العلاقات المالية الأساسية سليمة اتجاهياً (المزيد من الإيراد يرفع
 * القيمة الحالية، المزيد من التكلفة يخفضها)، وأن نقطة المصفوفة عند 0% تطابق
 * الأساس تماماً بدل إعادة حساب منفصلة قد تختلف.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SensitivityAnalysis } from '../SensitivityAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state };
}

// دراسة مربحة بهامش مريح — تبقى موجبة القيمة الحالية عبر كل تغيّرات ±20%/±10%.
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

// دراسة هامشية عمداً — عند -20%/-30% إيراد تنقلب القيمة الحالية سالبة، كي يُختبر
// المسار الأحمر (text-danger) فعلياً لا نظرياً فقط، إلى جانب المسار الأخضر.
function fragileStudy() {
    const data = healthyStudy();
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 700, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.02 }] };
    return data;
}

function expectedClass(npv) {
    return (npv == null || Number.isNaN(npv)) ? 'text-muted' : (npv < 0 ? 'text-danger' : 'text-success');
}

describe('SensitivityAnalysis — البطاقات الثلاث (±10%) تطابق المحرك الحقيقي', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('تعرض 3 بطاقات بالترتيب الصحيح (إيرادات، تشغيلية، رأسمالية) بعناوين مطابقة', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const cards = [...document.querySelectorAll('.sensitivity-item-card')];
        expect(cards).toHaveLength(3);
        expect(cards[0].querySelector('.mini-title').textContent).toBe('تغير الإيرادات');
        expect(cards[1].querySelector('.mini-title').textContent).toBe('تغير التكاليف التشغيلية');
        expect(cards[2].querySelector('.mini-title').textContent).toBe('تغير التكاليف الرأسمالية');
    });

    it('بطاقة الإيرادات: القيم المعروضة (±10%) تساوي بالضبط ناتج calculateStudy الحقيقي لنفس المعاملات', () => {
        const study = healthyStudy();
        const base = calculateStudy(study);
        const down = calculateStudy(study, { revenueChange: -0.10 });
        const up = calculateStudy(study, { revenueChange: 0.10 });

        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const card = document.querySelectorAll('.sensitivity-item-card')[0];
        const points = card.querySelectorAll('.range-point');
        const valueOf = (point) => point.querySelectorAll('span')[1];

        expect(valueOf(points[0]).textContent).toBe(view.formatCurrency(down.indicators.npv));
        expect(valueOf(points[0]).className).toBe(expectedClass(down.indicators.npv));
        expect(valueOf(points[1]).textContent).toBe(view.formatCurrency(base.indicators.npv));
        expect(valueOf(points[2]).textContent).toBe(view.formatCurrency(up.indicators.npv));
        expect(valueOf(points[2]).className).toBe(expectedClass(up.indicators.npv));
    });

    it('اتجاه العلاقات المالية سليم: ارتفاع الإيراد يرفع القيمة الحالية، ارتفاع التكاليف (تشغيلية أو رأسمالية) يخفّضها', () => {
        const study = healthyStudy();
        const revDown = calculateStudy(study, { revenueChange: -0.10 }).indicators.npv;
        const base = calculateStudy(study).indicators.npv;
        const revUp = calculateStudy(study, { revenueChange: 0.10 }).indicators.npv;
        expect(revDown).toBeLessThan(base);
        expect(base).toBeLessThan(revUp);

        const opexUp = calculateStudy(study, { opexChange: 0.10 }).indicators.npv;
        const opexDown = calculateStudy(study, { opexChange: -0.10 }).indicators.npv;
        expect(opexUp).toBeLessThan(base);
        expect(opexDown).toBeGreaterThan(base);

        const capexUp = calculateStudy(study, { capexChange: 0.10 }).indicators.npv;
        const capexDown = calculateStudy(study, { capexChange: -0.10 }).indicators.npv;
        expect(capexUp).toBeLessThan(base);
        expect(capexDown).toBeGreaterThan(base);
    });
});

describe('SensitivityAnalysis — مصفوفة التأثير (5 نقاط): نقطة 0% تطابق الأساس تماماً', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('صف الإيرادات في المصفوفة: القيم الخمس (±20%/±10%/0) صحيحة وبالألوان المطابقة لإشاراتها الفعلية', () => {
        const study = fragileStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const rows = [...document.querySelectorAll('.sensitivity-matrix-container tbody tr')];
        const revenueRow = rows.find(r => r.querySelector('td').textContent === 'الإيرادات');
        const cells = [...revenueRow.querySelectorAll('td')].slice(1); // بعد عمود التسمية

        const variations = [-0.20, -0.10, 0, 0.10, 0.20];
        variations.forEach((v, i) => {
            const npv = v === 0 ? calculateStudy(study).indicators.npv : calculateStudy(study, { revenueChange: v }).indicators.npv;
            expect(cells[i].textContent).toBe(view.formatCurrency(npv));
            expect(cells[i].className).toBe(expectedClass(npv));
        });

        // تأكيد أن كلا المسارين (أخضر/أحمر) ظهرا فعلاً في هذا الصف — لا اختبار نظري فقط
        expect(cells.some(c => c.className === 'text-danger')).toBe(true);
        expect(cells.some(c => c.className === 'text-success')).toBe(true);
    });

    it('نقطة 0% في المصفوفة تساوي baseNPV المستخدم في البطاقات أعلاه بالضبط (لا إعادة حساب منفصلة قد تنحرف)', () => {
        const study = healthyStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const baseCardValue = document.querySelectorAll('.sensitivity-item-card')[0]
            .querySelectorAll('.range-point')[1].querySelectorAll('span')[1].textContent;

        const rows = [...document.querySelectorAll('.sensitivity-matrix-container tbody tr')];
        const revenueRow = rows.find(r => r.querySelector('td').textContent === 'الإيرادات');
        const baseMatrixCell = revenueRow.querySelectorAll('td')[3]; // العمود الثالث بعد التسمية = 0%

        expect(baseMatrixCell.textContent).toBe(baseCardValue);
    });
});

describe('SensitivityAnalysis — جدول مستويات التشغيل (90%/80%/70%)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    function operatingLevelTable() {
        const title = [...document.querySelectorAll('.card-title')].find(h => h.textContent.includes('مستويات التشغيل'));
        return title.closest('.card');
    }

    it('الصفوف الأربعة (100%/90%/80%/70%) تطابق ناتج المحرك تماماً بنفس الإشارة واللون، بلا تكرار حساب متضارب', () => {
        const study = fragileStudy();
        const view = new SensitivityAnalysis('c', fakeStore(study));
        view.render();

        const table = operatingLevelTable();
        const rows = [...table.querySelectorAll('tbody tr')];
        expect(rows).toHaveLength(4);

        const expected = [
            { level: '100% (أساسي)', npv: calculateStudy(study).indicators.npv },
            { level: '90%', npv: calculateStudy(study, { revenueChange: -0.10 }).indicators.npv },
            { level: '80%', npv: calculateStudy(study, { revenueChange: -0.20 }).indicators.npv },
            { level: '70%', npv: calculateStudy(study, { revenueChange: -0.30 }).indicators.npv },
        ];

        rows.forEach((row, i) => {
            const cells = row.querySelectorAll('td');
            expect(cells[0].textContent).toBe(expected[i].level);
            expect(cells[1].textContent).toBe(view.formatCurrency(expected[i].npv));
            // الإصلاح الحرج: العمود يجب أن يعكس إشارة نفس الرقم المعروض بالضبط (لا نداءً منفصلاً
            // قد يُعيد نتيجة أخرى، ولا تصنيفاً أخضر زائفاً حين يفشل الحساب).
            expect(cells[1].className).toBe(expectedClass(expected[i].npv));
        });

        // 80% و70% سالبتان في هذه الدراسة الهامشية — يجب أن تظهرا فعلاً باللون الأحمر
        expect(expected[2].npv).toBeLessThan(0);
        expect(expected[3].npv).toBeLessThan(0);
        expect(rows[2].querySelector('td:nth-child(2)').className).toBe('text-danger');
        expect(rows[3].querySelector('td:nth-child(2)').className).toBe('text-danger');
    });
});

describe('SensitivityAnalysis — formatCurrency: يميّز الصفر الحقيقي عن غياب القيمة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يُنسِّق الصفر الحقيقي كقيمة مالية، لا "--" (0 ليس غياب بيانات)', () => {
        const view = new SensitivityAnalysis('c', fakeStore(healthyStudy()));
        expect(view.formatCurrency(0)).not.toBe('--');
        expect(view.formatCurrency(0)).toContain((0).toLocaleString('ar-SA'));
    });

    it('null/undefined/NaN كلها تُعرض "--" (غياب بيانات محايد لا صفر مفبرك)', () => {
        const view = new SensitivityAnalysis('c', fakeStore(healthyStudy()));
        expect(view.formatCurrency(null)).toBe('--');
        expect(view.formatCurrency(undefined)).toBe('--');
        expect(view.formatCurrency(NaN)).toBe('--');
    });

    it('يُنسِّق قيماً سالبة وموجبة كبيرة دون رمي خطأ', () => {
        const view = new SensitivityAnalysis('c', fakeStore(healthyStudy()));
        expect(() => view.formatCurrency(-4250000)).not.toThrow();
        expect(view.formatCurrency(-4250000)).toContain((4250000).toLocaleString('ar-SA'));
    });
});

describe('SensitivityAnalysis — خطأ حساب النموذج الأساسي', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('دراسة فارغة تماماً (state=null): لا رمي خطأ للأعلى، ولا انهيار في jsdom', () => {
        const view = new SensitivityAnalysis('c', fakeStore(null));
        expect(() => view.render()).not.toThrow();
    });
});
